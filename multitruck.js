const TRUCK_MODEL_URL = "model/truck.gltf";
const TICKRATE = 60;
const TICK_INTERVAL = 1000 / TICKRATE;

const INITIAL_POS = Cesium.Cartesian3.fromDegrees(-77.413404, 43.203573);
const INITIAL_ORIENT = Cesium.Transforms.headingPitchRollQuaternion(INITIAL_POS,
    new Cesium.HeadingPitchRoll(0, 0, 0));
const FORWARD_ACCEL = 1;
const BACKWARD_ACCEL = 1;
const MAX_FORWARD_SPEED = 100;
const MAX_REVERSE_SPEED = 40;
const GRAVITY = 9.8;

// leaving out next line will result in console warning
Cesium.BingMapsApi.defaultKey = 'P9gVFeINebTgcj5ONynB~sa3kfugY4uM70j48aMFH-g~Ai2zw5GpzAt7hLyv87kHTaDy9dhktuwKhkBi8HyCOoaU5f1VrSm9-Ps4QEJQRuH8';
let viewer = new Cesium.Viewer("cesium-container", {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    shadows: true
});

let terrainProvider = new Cesium.CesiumTerrainProvider({
    url : 'https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles'
});
viewer.terrainProvider = terrainProvider;
viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

/*
 * note: for orientationMatrix from quaternion:
 * col 0 = unit vector forward
 * col 1 = unit vector to left
 * col 2 = unit vector straight up
 */
class Truck {
    constructor(truckEntity) {
        this.entity = truckEntity;
        this.vel = new Cesium.Cartesian3();
        this.forward = false;
        this.backward = false;
        this.left = false;
        this.right = false;
    }

