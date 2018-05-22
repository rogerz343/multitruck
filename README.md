# truck-battle
A simple web browser multiplayer game in which players control trucks and try to destroy other trucks.

## Usage
To start the server, first install the node modules as usual by typing `npm install` in the root directory containing the `package.json` file. In addition, download Cesium (https://cesiumjs.org/downloads/) and place the *Cesium* folder (which contains *Cesium.js*) into the root directory. Then, start the server with `node server.js`. Clients should connect to the IP and port specified in *server.js* (which can be configured).

## Code organization
- *server.js*: Contains the code for the server.
- *index.html*: Contains the code for the client's browser.
- *multitruck.js*: Contains the scripts used in *index.html* for the client.
- *multitruck.css*: Contains the stylesheet used in *index.html*.
- Resources: Contains some of the resources (e.g. the model for the truck).

## TODO, possible improvements, etc.
- teleport to any lat/lon
- update ui
- input username for session
- display score
- get a better projectile model
