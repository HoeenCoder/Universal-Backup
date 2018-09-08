'use strict';
// @ts-nocheck rewriting this soon

class Lighthouse extends Rooms.RoomGame {
	constructor(room) {
		super(room);
		this.gameid = 'lighthouse';

		this.players = [];
		this.lynches = {}; // player -> lynches
		this.lynching = {}; // player -> lynch
		this.hammerCount = 0;
		// stores the messages by user, goes public postgame
		this.log = [];
		this.checkLog = []; // messages from users not ingame, messages trying to use commands
		this.enabled = true;
		// this object should get recreated after each game. it's not like iso

		this.listenerId = Chat.addListener(`lighthouse-${room.roomid}`, true, ['pm'], (t, u, m) => this.onMessage(t, u, m), true);
		this.mafiaListenerId = Mafia.addMafiaListener(`lighthouse-${room.roomid}`, [room.roomid], ['players', 'gameend'], (e, r, d) => {
			if (e === 'players') return this.parsePlayerList(e, r, d);
			this.end();
		}, true);
		this.sendRoom(`Darkness falls across the land...`);
		this.sendRoom(`!mafia players`);
	}
	onMessage(type, user, message) {
		if (!this.enabled) return;

		user = toId(message[0]);
		if (user === toId(Config.nick)) return;
		message = message.slice(2).join('|').trim();

		const log = `${user}: ${message}`;
		const firstChar = message.charAt(0);
		if (firstChar === '!' || firstChar === '/') {
			debug(`Lighthouse attempted to use command: ${log}`);
			this.checkLog.push(log);
			return;
		}
		if (firstChar === '.') return;
		if (!this.players.includes(toId(user))) {
			debug(`Lighthouse message from user not ingame: ${log}`);
			this.checkLog.push(log);
			return;
		}
		if (/mafiasignup/.test(message)) {
			debug(`Lighthouse tried to say HL word: ${log}`);
			this.checkLog.push(log);
			return;
		}
		message = message.replace(/(\*\*)+/g, '*');
		this.sendRoom(message);
		this.log.push(log);
	}

	lynch(user, target) {
		if (!this.enabled) return;

		const userid = toId(user);
		let targetid = toId(target);
		if (userid === targetid) return;
		if (!this.players.includes(userid)) return;
		if (!this.players.includes(targetid)) {
			if (targetid === 'nolynch' || targetid === 'nl') {
				targetid = 'No lynch';
			} else {
				return;
			}
		}
		if (this.lynching[userid]) return sendPM(userid, `You are already lynching someone`);

		this.lynching[userid] = targetid;
		if (!this.lynches[targetid]) this.lynches[targetid] = [];
		this.lynches[targetid].push(userid);
		if (this.lynches[targetid].length >= this.hammerCount) {
			this.sendRoom(`**${targetid} was hammered!**`);
			this.stop();
			return;
		}
		this.sendRoom(`**Someone lynched ${targetid}**`);
		this.log.push(`LYNCH: ${userid} -> ${target}`);
		return;
	}

	unlynch(user) {
		if (!this.enabled) return;

		const userid = toId(user);
		if (!this.players.includes(userid)) return;
		if (!this.lynching[userid]) return sendPM(userid, `You are not lynching anyone`);

		this.lynches[this.lynching[userid]].splice(this.lynches[this.lynching[userid]].indexOf(userid), 1);
		this.sendRoom(`**Someone unlynched ${this.lynching[userid]}**`);
		delete this.lynching[userid];
		this.log.push(`UNLYNCH: ${userid}`);
		return;
	}

	parsePlayerList(event, roomid, details) {
		this.players = details[0].split(',').map(toId);
		this.hammerCount = Math.floor(this.players.length / 2) + 1;
	}
	stop() {
		this.enabled = false;
		this.sendRoom(`Light returns, for now...`);
	}
	resume() {
		this.enabled = true;
		this.lynches = {};
		this.lynching = {};
		this.sendRoom(`Darkness covers the land...`);
	}

	end() {
		this.sendRoom(`The lighthouse session has ended`);
		this.sendRoom(`!code Logs:\n${this.log.join('\n')}`);
		Chat.removeListener(this.listenerId);
		Mafia.removeMafiaListener(this.mafiaListenerId);
	}
}

exports.commands = {
	lighthouse: function (target, room, user) {
		if (!room) return;
		if (!this.can('roommanagement')) return false;
		if (room.game) return;
		room.game = new Lighthouse(room);
	},
	lhstop: function (target, room, user) {
		if (!room) return;
		if (!this.can('roommanagement')) return false;
		if (!room.game || room.game.gameid !== 'lighthouse') return;
		room.game.stop();
	},
	lhresume: function (target, room, user) {
		if (!room) return;
		if (!this.can('roommanagement')) return false;
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
	lynches: function (target, room, user) {
		if (!room || !room.game || room.game.gameid !== 'lighthouse') return;
		if (!this.can('games')) return;
		// blind assume we have bot because i havent implemented a proper roomperms system
		let lynches = Object.entries(room.game.lynches).map(([k, v]) => {
			if (!v.length) return '';
			return `<div>${k} (${v.length}): ${v.join(', ')}</div>`;
		});
		room.send(`/addhtmlbox ${lynches.join('')}`);
	},
};
