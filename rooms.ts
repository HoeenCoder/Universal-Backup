export class Room {
	roomid: string;
	title: string;
	roomType: string;
	/** userid -> name */
	users: Map<string, string> = new Map();
	auth: Map<string, string> = new Map();
	game: RoomGame | null = null;
	mafiaTracker: MafiaTracker | null = null;
	iso: MafiaISO | null = null;
	mafiaCooldown: MafiaCooldown | null = null;
	// fixme
	scavengerHunt: import('./plugins/scavs').ScavengerHunt | null = null;
	pendingScavengerHunt: import('./plugins/scavs').ScavengerHunt | null = null;
	constructor(roomid: string, roomType: string) {
		this.roomid = roomid;
		this.title = roomid;
		this.roomType = roomType;

		// auth is strictly roomauth, gets updated on /roomauth and on (pro/de)mote messages
		sendMessage('', `/cmd roominfo ${this.roomid}`); // need to use roomauth1 because it gives the roomname
	}


	send(message: string) {
		sendMessage(this.roomid, message);
	}

	destroy() {
		debug(`DEINIT ROOM: ${this.roomid}`);
		Rooms.rooms.delete(this.roomid);
	}

	setTitle(newTitle: string) {
		this.title = newTitle;
	}

	updateUserlist(users: string) {
		const userList = users.split(',').slice(1);
		for (const user of userList) {
			this.userJoin(user);
		}
	}

	get userList() {
		return [...this.users.keys()];
	}

	get userCount() {
		return this.userList.length;
	}

	userLeave(name: string) {
		const [, username] = Tools.splitUser(name);
		const userid = toId(username);
		const user = this.users.get(userid);
		if (!user) return debug(`User '${userid}' trying to leave a room '${this.roomid}' when they're not in it`);
		//this.auth.delete(userid);
		this.users.delete(userid);
	}

	userJoin(name: string) {
		const [, username] = Tools.splitUser(name);
		const userid = toId(username);
		this.users.set(userid, username);
		//this.auth.set(userid, group);
	}

	userRename(from: string, to: string) {
		const [, oldName] = Tools.splitUser(from);
		const [, newName] = Tools.splitUser(to);
		const oldId = toId(oldName);
		const newId = toId(newName);
		if (oldId === newId) {
			this.users.set(newId, newName);
			//this.auth.set(newId, newGroup);
			return;
		}
		this.users.delete(oldId);
		//this.auth.delete(oldId);
		this.users.set(newId, newName);
		//this.auth.set(newId, newGroup);
		debug(`User rename in '${this.roomid}': '${from}' => '${to}'`);
		if (this.game && this.game.onRename) this.game.onRename(oldId, newName);
	}

	getAuth(userid: string) {
		return this.auth.get(userid) || ' ';
	}
}

function getRoom(roomid: string) {
	if (!roomid) return null;
	if (typeof roomid === 'object') return roomid;
	return Rooms.rooms.get(roomid.startsWith('groupchat') ? roomid : toId(roomid)) || null;
}

function addRoom(roomid: string, roomType: string) {
	let room = Rooms(roomid);
	if (room) {
		if (room.roomType !== roomType) {
			debug(`Recreating room '${room.roomid}@${room.roomType}' as '${roomid}@${roomType}'`);
		} else {
			return room;
		}
	}
	room = new Room(roomid, roomType);
	Rooms.rooms.set(roomid, room);
	debug(`INIT ROOM: ${roomid}`);
	return room;
}

/**
 * Returns the roomid where the bot has the bot rank and where the target is in
 * Returns a valid roomid or null
 */
function canPMInfobox(user: string) {
	const nick = toId(Config.nick);
	user = toId(user);
	for (const room of [...Rooms.rooms.values()]) {
		if (room.getAuth(nick) === '*') {
			if (room.users.has(user)) return room.roomid;
		}
	}
	return null;
}

import { RoomGame, RoomGamePlayer } from './room-game.js';
export let Rooms = Object.assign(getRoom, {
	Room,
	rooms: new Map<string, Room>(),
	addRoom,
	canPMInfobox,
	RoomGame,
	RoomGamePlayer,
});
