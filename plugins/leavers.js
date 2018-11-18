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

const listeners = {
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
	if (!Config.leaversEnabled) return false;
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
			Chat.sendMessage(room, `/mafia win -${LEAVER_POINTS}, ${leaver}`);
			given.push(leaver);
		}
	}
	if (given.length) Chat.sendMessage(room, `Gave leaver points to ${given.length} user${given.length !== 1 ? 's' : ''}.`);
	if (didSomething) writeLeavers();
	pendingLeavers = {};
}

exports.mafiaListeners = listeners;
