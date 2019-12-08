/**
 *
 */
const path = require('path')
const bcrypt = require('bcryptjs')

/**
 *
 */
module.exports = app => {

    /**
     *
     */
    const database = app.get('database')
    const jwt = require('@module/jwt')()

    let model = {}

    /**
     *
     */
    model.createUser = async function (data) {
        let row = new database.row('user', data || {})

        row.password = bcrypt.hashSync(row.password || '', bcrypt.genSaltSync(10))
        row.createdDate = new Date()

        return user
    }

    /**
     *
     */
    model.authenticate = async function (email, password) {

        let user = await database.findOne('user', 'email = ?', [
            email
        ])

        if (user.id) {
            //
            if (!bcrypt.compareSync(password, user.password)) {
                return {
                    error: 'Invalid username or password'
                }
            }
            return {
                token: jwt.sign({
                    id: user.id
                })
            }
        }
        return {
            error: 'Invalid username or password'
        }
    }

    /**
     *
     */
    model.fromToken = async function (req) {
        // sanity check token is set
        if (!req.headers.authorization || (req.headers.authorization && req.headers.authorization.charAt(6) !== ' ')) {
            return false
        }

        let parts = req.headers.authorization.split(' ')

        if (parts.length !== 2 || !parts[1]) {
            return false
        }

        try {
            let decoded = jwt.verify(parts[1])

            return await database.load('user', decoded.id)
        } catch (e) {
            return {
                error: {
                    name: e.name,
                    massage: e.massage
                }
            }
        }
    }

    return model
}
