'use strict';
// TODO port this into mafia-tracker.js once i reimplement iso

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	game: function (target, room) {
		if (!this.can('eval')) return false;
		if (!room || !room.mafiaTracker) return this.reply(`No mafia game running...`);
		if (room.mafiaTracker.hostid !== toId(Config.nick)) return this.reply(`I'm not the host...`);
		const game = Mafia.games[toId(target)];
		if (!game) return this.reply(`Not a game`);
		room.mafiaTracker.addGame(game);
	},
	start: function (target, room) {
		if (!this.can('eval')) return false;
		if (!room || !room.mafiaTracker || !room.mafiaTracker.game) return this.reply(`No mafia game running...`);
		if (!room.mafiaTracker.game.triggers.start) return this.reply(`Unsupported`);
		room.mafiaTracker.game.triggers.start.call(room.mafiaTracker);
	},
};

exports.commands = commands;