    onTick() {
        let dt = 1 / TICKRATE;
        let entity = this.entity;

        let pos0 = entity.position._value;
        let pos0Carto = Cesium.Cartographic.fromCartesian(pos0);
        let height = pos0Carto.height;
        let groundHeight = viewer.scene.globe.getHeight(pos0Carto);
        let vel0 = this.vel;
        let speed = Cesium.Cartesian3.magnitude(vel0);

        let isAirborne = height - groundHeight > 0.1;
        let orientationMatrix = Cesium.Matrix3.fromQuaternion(entity.orientation._value);
        let forwardDir = Cesium.Matrix3.getColumn(orientationMatrix, 0, new Cesium.Cartesian3());
        let leftDir = Cesium.Matrix3.getColumn(orientationMatrix, 1, new Cesium.Cartesian3());
        let upDir = Cesium.Matrix3.getColumn(orientationMatrix, 2, new Cesium.Cartesian3());

        let steerAngle = 0;

        // steering
        if (this.left || this.right) {
            let TURN_SPEED_MIN = 60;        // radian/sec
            let TURN_SPEED_MAX = 100;       // radian/sec

            let turnSpeed;

            // turn speed calculations adapted from monster milktruck
            let SPEED_MAX_TURN = 25;
            let SPEED_MIN_TURN = 120;
            if (speed < SPEED_MAX_TURN) {
                turnSpeed = TURN_SPEED_MIN + (TURN_SPEED_MAX - TURN_SPEED_MIN) * (SPEED_MAX_TURN - speed) / SPEED_MAX_TURN;
                turnSpeed *= (speed / SPEED_MAX_TURN);
            } else if (speed < SPEED_MIN_TURN) {
                turnSpeed = TURN_SPEED_MIN + (TURN_SPEED_MAX - TURN_SPEED_MIN) * (SPEED_MIN_TURN - speed) / (SPEED_MIN_TURN - SPEED_MAX_TURN);
            } else {
                turnSpeed = TURN_SPPED_MIN;
            }
            if (truck.left) {
                steerAngle = turnSpeed * dt * Math.PI / 180;
            }
            if (truck.right) {
                steerAngle = -turnSpeed * dt * Math.PI / 180;
            }
        }

        // turn the car, update forward, left, and up orthonormal vectors
        forwardDir = isAirborne ? forwardDir : rotate(forwardDir, upDir, steerAngle);
        leftDir = Cesium.Cartesian3.cross(upDir, forwardDir, new Cesium.Cartesian3());
        Cesium.Matrix3.setColumn(orientationMatrix, 0, forwardDir, orientationMatrix);
        Cesium.Matrix3.setColumn(orientationMatrix, 1, leftDir, orientationMatrix);
        entity.orientation = Cesium.Quaternion.fromRotationMatrix(orientationMatrix);

        // calculate forward speed
        let forwardSpeed = 0;
        if (!isAirborne) {
            // if slipping, transfer some of the slip velocity into forward velocity
            let slipMagnitude = Cesium.Cartesian3.dot(this.vel, forwardDir);
            let c0 = Math.exp(-dt / 0.5);
            let slipVector = Cesium.Cartesian3.multiplyByScalar(forwardDir, slipMagnitude * (1 - c0), new Cesium.Cartesian3());
            Cesium.Cartesian3.subtract(this.vel, slipVector, this.vel);

            forwardSpeed = Cesium.Cartesian3.dot(forwardDir, this.vel);
            if (truck.forward) {
                let accelAmount = Cesium.Cartesian3.multiplyByScalar(forwardDir, FORWARD_ACCEL * dt, new Cesium.Cartesian3());
                Cesium.Cartesian3.add(this.vel, accelAmount, this.vel);
            } else if (truck.backward) {
                if (forwardSpeed > -MAX_REVERSE_SPEED) {
                    let accelAmount = Cesium.Cartesian3.multiplyByScalar(forwardDir, -BACKWARD_ACCEL * dt, new Cesium.Cartesian3());
                    Cesium.Cartesian3.add(this.vel, accelAmount, this.vel);
                }
            }
        }

        // air resistance

        // gravity
        let gravNormal = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(pos0);
        let upAccel = Cesium.Cartesian3.multiplyByScalar(gravNormal, -GRAVITY * dt, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(this.vel, upAccel, this.vel);

        // move truck after velocity vector is completely calculated
        let deltaPos = Cesium.Cartesian3.multiplyByScalar(this.vel, dt, new Cesium.Cartesian3());
        let pos1 = Cesium.Cartesian3.add(deltaPos, pos0, new Cesium.Cartesian3());

        // check that we're not underground
        let pos1Carto = Cesium.Cartographic.fromCartesian(pos1);
        groundHeight = viewer.scene.globe.getHeight(pos1Carto);
        if (groundHeight != undefined && !isNaN(groundHeight) && pos1Carto.height < groundHeight) {
            pos1 = Cesium.Cartesian3.fromRadians(pos1Carto.longitude, pos1Carto.latitude, groundHeight);
            pos1Carto.height = groundHeight;
        }

        entity.position = pos1;

        // cancel velocity into ground
        if (!isAirborne) {
            let groundNormal = estimateGroundNormal(pos1);
            let speedOutOfGround = Cesium.Cartesian3.dot(groundNormal, this.vel);
            if (speedOutOfGround < 0) {
                let cancel = Cesium.Cartesian3.multiplyByScalar(groundNormal, -speedOutOfGround, new Cesium.Cartesian3());
                Cesium.Cartesian3.add(this.vel, cancel, this.vel);
            }

            // make orientation match ground
            let c0 = Math.exp(-dt / 0.25);
            let c1 = 1 - c0;
            let scaledUp = Cesium.Cartesian3.multiplyByScalar(upDir, c0, new Cesium.Cartesian3());
            let scaledNormal = Cesium.Cartesian3.multiplyByScalar(groundNormal, c1, new Cesium.Cartesian3());
            let blendedUp = Cesium.Cartesian3.add(scaledUp, scaledNormal, new Cesium.Cartesian3());
            Cesium.Cartesian3.normalize(blendedUp, blendedUp);

            let newLeft = Cesium.Cartesian3.cross(blendedUp, forwardDir, new Cesium.Cartesian3());
            Cesium.Matrix3.setColumn(orientationMatrix, 1, newLeft, orientationMatrix);
            Cesium.Matrix3.setColumn(orientationMatrix, 2, blendedUp, orientationMatrix);

            forwardDir = Cesium.Matrix3.getColumn(orientationMatrix, 0, new Cesium.Cartesian3());
            leftDir = Cesium.Matrix3.getColumn(orientationMatrix, 1, new Cesium.Cartesian3());
            upDir = Cesium.Matrix3.getColumn(orientationMatrix, 2, new Cesium.Cartesian3());
        }

        // viewer.scene.camera.lookAt(truck.entity.position._value,
        //     new Cesium.HeadingPitchRange(Math.PI / 2, -0.1, 50));

    }
}

/**
 * Calculates how fast the truck should be able to steer, depending on its speed
 * @param {Number} speed the magnitude of the velocity of the car
 * @returns {Number} the speed that the car can turn at
 */
function steeringSpeed(speed) {
    return 5;
}

/**
 * Rotates the given vector about the given axis by the given amount of radians
 * @param {Cesium.Cartesian3} vector the vector to rotate
 * @param {Cesium.Cartesian3} axis the axis of rotation
 * @param {Number} radians the amount to rotate in radians
 * @returns {Cesium.Cartesian3} a new Cesium.Cartesian3 representing the rotated vector
 */
function rotate(vector, axis, radians) {
    let quaternion = Cesium.Quaternion.fromAxisAngle(axis, radians);
    let rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
    return Cesium.Matrix3.multiplyByVector(rotationMatrix, vector, new Cesium.Cartesian3());
}

/**
 * Calculates the normal vector of the terrain at the given position.
 * Estimation is done by taking 4 height samples around the given position
 * @param {Cesium.Cartesian3} pos the position that we want to estimate the ground normal of
 * @returns {Cesium.Cartesian3} the normal vector of the terrain at pos
 */
function estimateGroundNormal(pos) {
    let globe = viewer.scene.globe;

    let frame = Cesium.Transforms.eastNorthUpToFixedFrame(pos, globe.ellipsoid);
    let east = Cesium.Cartesian3.fromCartesian4(Cesium.Matrix4.getColumn(frame, 0, new Cesium.Cartesian4()));
    let north = Cesium.Cartesian3.fromCartesian4(Cesium.Matrix4.getColumn(frame, 1, new Cesium.Cartesian4()));

    let pos0 = Cesium.Cartesian3.add(pos, east, new Cesium.Cartesian3());
    let pos1 = Cesium.Cartesian3.subtract(pos, east, new Cesium.Cartesian3());
    let pos2 = Cesium.Cartesian3.add(pos, north, new Cesium.Cartesian3());
    let pos3 = Cesium.Cartesian3.subtract(pos, north, new Cesium.Cartesian3());

    let h0 = Cesium.Cartographic.fromCartesian(pos0).height;
    let h1 = Cesium.Cartographic.fromCartesian(pos1).height;
    let h2 = Cesium.Cartographic.fromCartesian(pos2).height;
    let h3 = Cesium.Cartographic.fromCartesian(pos3).height;

    let dx = h1 - h0;
    let dy = h3 - h2;
    let normal = new Cesium.Cartesian3(dx, dy, 2);
    Cesium.Cartesian3.normalize(normal, normal);
    
    Cesium.Matrix4.multiplyByPointAsVector(frame, normal, normal);
    return normal;
}

function tick() {
    truck.onTick();
}

function frame(timestamp) {
    let now = window.performance.now();
    deltaT += Math.min(1000, now - timestamp);      // cap deltaT at 1 sec in case browser loses focus
    while (deltaT >= TICK_INTERVAL) {
        deltaT -= TICK_INTERVAL;
        tick();
    }
    requestAnimationFrame(frame);
}

$(document).keydown((e) => {
    let c = e.which;
    if (c == 87) {              // w
        truck.forward = true;
    } else if (c == 65) {       // a
        truck.left = true;
    } else if (c == 83) {       // s
        truck.backward = true;
    } else if (c == 68) {       // d
        truck.right = true;
    }
});

$(document).keyup((e) => {
    let c = e.which;
    if (c == 87) {              // w
        truck.forward = false;
    } else if (c == 65) {       // a
        truck.left = false;
    } else if (c == 83) {       // s
        truck.backward = false;
    } else if (c == 68) {       // d
        truck.right = false;
    }
});

let truckEntity = viewer.entities.add({
    name: "truck",
    model: {
        uri: TRUCK_MODEL_URL,
        scale: 1,
        runAnimations: false
    },
    position: INITIAL_POS,
    orientation: INITIAL_ORIENT
});
let truck = new Truck(truckEntity);

let deltaT = 0;
let start = window.performance.now();
requestAnimationFrame(frame);