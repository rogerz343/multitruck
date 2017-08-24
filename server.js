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

const PROJECTILE_SPEED = 30;
let Cesium = require("cesium");


/**
 * Class that describes a user's id, position, orientation, and health.
 * Actual entities for the players are rendered/stored only on the client.
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
 * Class that describes a projectile in the world.
 * Actual entities for the projectiles are rendered/stored on the client, but
 * collision detection is done only on the server.
 */
class Projectile {
    constructor(projectileId, position, velocity, damage) {
        this.id = projectileId;
        this.initialPos = position;
        this.pos = position;
        this.vel = velocity;
        this.damage = damage;
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
            console.log("remove because too far");
            PROJECTILES_TO_REMOVE.push(projId);
            delete PROJECTILES[projId];
        } else {
            for (let playerId in PLAYERS_IN_SERVER) {
                let player = PLAYERS_IN_SERVER[playerId];
                if (Cesium.Cartesian3.distance(projectile.pos, player.pos) <= 3) {
                    player.health -= projectile.damage;
                    PROJECTILES_TO_REMOVE.push(projId);
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

let PLAYERS_IN_SERVER = {};             // a map from a player id to a Player object
let PROJECTILES = {};                   // a map from a projectile id to a Projectile object
let PROJECTILES_TO_REMOVE = [];         // a list of projectile id's to let clients remove

let projectileCount = 0;
let dt = 1 / 60;

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

    socket.on("addNewProjectile", (pos, vel, damage) => {
        Cesium.Cartesian3.multiplyByScalar(vel, PROJECTILE_SPEED, vel);
        PROJECTILES[projectileCount] = new Projectile(projectileCount, pos, vel, damage);
        projectileCount++;
    });
});

/**
 * Main server loop. Performs calculations and emits data to all clients.
 */
function serverTick() {
    // update projectiles
    PROJECTILES_TO_REMOVE = [];
    updateProjectiles();

    // emit data
    io.sockets.emit("serverEmitsData", PLAYERS_IN_SERVER, PROJECTILES, PROJECTILES_TO_REMOVE);
    setTimeout(serverTick, 16.6);
}
serverTick();