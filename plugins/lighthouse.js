'use strict';

class Lighthouse extends Rooms.RoomGame {
	constructor(room) {
		super(room);
		this.gameid = 'lighthouse';

		/** @type {{[k: string]: number}} */
		this.lynches = {}; // player -> lynches
		/** @type {{[k: string]: string[]}} */
		this.lynching = {}; // player -> lynch
		// stores the messages by user, goes public postgame
		/** @type {string[]} */
		this.log = [];
		/** @type {string[]} */
		this.sketchyLog = []; // messages from users not ingame, messages trying to use commands
		this.enabled = true;
		// this object should get recreated after each game. it's not like iso
		this.listenerId = Chat.addListener(`lighthouse-${room.roomid}`, true, ['pm'], true, (t, u, m) => this.onMessage(t, u, m));
		this.mafiaListenerId = Mafia.addMafiaListener(`lighthouse-${room.roomid}`, [room.roomid], ['gameend'], true, () => this.end());
		this.sendRoom(`Darkness falls...`);
		this.sendRoom(Chat.strong(this.room, "Players, PM me your messages to have them announced anonymously"));
		if (!room.mafiaTracker || room.mafiaTracker.phase === 'ended') this.sendRoom(`Panic! - no mafia game running`);
	}
	onMessage(type, user, message) {
		if (!this.enabled) return;

		user = toId(message[0]);
		if (user === toId(Config.nick)) return;
		message = message.slice(2).join('|').trim();

		const log = `${user}: ${message}`;
		const firstChar = message.charAt(0);
		if (Config.commandTokens.includes(firstChar)) return;
		if (!this.room.mafiaTracker.players[toId(user)] || this.room.mafiaTracker.players[toId(user)].dead) {
			debug(`Lighthouse message from user not ingame: ${log}`);
			this.sketchyLog.push(log);
			return;
		}
		message = Tools.sanitize(message);
		if (!message) {
			debug(`Lighthouse message rejected by sanitizer: ${log}`);
			this.sketchyLog.push(log);
			return;
		}
		this.sendRoom(message);
		this.log.push(log);
	}

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
		this.sendRoom(`The lighthouse game has ended`);
		this.sendRoom(`!code Logs:\n${this.log.join('\n')}`);
		if (this.sketchyLog.length) {
			this.sendRoom(`/addrankhtmlbox, %, <b>Sketchy messages (only staff can see this):</b><br/>${this.sketchyLog.map(Tools.escapeHTML).join('<br/>')}`);
		}
		Chat.removeListener(this.listenerId);
		Mafia.removeMafiaListener(this.mafiaListenerId);
		this.destroy();
	}
}

exports.commands = {
	lighthouse: function (target, room, user) {
		if (!room) return;
		if (!this.can('games')) return false;
		if (room.game) return;
		room.game = new Lighthouse(room);
	},
	lhstop: function (target, room, user) {
		if (!room) return;
		if (!this.can('games')) return false;
		if (!room.game || room.game.gameid !== 'lighthouse') return;
		room.game.stop();
	},
	lhresume: function (target, room, user) {
		if (!room) return;
		if (!this.can('games')) return false;
		if (!room.game || room.game.gameid !== 'lighthouse') return;
		room.game.resume();
	},
	l: function (target, room, user) {
		if (room) return;
		const lighthouseRoom = [...Rooms.rooms.values()].find(r => r.game && r.game.gameid === 'lighthouse');
		if (!lighthouseRoom) return;
		lighthouseRoom.game.lynch(user, target);
	},
	ul: function (target, room, user) {
		if (room) return;
		const lighthouseRoom = [...Rooms.rooms.values()].find(r => r.game && r.game.gameid === 'lighthouse');
		if (!lighthouseRoom) return;
		lighthouseRoom.game.unlynch(user, target);
	},
	modlynches: 'lynches',
	lynches: function (target, room, user, cmd) {
		if (!room || !room.game || room.game.gameid !== 'lighthouse') return;
		if (!this.can('games')) return;

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
		const lighthouseRoom = [...Rooms.rooms.values()].find(r => r.game && r.game.gameid === 'lighthouse');
		if (!lighthouseRoom) return;
		if (!this.can('games', null, lighthouseRoom)) return;
		this.replyHTMLPM(lighthouseRoom.game.log.join('<br/>') + '<br/>Blocked Messages<br/>' + lighthouseRoom.game.sketchyLog.join('<br/>'));
		lighthouseRoom.game.log.push(`${user} is looking at logs!`);
	},
};
