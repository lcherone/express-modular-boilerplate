const debug = require('debug')('app:module:utils')

const fs = require('fs')
const path = require("path")

/**
 *
 */
module.exports = () => {
  return {
    /**
     *
     * @param {*} dirPath
     */
    mkdir(dirPath) {
      dirPath.split(path.sep).reduce((prevPath, folder) => {
        const currentPath = path.join(prevPath, folder, path.sep)
        if (!fs.existsSync(currentPath)) {
          fs.mkdirSync(currentPath)
        }
        return currentPath
      }, '')
    },
    /**
     *
     * @param {*} filePath
     * @param {*} data
     */
    async file_put_contents(filePath, data) {
      mkdir(path.dirname(filePath))

      return await fs.writeFile(filePath, data, "binary", function (err) {
        if (err) {
          throw new Error(err)
        }
        return Promise.resolve()
      });
    }
  }
}
