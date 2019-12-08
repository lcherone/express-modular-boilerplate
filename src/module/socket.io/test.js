
const io = require("socket.io-client");

// connect to the socket server, which is the same port as express
const socket = io.connect("http://127.0.0.1:8080", {
    query: {
      token: '123'
    }
});

socket.on('error', (err) => {
    console.log(err)
    socket.disconnect()
})

// on connection, announce to the server
socket.on('connect', function () {
    console.log('Connected:', socket.id);

    //
    console.log('Announcing:');
    socket.emit('announce', {}, (ack) => {

        console.log('Server acknowledged');

        console.log('Got clients:', ack);
    });
});
