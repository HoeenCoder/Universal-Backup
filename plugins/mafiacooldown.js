'use strict';

const BROADCAST_COOLDOWN = 90 * 1000;

class MafiaCooldown extends Rooms.RoomGame {
	/**
     * @param {Room} room
     */
	constructor(room) {
		super(room);
		this.roomid = room.roomid;
		this.enabled = true;
		/** @type {"pregame" | "signups" | "game" | "cooldown"} */
		this.state = 'pregame';
		/** @type {string?} */
		this.curHost = null;
		/** @type {NodeJS.Timer?} */
		this.timer = null;
		this.cooldownStart = 0;
		this.cooldown = Config.MafiaCooldown || 60;
		this.lastBroadcast = 0;
		/** @type {string[]} */
		this.themeHistory = [];
		this.themeHistoryLength = 2;
	}

	/**
	 * @param {string} user
	 */
	status(user) {
		let remaining = (this.cooldownStart + this.cooldown * 1000) - Date.now();
		let reply = '';
		if (remaining < 1) {
			reply = `The cooldown timer is not running.`;
		} else {
			reply = `There is ${Tools.toDurationString(remaining, {precision: 2})} left on the cooldown timer.`;
		}
		if (Date.now() > (this.lastBroadcast + BROADCAST_COOLDOWN)) {
			this.sendRoom(Chat.strong(this.room, reply));
			this.lastBroadcast = Date.now();
		} else {
			Chat.sendPM(user, reply);
		}
	}
	/**
     * @param {string} user
     * @param {string} by
     */
	onHost(user, by) {
		if (this.timer) {
			clearTimeout(this.timer);
			this.cooldownStart = 0;
		}
		if (this.enabled && this.state !== 'pregame' && toId(by) !== toId(Config.nick)) {
			this.sendRoom(`Cooldown ended early by ${by}.`);
		}
		this.sendRoom(Chat.strong(this.room, `Themes on cooldown: ${this.themeHistory.join(', ')}`));
		this.state = 'signups';
		this.curHost = user;
	}

	onEnd() {
		this.curHost = null;
		if (this.state === 'game') {
			this.state = 'cooldown';
			if (this.enabled) {
				this.cooldownStart = Date.now();
				this.timer = setTimeout(() => this.nextHost(), this.cooldown * 1000);
				this.sendRoom(`Cooldown time - The next mafia game can start in ${Tools.toDurationString(this.cooldown * 1000, {precision: 2})}.`);
			}
		} else {
			this.state = 'pregame';
			this.sendRoom(`No game was properly started - A new user can be hosted anytime`);
			this.curHost = null;
		}
	}

	onStart() {
		this.state = 'game';
	}

	nextHost() {
		if (!this.enabled) return;
		this.state = 'pregame';
		this.sendRoom('/mafia nexthost');
	}

	onHostFail(activeGame = false) {
		if (!this.enabled) return;
		this.sendRoom(`Nobody could be automatically hosted ${activeGame ? 'because another game is being played' : ''} - host a user manually and the queue will continue`);
	}

	disable() {
		if (!this.enabled) return this.sendRoom(`Cooldown already disabled`);
		this.enabled = false;
		if (this.timer) {
			clearTimeout(this.timer);
			this.cooldownStart = 0;
		}
		this.sendRoom(`The mafia cooldown was disabled`);
	}
	enable() {
		if (this.enabled) return this.sendRoom(`Cooldown already enabled`);
		this.enabled = true;
		if (this.state === 'cooldown') this.state = 'pregame';
		this.sendRoom(`The mafia cooldown was enabled`);
	}
}

Chat.events.on('error', (/** @type {Room} */room, /** @type {string[]} */details) => {
	if (!room || !room.mafiaCooldown) return;
	if (details[0] === 'Nobody on the host queue could be hosted.' || details[0] === 'Nobody is on the host queue.') {
		room.mafiaCooldown.onHostFail();
	}
	if (details[0].startsWith('There is already a game of')) {
		room.mafiaCooldown.onHostFail(true);
	}
});
Mafia.events.on('host', (/** @type {MafiaTracker} */tracker, /** @type {string[]} */details) => {
	if (tracker.room.mafiaCooldown) tracker.room.mafiaCooldown.onHost(details[0], details[1]);
});
Mafia.events.on('setroles', (/** @type {MafiaTracker} */tracker, /** @type {string[]} */details) => {
	const cd = tracker.room.mafiaCooldown;
	if (cd && cd.curHost) { Chat.sendPM(cd.curHost, `${cd.curHost}, please add your theme to the cooldown queue with \`\`${Config.commandTokens[0]}theme [theme]\`\`. Adding the wrong theme can result in a hostban.`); }
});
Mafia.events.on('subhost', (/** @type {MafiaTracker} */tracker, /** @type {string[]} */details) => {
	if (tracker.room.mafiaCooldown) tracker.room.mafiaCooldown.curHost = details[0];
});
Mafia.events.on('gamestart', (/** @type {MafiaTracker} */tracker, /** @type {string[]} */details) => {
	if (tracker.room.mafiaCooldown) tracker.room.mafiaCooldown.onStart();
});
Mafia.events.on('gameend', (/** @type {MafiaTracker} */tracker, /** @type {string[]} */details) => {
	if (tracker.room.mafiaCooldown) tracker.room.mafiaCooldown.onEnd();
});

/** @type {import("../chat").ChatCommands} */
const commands = {
	createcooldown: function (target, room, user) {
		if (!this.can('leader')) return;
		if (!room) return;
		if (room.mafiaCooldown) return this.reply('Already exists');
		room.mafiaCooldown = new MafiaCooldown(room);
		this.replyPM('done');
	},
	enablecd: 'disablecd',
	disablecd: function (target, room, user, cmd) {
		if (!this.can('staff')) return;
		if (!room || !room.mafiaCooldown) return;
		if (cmd === 'enablecd') {
			room.mafiaCooldown.enable();
		} else {
			room.mafiaCooldown.disable();
		}
	},
	cooldown: function (target, room, user) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		cd.status(user);
	},
	theme: function (target, room, user, cmd) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		if (!this.can('host') && toId(cd.curHost) !== toId(user)) return;
		const safeTarget = Tools.sanitize(target);
		if (!safeTarget) return;
		cd.themeHistory.unshift(safeTarget);
		if (cd.themeHistory.length > cd.themeHistoryLength) cd.themeHistory.pop();
		this.replyPM(`Added ${safeTarget} to the play history.`);
	},
	t: function (target, room) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		this.reply(this.strong(`Themes on cooldown: ${cd.themeHistory.join(', ')}`));
	},
};
exports.commands = commands;

/** @typedef {MafiaCooldown} MafiaCooldownT */