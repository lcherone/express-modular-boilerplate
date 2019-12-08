const env = require('dotenv').config()
const debug = require("debug")("app:entrypoint")
const path = require("path")

//
if (env.error) throw env.error

//
try {
  // Express
  const app = require("@module/express")({
    basePath: __dirname,
    publicPath: path.join(__dirname, "public"),
    noCache: true
  })

  // Socket.io (not used yet)
  // app.socket = require("@module/socket.io")(app)

  /*
   ** Enable route controllers
   */
  app.addRoutes(["index", 'user'])

  /*
   ** Error handler
   */
  // app.express.use((err, req, res, next) => {
  //   //
  //   debug(err.stack)

  //   //
  //   res.status(500).json({
  //     name: err.name,
  //     message: err.message,
  //     fatal: err.fatal,
  //     errno: err.errno,
  //     code: err.code
  //   })
  // })

  /*
   ** Listen
   */
  app.listen(process.env.PORT || 8080, err => {
    if (err) throw err
    debug(`Server started: http://127.0.0.1:%d`, process.env.PORT || 8080)
  })
} catch (e) {
  debug(e)
}
