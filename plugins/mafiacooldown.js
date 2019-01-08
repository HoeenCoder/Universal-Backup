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

/**
 * @param {string} type
 * @param {string} roomid
 * @param {string[]} details
 * @param {string} message
 */
function parseEvent(type, roomid, details, message = '') {
	const room = Rooms(roomid);
	if (!room) return;
	/** @type {MafiaCooldown} */
	const cooldown = room.mafiaCooldown;
	if (!cooldown || !cooldown.enabled) return;
	switch (type) {
	case 'error':
		if (details[0] === 'Nobody on the host queue could be hosted.' || details[0] === 'Nobody is on the host queue.') {
			cooldown.onHostFail();
		}
		if (details[0].startsWith('There is already a game of')) {
			cooldown.onHostFail(true);
		}
		break;
	case 'host':
		cooldown.onHost(details[0], details[1]);
		break;
	case 'setroles':
		if (cooldown.curHost) Chat.sendPM(cooldown.curHost, `${cooldown.curHost}, please add your theme to the cooldown queue with \`\`${Config.commandTokens[0]}theme [theme]\`\`. Adding the wrong theme can result in a hostban.`);
		break;
	case 'subhost':
		if (toId(cooldown.curHost) === details[1]) cooldown.curHost = details[0];
		break;
	case 'gamestart':
		cooldown.onStart();
		break;
	case 'gameend':
		cooldown.onEnd();
		break;
	}
}

const listeners = {
	"mafia-cooldown": {
		rooms: true,
		messageTypes: ['error'],
		repeat: true,
		callback: parseEvent,
	},
};
const mafiaListeners = {
	"mafia-cooldown": {
		rooms: true,
		events: ['host', 'setroles', 'gamestart', 'gameend', 'subhost'],
		repeat: true,
		callback: parseEvent,
	},
};

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	createcooldown: function (target, room, user) {
		if (!this.can('roommanagement')) return;
		if (!room) return;
		if (room.mafiaCooldown) return this.reply('Already exists');
		room.mafiaCooldown = new MafiaCooldown(room);
		this.replyPM('done');
	},
	enablecd: 'disablecd',
	disablecd: function (target, room, user, cmd) {
		if (!this.can('games')) return;
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
		if (!this.can('games') && toId(cd.curHost) !== toId(user)) return;
		target = target.replace(/[^A-Za-z\s+&]/g, '');
		if (!target) return;
		cd.themeHistory.unshift(target);
		if (cd.themeHistory.length > cd.themeHistoryLength) cd.themeHistory.pop();
		this.replyPM(`Added ${target} to the play history.`);
		return;
	},
	t: function (target, room) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		this.reply(this.strong(`Themes on cooldown: ${cd.themeHistory.join(', ')}`));
	},
};
module.exports = {
	commands,
	listeners,
	mafiaListeners,
};
