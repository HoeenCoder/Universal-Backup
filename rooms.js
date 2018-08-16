'use strict';

class Room {
	constructor(roomid, roomType) {
		this.roomid = roomid;
		this.title = roomid;
		this.roomType = roomType;
		/** @type {Map<string, string>} */
		this.users = new Map(); // userid->name
		/** @type {Map<string, string>} */
		this.auth = new Map(); // userid->auth
		// auth is strictly roomauth, gets updated on /roomauth and on (pro/de)mote messages
		sendMessage(null, `/roomauth1 ${this.roomid}`); // need to use roomauth1 because it gives the roomname

		this.game = null;
		this.iso = null;
	}

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
			const [auth, name] = Tools.splitUser(user);
			this.userJoin(auth, name);
		}
	}

	/**
	 * @type {string[]} A list of all userids in the room
	 */
	get userList() {
		return [...this.users.keys()].map;
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
		const userid = toId(name);
		const user = this.users.get(userid);
		if (!user) return debug(`User '${userid}' trying to leave a room '${this.roomid}' when they're not in it`);
		//this.auth.delete(userid);
		this.users.delete(userid);
	}

	/**
	 * @param {string} group
	 * @param {string} name
	 */
	userJoin(group, name) {
		const userid = toId(name);
		this.users.set(userid, name);
		//this.auth.set(userid, group);
	}

	/**
	 * @param {string} from
	 * @param {string} newGroup
	 * @param {string} to
	 */
	userRename(from, newGroup, to) {
		const oldId = toId(from);
		const newId = toId(to);
		if (oldId === newId) {
			this.users.set(newId, to);
			//this.auth.set(newId, newGroup);
			return;
		}
		this.users.delete(oldId);
		//this.auth.delete(oldId);
		this.users.set(newId, to);
		//this.auth.set(newId, newGroup);
		debug(`User rename in '${this.roomid}': '${from}' => '${to}'`);
		for (const activity in this.activities) {
			if (activity.onRename) activity.onRename(oldId, to);
		}
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
 * @return {Room | null}
 */
function getRoom(roomid) {
	if (typeof roomid === 'object') return roomid;
	return Rooms.rooms.get(roomid.startsWith('groupchat') ? roomid : toId(roomid));
}

/**
 * @param {string} roomid
 * @param {string} roomtype
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
	for (const room of [...Rooms.rooms.values()]) {
		if (room.getAuth(nick) === '*') {
			if (room.users.has(user)) return room.roomid;
		}
	}
	return null;
}

const {RoomGame, RoomGamePlayer} = require('./room-game.js');
let Rooms = module.exports = Object.assign(getRoom, {
	/** @type {Map<string, Room>} */
	rooms: new Map(),
	addRoom,
	canPMInfobox,
	RoomGame,
	RoomGamePlayer,
});
