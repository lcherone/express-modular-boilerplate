const debug = require("debug")("app:module:socket.io");

// libs
//const jwt = require('../lib/jwt');

class Server {
  /**
   *
   */
  constructor(app) {
    // app is instance of express
    this.app = app.express;

    // socket.io
    this.http = require("http").Server(this.app);
    this.io = require("socket.io")(this.http, { serveClient: false });
    this.app.set("io", this.io);

    // socket clients
    this.clients = {};
    this.app.set("socket_clients", this.clients);

    // socket controller hooks
    this.socketHooks = [];
  }

  /**
   * Start server and listen
   *  - on['connection'] - verify passed jwt, load user into this.clients
   */
  listen() {
    //
    this.http.listen(...arguments);

    // set into clients and authenticate if token is set and is 123 (@todo)
    this.io.use((socket, next) => {
      // set into clients
      this.clients[socket.id] = {
        id: socket.id,
        authenticated: false,
        meta: {}
      };
      if (socket.handshake.query && socket.handshake.query.token) {
        if (socket.handshake.query.token === "123") {
          this.clients[socket.id].authenticated = true;
        }
      }
      this.app.set("socket_clients", this.clients);
      next();
    });

    this.io.on("connection", async socket => {
      debug("Client connected: " + socket.id, socket.handshake);
      try {
        //let client = {};
        // check websocket mode (guest or authenticated)
        //if (socket.handshake.query.jwt && socket.handshake.query.jwt !== 'guest') {
        // verify jwt
        //user = jwt.verify(socket.handshake.query.jwt)

        // decode id and load user data
        //let id = this.hashids.decode(user.id)
        //            if (id.length === 0) {
        //              throw Error('Invalid user id in JWT')
        //            }
        //
        //            let data = await this.model.user.findOne('id = ?', [id[0]])
        //            if (!data) {
        //              throw Error('User not found')
        //            }

        // update socket id in user table
        //data.socket_id = socket.id;
        //data.store();

        // set user data
        //user.data = data
        //user.socket = socket

        //debug('io: user connected: ' + socket.id + ' ('+ user.data.username +')')
        //} else {
        //            user.id = 0;
        //            user.data = {
        //              id: 0,
        //              usename: 'guest',
        //              socket_id: socket.id,
        //            };
        //            user.socket = socket
        //}

        // call events method
        this.events(socket);
      } catch (err) {
        debug(err.name);
        // issue new token
        if (err.name === "TokenExpiredError") {
          //let token = jwt.decode(socket.handshake.query.jwt)
          //delete token.payload.iat
          //delete token.payload.nbf
          //delete token.payload.exp
          //return socket.emit('refresh_token', {
          //  token: jwt.sign(Object.assign({}, {}, token.payload))
          //})
        }
        return err;
      }
    });

    return this.io;
  }

  /**
   * Socket events called on successfull connection
   *
   * @param {*} socket
   */
  events(socket) {
    //
    debug("Attaching controller sockets");
    this.socketHooks.forEach(socketHook => {
      socketHook(socket, this.io, this.clients);
    });

    // broadcast to connected client
    socket.broadcast.emit("client:connected", {
      id: this.clients[socket.id].id
    });

    // disconnected
    socket.on("disconnect", () => {
      debug("Client disconnected: " + socket.id);

      this.io.emit("client:disconnected", {
        id: this.clients[socket.id].id
      });

      delete this.clients[socket.id];
    });
  }
}

module.exports = app => {
  return new Server(app);
};
