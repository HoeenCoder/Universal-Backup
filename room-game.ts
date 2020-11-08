export class RoomGame {
	room: Room;
	gameid: string = '';
	constructor(room: Room) {
		this.room = room;
	}

	sendRoom(message: string) {
		if (!this.room) return;
		sendMessage(this.room.roomid, message);
	}

	destroy() {
		if (!this.room) return;
		this.room.game = null;
	}

	onRename(oldId: string, newName: string) {}

	join(user: string, target: string) {}
	leave(user: string, target: string) {}
	end(user: string, target: string) {}
}

export class RoomGamePlayer {
	user: string;
	constructor(user: string) {
		this.user = user;
	}
	send(msg: string) {
		sendPM(this.user, msg);
	}
}
