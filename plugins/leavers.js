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

const REMINDER_MESSAGE =
"/wall " +
"Don't PM any user who you don't completely know and trust about your role, role information, or the game, for any reason. " +
"Be wary of users pretending to be other users. " +
"Giving out information can get you banned.";


Chat.events.on('chat', (/** @type {Room} */room, /** @type {string[]} */details) => {
	if (room.roomid !== 'mafia') return;
	const message = details[1].toLowerCase();
	if (message.startsWith('/announce fish') || message.startsWith('/announce official')) {
		return markOfficial(room, details[0]);
	}
});

Chat.events.on('join', (/** @type {Room} */room, /** @type {string[]} */details) => {
	if (room.roomid !== 'mafia') return;
	if (details.some(user => user.toLowerCase().replace(/[^a-z]/g, "") == 'snaquaza') && Math.random() < 0.01)
		room.send("Hi Snaq!");
	if (details.some(user => user.toLowerCase().replace(/[^a-z0-9]/g, "") == 'alexander489') && Math.random() < 0.01)
		room.send("Hi Alex!");
	}
});

/**
 * @param {Room} room
 * @param {string} user
 */
function markOfficial(room, user) {
	if (!room.mafiaTracker) return Chat.sendPM(user, "No game running, announce again once you've hosted yourself.");
	if (room.mafiaTracker.official) return Chat.sendPM(user, "This game is already marked as official.");
	Chat.sendPM(user, 'Marked the current game as official.');
	room.mafiaTracker.official = true;

	room.mafiaTracker.addMafiaListener('gamestart', () => {
		// @ts-ignore FIXME the listener CB should pass the mafiaTracker
		room.mafiaTracker.sendRoom(REMINDER_MESSAGE);
	});

	room.mafiaTracker.addMafiaListener('gameend', () => {
		/** @type {string[]} */
		let given = [];
		let didSomething;
		const now = (new Date().getFullYear()).toString() + (new Date().getMonth()).toString();
		for (const [leaver, applyPoints] of Object.entries(pendingLeavers)) {
			if (!applyPoints) continue;
			if (Leavers[leaver] !== now) {
				// free leave
				Chat.sendPM(leaver, `You have left a game. Leaving another game this month will incur a leaderboard penalty.`);
				Leavers[leaver] = now;
				didSomething = true;
			} else {
				// @ts-ignore FIXME
				room.mafiaTracker.sendRoom(`/mafia win -${LEAVER_POINTS}, ${leaver}`);
				given.push(leaver);
			}
		}
		// @ts-ignore FIXME
		if (given.length) room.mafiaTracker.sendRoom(`Gave leaver points to ${given.length} user${given.length !== 1 ? 's' : ''}.`);
		if (didSomething) writeLeavers();
		pendingLeavers = {};
	});

	room.mafiaTracker.addMafiaListener('sub', (/** @type {string[]} */details) => {
		// @ts-ignore FIXME
		if (!['night', 'day'].includes(room.mafiaTracker.phase)) return;
		pendingLeavers[toId(details[0])] = !pendingLeavers[toId(details[1])];
		pendingLeavers[toId(details[1])] = false;
	});
}

/** @type {ChatCommands} */
const commands = {
	official: function (target, room, user) {
		const mafiaRoom = Rooms('mafia');
		if (!mafiaRoom || !this.can('staff', mafiaRoom)) return;

		return markOfficial(mafiaRoom, user);
	},

	leaver: 'unleaver',
	unleaver: function (target, room, user, cmd) {
		if (!this.can('staff', Rooms('mafia'))) return;
		target = toId(target);
		const apply = !cmd.startsWith('un');
		if (!!pendingLeavers[target] === apply) return this.replyPM(`${target} is ${apply ? 'already' : 'not'} marked as a pending leaver.`);
		pendingLeavers[target] = apply;
		return this.replyPM(`${target} was ${apply ? '' : 'un'}marked as a leaver.`);
	},

	clearleaver: function (target) {
		if (!this.can('staff', Rooms('mafia'))) return;
		target = toId(target);
		if (Leavers[target] !== (new Date().getMonth())) return this.replyPM(`${target} has not left any games this month.`);
		delete Leavers[target];
		writeLeavers();
		return this.replyPM(`${target}'s grace leaver was reset.`);
	},
};

exports.commands = commands;
