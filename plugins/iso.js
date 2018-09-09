'use strict';

const crypto = require('crypto');

class ISO {
	// this exists basically just for data storage
	/**
	 * @param {string} roomid
	 */
	constructor(roomid) {
		this.room = roomid;

		/** @type {string[][]} */
		this.authors = [/* string[][] */]; // contains the authors for each index, system messages are ~. lines with multiple authors are from lynches
		/** @type {string[]} */
		this.log = []; // contains just the lines. lines should be able to be directly output
		/** @type {string[]} */
		this.htmllog = []; // the above, but as safe html divs
		/** @type {string[]} */
		this.systemLog = [];
		this.startTime = 0;
		this.enabled = false;
	}

	startSession() {
		this.sendRoom(`Isolation session started`);
		this.enabled = true;
		this.startTime = Date.now();
		this.authors = [];
		this.log = [];
		this.htmllog = [];
		this.systemlog = [];
	}

	endSession() {
		this.sendRoom(`Isolation session ended. ${this.authors.length} messages recorded`);
		this.enabled = false;
	}

	/**
	 * @param {string} m
	 */
	sendRoom(m) {
		Chat.sendMessage(this.room, m);
	}

	getTimestamp() {
		if (!this.startTime) return '[]';

		/**
		 * @param {number} v
		 */
		function p02d(v) {
			return v < 10 ? '0' + v : v;
		}
		const delta = Date.now() - this.startTime;

		let s = Math.floor(delta / 1000);
		let h = Math.floor(s / (60 * 60));
		s = s - h * 60 * 60;
		let m = Math.floor(s / 60);
		s = s - m * 60;
		return `[${h ? `${p02d(h)}:` : ''}${p02d(m)}:${p02d(s)}]`;
	}

	/**
	 * @param {string} author
	 * @param {string} message
	 */
	addChatMessage(author, message) {
		if (!this.enabled) return;
		const time = this.getTimestamp();
		this.authors.push([toId(author)]);
		this.log.push(`${time} ${author}: ${message}`);
		this.htmllog.push(`<div class="chat chatmessage-${toId(author)}"><small>${time} ${author.charAt(0)}</small><strong style="${colourName(author)}">${author.slice(1)}:</strong><em>${Tools.escapeHTML(message)}</em></div>`);
	}

	/**
	 * @param {string[]} authors
	 * @param {string} message
	 */
	addMessage(authors, message) {
		if (!this.enabled) return;
		const time = this.getTimestamp();
		if (authors[0] !== '~') authors = authors.map(toId);
		this.authors.push(authors);
		this.log.push(`${time} ${message}`);
		this.htmllog.push(`<div class="chat"><small>${time} </small><em>${Tools.escapeHTML(message)}</em></div>`);
	}
	/**
	 * @param {string} message
	 */
	addSystemMessage(message) {
		if (!this.enabled) return;
		this.systemLog.push(`${this.getTimestamp()} ${message}`);
	}
}

/**
 * @param {string} messageType
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseChat(messageType, roomid, parts) {
	const author = parts[0];
	const message = parts.slice(1).join('|');

	const room = Rooms(roomid);
	if (!room || !room.iso) return;

	if (author === '~') return;
	if (message.startsWith('/log')) return;
	room.iso.addChatMessage(author, message);
}
/**
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 * @param {string} message
 */
function addLynch(event, roomid, details, message) {
	const room = Rooms(roomid);
	if (!room || !room.iso) return;
	room.iso.addMessage(details, message);
}
/**
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 * @param {string} message
 */
function addDay(event, roomid, details, message) {
	const room = Rooms(roomid);
	if (!room || !room.iso) return;
	room.iso.addMessage(['~'], `Day ${details[0]}. The hammer count is set at ${details[1]}`);
}
/**
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 * @param {string} message
 */
function addSystemMessage(event, roomid, details, message) {
	const room = Rooms(roomid);
	if (!room || !room.iso) return;
	room.iso.addSystemMessage(Tools.stripHTML(message));
}

