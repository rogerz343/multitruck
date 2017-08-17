let path = require("path");
let express = require("express");
let app = express();
let http = require("http").Server(app);
let io = require("socket.io")(http);
let fs = require("fs");

const PORT = 8000;
const ROOT_DIR = path.resolve(__dirname);

app.use("/", express.static(ROOT_DIR));
app.get('/', (req, res) => {
    res.sendFile(__dirname + "/index.html");
})

http.listen(PORT, () => {
    console.log("starting server on *: " + PORT)
});

io.on("connection", (socket) => {
    console.log("+ connection @ " + socket.request.connection.remoteAddress);

    socket.on("blah", () => {

    });
})