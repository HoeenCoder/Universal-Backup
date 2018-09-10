'use strict';

class RoomGame {
	/**
	 * @param {Room} room
	 */
	constructor(room) {
		/** @type {Room | null} */
		this.room = room;
		this.id = '';
	}

	/**
	 * @param {string} message
	 */
	sendRoom(message) {
		if (!this.room) return;
		sendMessage(this.room.roomid, message);
	}

	destroy() {
		if (!this.room) return;
		this.room.game = null;
		this.room = null;
	}

	/**
	 * @param {string} oldId
	 * @param {string} newName
	 */
	onRename(oldId, newName) {}

	/**
	 * @param {string} u
	 * @param {string} t
	 */
	join(u, t) {}
	/**
	 * @param {string} u
	 * @param {string} t
	 */
	leave(u, t) {}
	/**
	 * @param {string} u
	 * @param {string} t
	 */
	end(u, t) {}
}

class RoomGamePlayer {
	/**
	 * @param {string} user
	 */
	constructor(user) {
		this.user = user;
	}
	/**
	 * @param {string} msg
	 */
	send(msg) {
		sendPM(this.user, msg);
	}
}

module.exports = {RoomGame, RoomGamePlayer};
