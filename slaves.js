// abstraction around the client to make thin slaves
'use strict';

const fs = require('fs');

const Client = require('./client.js').Client;

/** @type {{[k: string]: boolean}} */
let NamesUsed = {};
/** @type {{[k: string]: {nick: string, pass: string}}} */
let Credentials = {};
function LoadCredentials() {
	Credentials = {};
	try {
		Credentials = JSON.parse(fs.readFileSync('./config/credentials.json').toString());
	} catch (e) {}
}
LoadCredentials();
function CountCredentials() {
	return Object.keys(Credentials).length;
}
class SlaveClient {
	/**
	 * @param {AnyObject} credentials
	 * @param {string[]} rooms
	 */
	constructor(credentials, rooms) {
		this.name = credentials.nick;
		this.userid = toId(credentials.nick);
		this.client = new Client({
			nick: credentials.nick,
			pass: credentials.pass,
			autojoin: rooms,
			reconnectTime: 0,
			avatar: Math.floor(Math.random() * 100),
		});
		this.client.connect();
		return this;
	}

	kill() {
		this.client.send('|/logout');
		this.client.disconnect();
		NamesUsed[this.userid] = false;
	}
}

/**
 * @param {string} preferredName
 */
function GetCredentials(preferredName = '') {
	const prefId = toId(preferredName);
	if (prefId && !NamesUsed[prefId] && Credentials[prefId]) return Credentials[prefId];

	for (const id of Tools.lazyShuffle(Object.keys(Credentials))) {
		if (NamesUsed[id]) continue;
		NamesUsed[id] = true;
		return Credentials[id];
	}
	// no credentials available - panic!
	debug('Ran out of anon credential accounts!');
	return null;
}

module.exports = {
	SlaveClient,
	GetCredentials,
	NamesUsed,
	LoadCredentials,
	CountCredentials,
};
