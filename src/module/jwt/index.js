const debug = require('debug')('app:lib:jwt')

const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')

const Module = function (options) {
  options = options || {}

  /**
   *
   */
  const certsPath = options.certsPath || path.join(__dirname, './certs')
  delete options.certsPath

  const privateKey = fs.readFileSync(path.join(certsPath, 'private.key'))
  const publicKey = fs.readFileSync(path.join(certsPath, 'public.pem'))

  /**
   *
   */
  let JWT = this

  /**
   *
   */
  JWT.options = Object.assign({
    algorithm: 'RS256',
    keyid: '1',
    noTimestamp: false,
    expiresIn: '3600s'
  }, options)

  /**
   *
   */
  JWT.sign = function (payload, options) {
    options = Object.assign({}, this.options, options || {})
    debug('[sign] payload: %o\n[sign] options: %o', payload, options)

    return jwt.sign(payload, privateKey, options)
  }

  /**
   *
   */
  JWT.refresh = function (token, options) {
    options = Object.assign({}, this.options, options || {})
    //debug('[refresh] token: %o\n[refresh] options: %o', token.substr(0, 32) + '...', options)

    // at this point we know token is valid but expired
    let payload = {}
    try {
      payload = jwt.verify(token, publicKey)
    } catch (err) {
      payload = JWT.decode(token)
    }

    payload = payload.payload;

    // remove what we dont want
    delete payload.iat
    delete payload.exp
    delete payload.nbf
    delete payload.jti

    return jwt.sign(payload, privateKey, Object.assign({}, this.options, {
      jwtid: options.jwtid || '1'
    }))
  }

  /**
   *
   */
  JWT.verify = function (token, options) {
    options = options || {
      verify: {}
    }
    return jwt.verify(token, publicKey, options.verify)
  }

  /**
   *
   */
  JWT.decode = jwt.decode

  return JWT
}

module.exports = Module
