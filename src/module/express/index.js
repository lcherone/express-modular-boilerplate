const debug = require("debug")("app:module:express")

const path = require("path")
const express = require("express")
const bodyParser = require("body-parser")
const compression = require("compression")
const fileUpload = require("express-fileupload")

const app = express()

/**
 *
 */
module.exports = options => {
  /**
   * Options
   */
  this.options = Object.assign({
    basePath: path.join(__dirname, '../', '../', '../', 'src'),
    publicPath: path.join(__dirname, '../', '../', '../', 'src', 'public'),
    apiPath: '/',
    apiVersion: '',
    bodyParser: {
      extended: true,
      limit: "20MB",
      parameterLimit: 1000
    },
    noCache: false
  }, options)

  app.set('basePath', this.options.basePath)
  app.set('publicPath', this.options.publicPath)

  /**
   * Package
   */
  this.package = require(path.join(this.options.basePath, '../', 'package.json'))
  app.set('package', this.package)

  debug('Starting: ' + this.package.name + ' [v' + this.package.version + ']')

  /**
   * Add routes
   *
   * {array} routes
   */
  this.addRoutes = (routes = []) => {
    if (!Array.isArray(routes)) throw Error('Invalid argument type, expecting array')

    const apiPath = path.join(this.options.apiPath, '/', this.options.apiVersion)
    const routesPath = path.join(this.options.basePath, 'routes')
    debug('API %s', apiPath)

    /**
     * Initial static route
     */
    debug('Dist folder [GET /]: ' + this.options.publicPath)
    app.use('/', express.static(this.options.publicPath))

    /**
     * API routes
     */
    routes.forEach(item => {
      if (typeof item !== "string") throw Error('Invalid route, expecting string')

      let route

      // its a module
      if (this.package.dependencies['@routes/' + item]) {
        debug('Loading API module router [%s]: %s', item, '@routes/' + item)
        route = require('@routes/' + item)(app)
      } else {
        // presume its local
        debug('Loading API local router [%s]: %s', item, path.join(routesPath, item + '.js'))
        route = require(path.join(routesPath, item))(app)
      }

      // add controller package
      if (route.package && route.package.name) {
        if(!app.package) app.package = {}
        app.package[route.package.name] = route.package
      }

      // add controller models
      if (route.models) {
        app.model = Object.assign({}, app.model, route.models)
      }

      // add controller socket hooks
      if (this.socket && route.controller && route.controller.socket) {
        debug(' - adding socket')
        this.socket.socketHooks.push(route.controller.socket)
      }

      // add controller socket hooks
      if (this.socket && route.controllers) {
        for (let i in route.controllers) {
          // add controller socket hooks
          if (route.controllers[i].socket) {
            debug(' - adding socket')
            this.socket.socketHooks.push(route.controllers[i].socket)
          }
        }
      }

      // add route
      app.use(apiPath, route.router)
    })

    /**
     * SPA history api fallback to index.html
     */
    if (this.options.spaFallback) {
      app.use('/', ((...args) => (req, res, next) => {
        if ((req.method === 'GET' || req.method === 'HEAD') && req.accepts('html')) {
          (res.sendFile || res.sendfile).call(res, ...args, err => err && next())
        } else next()
      })('index.html', {
        root: this.options.publicPath
      }))
    }

    /**
     * No Cache
     */
    if (this.options.noCache) {
      app.use(function (req, res, next) {
        res.set({
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Expires': '-1',
          'Pragma': 'no-cache'
        })
        next()
      })
    }
  }

  /**
   * Listen method
   */
  this.listen = function () {
    if (this.socket) {
      debug("Using http.listen via socket.io")
      this.socket.listen(...arguments)
    } else {
      debug("Using app.listen via express")
      app.listen(...arguments)
    }
  }

  /**
   * Static routes
   */
  app.use("/", express.static(this.options.publicPath))

  /**
   * Views and view engine
   */
  app.set("views", this.options.basePath)
  app.set("view engine", "ejs")
  app.set("view cache", true)

  /**
   * Middleware
   */
  app.use(compression())
  app.use(fileUpload())

  /*
   ** Config
   */
  debug("Environment:", process.env.NODE_ENV || "development")
  app.set("env", process.env.NODE_ENV || "development")

  if (process.env.NODE_ENV === "development") {
    app.set("json spaces", 2)
  }

  //
  app.use(bodyParser.json(this.options.bodyParser))
  app.use(bodyParser.urlencoded(this.options.bodyParser))

  return {
    express: app,
    options: this.options,
    addRoutes: this.addRoutes,
    listen: this.listen
  }
}
