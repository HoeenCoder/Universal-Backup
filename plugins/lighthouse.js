'use strict';

class Lighthouse extends Rooms.RoomGame {
	/**
	 * @param {Room} room
	 */
	constructor(room) {
		super(room);
		this.gameid = 'lighthouse';

		/** @type {{[k: string]: string[]}} */
		this.lynches = {}; // player -> lynches
		/** @type {{[k: string]: string}} */
		this.lynching = {}; // player -> lynch
		// stores the messages by user, goes public postgame
		/** @type {string[]} */
		this.log = [];
		/** @type {string[]} */
		this.sketchyLog = []; // messages from users not ingame, messages trying to use commands
		this.enabled = true;

		this.sendRoom(`Darkness falls...`);
		this.sendRoom(Chat.strong(this.room, "Players, PM me your messages to have them announced anonymously"));
		if (!room.mafiaTracker || room.mafiaTracker.phase === 'ended') {
			this.sendRoom(`Panic! - no mafia game running`);
		} else {
			room.mafiaTracker.chatListeners.push(
				Chat.events.on('pm', (/** @type {any} */room, /** @type {string[]} */args) => this.onMessage(args))
			);
			room.mafiaTracker.addMafiaListener('gameend', () => this.end());
		}
	}
	/**
	 * @param {string[]} details
	 */
	onMessage(details) {
		if (!this.enabled) return;

		const user = toId(details[0]);
		/** @type {string | false} */
		let message = details.slice(2).join('|');
		if (!this.room.mafiaTracker.players[user] || this.room.mafiaTracker.players[user].dead) return;
		if (user === toId(Config.nick)) return;

		const log = `${user}: ${message}`;
		const firstChar = message.charAt(0);
		if (Config.commandTokens.includes(firstChar)) return;
		message = Tools.sanitize(message);
		if (!message) {
			debug(`Lighthouse message rejected by sanitizer: ${log}`);
			this.sketchyLog.push(log);
			return;
		}
		this.sendRoom(message);
		this.log.push(log);
	}

	/**
	 * @param {string} user
	 * @param {string} target
	 */
	lynch(user, target) {
		if (!this.enabled) return;

		const userid = toId(user);
		let targetid = toId(target);
		if (userid === targetid) return;
		const players = this.room.mafiaTracker.players;
		if (!players[userid] || (players[userid].dead && !players[userid].spirit)) return;
		if (!players[targetid] || players[targetid].dead) {
			if (targetid === 'nolynch' || targetid === 'nl') {
				targetid = 'No lynch';
			} else {
				return;
			}
		}
		if (this.lynching[userid]) return Chat.sendPM(userid, `You are already lynching someone`);

		this.lynching[userid] = targetid;
		if (!this.lynches[targetid]) this.lynches[targetid] = [];
		this.lynches[targetid].push(userid);
		if (this.lynches[targetid].length >= Math.floor(this.room.mafiaTracker.aliveCount / 2) + 1) {
			this.sendRoom(Chat.strong(this.room, `**${targetid} was hammered!**`));
			this.stop();
			return;
		}
		this.sendRoom(Chat.strong(this.room, `Someone lynched ${targetid}`));
		this.log.push(`LYNCH: ${userid} -> ${target}`);
		return;
	}

	/**
	 * @param {string} user
	 */
	unlynch(user) {
		if (!this.enabled) return;

		const userid = toId(user);
		if (!this.room.mafiaTracker.players[userid]) return;
		if (!this.lynching[userid]) return sendPM(userid, `You are not lynching anyone`);

		this.lynches[this.lynching[userid]].splice(this.lynches[this.lynching[userid]].indexOf(userid), 1);
		this.sendRoom(`**Someone unlynched ${this.lynching[userid]}**`);
		delete this.lynching[userid];
		this.log.push(`UNLYNCH: ${userid}`);
		return;
	}

	stop() {
		this.enabled = false;
		this.sendRoom(`Light returns...`);
	}
	resume() {
		this.enabled = true;
		this.lynches = {};
		this.lynching = {};
		this.sendRoom(`Darkness falls...`);
	}

	end() {
		console.log('ENDING');
		this.sendRoom(`The lighthouse game has ended`);
		this.sendRoom(`!code Logs:\n${this.log.join('\n')}`);
		if (this.sketchyLog.length) {
			this.sendRoom(`/addrankhtmlbox, %, <b>Sketchy messages (only staff can see this):</b><br/>${this.sketchyLog.map(Tools.escapeHTML).join('<br/>')}`);
		}
		this.destroy();
	}
}

/** @type {import("../chat").ChatCommands} */
const commands = {
	lighthouse: function (target, room, user) {
		if (!room) return;
		if (!this.can('staff')) return false;
		if (room.game) return;
		room.game = new Lighthouse(room);
	},
	lhstop: function (target, room, user) {
		if (!room) return;
		if (!this.can('staff')) return false;
		if (!room.game || !(room.game instanceof Lighthouse)) return;
		room.game.stop();
	},
	lhresume: function (target, room, user) {
		if (!room) return;
		if (!this.can('staff')) return false;
		if (!room.game || !(room.game instanceof Lighthouse)) return;
		room.game.resume();
	},
	l: function (target, room, user) {
		if (room) return;
		const lighthouseRoom = [...Rooms.rooms.values()].find(r => !!(r.game && r.game instanceof Lighthouse));
		if (!lighthouseRoom || !(lighthouseRoom.game instanceof Lighthouse)) return; // failsafe to make typescript happy
		lighthouseRoom.game.lynch(user, target);
	},
	ul: function (target, room, user) {
		if (room) return;
		const lighthouseRoom = [...Rooms.rooms.values()].find(r => !!(r.game && r.game instanceof Lighthouse));
		if (!lighthouseRoom || !(lighthouseRoom.game instanceof Lighthouse)) return;
		lighthouseRoom.game.unlynch(user);
	},
	modlynches: 'lynches',
	lynches: function (target, room, user, cmd) {
		if (!room || !room.game || !(room.game instanceof Lighthouse)) return;
		if (!this.can('staff')) return;

		const m = cmd === 'modlynches';
		const auth = room.auth.get(toId(Config.nick));
		if (auth === ' ') return this.reply(`Can't broadcast`);
		const html = auth === '*' || auth === '#';
		let lynches = Object.entries(room.game.lynches).map(([k, v]) => {
			if (!v.length) return '';
			return `${k}: (${v.length})${m ? `: ${v.join(', ')}` : ''}`;
		});
		if (html) {
			room.send(`/addhtmlbox <div>${lynches.join('</div><div>')}</div>`);
		} else {
			room.send(`!code Lynches:\n${lynches.join('\n')}`);
		}
	},
	logs: function (target, room, user) {
		const lighthouseRoom = [...Rooms.rooms.values()].find(r => !!(r.game && r.game instanceof Lighthouse));
		if (!lighthouseRoom || !(lighthouseRoom.game instanceof Lighthouse)) return;
		if (!this.can('staff', lighthouseRoom)) return;
		this.replyHTMLPM(lighthouseRoom.game.log.join('<br/>') + '<br/>Blocked Messages<br/>' + lighthouseRoom.game.sketchyLog.join('<br/>'));
		lighthouseRoom.game.log.push(`${user} is looking at logs!`);
	},
};

exports.commands = commands;
