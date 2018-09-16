'use strict';

class MafiaCooldown extends Rooms.RoomGame {
	/**
     * @param {Room} room
     */
	constructor(room) {
		super(room);
		this.roomid = room.roomid;
		this.enabled = true;
		/** @type {"pregame" | "game" | "cooldown"} */
		this.state = 'pregame';
		/** @type {string?} */
		this.curHost = null;
		/** @type {NodeJS.Timer?} */
		this.timer = null;
		this.cooldown = Config.MafiaCooldown || 10;
		/** @type {string[]} */
		this.themeHistory = [];
		this.themeHistoryLength = 2;
	}

	/**
     * @param {string} user
     * @param {string} by
     */
	onHost(user, by) {
		if (this.timer) clearTimeout(this.timer);
		if (this.enabled && this.state !== 'pregame' && toId(by) !== toId(Config.nick)) {
			this.sendRoom(`Cooldown ended early by ${by}.`);
		}
		this.sendRoom(`Themes on cooldown: ${this.themeHistory.join(', ')}`);
		this.state = 'game';
		this.curHost = user;
	}

	onEnd() {
		this.state = 'cooldown';
		this.curHost = null;
		if (this.enabled) {
			this.timer = setTimeout(() => this.nextHost(), this.cooldown * 1000);
			let time = `${this.cooldown} seconds`;
			if (this.cooldown > 60) {
				time = `${Math.round(this.cooldown / 60)} minutes`;
			}
			this.sendRoom(`Cooldown time - The next mafia game can start in ${time}.`);
		}
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
		if (this.timer) clearTimeout(this.timer);
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
	if (!cooldown) return;
	switch (type) {
	case 'error':
		if (details[0] === 'Nobody on the host queue could be hosted.' || details[0] === 'Nobody is on the host queue.') {
			cooldown.onHostFail();
		}
		if (details[0] === 'There is already a game in progress in this room.') {
			cooldown.onHostFail(true);
		}
		break;
	case 'host':
		cooldown.onHost(details[0], details[1]);
		break;
	case 'setroles':
		if (cooldown.curHost) Chat.sendPM(cooldown.curHost, `${cooldown.curHost}, please add what theme your hosting to the cooldown queue with \`\`@theme [Name of theme]\`\` in the ${room.title} room. Adding a different theme to the queue than the theme you actually hosted can result in a hostban.`);
		break;
	case 'gameend':
		cooldown.onEnd();
		break;
	}
}
Chat.addListener('mafia-cooldown-html', true, ['error'], parseEvent, true);
Mafia.addMafiaListener('cooldown-events', true, ['host', 'setroles', 'gameend'], parseEvent, true);

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	createcooldown: function (target, room, user) {
		if (!this.can('roommanagement')) return;
		if (!room) return;
		if (room.mafiaCooldown) return this.reply('Already exists');
		room.mafiaCooldown = new MafiaCooldown(room);
		this.reply('done');
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
	theme: function (target, room, user) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		if (!this.can('games') && toId(cd.curHost) !== toId(user)) return;
		cd.themeHistory.unshift(toId(target));
		if (cd.themeHistory.length > cd.themeHistoryLength) cd.themeHistory.pop();
		this.reply(`Added ${toId(target)} to the played themes history`);
		if (toId(cd.curHost) === toId(user)) cd.curHost = null;
	},
	t: function (target, room) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		this.reply(`Themes on cooldown: ${cd.themeHistory.join(', ')}`);
	},
};
exports.commands = commands;
