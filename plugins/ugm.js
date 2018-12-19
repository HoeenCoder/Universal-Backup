'use strict';
const cheerio = require('cheerio');

// todo: integrate into proper mafia tracking
let UGMTrackerEnabled = false;
let gameStarted = false;

/** @type {{[k: string]: string}} */
let alignments = {};
for (const a of Object.values(Mafia.data.alignments)) {
	alignments['' + (a.buttonColor || a.color)] = a.id;
}
let validAlignments = Object.values(alignments);

const PLAY_POINTS = [3, 10, 15, 20, 25];
const HOST_POINTS = [3, 6, 9, 12, 15];
const MVP_POINTS = [2, 6, 9, 12, 15];

/**
 * @param {number} playerCount
 * @param {'host' | 'play' | 'mvp'} type
 */
function Points(playerCount, type) {
	const points = {play: PLAY_POINTS, host: HOST_POINTS, mvp: MVP_POINTS}[type];
	if (playerCount <= 5) return points[0];
	if (playerCount <= 8) return points[1];
	if (playerCount <= 11) return points[2];
	if (playerCount <= 15) return points[3];
	return points[4];
}

/**
 * @param {string} t
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseChatPage(t, roomid, parts) {
	try {
		let text = parts.join('\n');
		const game = (Rooms('mafia') || {mafiaTracker: null}).mafiaTracker;
		if (!game || (game.phase !== 'night' && game.phase !== 'day')) return;
		let $ = cheerio.load(text.substr(text.indexOf('|pagehtml|') + 10));
		for (const e of $('h3:contains(Player Options)').parent()[0].children) {
			if (e.name === 'details') {
				const userid = toId(e.children[0].children[0].childNodes[0].nodeValue);
				const alignmentColour = e.children[0].children[0].children[1].attribs['style'].slice(23);
				const role = e.children[0].children[0].children[0].nodeValue.slice(0);

				const alignment = alignments[alignmentColour];
				if (!alignment) {
					Chat.sendPM(game.hostid, `Unknown colour for alignment: ${role}. Please tell a mod.`);
				}
				if (!game.players[userid]) {
					Chat.sendPM(game.hostid, `Missing player ${userid}. Please tell a mod.`);
				}
				game.players[userid].role = role;
				game.players[userid].alignment = alignment;
			}
		}
	} catch (e) {
		Chat.sendMessage('mafia', `Alignment parsing from the HTML room broke, please tell a staff member.`);
		console.log(e);
	}
}

/**
 * @param {string} t
 * @param {string} r
 * @param {string[]} d
 */
function onEvent(t, r, d) {
	if (!UGMTrackerEnabled) return;
	if (t === 'host') {
		Chat.sendMessage('mafia', `/mafia cohost ${Config.nick}`);
		gameStarted = false;
	} else if (t === 'gamestart') {
		gameStarted = true;
	} else if (t === 'gameend') {
		if (!gameStarted) return;
		const room = Rooms(r);
		if (!room) return false;
		const mafiaTracker = room.mafiaTracker;
		if (!mafiaTracker) return Chat.sendMessage('mafia', 'desync');
		Chat.sendMessage('mafia', `.addpoints ${Points(Object.keys(mafiaTracker.players).length, 'host')}, ${mafiaTracker.hostid}`);
		Chat.sendPM(mafiaTracker.hostid, 'Remember to add points with ``.winfaction <faction>`` in chat.')
	}
}

const listeners = {
	"ugm-room": {
		rooms: ['view-mafia-mafia'],
		messageTypes: ['chatpage'],
		repeat: true,
		callback: parseChatPage,
	},
};
const mafiaListeners = {
	"ugm-events": {
		rooms: ['mafia'],
		events: ['host', 'gamestart', 'gameend'],
		repeat: true,
		callback: onEvent,
	},
};
/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	ugm: function (target, room, user) {
		if (!this.can('roommanagement', null, room)) return;
		UGMTrackerEnabled = true;
		this.reply(`Enabled the UGM tracker.`);
	},
	disableugm: function (target, room, user) {
		if (!this.can('roommanagement', null, room)) return;
		UGMTrackerEnabled = false;
		this.reply(`Disabled the UGM tracker.`);
	},
	winfaction: function (target, room, user) {
		target = toId(target);
		if (!validAlignments.includes(target)) return this.reply(`Not a valid alignment.`);
		if (!room || !room.mafiaTracker || (room.mafiaTracker.hostid !== toId(user) && !this.can('games'))) return;
		if (room.roomid !== 'mafia') return;
		if (!UGMTrackerEnabled) return this.reply('disabled');
		const game = room.mafiaTracker;
		let winners = [];
		for (const p in game.players) {
			if (game.players[p].alignment === target) winners.push(p);
		}
		this.reply(`.addpoints ${Points(Object.keys(room.mafiaTracker.players).length, 'play')}, ${winners.join(', ')}`);
	},
	mvp: function (target, room, user) {
		if (!room || !room.mafiaTracker || !this.can('games')) return;
		if (room.roomid !== 'mafia') return;
		if (!UGMTrackerEnabled) return this.reply('disabled');
		this.reply(`.addpoints ${Points(Object.keys(room.mafiaTracker.players).length, 'mvp')}, ${target}`);
	},
};

module.exports = {
	commands,
	listeners,
	mafiaListeners,
};
