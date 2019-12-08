/*
 ** Package
 */
const package = require('./package.json')
const debug = require("debug")("app:routes:" + package.name)

/*
 ** Express Router
 */
const router = require('express').Router()

/*
 ** Export function
 */
module.exports = app => {

  /**
   * Model(s)
   *  - It gets set into `app.modal.auth` etc
   */
  const models = {
    //auth: require('./models/auth')(app)
  }

  /**
   * Controller(s)
   */
  const controllers = {
    index: require('./controllers/index')(app)
  }

  /**
   * Route(s)
   */
  router.get('/', (...args) => controllers.index.get(...args))

  return {
    package,
    models,
    controllers,
    router
  }
}
