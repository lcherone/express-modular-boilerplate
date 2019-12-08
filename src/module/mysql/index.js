const debug = require('debug')('app:module:mysql')

/**
 *
 */
module.exports = () => {
    return {
        orm: require('./orm')

    }
}
