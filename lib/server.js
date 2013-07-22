var io = require('socket.io'),
    path = require('path'),
    nconf = require('nconf'),
    express = require('express');

// load config from argv/environment variables/config.json
nconf.argv()
     .env()
     .file({file: path.resolve(__dirname, '../config/config.json')});

// express app
var app = express();

app.use("/remote_control", express.static(path.resolve(__dirname, '../static/remote_control')));
app.use("/field", express.static(path.resolve(__dirname, '../static/javascript-pong')));

var http_server = app.listen(nconf.get("port"));

// socket.io
io = io.listen(http_server);

var fields_count = 0,
    fields = [];
io.of("/agent")
    .on('connection', function (socket) {
        socket.on('new_field', function (name) {
            fileds.push(socket);

            self.emit({field_id: fields_count++});
        });
    });
