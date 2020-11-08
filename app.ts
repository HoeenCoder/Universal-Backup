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
import { Tools } from './tools';
global.Tools = Tools;
global.toId = Tools.toId;
Config.nickid = toId(Config.nick);
if (!toId(Config.nick)) {
	console.log(`${Config.nick ? 'An invalid' : 'No'} nickname was provided, please edit the bot's username in config.js`);
	process.exit(1);
}

if (!Config.primaryRoom) console.log("No primary room set, commands requiring auth will not work in PMs.");

global.debug = (msg: string) => {
	if (!Config.debugMode) return;
	console.log("[DEBUG] " + msg);
};
global.log = (msg: string) => {
	if (!Config.verboseMode) return;
	console.log("[LOG] " + msg);
};

import { Rooms } from './rooms';
global.Rooms = Rooms;
import { Chat } from './chat';
global.Chat = Chat; // handles the connection too
global.Mafia = require('./mafia.js');
Chat.loadCommands();

global.sendMessage = Chat.sendMessage;
global.sendPM = Chat.sendPM;


if (Config.webhookCrashURL) {
	const https = require('https');
	function reportError(e: Error) { 	// eslint-disable-line no-inner-declarations
		const data = {
			content: e.stack,
		};
		const reqOptions = {
			hostname: "discordapp.com",
			path: `/api/webhooks/${Config.webhookCrashURL}`,
			agent: false,
			method: 'POST',
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		};

		const req = https.request(reqOptions, (res: any) => {});
		req.on('error', (e: Error) => {
			console.error(`Error while making request: ${e.stack}`);
			return;
		});
		req.write(JSON.stringify(data));
		req.end();
	}

	process.on('uncaughtException', (e) => {
		reportError(e);
	});
}

Chat.client.connect();
