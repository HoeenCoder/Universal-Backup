'use strict';

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	join: function (target, room, user) {
		if (!room || !room.game || !room.game.join) return;
		room.game.join(user, target);
	},
	leave: function (target, room, user) {
		if (!room || !room.game || !room.game.leave) return;
		room.game.leave(user, target);
	},
	end: function (target, room, user) {
		if (!this.can('games') || !room || !room.game || !room.game.end) return;
		room.game.end(user, target);
	},
};

exports.commands = commands;
