"use strict";

// PS formatter doesn't include trailing punctuation on links
// mafiascum loves ending their themenames with links
const https = require('https');
const cheerio = require('cheerio');

const MAFISCUM_REGEX = /(?:\b|(?!\w))((?:https?:\/\/)?wiki\.mafiascum\.net\/index\.php\?title=.*[^\sa-z])(?:\b|\B(?!\w))/i;

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
			if (res.statusCode === 404) {
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
				if (title === 'Bad Title - MafiaWiki') {
					setupCache[url] = false;
					return resolve(false);
				}
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
	const message = parts.join('|');
	if (message.includes('[[') && message.includes(']]')) return; // probably already has a link;
	const match = message.match(MAFISCUM_REGEX);
	if (match) {
		if (!toBroadcast(match[0])) return;
		getLink(match[0]).then(result => {
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
