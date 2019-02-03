"use strict";

// PS formatter doesn't include trailing punctuation on links
// mafiascum loves ending their themenames with punctuation
const https = require('https');
const cheerio = require('cheerio');

const MAFIASCUM_REGEX = /(?:^|\s)((?:https?:\/\/)?wiki\.mafiascum\.net\/index\.php\?title=.*[^\sa-z])(?:$|\s)/i;

let cooldownTime = 10 * 1000;

/** @type {{[k: string]: number}} */
let themeCooldowns = {};
/** @type {{[k: string]: string | false}} */
let setupCache = {};

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
async function getLink(url) {
	return new Promise((resolve, reject) => {
		if (url in setupCache) return resolve(setupCache[url]);
		const req = https.get(url, (res) => {
			if (res.statusCode !== 200) {
				setupCache[url] = false;
				return resolve(false);
			}
			let data = '';
			res.on('data', e => {
				data += e;
			});
			res.on('end', () => {
				let title;
				try {
					const $ = cheerio.load(data);
					title = $('title')[0].children[0].data;
				} catch (e) {}
				if (!title) title = url;
				setupCache[url] = `[[${title} <${decodeURI(url)}>]]`;
				return resolve(setupCache[url]);
			});
		});
		req.on('error', (e) => {
			resolve(false);
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
	const message = parts.slice(1).join('|');
	if (message.includes('[[') && message.includes(']]')) return; // probably already has a link;
	const match = MAFIASCUM_REGEX.exec(message);
	if (match) {
		if (!toBroadcast(match[1])) return;
		getLink(match[1]).then(result => {
			if (result) {
				Chat.sendMessage(roomid, result);
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
