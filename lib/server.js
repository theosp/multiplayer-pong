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

app.get("/get_remote_control_qr_code/");

var http_server = app.listen(nconf.get("port"));

// socket.io
io = io.listen(http_server);

var fields = [],
    controllers = {};
io.of("/agent")
    .on('connection', function (socket) {
        socket.on('new_field', function () {
            var self = this;

            var field_id = fields.push(socket) - 1;
            controllers[field_id] = [];
            socket.set("field_id", field_id);
            socket.set("status", "open");

            io.log.debug("new_field: " + field_id);

            socket.emit("field_registered", field_id);

            socket.on("disconnect", function () {
                io.log.debug("field disconnected: " + field_id);

                io.log.debug("field deleted: " + field_id);
                delete fields[field_id];

                var i;
                for (i = 0; i < controllers[field_id].length; i++) {
                    var field_controller = controllers[field_id][i];
                
                    if (typeof field_controller !== 'undefined') {
                        field_controller.emit("error", {error: "Field disconnected", code: "field_disconnected"});
                        field_controller.disconnect();
                    }
                }

                io.log.debug("field controllers disconnected and removed: " + field_id);
                delete controllers[field_id];
            });
        });

        socket.on('start_game', function (field_id) {
            var self = this;

        });

        socket.on('new_controller', function (field_id) {
            var self = this;

            var field_socket = fields[field_id];
            if (typeof field_socket === 'undefined') {
                socket.emit("error", {error: "field does not exist", code: "field_not_exists"});
                socket.disconnect();

                return;
            }

            field_socket.get("status", function (err, status) {
                if (status !== "open") {
                    socket.emit("error", {error: "Field closed for registration", code: "field_closed_for_registration"});
                    socket.disconnect();

                    return;
                }

                var controller_id = controllers[field_id].push(socket) - 1;

                io.log.debug("new_controller registered on field: " + field_id + "; controller_id: " + controller_id);

                socket.emit("controller_registered");
                field_socket.emit("controller_connected");

                socket.on("disconnect", function () {
                    io.log.debug("controller disconnected and removed: " + controller_id);

                    field_socket.emit("controller_disconnected");

                    delete controllers[field_id][controller_id];
                });
            });
        });
    });
