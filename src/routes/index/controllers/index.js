const encryption = require('@module/encryption')

/**
 * Controller
 */
module.exports = app => {
  return new class {
    constructor(app) {
      this.app = app
    }

    async socket(socket, io, clients) {
      socket.on("announce", (meta, cb) => {
        debug("announce", clients)

        cb(clients)
      })
    }

    foo() {
      return 'foo'
    }

    async get(req, res, next) {
      //
      try {

        res.render("routes/index/views/index", {
          foo: this.foo(),
          globals: {
            socket_clients: this.app.get("socket_clients"),
            token: encryption.hash("sha512", "123").toString('hex'),
            payment: {}
          }
        })
      } catch (err) {
        return next(err)
      }
    }
  }(app)
}
