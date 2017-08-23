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
 * general projectile class
 * assumes symmetry (i.e. round bullets, not missiles)
 * Projectiles on client-side are only to show clients where they are. Actual collision
 * detection is done server-side.
 */
class Projectile {
    constructor(projectileId, position, velocity) {
        this.id = projectileId;
        this.initialPos = position;
        this.pos = position;
        this.vel = velocity;
    }

    entityTick() {
        let deltaPos = Cesium.Cartesian3.multiplyByScalar(this.vel, dt, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(this.pos, deltaPos, this.pos);
    }
}

/**
 * updates the location of every projectile and checks for collisions
 * runtime is O(n^2) for collision detection
 */
function updateProjectiles() {
    for (let projId in PROJECTILES) {
        let projectile = PROJECTILES[projId];
        projectile.entityTick();
        if (Cesium.Cartesian3.distance(projectile.pos, projectile.initialPos) > 1000) {
            delete PROJECTILES[projId];
        } else {
            for (let playerId in PLAYERS_IN_SERVER) {
                let player = PLAYERS_IN_SERVER[playerId];
                if (Cesium.Cartesian3.distance(projectile.pos, player.pos) < 0.5) {
                    player.health -= 10;
                    delete PROJECTILES[projId];
                    break;
                }
            }
        }
    }
}

/**
 * Current server model:
 * Every tick, the server requests data from every client.
 * A separate tick sends data back to clients.
 */

let PLAYERS_IN_SERVER = {};
let PROJECTILES = {};

let projectileCount = 0;

io.on("connection", (socket) => {
    console.log("+ connection @ " + socket.request.connection.remoteAddress);

    socket.on("playerConnect", (userId, position, orientation, health) => {
        let newPlayer = new Player(userId, position, orientation, health);
        PLAYERS_IN_SERVER[userId] = newPlayer;
    });

    // TODO: fix disconnecting
    // socket.on("disconnect", () => {
    //     console.log("- disconnection @ ???");
    //     delete PLAYERS_IN_SERVER[userId];
    // });

    socket.on("serverReceivesClientData", (userId, position, orientation) => {
        let player = PLAYERS_IN_SERVER[userId];
        if (player) {
            player["pos"] = position;
            player["orientation"] = orientation;
        }
    });

    socket.on("addNewProjectile", (pos, vel) => {
        PROJECTILES[projectileCount] = new Projectile(projectileCount, pos, vel);
        projectileCount++;
    });

    // function serverRequestDataTick() {
    //     socket.emit("serverRequestsClientData");
    //     setTimeout(serverRequestDataTick, 16.6);
    // }
    // serverRequestDataTick();
    
    function serverTick() {
        // update projectiles
        updateProjectiles();

        // emit data
        socket.emit("serverEmitsData", PLAYERS_IN_SERVER, PROJECTILES);
        setTimeout(serverTick, 16.6);
    }
    serverTick();
});