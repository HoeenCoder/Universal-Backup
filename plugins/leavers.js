'use strict';

const fs = require('fs');

/** @type {{[k: string]: boolean}} */
let pendingLeavers = {};
const LEAVER_POINTS = 5;
const LEAVER_FILE = './config/leavers.json';
/** @type {{[k: string]: number}} */
let Leavers = {};
try {
	Leavers = JSON.parse(fs.readFileSync(LEAVER_FILE).toString());
} catch (e) {}

function writeLeavers() {
	fs.writeFileSync(LEAVER_FILE, JSON.stringify(Leavers));
}

let official = false;

const mafiaListeners = {
	"leaver-sub": {
		rooms: ['mafia'],
		events: ['sub'],
		repeat: true,
		callback: onSub,
	},
	"leaver-end": {
		rooms: ['mafia'],
		events: ['gameend'],
		repeat: true,
		callback: onEnd,
	},
};

const listeners = {
	"leaver-official": {
		rooms: ['mafia'],
		messageTypes: ['chat'],
		repeat: true,
		callback: parseChat,
	},
};

/**
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 */
function onSub(event, roomid, details) {
	const room = Rooms(roomid);
	const phase = room && room.mafiaTracker && room.mafiaTracker.phase;
	if (phase && (phase !== 'night' && phase !== 'day')) return;
	pendingLeavers[toId(details[0])] = !pendingLeavers[toId(details[1])];
	pendingLeavers[toId(details[1])] = false;
}

/**
 * @param {string} event
 * @param {string} room
 * @param {string[]} details
 */
function onEnd(event, room, details) {
	if (!official) {
		pendingLeavers = {};
		return;
	}
	official = false;
	/** @type {string[]} */
	let given = [];
	let didSomething;
	const now = new Date().getMonth();
	for (const [leaver, applyPoints] of Object.entries(pendingLeavers)) {
		if (!applyPoints) continue;
		if (Leavers[leaver] !== now) {
			// free leave
			Chat.sendPM(leaver, `You have left a game. Leaving another game this month will incur a leaderboard penalty.`);
			Leavers[leaver] = now;
			didSomething = true;
		} else {
			Chat.sendMessage(room, `mafia win -${LEAVER_POINTS}, ${leaver}`);
			given.push(leaver);
		}
	}
	if (given.length) Chat.sendMessage(room, `Gave leaver points to ${given.length} user${given.length !== 1 ? 's' : ''}.`);
	if (didSomething) writeLeavers();
	pendingLeavers = {};
}

/**
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 */
function parseChat(event, roomid, details) {
	if (details[1].toLowerCase().startsWith('/announce official')) {
		if (!official) Chat.sendPM(details[0], `Marked the current game as an official. Use ${Config.commandTokens[0]}notofficial to remove.`);
		official = true;
	}
}

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	notofficial: 'official',
	official: function (target, room, user, cmd) {
		if (!this.can('games', null, room)) return;
		//if (!room || room.roomid !== 'mafia') return this.reply(`Not valid in this room.`);
		official = !cmd.includes('not');
		this.replyPM(`Marked the current game as ${official ? '' : 'not '}an official.`);
	},
	leaver: 'unleaver',
	unleaver: function (target, room, user, cmd) {
		if (!this.can('games')) return;
		target = toId(target);
		const apply = !cmd.startsWith('un');
		if (!!pendingLeavers[target] === apply) return this.replyPM(`${target} is ${apply ? 'already' : 'not'} marked as a pending leaver.`);
		pendingLeavers[target] = apply;
		return this.replyPM(`${target} was ${apply ? '' : 'un'}marked as a leaver.`);
	},

	clearleaver: function (target) {
		if (!this.can('games')) return;
		target = toId(target);
		if (Leavers[target] !== (new Date().getMonth())) return this.replyPM(`${target} has not left any games this month.`);
		delete Leavers[target];
		writeLeavers();
		return this.replyPM(`${target}'s grace leaver was reset.`);
	},
};
module.exports = {
	commands,
	listeners,
	mafiaListeners,
};
