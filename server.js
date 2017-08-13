let express = require("express");;
let app = express();
let http = require("http").Server(app);
let io = require("socket.io")(http);

let fs = require("fs");

app.use("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
})

io.on("connection", (socket) => {
    console.log("+ connection @ " + socket.request.connection.remoteAddress);

    socket.on("blah", () => {

    });
})