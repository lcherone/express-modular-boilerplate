const encryption = require('@module/encryption')

/**
 * Sign-in Controller
 *
 * @module auth
 */
const Controller = function (app) {

    let Controller = {}

    /**
     * Socket.io events
     */
    Controller.socket = (socket, io, clients) => {
        //
        socket.on('auth:foo', (data, cb) => {
            console.log('test:foo', data)

            cb(clients)
        })
    }

    /**
     * [POST] /auth/sign-in
     *
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    Controller.post = async (req, res, next) => {

        try {
            res.json(await app.model.auth.authenticate(req.body.email, req.body.password))

            //
            /*
            user = await app.model.auth.createUser({
                email: 'admin@example.com',
                password: 'admin',
                password_require_change: 1
            })
            await user.store()
            */

        } catch (err) {
            return next(err)
        }
    }

    return Controller
}

module.exports = Controller
