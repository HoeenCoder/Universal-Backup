'use strict';

class MafiaUGO extends Rooms.RoomGame {
	/**
	 * @param {Room} room
	 */
	constructor(room) {
		super(room);
		this.roomid = room.roomid;
		this.enabled = false;
		this.gameStart = 0;
		this.game = false;
		this.players = 0;
	}

	onEnd() {
		// Calculate gametime
		if (!this.game) return;

		var gameLength = Date.now() - this.gameStart;
		var gameHours = Math.floor(gameLength / 3600000);
		var gameMinutes = Math.floor((gameLength % 3600000) / 60000);
		var gameSeconds = Math.round(((gameLength % 3600000) % 60000) / 1000);
		this.sendRoom(`${gameHours} hours, ${gameMinutes} minutes, ${gameSeconds} seconds.`);
		this.sendRoom(`Hosts (${Object.keys(this.room.mafiaTracker?.cohosts).length + 1}): ${[this.room.mafiaTracker?.host].concat(this.room.mafiaTracker?.cohosts).map(obj => obj.toString()).join()}`);
		this.sendRoom(`Players (${Object.keys(this.room.mafiaTracker?.players).length}): ${Object.keys(this.room.mafiaTracker?.players).map(obj => ' ' + obj + ' (' + this.room.mafiaTracker?.players[obj].role.trim() + ')').join()}`);
		this.game = false;
	}

	onStart() {
		// Set starting time
		this.gameStart = Date.now();
		this.game = true;
	}

	onHost() {
		this.sendRoom(`/mafia cohost ${Config.nick}`);
	}

	disable() {
		if (!this.enabled) return this.sendRoom(`UGO mode already disabled`);
		this.enabled = false;
		this.sendRoom(`UGO mode was disabled`);
	}
	enable() {
		if (this.enabled) return this.sendRoom(`UGO mode already enabled`);
		this.enabled = true;
		this.sendRoom(`UGO mode was enabled`);
	}
	hostGame() {
		this.sendRoom(`/mafia host dewbott`);
		this.sendRoom(`/mafia forceadd snaquaza`);
		this.sendRoom(`/mafia forceadd alexander489`);
		this.sendRoom(`/mafia close`);
		this.sendRoom(`/mafia setroles ss2`);
		this.sendRoom(`/mafia start`);
		this.sendRoom(`/mafia day`);
		this.sendRoom(`/mafia kill alexander489`);
		this.sendRoom(`gg snaquaza`);
		this.sendRoom(`/mafia end`);
    }
}

Mafia.events.on('host', (/** @type {mafiaTracker?} */tracker, /** @type {string[]} */details) => {
	if (tracker.room.mafiaUGO) tracker.room.mafiaUGO.onHost();
});
Mafia.events.on('gamestart', (/** @type {mafiaTracker?} */tracker, /** @type {string[]} */details) => {
	if (tracker.room.mafiaUGO) tracker.room.mafiaUGO.onStart();
});
Mafia.events.on('gameend', (/** @type {mafiaTracker?} */tracker, /** @type {string[]} */details) => {
	if (tracker.room.mafiaUGO) tracker.room.mafiaUGO.onEnd();
});

/** @type {ChatCommands} */
const commands = {
	enableugo: 'disableugo',
	disableugo: function (target, room, user, cmd) {
		if (!this.can('leader')) return;
		if (!room) return;
		if (cmd === 'enableugo') {
			if (!room.mafiaUGO) room.mafiaUGO = new MafiaUGO(room);
			room.mafiaUGO.enable();
		} else {
			room.mafiaUGO.disable();
		}
	},
};
exports.commands = commands;

/** @typedef {MafiaCooldown} MafiaCooldownT */