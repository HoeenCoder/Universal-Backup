// abstraction around the client to make thin slaves
'use strict';

const fs = require('fs');

const Client = require('./client.js');

/** @type {{[k: string]: boolean}} */
let NamesUsed = {};
/** @type {{[k: string]: {nick: string, pass: string}}} */
let Credentials = {};
try {
	Credentials = JSON.parse(fs.readFileSync('./config/credentials.json').toString());
} catch (e) {}

class SlaveClient {
	/**
	 * @param {Object} credentials 
	 * @param {string[]} rooms
	 */
	constructor(credentials, rooms) {
		NamesUsed[this.userid] = true;
		this.name = credentials.nick;
		this.userid = toId(credentials.nick);
		this.client = new Client({nick: credentials.nick, pass: credentials.pass, autojoin: rooms, reconnectTime: 0});
		this.client.connect();
		return this;
	}

	kill() {
		this.client.disconnect();
		NamesUsed[this.userid] = false;
	}
}

const crypto = require('crypto');

/** 
 * @param {string} preferredName
 */
function getCredentials(preferredName = '') {
	let nick = '';
	do {
		nick = crypto.randomBytes(3).toString('hex')
	} while (nick in NamesUsed);
	return {nick};
	const prefId = toId(preferredName);
	if (prefId && !NamesUsed[prefId] && Credentials[prefId]) return Credentials[prefId];

	for (const id of Tools.lazyShuffle(Object.keys(Credentials))) {
		if (NamesUsed[id]) continue;
		return Credentials[id];
	}
	// no credentials available - panic!
	debug('Ran out of anon credential accounts!');
	return null;
}

module.exports = {
	SlaveClient,
	getCredentials,
	NamesUsed
};

