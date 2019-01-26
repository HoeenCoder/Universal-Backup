'use strict';

const fs = require('fs');

let Mafia = module.exports;

Mafia.data = require('./mafia-data');

/** @typedef {(event: string, roomid: string, details: string[], message: string) => (true | void)} MafiaEventCallback */

/** @type {{[k: string]: {rooms: string[] | true, events: string[] | true, callback: MafiaEventCallback, repeat: number | true}}} */
Mafia.listeners = {};

/**
 * @param {string} id
 * @param {string[] | true} rooms
 * @param {string[] | true} events
 * @param {MafiaEventCallback} callback
 * @param {number | true} repeat
 */
Mafia.addMafiaListener = function (id, rooms, events, repeat, callback) {
	if (Mafia.listeners[id]) debug(`Overwriting existing mafia listener: '${id}'`);
	Mafia.listeners[id] = {rooms, events, callback, repeat};
	return id;
};
/**
 * @param {string} id
 */
Mafia.removeMafiaListener = function (id) {
	if (!Mafia.listeners[id]) return false;
	delete Mafia.listeners[id];
	return true;
};

/**
 * @param {string} roomid
 * @param {string} event
 * @param {string[]} details
 * @param {string} message
 */
function emitEvent(roomid, event, details, message) {
	for (const id in Mafia.listeners) {
		const listener = Mafia.listeners[id];
		if (listener.events !== true && !listener.events.includes(event)) continue;
		if (listener.rooms !== true && !listener.rooms.includes(roomid)) continue;
		const result = listener.callback(event, roomid, details, message);

		if (result === true) {
			if (listener.repeat !== true) listener.repeat--;
			if (listener.repeat === 0) delete Mafia.listeners[id];
		}
	}
	log(`MAFIAEVENT: ${event}: ${JSON.stringify(details)} in ${roomid}: "${message}"`);
}

