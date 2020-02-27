'use strict';

const fs = require('fs');

let Mafia = module.exports;

Mafia.data = require('./mafia-data');

Mafia.events = new Tools.Events();

/**
 * @param {Room} room
 * @param {string[]} parts
 */
function parseChat(room, parts) {
	if (!room) return;
	const author = parts[0];
	const message = parts.slice(1).join('|');
	/** @type {(event: string, details: string[]) => void} */
	function emit(event, details) {
		if (!room.mafiaTracker) return; // happens when joining a room with a mafia game running
		Mafia.events.emit(event, room.mafiaTracker, details, message);
	}

	if (author === '~') {
		let lynch = /^(.*) has (lynch|unlynch)ed (.*)\.$/.exec(message);
		if (lynch) return emit('lynch', [lynch[2], lynch[1], lynch[3]]);
		lynch = /^(.*) has shifted their lynch from (.*) to (.*)$/.exec(message);
		if (lynch) return emit('lynch', ['shift', ...lynch.slice(1, 4)]);
		lynch = /^(.*) has abstained from lynching\.$/.exec(message);
		if (lynch) return emit('lynch', ['nolynch', lynch[1]]);
		lynch = /^(.*) is no longer abstaining from lynching\.$/.exec(message);
		if (lynch) return emit('lynch', ['unnolynch', lynch[1]]);

		const playerList = /^\*\*Players \(\d+\)\*\*: (.*)$/.exec(message);
		if (playerList) return emit('players', [playerList[1]]);
	} else {
		const host = /^\/log (.*) was appointed the mafia host by (.*)\.$/.exec(message);
		if (host) {
			room.mafiaTracker = new MafiaTracker(room, host[1]);
			return emit('host', [host[1], host[2]]);
		}
	}
}

/**
 * @param {Room} room
 * @param {string[]} parts
 */
