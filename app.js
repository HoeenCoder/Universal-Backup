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
	require('child_process').execSync('npm install --production', {stdio: 'inherit'});
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
global.Tools = require('./tools.js');
global.toId = Tools.toId;
Config.nickid = toId(Config.nick);
if (!toId(Config.nick)) {
	console.log(`${Config.nick ? 'An invalid' : 'No'} nickname was provided, please edit the bot's username in config.js`);
	process.exit(1);
}

if (!Config.primaryRoom) console.log("No primary room set, commands requiring auth will not work in PMs.");
/**
 * @param {string} msg
 */

const debug = (msg) => {
	if (!Config.debugMode) return;
	console.log("[DEBUG] " + msg);
};
/**
 * @param {string} msg
 */
const log = (msg) => {
	if (!Config.verboseMode) return;
	console.log("[LOG] " + msg);
};
global.debug = debug;
global.log = log;

global.Rooms = require('./rooms.js');
global.Chat = require('./chat.js'); // handles the connection too
global.Mafia = require('./mafia.js');
Chat.loadCommands();

global.sendMessage = Chat.sendMessage;
global.sendPM = Chat.sendPM;


Chat.client.connect();
