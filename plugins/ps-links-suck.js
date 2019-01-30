"use strict";

// PS formatter doesn't include trailing punctuation on links
// mafiascum loves ending their themenames with links
const https = require('https');

const MAFISCUM_REGEX = /((?:https?:\/\/)?wiki\.mafiascum\.net\/index\.php\?title=.*[^\sA-Za-z])/i;

let cooldownTime = 10 * 1000;

/** @type {{[k: string]: number}} */
let themeCooldowns = {};
/** @type {{[k: string]: boolean}} */
let validSetups = {};

/**
 * Returns if the entry is on cooldown, then bumps the cooldown
 * @param {string} name
 */
function toBroadcast(name) {
	name = toId(name);
	if (!themeCooldowns[name] || themeCooldowns[name] < Date.now()) {
		themeCooldowns[name] = Date.now() + cooldownTime;
		return true;
	}
	return false;
}

/**
 * @param {string} url
 */
async function checkURL(url) {
	return new Promise((resolve, reject) => {
		if (url in validSetups) return resolve(validSetups[url]);
		const req = https.get(url, (res) => {
			validSetups[url] = res.statusCode !== 404;
			resolve(validSetups[url]);
		});
		req.on('error', (e) => {
			reject(e);
		});
	});
}

/**
 *
 * @param {string} type
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseChat(type, roomid, parts) {
	const message = parts.join('|');

	const match = message.match(MAFISCUM_REGEX);
	if (match) {
		if (!toBroadcast(match[0])) return;
		checkURL(match[0]).then(result => {
			if (result) {
				Chat.sendMessage(roomid, `/addhtmlbox <a href="${match[0]}">${match[0]}</a>`);
			}
		});
	}
}

const listeners = {
	"links-chat": {
		rooms: true,
		messageTypes: ['chat'],
		callback: parseChat,
		repeat: true,
	},
};

exports.listeners = listeners;