Chat.addListener('iso-chat', true, ['chat'], parseChat, true);
Mafia.addMafiaListener('iso-lynch', true, ['lynch', 'unlynch', 'lynchshift', 'nolynch', 'unnolynch'], addLynch, true);
Mafia.addMafiaListener('iso-day', true, ['day'], addDay, true);
const SYSTEM_EVENTS = ['night', 'day', 'kick', 'treestump', 'spirit', 'spiritstump', 'kill', 'revive', 'add', 'hammer', 'sethammer', 'shifthammer'];
Mafia.addMafiaListener('iso-system-messages', true, SYSTEM_EVENTS, addSystemMessage, true);
Mafia.addMafiaListener('iso-init', true, ['gamestart', 'gameend'], (/** @type {string} **/e, /** @type {string} **/r) => {
	const room = Rooms(r);
	if (!room || !room.iso) return;
	if (e === 'gamestart') return room.iso.startSession();
	room.iso.endSession();
}, true);

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	enableiso: function (target, room) {
		if (!this.can('roommanagement')) return false;
		if (!room) return;
		if (room.iso) return this.reply(`ISO already exists`);
		room.iso = new ISO(room.roomid);
		this.reply('Listener created');
	},

	istart: function (target, room, user) {
		if (!room || !room.iso) return;
		if (!this.can('games')) return;
		room.iso.startSession();
	},
	istop: function (target, room, user) {
		if (!room || !room.iso) return;
		if (!this.can('games')) return;
		room.iso.endSession();
	},
	i: 'isolation',
	isolate: 'isolation',
	si: 'isolation',
	gamelog: 'isolation',
	systemisolation: 'isolation',
	isolation: function (target, room, user, cmd, message) {
		let args = target.split(',').map(s => s.trim());
		if (!args.length) return;
		let replyInRoom = this.can('broadcast');
		if (!room) {
			// @ts-ignore guaranteed at this point
			room = Rooms(args[0]);
			if (!room) {
				room = Rooms(Config.primaryRoom);
			} else {
				args.shift();
			}
			if (!room) return;
			replyInRoom = false;
		}
		let iso = room.iso;
		if (!iso) return false;
		if (!iso.authors.length) return this.reply(`No entries`);


		if (!replyInRoom && !Rooms.canPMInfobox(user)) return this.replyPM(`Can't PM you html, make sure you share a room in which I have the bot rank.`);
		const usehtml = !replyInRoom || (room.getAuth(toId(Config.nick)) === '*');
		const log = usehtml ? iso.htmllog : iso.log;

		args = [...args.map(toId), '~'];
		let foundNames = {};
		let foundLog = [];
		let countLine = 'System messages';
		let system = false;
		if (cmd === 'si' || cmd === 'systemisolation' || cmd === 'gamelog') {
			foundLog = iso.systemLog;
			system = true;
		} else {
			for (let i = 0; i < iso.authors.length; i++) {
				const authors = iso.authors[i];
				for (const author of args) {
					if (authors.includes(author)) {
						if (!foundNames[author]) foundNames[author] = 0;
						foundNames[author]++;
						foundLog.push(log[i]);
						break;
					}
				}
			}
			delete foundNames['~'];
			if (!Object.keys(foundNames).length) return this.reply(`No entries found`);
			countLine = `ISO for ${Object.entries(foundNames).reduce((acc, [a, n]) => {
				if (a === '~') return acc;
				// @ts-ignore ???
				acc.push(`${a}: ${n} lines`);
				return acc;
			}, []).join('; ')}`;
		}
		let buf = '';
		if (usehtml) {
			buf = `<details><summary>${countLine}</summary><div role="log">${foundLog.join(system ? '<br/>' : '')}</div></details>`;
			if (!replyInRoom) {
				return this.replyHTMLPM(buf);
			}
			return this.reply(`/addhtmlbox ${buf}`);
		} else {
			this.reply(`!code ${countLine}\n${foundLog.join('\n')}`);
		}
	},
};

exports.commands = commands;

/** @type {{[n: string]: string}} */
let nameCache = {};
/**
 * @param {string} n
 */
function colourName(n) {
	n = toId(n);
	if (nameCache[n]) return nameCache[n];

	// borrowed from ps
	const hash = crypto.createHash('md5').update(n).digest('hex');
	let H = parseInt(hash.substr(4, 4), 16) % 360; // 0 to 360
	let S = parseInt(hash.substr(0, 4), 16) % 50 + 40; // 40 to 89
	let L = Math.floor(parseInt(hash.substr(8, 4), 16) % 20 + 30); // 30 to 49
	let C = (100 - Math.abs(2 * L - 100)) * S / 100 / 100;
	let X = C * (1 - Math.abs((H / 60) % 2 - 1));
	let m = L / 100 - C / 2;

	let R1, G1, B1;
	switch (Math.floor(H / 60)) {
	case 1: R1 = X; G1 = C; B1 = 0; break;
	case 2: R1 = 0; G1 = C; B1 = X; break;
	case 3: R1 = 0; G1 = X; B1 = C; break;
	case 4: R1 = X; G1 = 0; B1 = C; break;
	case 5: R1 = C; G1 = 0; B1 = X; break;
	case 0: default: R1 = C; G1 = X; B1 = 0; break;
	}
	let R = R1 + m, G = G1 + m, B = B1 + m;
	let lum = R * R * R * 0.2126 + G * G * G * 0.7152 + B * B * B * 0.0722; // 0.013 (dark blue) to 0.737 (yellow)
	let HLmod = (lum - 0.2) * -150; // -80 (yellow) to 28 (dark blue)
	if (HLmod > 18) HLmod = (HLmod - 18) * 2.5;
	else if (HLmod < 0) HLmod = (HLmod - 0) / 3;
	else HLmod = 0;
	// let mod = ';border-right: ' + Math.abs(HLmod) + 'px solid ' + (HLmod > 0 ? 'red' : '#0088FF');
	let Hdist = Math.min(Math.abs(180 - H), Math.abs(240 - H));
	if (Hdist < 15) {
		HLmod += (15 - Hdist) / 3;
	}

	L += HLmod;

	nameCache[n] = "color:hsl(" + H + "," + S + "%," + L + "%);";
	return nameCache[n];
}
