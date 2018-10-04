'use strict';
const fs = require('fs');

const THEMES_FILE = `./config/themes.json`;
const THEMECOUNT_FILE = `./config/themecount.json`;

const BROADCAST_COOLDOWN = 90 * 1000;

/** @type {{[k: string]: string | true}} */
let Themes = loadFile(THEMES_FILE) || {};
/** @type {{[k: string]: {[k: string]: number}}} */
let PlayHistory = loadFile(THEMECOUNT_FILE) || {};
/**
 * @param {string} path
 */
function loadFile(path) {
	try {
		const json = fs.readFileSync(path);
		return (JSON.parse(json.toString()));
	} catch (e) {
		return false;
	}
}
/**
 * @param {string} path
 * @param {any} data
 */
function writeFile(path, data) {
	fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * @param {string} name
 * @returns {string | string[]}
 */
function findTheme(name) {
	let theme = Themes[name];
	if (theme) return (theme === true ? name : theme);

	let themeDistances = {};
	for (const entry of Object.keys(Themes)) {
		themeDistances[entry] = Tools.levenshtein(name, entry);
	}
	/** @type {string[]} */
	let results = [];
	let lowest = 100;

	for (const [entry, distance] of Object.entries(themeDistances)) {
		if (distance < lowest) {
			lowest = distance;
			results = [entry];
		} else if (distance === lowest) {
			results.push(entry);
		}
	}
	return results;
}
/**
 * @param {string} name
 */
function addTheme(name) {
	if (Themes[toId(name)]) return false;
	Themes[toId(name)] = true;
	writeFile(THEMES_FILE, Themes);
	return true;
}
/**
 * @param {string} name
 * @param {string} theme
 */
function addAlias(name, theme) {
	if (Themes[toId(theme)] !== true) return false;
	Themes[toId(name)] = toId(theme);
	writeFile(THEMES_FILE, Themes);
	return true;
}
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
		// Current theme, to be written when the next game starts
		this.theme = '';
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
			this.sendRoom(reply);
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
		if (this.theme) {
			this.themeHistory.unshift(this.theme);
			if (this.themeHistory.length > this.themeHistoryLength) this.themeHistory.pop();
			if (!PlayHistory[this.theme]) PlayHistory[this.theme] = 0;
			PlayHistory[this.theme]++;
			writeFile(THEMECOUNT_FILE, PlayHistory);
			this.theme = '';
		}

		if (this.timer) {
			clearTimeout(this.timer);
			this.cooldownStart = 0;
		}
		if (this.enabled && this.state !== 'pregame' && toId(by) !== toId(Config.nick)) {
			this.sendRoom(`Cooldown ended early by ${by}.`);
		}
		this.sendRoom(`Themes on cooldown: ${this.themeHistory.join(', ')}`);
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
			this.theme = '';
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
	case 'gamestart':
		cooldown.onStart();
		break;
	case 'gameend':
		cooldown.onEnd();
		break;
	}
}
Chat.addListener('mafia-cooldown-html', true, ['error'], true, parseEvent);
Mafia.addMafiaListener('cooldown-events', true, ['host', 'setroles', 'gamestart', 'gameend'], true, parseEvent);

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
	cooldown: function (target, room, user) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		cd.status(user);
		/*
		let remaining = (cd.cooldownStart + cd.cooldown * 1000) - Date.now();
		if (remaining < 1) return this.reply(`The cooldown timer is not running.`);
		this.reply(`There is ${Tools.toDurationString(remaining, {precision: 2})} left on the cooldown timer.`);
		*/
	},
	atheme: 'theme',
	theme: function (target, room, user, cmd) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		if (!this.can('games') && toId(cd.curHost) !== toId(user)) return;
		target = toId(target);
		if (!target) return;
		let theme;
		if (cmd === 'atheme') {
			theme = target;
			if (addTheme(target)) cd.sendRoom(`/mn ADDTHEME ${theme} by [${toId(user)}]`);
		} else {
			theme = findTheme(target);
			if (Array.isArray(theme)) {
				this.reply(`${target} not found. Did you mean \`\`${theme.join(', ')}\`\`? If you are certain, use \`\`${Config.commandTokens[0]}atheme ${target}\`\``);
				return;
			}
		}
		cd.theme = theme;
		this.replyPM(`Set the current theme to ${theme}.`);
		return;
	},
	t: function (target, room) {
		if (!room || !room.mafiaCooldown) return;
		/** @type {MafiaCooldown} */
		const cd = room.mafiaCooldown;
		this.reply(`Themes on cooldown: ${cd.theme ? `(${cd.theme})` : ''}${cd.themeHistory.join(', ')}`);
	},
	addtheme: function (target) {
		if (!this.can('games')) return false;
		target = toId(target);
		if (!target) return;
		if (Themes[target]) return this.reply(`Already exists`);
		addTheme(target);
		this.reply(`Done`);
	},
	removetheme: function (target) {
		if (!this.can('editroom')) return false;
		target = toId(target);
		if (!target) return;
		delete Themes[target];
		this.reply(`Done. remember to remove any pointing aliases`);
		writeFile(THEMES_FILE, Themes);
	},
	addalias: function (target) {
		if (!this.can('games')) return false;
		const args = target.split(',').map(toId);
		if (args.length !== 2) return this.reply(`Invalid syntax`);
		if (addAlias(args[0], args[1])) return this.reply('Done');
		this.reply(`Target is not a theme - make sure it's not pointing at an existing alias`);
	},
	playcounts: function (target) {
		if (!this.can('games')) return;
		const themes = `<details><summary>Theme playcounts: </summary>` +
		Object.entries(PlayHistory).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}: ${v}`).join('<br />') +
		`</details>`;
		if (this.room) return this.reply(`/addhtmlbox ${themes}`);
		this.replyHTMLPM(themes);
	},
};
exports.commands = commands;
