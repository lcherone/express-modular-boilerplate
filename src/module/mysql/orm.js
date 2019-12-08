/* eslint new-cap: ["error", { "newIsCap": false }] */

const debug = require('debug')('app:module:mysql:orm')
const mysql = require('mysql')
const exec = require('child_process').exec

module.exports = function (options, activePool) {
  options = Object.assign({}, {
    host: '127.0.0.1',
    user: '',
    password: '',
    database: '',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    freeze: false,
    underscore: true
  }, options)

  options.multipleStatements = true

  let pool
  let schema = {}
  let tablesRefreshed = false
  const _id = options.underscore ? '_id' : 'Id'

  const Database = this

  /**
   * Dump
   * - Presumes you have mysqldump installed and available in $PATH
   * - Wont protect from command injection shenanigans
   */
  Database.dump = function (destination = 'database-export.sql') {
    return new Promise((resolve, reject) => {
      exec(
        `mysqldump --add-drop-table --user=${options.user} --password=${options.password} --host=${options.host} ${options.database} > ${destination} &`, {
        maxBuffer: 1024 * 1024
      }, function (error, stdout, stderr) {
        return (error !== null) ? reject(stderr) : resolve(stdout)
      })
    })
  }

  /**
   * Import
   * - Presumes you have mysqldump installed and available in $PATH
   * - Wont protect from command injection shenanigans
   */
  Database.import = function (infile = 'database-export.sql') {
    return new Promise((resolve, reject) => {
      exec(
        `cat ${infile} | mysql --host=${options.host} --user=${options.user} --password=${options.password} ${options.database}`, {
        maxBuffer: 1024 * 1024
      }, function (error, stdout, stderr) {
        return (error !== null) ? reject(stderr) : resolve(stdout)
      })
    })
  }

  /**
   * Row
   */
  Database.row = function (table, data) {
    let row = this
    if (data !== undefined) row = Object.assign(row, data)
    Object.defineProperty(row, 'table', {
      writable: true
    })
    row.table = table
  }

  /**
   * Store
   */
  Database.row.prototype.store = function () {
    let row = this
    return new Promise((resolve, reject) => {
      if (!Database.isValidRow(row)) {
        return reject(new Error('Err: invalid row'))
      }
      createTable(row).then(() => {
        return createColumns(row)
      }).then(() => {
        row.mutateValues()
        const sql = getInsertSql(row)
        const values = Object.keys(row).map(key => row[key])
        return Database.query(sql, values.concat(values))
      }).then(results => {
        if (results.insertId !== 0) {
          row.id = results.insertId
        }
        resolve(new Database.row(row.table, toObject(row)))
      })
    })
  }

  /**
   * Merge in values from obj into row
   * - Used to merge in updated values before store
   */
  Database.row.prototype.merge = function (obj) {
    let row = this

    if (!Database.isValidRow(row)) {
      throw new Error('Err: invalid row')
    }

    for (let key in toObject(obj)) {
      if (key !== 'table' && row.hasOwnProperty(key)) {
        row[key] = obj[key]
      }
    }

    return new Database.row(row.table, toObject(row))
  }

  /**
   * Delete
   */
  Database.row.prototype.delete = function () {
    let row = this
    return new Promise((resolve, reject) => {
      if (!Database.isValidRow(row)) throw new Error('Err: this is not a valid row!')
      const sql = 'DELETE FROM `' + row.table + '` WHERE id = ?'
      Database.query(sql, [row.id]).then(results => {
        resolve(true)
      })
    })
  }

  /**
   * Parent methods
   */
  Database.row.prototype.getParent = function (table) {
    let row = this
    return new Promise((resolve, reject) => {
      Database.load(table, row[table + _id]).then(parent => {
        resolve(parent)
      }, err => reject(err))
    })
  }

  Database.row.prototype.attachParent = function (table) {
    let row = this
    return new Promise((resolve, reject) => {
      row.getParent(table).then(parent => {
        row[table] = parent
        resolve()
      }, err => reject(err))
    })
  }

  Database.row.prototype.setParent = function (parent) {
    let row = this
    return new Promise((resolve, reject) => {
      parent.store().then(parent => {
        row[parent.table + _id] = parent.id
        row.store().then(child => {
          resolve(child)
        })
      })
    })
  }

  /**
   * Child methods
   */
  Database.row.prototype.getChildren = function (table, restSql, more) {
    let row = this
    return new Promise((resolve, reject) => {
      Database.find(table, row.table + _id + ' = ? ' + (restSql || ''), [row.id], more).then(children => {
        resolve(children)
      })
    })
  }

  Database.row.prototype.getChild = function (table) {
    let row = this
    return new Promise((resolve, reject) => {
      Database.findOne(table, row.table + _id + ' = ?', row.id).then(child => {
        resolve(child)
      })
    })
  }

  Database.row.prototype.attachChildren = function (table) {
    let row = this
    return new Promise((resolve, reject) => {
      row.getChildren(table).then(children => {
        row[table] = children
        resolve()
      })
    })
  }

  Database.row.prototype.attachChild = function (table) {
    let row = this
    return new Promise((resolve, reject) => {
      row.getChild(table).then(child => {
        row[table] = child
        resolve()
      })
    })
  }

  Database.row.prototype.addChildren = function (table, array) {
    let row = this
    return new Promise((resolve, reject) => {
      for (let i = 0; i < array.length; i++) {
        array[i][row.table + _id] = row.id
      }
      Database.storeRows(table, array).then(results => {
        resolve(results)
      })
    })
  }

  Database.row.prototype.getLists = function (table) {
    let row = this
    return new Promise((resolve, reject) => {
      const linkTable = getlinkTable(row.table, table)
      if (tableExists(linkTable)) {
        const sql = `` +
          `SELECT c.* \n` +
          `FROM \`${linkTable}\` as ut, \`${table}\` as c\n` +
          `WHERE ut.\`${row.table}${_id}\` = ? AND ut.\`${table}${_id}\` = c.id`
        Database.query(sql, row.id).then(lists => {
          resolve(Database.arrayToRows(table, lists))
        })
      } else {
        debug('Database: link table %s does not exist', linkTable)
        resolve([])
      }
    })
  }

  Database.row.prototype.attachLists = function (table) {
    let row = this
    return new Promise((resolve, reject) => {
      row.getLists(table).then(lists => {
        row[table] = lists
        resolve()
      })
    })
  }

  Database.row.prototype.setLists = function (table, array) {
    let row = this
    return new Promise((resolve, reject) => {
      Database.storeRows(table, array).then(lists => {
        const linkTable = getlinkTable(table, row.table)
        let links = []
        for (let i = 0; i < lists.length; i++) {
          let link = {}
          link[row.table + _id] = row.id
          link[table + _id] = lists[i].id
          links.push(link)
        }
        links = Database.arrayToRows(linkTable, links)
        if (tableExists(linkTable)) {
          Database.delete(linkTable, '`' + row.table + _id + '` = ?', row.id).then(() => {
            Database.storeRows(linkTable, links).then(() => {
              resolve(lists)
            })
          })
        } else {
          Database.storeRows(linkTable, links).then(() => {
            resolve(lists)
          })
        }
      })
    })
  }

  Database.row.prototype.addLists = function (table, array) {
    let row = this
    return new Promise((resolve, reject) => {
      Database.storeRows(table, array).then(lists => {
        const linkTable = getlinkTable(table, row.table)
        let links = []
        for (let i = 0; i < lists.length; i++) {
          let link = {}
          link[row.table + _id] = row.id
          link[table + _id] = lists[i].id
          links.push(link)
        }
        Database.storeRows(linkTable, links).then(() => {
          resolve(lists)
        })
      })
    })
  }

  Database.row.prototype.addList = function (list) {
    let row = this
    return new Promise((resolve, reject) => {
      list.store().then(() => {
        const linkTable = getlinkTable(list.table, row.table)
        let link = new Database.row(linkTable)
        link[row.table + _id] = row.id
        link[list.table + _id] = list.id
        link.store().then(() => {
          resolve(list)
        })
      })
    })
  }

  Database.row.prototype.removeList = function (list) {
    let row = this
    return new Promise((resolve, reject) => {
      const linkTable = getlinkTable(row.table, list.table)
      const condition = '`' + row.table + _id + '` = ? AND `' + list.table + _id + '` = ?'
      Database.delete(linkTable, condition, [row.id, list.id]).then(() => {
        resolve(true)
      })
    })
  }

  Database.row.prototype.mutateValues = function () {
    for (let colName in this) {
      if (this.hasOwnProperty(colName)) {
        this[colName] = mutateValue(this[colName])
      }
    }
  }

  Database.storeAll = function (rows) {
    return new Promise((resolve, reject) => {
      let results = []

      function step(i) {
        if (i < rows.length) {
          rows[i].store().then(function () {
            results.push(rows[i])
            step(i + 1)
          })
        } else {
          resolve(results)
        }
      }
      step(0)
    })
  }

  Database.storeRows = function (table, array) {
    return new Promise((resolve, reject) => {
      let results = []
      let rowInstance = new Database.row(table, {})
      for (let i = 0; i < array.length; i++) {
        rowInstance = Object.assign(rowInstance, array[i])
      }
      createTable(rowInstance).then(() => {
        createColumns(rowInstance).then(() => {
          let sql = []
          let values = []
          for (let i = 0; i < array.length; i++) {
            let row = new Database.row(table, array[i])
            results.push(row)
            sql.push(getInsertSql(row))
            row.mutateValues()
            let rowVals = Object.keys(row).map(key => row[key])
            values = values.concat(rowVals).concat(rowVals)
          }
          Database.query(sql.join(' '), values.concat(values)).then(rows => {
            if (!Array.isArray(rows)) {
              rows = [rows]
            }
            for (let i = 0; i < results.length; i++) {
              results[i].id = rows[i].insertId
            }
            resolve(Database.arrayToRows(table, results))
          }, err => {
            reject(err)
          })
        })
      })
    })
  }

  /**
   * Find/load methods
   */
  Database.load = function (table, id, more) {
    return new Promise((resolve, reject) => {
      if (id === undefined) throw new Error('An id must be given!')
      if (!Number.isInteger(id)) throw new Error('id must be an Integer!')
      Database.findOne(table, '`' + table + '`.`id` = ?', id, more).then(results => {
        resolve(Object.keys(results).length !== 0 && results.id ? new Database.row(table, toObject(results)) : {})
      })
    })
  }

  Database.find = function (table, restSql, vals, more) {
    return new Promise((resolve, reject) => {
      waitForSchema(() => {
        if (tableExists(table)) {
          const sql = getSelectSql(table, restSql, vals, more)
          Database.query(sql, vals).then(results => {
            if (results.length > 0) {
              let rows = Database.arrayToRows(table, results)
              attachJoins(rows, more).then(rows => {
                resolve(rows)
              })
            } else {
              resolve([])
            }
          })
        } else {
          resolve([])
        }
      })
    })
  }

  Database.findOne = function (table, restSql, vals, more) {
    return new Promise((resolve, reject) => {
      Database.find(table, restSql, vals, more).then(results => {
        if (results.length > 0) {
          resolve(new Database.row(table, toObject(results[0])))
        } else {
          resolve({})
        }
      }, err => reject(err))
    })
  }

  Database.findOrCreate = function (table, vals, more) {
    return new Promise((resolve, reject) => {
      waitForSchema(() => {
        if (tableExists(table)) {
          let keys = Object.keys(vals)
          let values = Object.values(vals)
          Database.findOne(table, '`' + keys.join('` = ? AND `') + `\` = ?`, values, more).then(results => {
            if (Object.keys(results).length !== 0) {
              resolve(results)
            } else {
              let row = new Database.row(table, vals)
              row.store().then(results => {
                resolve(results)
              })
            }
          })
        } else {
          resolve([])
        }
      })
    })
  }

  Database.count = function (table, restSql, vals) {
    return new Promise((resolve, reject) => {
      waitForSchema(() => {
        if (tableExists(table)) {
          Database.find(table, restSql, vals, {
            fields: ['COUNT(*)']
          }).then(results => {
            resolve(results[0]['COUNT(*)'])
          })
        } else {
          resolve(0)
        }
      })
    })
  }

  Database.delete = function (table, restSql, vals) {
    return new Promise((resolve, reject) => {
      Database.query('DELETE FROM `' + table + '` WHERE ' + restSql, vals).then(results => {
        resolve(results)
      })
    })
  }

  Database.query = function (sql, vals) {
    vals = giveValsCorrectLength(sql, vals)
    return new Promise((resolve, reject) => {
      if (typeof sql !== 'string') reject(new Error('Err: sql must be a String!'))
      if (!Array.isArray(vals) && typeof vals === 'object') reject(new Error('Err: vals must be an array or a simple variable!'))
      waitForSchema(() => {
        pool.getConnection((err, connection) => {
          if (err) return reject(err)
          debug('USE `' + options.database + '`')
          connection.query('USE `' + options.database + '`', err => {
            if (err) return reject(err)
            debug(sql, vals)
            connection.query(sql, vals, (err, results) => {
              connection.release()
              if (err) return reject(err)
              resolve(results)
            })
          })
        })
      })
    })
  }

  Database.exec = function (sql, vals) {
    return Database.query(sql, vals)
  }

  Database.getSchema = function () {
    return new Promise((resolve, reject) => {
      waitForSchema(() => {
        resolve(schema)
      })
    })
  }

  function joinRelation(rows, more, type) {
    return new Promise((resolve, reject) => {
      const attachFns = {
        parents: 'attachParent',
        children: 'attachChildren',
        child: 'attachChild',
        lists: 'attachLists'
      }
      if (more === undefined) {
        more = {}
      }
      if (typeof more[type] === 'string') {
        more[type] = [more[type]]
      }
      if (Array.isArray(more[type])) {
        dothen(rows, function (nextDatabase, row, index) {
          dothen(more[type], function (nextRelative, relativeName) {
            let attachFn = attachFns[type]
            rows[index][attachFn](relativeName).then(() => {
              nextRelative()
            })
          }, () => {
            nextDatabase()
          })
        }, () => {
          resolve(rows)
        })
      } else {
        resolve(rows)
      }
    })
  }

  function attachJoins(rows, more) {
    return new Promise((resolve, reject) => {
      joinRelation(rows, more, 'parents').then(rows => {
        joinRelation(rows, more, 'child').then(rows => {
          joinRelation(rows, more, 'children').then(rows => {
            joinRelation(rows, more, 'lists').then(rows => {
              resolve(rows)
            })
          })
        })
      })
    })
  }

  function toObject(object) {
    let results = {}
    for (let colName in object) {
      if (object.hasOwnProperty(colName)) {
        const isDate = /^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9])(?:( [0-2][0-9]):([0-5][0-9]):([0-5][0-9]))?$/gm
        if (typeof object[colName] === 'string' && isDate.test(object[colName])) {
          // looks like datetime
          try {
            if (object[colName] !== '0000-00-00 00:00:00') {
              object[colName] = new Date(object[colName])
            }
          } catch (e) { }
        } else if (typeof object[colName] === 'string' && (
          // looks like json
          `${object[colName]}`.startsWith('{') || `${object[colName]}`.startsWith('[')
        ) && (
            `${object[colName]}`.endsWith('}') || `${object[colName]}`.endsWith(']')
          )) {
          try {
            object[colName] = JSON.parse(object[colName])
          } catch (e) { }
        }
        results[colName] = object[colName]
      }
    }
    return results
  }

  Database.arrayToRows = function (table, array) {
    let results = []
    for (let i = 0; i < array.length; i++) {
      if (!Database.isValidRow(array[i])) {
        array[i] = new Database.row(table, toObject(array[i]))
      }
      results.push(array[i])
    }
    return results
  }

  function giveValsCorrectLength(sql, vals) {
    vals = vals || []
    const questionMarks = sql.match(/\?/g)
    const length = (questionMarks != null) ? questionMarks.length : 0
    for (let i = vals.length; i < length; i++) {
      vals[i] = ''
    }
    return vals
  }

  function getInsertSql(row) {
    const keysPart = '`' + Object.keys(row).join('` = ?, `') + '` = ?'
    return `` +
      `INSERT INTO \`${row.table}\`\n` +
      `SET ${keysPart}\n` +
      `ON DUPLICATE KEY\n` +
      `UPDATE ${keysPart};`
  }

  function getSelectSql(table, restSql, vals, more) {
    restSql = restSql || ' '

    let sql = 'SELECT '
    sql += (more === undefined || more.fields === undefined) ? '*' :
      (more.fields.length === 1 && more.fields[0] === 'COUNT(*)' ? 'COUNT(*)' : '`' + more.fields.join('`, `') + '`')

    sql += ' FROM `' + table + '`'

    const wheresBlock = getWheresBlock(restSql)
    if (/(=|>|<|LIKE|REGEXP|BETWEEN|IS|IN|LEAST|COALESCE|INTERVAL|GREATEST|STRCMP)/i.test(wheresBlock)) {
      sql += ' WHERE ' + restSql
    } else {
      sql += ' ' + restSql
    }

    return sql
  }

  function getWheresBlock(sql) {
    let wheresEnd = sql.length - 1
    const keyWords = ['order by', 'limit', 'group by', 'join']
    for (let i = 0; i < keyWords.length; i++) {
      const regex = new RegExp(keyWords[i], 'i')
      const match = regex.exec(sql)
      if (match && match.index < wheresEnd) {
        wheresEnd = match.index
      }
    }
    return sql.slice(0, wheresEnd)
  }

  Database.isValidRow = function (row) {
    return ((row !== undefined && Object.keys(row).length > 0) && row.table !== undefined && row instanceof Database.row)
  }

  function getlinkTable(t1, t2) {
    let array = [t1, t2]
    return array.sort().join('_')
  }

  function createTable(row) {
    return new Promise((resolve, reject) => {
      const sql = `
      SET NAMES utf8;
      SET time_zone = '+00:00';
      SET foreign_key_checks = 0;
      SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';
      SET NAMES utf8mb4;

      CREATE TABLE IF NOT EXISTS \`${row.table}\` (
        id INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      Database.query(sql).then(results => {
        if (results.affectedRows === 0) {
          tablesRefreshed = true
          resolve()
        }
        tablesRefreshed = false
        refreshTables().then(results => {
          schema = results
          tablesRefreshed = true
        })
        resolve()
      })
    })
  }

  function createColumn(row, colName) {
    row[colName] = mutateValue(row[colName])
    return new Promise((resolve, reject) => {
      whatActionToCol(row, colName).then(resSql => {
        if (!resSql) {
          resolve()
        } else {
          return Database.query(resSql)
        }
      }).then(execResponse => {
        tablesRefreshed = false
        resolve()
      })
    })
  }

  function createColumns(row) {
    return new Promise((resolve, reject) => {
      if (tablesRefreshed === true) {
        resolve()
      }
      const cols = Object.keys(row)
      return Promise.all(cols.map(colName => {
        return createColumn(row, colName)
      })).then(() => {
        return refreshTables()
      }).then(newSchema => {
        schema = newSchema
        tablesRefreshed = true
        resolve()
      })
    })
  }

  function getDataType(v) {
    switch (typeof v) {
      case 'number':
        if (String(v).indexOf('.') > -1) return 'DOUBLE'
        if (v > 2147483647) return 'BIGINT'
        return 'INT'
      case 'string':
        if (v.length <= 25) return 'VARCHAR(25)'
        if (v.length > 25 && v.length <= 50) return 'VARCHAR(50)'
        if (v.length > 50 && v.length <= 100) return 'VARCHAR(100)'
        if (v.length > 100 && v.length <= 191) return 'VARCHAR(191)'
        if (v.length > 191 && v.length <= 255) return 'VARCHAR(255)'
        return 'TEXT'
      case 'boolean':
        return 'BOOL'
      case 'object':
        if (v instanceof Date) return 'DATETIME'
        return 'TEXT'
      default:
        return 'TEXT'
    }
  }

  function mutateValue(v) {
    switch (typeof v) {
      case 'object':
        if (v instanceof Date) {
          v.setMilliseconds(0)
          return v
        }
        return JSON.stringify(v)
      case 'string':
        if (v === 'null') {
          return null
        }
        return v
      default:
        return v
    }
  }

  function dothen(array, fn, callback) {
    function step(i) {
      if (i < array.length) {
        fn(function () {
          step(i + 1)
        }, array[i], i, array)
      } else {
        callback()
      }
    }
    step(0)
  }

  function whatActionToCol(row, colName) {
    return new Promise((resolve, reject) => {
      getDBColumn(row.table, colName).then(dbColumn => {
        const datatype = getDataType(row[colName])
        let skip = true
        let results = 'ALTER TABLE `' + row.table + '`'
        const command = (dbColumn) ? ' MODIFY COLUMN ' : ' ADD '
        results += command + '`' + colName + '` ' + datatype + ' COLLATE \'utf8mb4_general_ci\' NULL '
        const newEntry = String(mutateValue(row[colName]))
        if (
          dbColumn === undefined ||
          (dbColumn.name === 'varchar' && datatype === 'TEXT') ||
          (dbColumn.name === 'varchar' && newEntry.length > dbColumn.length) ||
          (dbColumn.name === 'int' && datatype === 'DOUBLE')
        ) {
          skip = false
        }
        if (skip) results = false
        resolve(results)
      })
    })
  }

  function getDBColumn(tableName, colName) {
    return new Promise((resolve, reject) => {
      const table = schema[tableName]
      let results
      if (table && table.hasOwnProperty(colName)) {
        results = schema[tableName][colName]
        const typeRegex = /(\w+)(\((\d+)\))?/g.exec(results)
        results = {
          name: typeRegex[1],
          length: typeRegex[3]
        }
      }
      resolve(results)
    })
  }

  function tableExists(table) {
    return schema.hasOwnProperty(table)
  }

  function refreshTables() {
    return new Promise((resolve, reject) => {
      let resSchema = {}
      pool.getConnection((err, connection) => {
        if (err) return reject(err)
        const sql = `` +
          `SELECT TABLE_NAME,\n` +
          `       COLUMN_NAME,\n` +
          `       COLUMN_TYPE\n` +
          `FROM INFORMATION_SCHEMA.COLUMNS\n` +
          `WHERE TABLE_SCHEMA = ?`
        debug(sql)
        connection.query(sql, options.database, (err, results) => {
          connection.release()
          if (err) return reject(err)
          for (let i = 0; i < results.length; i++) {
            const tableName = results[i].TABLE_NAME
            const colName = results[i].COLUMN_NAME
            if (!resSchema.hasOwnProperty(tableName)) {
              resSchema[tableName] = {}
            }
            resSchema[tableName][colName] = results[i].COLUMN_TYPE
          }
          resolve(resSchema)
        })
      })
    })
  }

  function waitForSchema(fn) {
    if (!pool) {
      Database.connect().catch(err => {
        throw err
      })
    }
    if (tablesRefreshed) {
      fn()
    } else {
      setTimeout(() => {
        waitForSchema(fn)
      }, 5)
    }
  }

  Database.connect = function () {
    return new Promise((resolve, reject) => {
      if (options.database === undefined) reject(new Error('Err: A database must be given!'))

      const dbName = options.database
      delete options.database

      if (activePool) {
        pool = activePool
      } else {
        pool = mysql.createPool(options)
      }

      // pool.on('connection', connection => {
      //   debug('Database connection made')
      // })
      // pool.on('acquire', connection => {
      //   debug('Connection %d acquired', connection.threadId)
      // })
      // pool.on('enqueue', () => {
      //   debug('Waiting for available connection slot')
      // })
      // pool.on('release', connection => {
      //   debug('Connection %d released', connection.threadId)
      // })
      // pool.on('error', err => {
      //   throw err
      // })

      if (!options.freeze) {
        pool.getConnection((err, connection) => {
          if (err) return reject(err)
          let sql = `CREATE DATABASE IF NOT EXISTS \`${dbName}\`\n` +
            `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
          debug(sql)
          connection.query(sql, () => {
            options.database = dbName
            connection.release()
            resolve()
          })
        })
      } else {
        options.database = dbName
        resolve()
      }
    }).then(() => {
      return refreshTables()
    }).then(results => {
      schema = results
      tablesRefreshed = true
      return Promise.resolve()
    })
  }

  /**
   * Close Connection
   */
  Database.close = function () {
    !pool || pool.end()
  }
}