function parseHTML(room, parts) {
	if (!room) return;

	const message = Tools.unescapeHTML(parts.join('|'));
	/** @type {(event: string, details: string[]) => void} */
	function emit(event, details) {
		if (!room.mafiaTracker) return;
		Mafia.events.emit(event, room.mafiaTracker, details, message);
	}

	if (message === '<div class="broadcast-blue">The game of Mafia is starting!</div>') return emit('gamestart', []);
	if (message === 'mafia|<div class="infobox">The game of Mafia has ended.</div>') return emit('gameend', []);

	let event = /^<div class="broadcast-blue">Night (\d+). PM the host your action, or idle\.<\/div>$/.exec(message);
	if (event) return emit('night', [event[1]]);
	event = /^<div class="broadcast-blue">Day (\d+)\. The hammer count is set at (\d+)<\/div>$/.exec(message);
	if (event) return emit('day', event.slice(1, 3));

	event = /^<div class="broadcast-blue">(.+) was kicked from the game!<\/div>$/.exec(message);
	if (event) return emit('kill', ['kick', event[1]]);
	event = /^<div class="broadcast-blue">(.+) was eliminated!\s?<\/div>$/.exec(message);
	if (event) return emit('kill', ['killnoreveal', event[1]]);
	event = /^<div class="broadcast-blue">(.+) has been treestumped!<\/div>$/.exec(message);
	if (event) return emit('kill', ['treestump', event[1]]);
	event = /^<div class="broadcast-blue">(.+) became a restless spirit!<\/div>$/.exec(message);
	if (event) return emit('kill', ['spirit', event[1]]);
	event = /^<div class="broadcast-blue">(.+) became a restless treestump!<\/div>$/.exec(message);
	if (event) return emit('kill', ['spiritstump', event[1]]);

	event = /^<div class="broadcast-blue">(.+) was eliminated! .+'s role was <span style="font-weight:bold;color:(.+)">(.+)<\/span>\.<\/div>$/.exec(message);
	if (event) return emit('kill', ['kill', event[1], event[3], event[2]]); // player, role, color

	event = /^<div class="broadcast-blue">(.+) was revived!<\/div>$/.exec(message);
	if (event) return emit('revive', [event[1]]);

	event = /^<div class="broadcast-blue">(.+) has been added to the game by (.+)!<\/div>$/.exec(message);
	if (event) return emit('add', event.slice(1, 3));

	event = /^<div class="broadcast-blue">Hammer! (.+) was lynched!<\/div>$/.exec(message);
	if (event) return emit('hammer', [event[1]]);

	event = /^<div class="broadcast-blue">(.*) has been subbed out\. (.*) has joined the game\.<\/div>$/.exec(message);
	if (event) return emit('sub', [event[1], event[2]]);

	event = /^<div class="broadcast-blue">(.*) has been substituted as the new host, replacing (.*)\.<\/div>$/.exec(message);
	if (event) return emit('subhost', [event[1], event[2]]);

	event = /^<div class="broadcast-blue">(.*) has been added as a cohost by (.*)<\/div>$/.exec(message);
	if (event) return emit('cohost', [event[1], event[2]]);
	event = /^<div class="broadcast-blue">(.*) was removed as a cohost by (.*)<\/div>$/.exec(message);
	if (event) return emit('uncohost', [event[1], event[2]]);

	event = /^<div class="broadcast-blue">The hammer count has been set at (\d+), and lynches have been reset\.<\/div>$/.exec(message);
	if (event) return emit('sethammer', ['reset', event[1]]);
	event = /^<div class="broadcast-blue">The hammer count has been shifted to (\d+)\. Lynches have not been reset\.<\/div>$/.exec(message);
	if (event) return emit('sethammer', ['shift', event[1]]);

	event = /^<strong>The deadline has been set for (\d+) minutes\.<\/strong>$/.exec(message);
	if (event) return emit('deadlineset', [event[1]]);
	event = /^<strong>Time is up!<\/strong>$/.exec(message);
	if (event) return emit('deadline', []);

	if (room.mafiaTracker && (room.mafiaTracker.hostid === Config.nickid || room.mafiaTracker.cohosts.includes(Config.nickid))) {
		if (room.mafiaTracker.hasRoles) return;
		const players = room.mafiaTracker.players;
		const message = parts.join('|');
		if (message.slice(0, 21) !== `<div class="infobox">` || message.slice(-6) !== `</div>`) return;
		const lines = message.slice(21, -6).split('<br/>');
		for (let line of lines) {
			line = Tools.unescapeHTML(line);
			const splitIndex = line.indexOf(':');
			if (splitIndex < 0) return;
			const player = players[toId(line.slice(0, splitIndex))];
			if (!player) return;
			player.role = line.slice(splitIndex + 1);
		}
		room.mafiaTracker.hasRoles = true;
		return emit('playerroles', []);
	}
}
/**
 * @param {Room} room
 * @param {string[]} parts
 */
function parseRaw(room, parts) {
	if (!room) return;
	const message = parts.join('|');
	/** @type {(event: string, details: string[]) => void} */
	function emit(event, details) {
		if (!room.mafiaTracker) return;
		Mafia.events.emit(event, room.mafiaTracker, details, message);
	}

	const leave = /^(.*) has (join|left)(?:ed)? the game\.$/.exec(message);
	if (leave) return emit(leave[2], [leave[1]]);

	if (message === "The roles have been set.") return emit('setroles', []);

	const plur = /^Plurality is on (.*)$/.exec(message);
	if (plur) return emit('plur', [plur[1]]);
}

Chat.events.on('chat', parseChat);
Chat.events.on('html', parseHTML);
Chat.events.on('raw', parseRaw);

/**
 * @typedef {object} MafiaTrackerOptions
 * @property {"night" | "day"} [phase]
 * @property {boolean} [end]
 * @property {number | false} [deadline]
 * @property {string[]} [add]
 * @property {string[]} [kill]
 * @property {boolean} [reveal]
 * @property {boolean} [nolynch]
 * @property {boolean | "hammer"} [selflynch]
 * @property {number} [shifthammer]
 * @property {number} [hammer]
 */

class MafiaPlayer extends Rooms.RoomGamePlayer {
	/**
	 * @param {string} user
	 */
	constructor(user) {
		super(user);
		this.dead = false;
		this.spirit = false;
		this.treestump = false;

		this.role = '';
		this.roleRevealed = false;
	}
}

