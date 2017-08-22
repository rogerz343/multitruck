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

/* Program Starts Here */

/**
 * We don't actually store truck entities in the Player class to minimize the
 * (redundant) data we send over a network.
 * Note: apparently you can't send entire entities over network because it
 * causes a stack overflow (?)
 */
class Player {
    constructor(playerId, position, orientation, health) {
        this.id = playerId;
        this.pos = position;
        this.orientation = orientation;
        this.health = health;
    }
}

/**
 * Current server model:
 * Every tick, the server requests data from every client.
 * A separate tick sends data back to clients.
 */

let PLAYERS_IN_SERVER = {};

io.on("connection", (socket) => {
    console.log("+ connection @ " + socket.request.connection.remoteAddress);

    socket.on("playerConnect", (userId, position, orientation, health) => {
        let newPlayer = new Player(userId, position, orientation, health);
        PLAYERS_IN_SERVER[userId] = newPlayer;
        console.log(PLAYERS_IN_SERVER);
    });

    // TODO: fix disconnecting
    // socket.on("disconnect", () => {
    //     console.log("- disconnection @ ???");
    //     delete PLAYERS_IN_SERVER[userId];
    // });

    socket.on("serverReceivesClientData", (userId, position, orientation, health) => {
        let player = PLAYERS_IN_SERVER[userId];
        player["pos"] = position;
        player["orientation"] = orientation;
    });

    function serverRequestDataTick() {
        socket.emit("serverRequestsClientData");
        setTimeout(serverRequestDataTick, 16.6);
    }
    serverRequestDataTick();
    
    function serverGlobalEmitData() {
        socket.emit("serverEmitsData", PLAYERS_IN_SERVER);
        setTimeout(serverGlobalEmitData, 16.6);
    }
    serverGlobalEmitData();
});