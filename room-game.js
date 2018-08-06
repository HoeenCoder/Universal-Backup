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
