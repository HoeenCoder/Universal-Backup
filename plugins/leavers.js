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

/**
 * @param {Room} room
 * @param {string} user
 */
function markOfficial(room, user) {
	if (!room.mafiaTracker) return Chat.sendPM(user, "No game running, announce again once you've hosted yourself.");
	Chat.sendPM(user, 'Marked the current game as official.');

	room.mafiaTracker.addMafiaListener('gamestart', () => {
		room.mafiaTracker.sendRoom(REMINDER_MESSAGE);
	});

	room.mafiaTracker.addMafiaListener('gameend', () => {
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
				room.mafiaTracker.sendRoom(`/mafia win -${LEAVER_POINTS}, ${leaver}`);
				given.push(leaver);
			}
		}
		if (given.length) room.mafiaTracker.sendRoom(`Gave leaver points to ${given.length} user${given.length !== 1 ? 's' : ''}.`);
		if (didSomething) writeLeavers();
		pendingLeavers = {};
	});

	room.mafiaTracker.addMafiaListener('sub', (/** @type {string[]} */details) => {
		if (!['night', 'day'].includes(room.mafiaTracker.phase)) return;
		pendingLeavers[toId(details[0])] = !pendingLeavers[toId(details[1])];
		pendingLeavers[toId(details[1])] = false;
	});
}

/** @type {import("../chat").ChatCommands} */
const commands = {
	official: function (target, room, user) {
		if (!this.can('staff')) return;
		if (!room || room.roomid !== 'mafia') return this.replyPM(`This command is only usable in the Mafia room.`);

		return markOfficial(room, user);
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
