var io = require('socket.io'),
    path = require('path'),
    nconf = require('nconf'),
    fs = require('fs'),
    express = require('express');

// load config from argv/environment variables/config.json
nconf.argv()
     .env()
     .file({file: path.resolve(__dirname, '../config/config.json')});

// express app
var app = express();

app.get("/config.js", function (req, res) {
    fs.readFile(path.resolve(__dirname, '../config/config.json'), function (err, data) {
        if (err) throw err;

        data = JSON.parse(data);
        // for security measures, set the params from config.json explicitly.
        data = {
            domain: data.domain,
        };

        res.header("Content-Type", "text/javascript");
        res.send("CONFIG = " + JSON.stringify(data) + ";");
    });
});

app.use("/remote_control", express.static(path.resolve(__dirname, '../static/remote_control')));
app.use("/field", express.static(path.resolve(__dirname, '../static/javascript-pong')));

// /(remote_control|field) -> /$1/ (add trailing slash, keep get params)
app.get(/\/(remote_control|field)$/, function (req, res) {
    res.redirect(303, req.path + '/' + req.originalUrl.replace(/[^?]*/, ""));
})

app.get("/get_remote_control_qr_code/");

var http_server = app.listen(nconf.get("port"));

// socket.io
io = io.listen(http_server);

var fields = [],
    controllers = {};

var for_each_controller = function (field_id, cb) {
        if (typeof controllers[field_id] !== 'undefined') {
            var i;
            for (i = 0; i < controllers[field_id].length; i++) {
                var field_controller = controllers[field_id][i];
            
                if (typeof field_controller !== 'undefined') {
                    cb(field_controller);
                }
            }
        }
    },
    broadcast_to_controllers = function (field_id, event, event_args) {
        for_each_controller(field_id, function (field_controller) {
            field_controller.emit(event, event_args);
        });
    };
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

                broadcast_to_controllers(field_id, "error", {error: "Field disconnected", code: "field_disconnected"});
                for_each_controller(field_id, function (field_controller) {
                    field_controller.disconnect();
                });

                io.log.debug("field's controllers disconnected and removed: " + field_id);
                delete controllers[field_id];
            });
        });

        socket.on('start', function (type) {
            var self = this;

            if (type !== 1 && type !== 2) {
                type = 1;
            }

            socket.set("game_type", type);

            socket.get("field_id", function (err, field_id) {
                var i = 0;
                for_each_controller(field_id, function (field_controller) {
                    field_controller.emit("start", i++ % type);
                });
            });

            socket.set("status", "closed");
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

                    if (typeof controllers[field_id] === 'object') {
                        delete controllers[field_id][controller_id];
                    }
                });
            });
        });

        socket.on('position', function (field_id, side, position) {
            var field_socket = fields[field_id];
            if (typeof field_socket === 'undefined') {
                socket.emit("error", {error: "field does not exist", code: "field_not_exists"});
                socket.disconnect();

                return;
            }

            field_socket.emit("position", side, position);
        });
    });