/**
 * @param {string} messageType
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseChat(messageType, roomid, parts) {
	const author = parts[0];
	const message = parts.slice(1).join('|');

	if (author === '~') {
		let lynch = /^(.*) has (lynch|unlynch)ed (.*)\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', [lynch[2], lynch[1], lynch[3]], message);
		lynch = /^(.*) has shifted their lynch from (.*) to (.*)$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', ['shift', ...lynch.slice(1, 4)], message);
		lynch = /^(.*) has abstained from lynching\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', ['nolynch', lynch[1]], message);
		lynch = /^(.*) is no longer abstaining from lynching\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', ['unnolynch', lynch[1]], message);

		const playerList = /^\*\*Players \(\d+\)\*\*: (.*)$/.exec(message);
		if (playerList) return emitEvent(roomid, 'players', [playerList[1]], message);
	} else {
		const host = /^\/log (.*) was appointed the mafia host by (.*)\.$/.exec(message);
		if (host) return emitEvent(roomid, 'host', [host[1], host[2]], message);
	}
}

/**
 * @param {string} messageType
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseHTML(messageType, roomid, parts) {
	const message = Tools.unescapeHTML(parts.join('|'));
	if (message === '<div class="broadcast-blue">The game of Mafia is starting!</div>') return emitEvent(roomid, 'gamestart', [], message);
	if (message === 'mafia|<div class="infobox">The game of Mafia has ended.</div>') return emitEvent(roomid, 'gameend', [], message);

	let event = /^<div class="broadcast-blue">Night (\d+). PM the host your action, or idle\.<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'night', [event[1]], message);
	event = /^<div class="broadcast-blue">Day (\d+)\. The hammer count is set at (\d+)<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'day', event.slice(1, 3), message);

	event = /^<div class="broadcast-blue">(.+) was kicked from the game!<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'kill', ['kick', event[1]], message);
	event = /^<div class="broadcast-blue">(.+) was eliminated!\s?<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'kill', ['killnoreveal', event[1]], message);
	event = /^<div class="broadcast-blue">(.+) has been treestumped!<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'kill', ['treestump', event[1]], message);
	event = /^<div class="broadcast-blue">(.+) became a restless spirit!<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'kill', ['spirit', event[1]], message);
	event = /^<div class="broadcast-blue">(.+) became a restless treestump!<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'kill', ['spiritstump', event[1]], message);

	event = /^<div class="broadcast-blue">(.+) was eliminated! .+'s role was <span style="font-weight:bold;color:(.+)">(.+)<\/span>\.<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'kill', ['kill', event[1], event[3], event[2]], message); // player, role, color

	event = /^<div class="broadcast-blue">(.+) was revived!<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'revive', [event[1]], message);

	event = /^<div class="broadcast-blue">(.+) has been added to the game by (.+)!<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'add', event.slice(1, 3), message);

	event = /^<div class="broadcast-blue">Hammer! (.+) was lynched!<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'hammer', [event[1]], message);

	event = /^<div class="broadcast-blue">(.*) has been subbed out\. (.*) has joined the game\.<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'sub', [event[1], event[2]], message);

	event = /^<div class="broadcast-blue">(.*) has been substituted as the new host, replacing (.*)\.<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'subhost', [event[1], event[2]], message);

	event = /^<div class="broadcast-blue">(.*) has been added as a cohost by (.*)<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'cohost', [event[1], event[2]], message);
	event = /^<div class="broadcast-blue">(.*) was removed as a cohost by (.*)<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'uncohost', [event[1], event[2]], message);

	event = /^<div class="broadcast-blue">The hammer count has been set at (\d+), and lynches have been reset\.<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'sethammer', ['reset', event[1]], message);
	event = /^<div class="broadcast-blue">The hammer count has been shifted to (\d+)\. Lynches have not been reset\.<\/div>$/.exec(message);
	if (event) return emitEvent(roomid, 'sethammer', ['shift', event[1]], message);

	event = /^<strong>The deadline has been set for (\d+) minutes\.<\/strong>$/.exec(message);
	if (event) return emitEvent(roomid, 'deadlineset', [event[1]], message);
	event = /^<strong>Time is up!<\/strong>$/.exec(message);
	if (event) return emitEvent(roomid, 'deadline', [], message);
}
/**
 * @param {string} messageType
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseRaw(messageType, roomid, parts) {
	const message = parts.join('|');
	const leave = /^(.*) has (join|left)(?:ed)? the game\.$/.exec(message);
	if (leave) return emitEvent(roomid, leave[2], [leave[1]], message);

	if (message === "The roles have been set.") return emitEvent(roomid, 'setroles', [], message);

	const plur = /^Plurality is on (.*)$/.exec(message);
	if (plur) return emitEvent(roomid, 'plur', [plur[1]], message);
}

Chat.addListener("mafia-events-chat", true, ['chat'], true, parseChat);
Chat.addListener("mafia-events-html", true, ['html', 'uhtml'], true, parseHTML);
Chat.addListener("mafia-events-raw", true, ['raw'], true, parseRaw);
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
		if (this.hostid === toId(Config.nick) || this.cohosts.includes(toId(Config.nick))) this.findRoles();
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
	 * @param {string} author
	 * @param {string} message
	 */
	onChatMessage(author, message) {
		if (this.game && this.game.triggers.chat) this.game.triggers.chat.call(this, author, message);
	}

	findRoles() {
		if (!this.room) return;
		if (this.prListener) Chat.removeListener(this.prListener);
		this.sendRoom(`/mafia playerroles`);
		const listenerid = Chat.addListener(`mafia-${this.room.roomid}-playerroles`, [this.room.roomid], ['html'], 1,
			(/**@type {string}*/t, /**@type {string}*/r, /**@type {string[]}*/p) => {
				const message = Tools.unescapeHTML(p.join('|'));
				if (message.slice(0, 21) !== `<div class="infobox">` || message.slice(-6) !== `</div>`) return;
				const lines = message.slice(21, -6).split('<br/>');
				for (const line of lines) {
					const parts = line.split(':');
					if (parts.length < 2) return false;
					const user = toId(parts[0]);
					const role = parts.slice(1).join(':').trim();
					if (!this.players[user]) return debug(`[MAFIA] playerroles without a valid player "${user}" "${JSON.stringify(parts)}"`);
					this.players[user].role = role;
				}
				this.log(`found player roles`);

				emitEvent(r, 'playerroles', [], '');
				if (this.game && this.game.triggers.playerRoles) this.game.triggers.playerRoles.call(this);
				return true;
			});
		this.prListener = listenerid;
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
		if (this.prListener) Mafia.removeMafiaListener(this.prListener);
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

/**
 * @param {string} type
 * @param {string} roomid
 * @param {string[]} parts
 */
function onChatMessage(type, roomid, parts) {
	const room = Rooms(roomid);
	if (!room || !room.mafiaTracker) return;

	const author = parts[0];
	const message = parts.slice(1).join('|');
	room.mafiaTracker.onChatMessage(author, message);
}

/**
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 */
function onGameStart(event, roomid, details) {
	const room = Rooms(roomid);
	if (!room) return;
	room.mafiaTracker = new MafiaTracker(room, details[0]);
}
/**
 *
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 * @param {string} message
 */
function onEvent(event, roomid, details, message) {
	log(`[MAFIA] ${event}: ${JSON.stringify(details)}`);
	const room = Rooms(roomid);
	if (!room || !room.mafiaTracker) return;
	const tracker = room.mafiaTracker;
	switch (event) {
	case 'kill':
		tracker.onKill(details[0], details[1], details[2]);
		break;
	case 'add':
		tracker.addPlayer(details[0]);
		break;
	case 'join':
		tracker.onJoin(details[0]);
		break;
	case 'left':
		tracker.onLeave(details[0]);
		break;
	case 'sub':
		tracker.sub(details[0], details[1]);
		break;
	case 'revive':
		tracker.onRevive(details[0]);
		break;
	case 'day':
		tracker.onDay();
		break;
	case 'night':
		tracker.onNight();
		break;
	case 'subhost':
		tracker.subHost(details[0], details[1]);
		break;
	case 'cohost':
		tracker.addCohost(details[0]);
		break;
	case 'uncohost':
		tracker.removeCohost(details[1]);
		break;
	case 'gamestart':
		tracker.onStart();
		break;
	case 'gameend':
		tracker.phase = 'ended';
		break;
	}
	if (tracker.game) {
		if (tracker.game.events[event]) tracker.game.events[event].apply(tracker, details);
	}
}

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

Mafia.addMafiaListener('mafiatracker-gamestart', true, ['host'], true, onGameStart);
Mafia.addMafiaListener('mafiatracker-events', true, true, true, onEvent);
Chat.addListener('mafiatracker-messages', true, ['chat'], true, onChatMessage);
