'use strict';

// Check dependencies & node version
try {
	eval('{ let a = async () => {}; }');
} catch (e) {
	console.log("We require Node.js version 8 or later; you're using " + process.version);
	process.exit(1);
}

const fs = require('fs');

try {
	// add dependecies here
	require('websocket');
} catch (e) {
	console.log('Dependencies unmet! Installing them...');
	require('child-process').execSync('npm install --production', {stdio: 'inherit'});
	// exit here if needed, not sure if it is.
}

// Load config
try {
	global.Config = require('./config/config.js');
} catch (e) {
	if (e.code !== 'MODULE_NOT_FOUND') throw e; // Shouldn't happen
	console.log('config.js not found, creating one with default settings...');
	fs.copyFileSync('config/config-example.js', 'config/config.js');
	console.log('Please restart the bot.');
	process.exit(1);
}

// Setup globals
global.toId = function (text) {
	if (text && text.id) {
		text = text.id;
	} else if (text && text.userid) {
		text = text.userid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
};

if (!toId(Config.nick)) {
	console.log((Config.nick ? 'An invalid' : 'No') + ' nickname was provided, please edit the bot\'s username in config.js');
	process.exit(1);
}

global.debug = function (msg) {
	if (!Config.debugMode) return;
	console.log(`[DEBUG] ${msg}`);
};

global.Rooms = require('./rooms.js');
global.Users = require('./users.js');

global.Client = require('./client.js').Client; // Handles the connection to PS

global.sendMessage = function (roomid, message) {
	const room = Rooms(roomid);
	if (!room && roomid) return debug(`Sending to invalid room ${roomid}`);
	Client.send(`${room.roomid}|${message}`);
};
global.sendPM = function (userid, message) {
	const target = Users(userid);
	if (!target) debug(`Sending PM to unknown user ${userid}`);
	Client.send(`|/pm ${target ? target.userid : userid}, ${message}`);
};

global.Commands = require('./commands.js');
Client.messageCallback = require('./parser.js');

Client.connect();
