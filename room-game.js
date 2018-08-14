'use strict';

class RoomGame {
	constructor(room) {
		this.room = room;
	}

	sendRoom(message) {
		sendMessage(this.room.roomid, message);
	}

	destroy() {
		this.room.game = null;
		this.room = null;
	}

	/**
	 * @param {string} oldId
	 * @param {string} newName
	 */
	onRename(oldId, newName) {}
}

class RoomGamePlayer {
	constructor(user) {
		this.user = user.userid;
	}
	send(msg) {
		sendPM(this.user, msg);
	}
}

module.exports = {RoomGame, RoomGamePlayer};
