'use strict';

class Room {
	/**
	 * @param {string} roomid
	 * @param {string} roomType
	 */
	constructor(roomid, roomType) {
		this.roomid = roomid;
		this.title = roomid;
		this.roomType = roomType;
		/** @type {Map<string, string>} */
		this.users = new Map(); // userid->name
		/** @type {Map<string, string>} */
		this.auth = new Map(); // userid->auth
		// auth is strictly roomauth, gets updated on /roomauth and on (pro/de)mote messages
		sendMessage(null, `/cmd roominfo ${this.roomid}`); // need to use roomauth1 because it gives the roomname

		/** @type {RoomGame | null}*/
		this.game = null;
		/** @type {object | null} */
		this.mafiaTracker = null;
		/** @type {object | null} */
		this.iso = null;
		/** @type {Object} */
		this.mafiaCooldown = null;
		/** @type {import('./plugins/scavs').ScavengerHunt?} */
		this.scavengerHunt = null;
	}

	/**
	 * @param {string} message
	 */
	send(message) {
		sendMessage(this.roomid, message);
	}

	destroy() {
		/*for (const [userid, user] of this.users.entries()) {
		}*/
		debug(`DEINIT ROOM: ${this.roomid}`);
		Rooms.rooms.delete(this.roomid);
	}

	/**
	 * @param {string} newTitle The room's title sent from |title|
	 */
	setTitle(newTitle) {
		this.title = newTitle;
	}

	/**
	 * @param {string} users The list of users sent from |users|
	 */
	updateUserlist(users) {
		const userList = users.split(',').slice(1);
		for (const user of userList) {
			this.userJoin(user);
		}
	}

	/**
	 * @type {string[]} A list of all userids in the room
	 */
	get userList() {
		return [...this.users.keys()];
	}

	/**
	 * @type {number}
	 */
	get userCount() {
		return this.userList.length;
	}

	/**
	 * @param {string} name
	 */
	userLeave(name) {
		const [, username] = Tools.splitUser(name);
		const userid = toId(username);
		const user = this.users.get(userid);
		if (!user) return debug(`User '${userid}' trying to leave a room '${this.roomid}' when they're not in it`);
		//this.auth.delete(userid);
		this.users.delete(userid);
	}

	/**
	 * @param {string} name
	 */
	userJoin(name) {
		const [, username] = Tools.splitUser(name);
		const userid = toId(username);
		this.users.set(userid, username);
		//this.auth.set(userid, group);
	}

	/**
	 * @param {string} from
	 * @param {string} to
	 */
	userRename(from, to) {
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

	/**
	 * @param {string} userid
	 * @return {string}
	 */
	getAuth(userid) {
		return this.auth.get(userid) || ' ';
	}
}

/**
 * @param {string} roomid
 * @return {Room | null}
 */
function getRoom(roomid) {
	if (!roomid) return null;
	if (typeof roomid === 'object') return roomid;
	return Rooms.rooms.get(roomid.startsWith('groupchat') ? roomid : toId(roomid)) || null;
}

/**
 * @param {string} roomid
 * @param {string} roomType
 */
function addRoom(roomid, roomType) {
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
 * @param {string} user
 */
function canPMInfobox(user) {
	const nick = toId(Config.nick);
	user = toId(user);
	for (const room of [...Rooms.rooms.values()]) {
		if (room.getAuth(nick) === '*') {
			if (room.users.has(user)) return room.roomid;
		}
	}
	return null;
}

const {RoomGame, RoomGamePlayer} = require('./room-game.js');
let Rooms = Object.assign(getRoom, {
	Room,
	/** @type {Map<string, Room>} */
	rooms: new Map(),
	addRoom,
	canPMInfobox,
	RoomGame,
	RoomGamePlayer,
});
module.exports = Rooms;