class MafiaTracker extends Rooms.RoomGame {
	/**
	 * @param {Room} room
	 * @param {string} host
	 */
	constructor(room, host) {
		super(room);

		/** @type {{[k: string]: MafiaPlayer}} */
		this.players = {};

		this.aliveCount = 0;
		this.deadCount = 0;

		this.host = host;
		this.hostid = toId(host);
		/** @type {string[]} */
		this.cohosts = [];
		/** @type {"signups" | "locked" | "IDEApicking" | "IDEAlocked" | "day" | "night" | "ended"} */
		// locked doesnt get used cause it's a pain to detect and also not relevent
		this.phase = "signups";

		this.hasRoles = false;
		/** @type {object[]} */
		this.chatListeners = [];
		/** @type {object[]} */
		this.mafiaListeners = [];

		/** @type {import('./plugins/iso').ISOType?} */
		this.iso = null;

		this.log(`init ${this.host}`);

		this.game = null;
		this.data = null;
	}

	/** @param {string} player */
	onJoin(player) {
		log(`join ${player}`);
		this.addPlayer(player);
	}
	/** @param {string} player */
	onLeave(player) {
		log(`leave ${player}`);
		this.removePlayer(player);
	}
	/**
	 * @param {string} type
	 * @param {string} player
	 * @param {string} role
	 */
	onKill(type, player, role = '') {
		const userid = toId(player);
		this.players[userid].dead = true;
		this.players[userid].spirit = type.includes('spirit');
		this.players[userid].treestump = type.includes('stump');
		this.log(`killed ${userid}`);
		this.aliveCount--;
		if (this.phase !== 'signups') {
			this.deadCount++;
		} else {
			delete this.players[userid];
		}
	}
	/** @param {string} player */
	onRevive(player) {
		const userid = toId(player);
		this.players[userid].dead = false;
		this.players[userid].spirit = false;
		this.players[userid].treestump = false;
		this.aliveCount++;
		this.deadCount--;
	}
	onStart() {
		if (this.hostid === Config.nickid || this.cohosts.includes(Config.nickid)) this.sendRoom("/mafia playerroles");
	}
	onEnd() {
		this.phase = 'ended';
		for (const listener of this.chatListeners) {
			Chat.events.remove(listener);
		}
		for (const listener of this.mafiaListeners) {
			// slight hack to make this event fire
			if (listener.event === 'gameend') listener.callback(this);
			Mafia.events.remove(listener);
		}
	}
	onDay() {
		this.phase = 'day';
	}
	onNight() {
		this.phase = 'night';
	}
	/**
	 * @param {string} player
	 */
	addPlayer(player) {
		const playerid = toId(player);
		this.players[playerid] = new MafiaPlayer(player);
		this.aliveCount++;
		this.log(`addPlayer ${playerid}`);
	}
	/**
	 * @param {string} player
	 */
	removePlayer(player) {
		const playerid = toId(player);
		if (this.players[playerid].dead) {
			this.deadCount--;
		} else {
			this.aliveCount--;
		}
		delete this.players[playerid];
		this.log(`removePlayer ${playerid}`);
	}

	/**
	 * @param {string} oldName
	 * @param {string} newName
	 */
	sub(oldName, newName) {
		const oldId = toId(oldName);
		const newId = toId(newName);

		this.players[newId] = this.players[oldId];
		delete this.players[oldId];
		this.players[newId].user = newName;

		if (this.game && this.game.triggers.sub) this.game.triggers.sub.call(this, oldName, newName);
	}

	/**
	 * @param {string} newName
	 * @param {string} oldId
	 */
	subHost(newName, oldId) {
		if (this.hostid !== oldId) return this.sendRoom(`Subhost desync - "${this.hostid}"/"${this.host}" not ${oldId}`);
		this.hostid = toId(newName);
		this.host = newName;
	}

	/**
	 * @param {string} name
	 */
	addCohost(name) {
		this.cohosts.push(toId(name));
	}
	/**
	 * @param {string} name
	 */
	removeCohost(name) {
		this.cohosts.splice(this.cohosts.indexOf(toId(name)), 1);
	}

	/**
	 * @param {string} m
	 */
	log(m) {
		if (!Config.mafiaDebug) return;
		if (Config.mafiaDebug === true) this.sendRoom(m);
		console.log(`[MAFIA] ${m}`);
	}
	/**
	 * @param {string} event
	 * @param {(arg0: string[], arg1: string) => void} callback
	 */
	addChatListener(event, callback) {
		this.chatListeners.push(Chat.events.on(event,
			(/** @type {Room | string | null} */room, /** @type {string[]} */details, /** @type {string} */message) => {
				// @ts-ignore
				if (room && room.mafiaTracker === this) return callback(details, message);
			}));
	}
	/**
	 * @param {string} event
	 * @param {(arg0: string[], arg1: string) => void} callback
	 */
	addMafiaListener(event, callback) {
		this.mafiaListeners.push(Mafia.events.on(event,
			(/** @type {MafiaTracker} */tracker, /** @type {string[]} */details, /** @type {string} */message) => {
				if (tracker === this) return callback(details, message);
			}));
	}

	/**
	 * @param {object} game
	 */
	addGame(game) {
		if (this.game) return this.sendRoom('Game already exists.');
		this.game = game;
		this.data = game.data || {};
		if (this.game.triggers.create) this.game.triggers.create.call(this);
	}
	removeGame() {
		this.game = null;
		this.data = null;
	}
	/**
	 * @param {string} m
	 */
	destroy(m = '') {
		if (m) this.sendRoom(m);
		this.sendRoom(`/mafia end`);
	}
	/**
     * @param {MafiaTrackerOptions} options
     */
	applyOption(options) {
		if (!this.game) throw new Error(`Trying to use actions when not host: ${JSON.stringify(options)}`);
		if (options.end) this.sendRoom(`/mafia end`);
		if (options.phase) this.sendRoom(`/mafia ${options.phase}`);
		if (options.kill) {
			for (const p of options.kill) {
				this.sendRoom(`/mafia kill ${p}`);
			}
		}
		if (options.add) this.sendRoom(`/mafia forceadd ${options.add.join(',')}`);
		if (options.hasOwnProperty('selflynch')) {
			if (options.selflynch === true) this.sendRoom(`/mafia enableself`);
			if (options.selflynch === false) this.sendRoom(`/mafia disableself`);
			if (options.selflynch === 'hammer') this.sendRoom(`/mafia selflynch hammer`);
		}
		if (options.hasOwnProperty('nolynch')) this.sendRoom(`/mafia ${options.nolynch ? 'enable' : 'disable'}nl`);
		if (options.hasOwnProperty('reveal')) this.sendRoom(`/mafia reveal ${options.reveal ? 'on' : 'off'}`);
		if (options.hasOwnProperty('deadline')) this.sendRoom(`/mafia dl ${options.deadline === false ? 'off' : options.deadline}`);
		if (options.hasOwnProperty('shifthammer')) this.sendRoom(`/mafia shifthammer ${options.shifthammer}`);
		if (options.hasOwnProperty('hammer')) this.sendRoom(`/mafia hammer ${options.hammer}`);
	}
}

Mafia.MafiaTracker = MafiaTracker;
Mafia.MafiaPlayer = MafiaPlayer;

Mafia.events.on('kill', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.onKill(details[0], details[1], details[2]));
Mafia.events.on('add', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.addPlayer(details[0]));
Mafia.events.on('join', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.onJoin(details[0]));
Mafia.events.on('left', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.onLeave(details[0]));
Mafia.events.on('sub', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.sub(details[0], details[1]));
Mafia.events.on('revive', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.onRevive(details[0]));
Mafia.events.on('day', (/**@type {MafiaTracker}*/t) => t.onDay());
Mafia.events.on('night', (/**@type {MafiaTracker}*/t) => t.onNight());
Mafia.events.on('subhost', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.subHost(details[0], details[1]));
Mafia.events.on('cohost', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.addCohost(details[0]));
Mafia.events.on('uncohost', (/**@type {MafiaTracker}*/t, /**@type {string[]}*/details) => t.removeCohost(details[0]));
Mafia.events.on('gamestart', (/**@type {MafiaTracker}*/t) => t.onStart());
Mafia.events.on('gameend', (/** @type {MafiaTracker}*/t) => t.onEnd());

/** @type {{[k: string]: object}} */
Mafia.games = {};
Mafia.loadGames = function () {
	const files = fs.readdirSync('mafia-games');
	for (const file of files) {
		if (file.substr(-3) !== '.js') continue;
		const plugin = require('./mafia-games/' + file);
		Object.assign(Mafia.games, plugin.games);
	}
	debug(`${Object.keys(Mafia.games).length} mafia games loaded`);
};
Mafia.loadGames();

/** @typedef {MafiaTracker} MafiaTrackerType */
