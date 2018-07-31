'use strict';

let Rooms = Object.assign(getRoom, {
	/** @type {Map<string, Room>} */
	rooms: new Map(),
	addRoom,
});

class Room {
	constructor(roomid, roomType) {
		this.roomid = roomid;
		this.title = roomid;
		this.roomType = roomType;
		/** @type {Map<string, User>} */
		this.users = new Map();
		/** @type {Map<string, string>} */
		this.roomauth = new Map();
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
			const [auth, nick] = Tools.splitUser(user);
			this.userJoin(nick, auth);
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
		const userid = toId(name);
		const user = this.users.get(userid);
		if (!user) return debug(`User '${userid}' trying to leave a room '${this.roomid}' when they're not in it`);
		this.roomauth.delete(userid);
		if (![...Rooms.rooms.values()].some(room => room.users.has(userid))) {
			debug(`User '${userid}' has left all of the bot's rooms; destroying`);
			user.destroy();
		}
	}

	/**
	 * @param {string} name
	 * @param {string} group
	 */
	userJoin(name, group) {
		const user = Users.addUser(name);
		this.users.set(user.userid, user);
		this.roomauth.set(user.userid, group);
	}

	/**
	 * @param {string} from
	 * @param {string} newGroup
	 * @param {string} to
	 */
	userRename(from, newGroup, to) {
		// this should ALWAYS be dealt with in the user/global scope before the room scope
		const oldId = toId(from);
		const newId = toId(to);
		if (oldId === newId) return this.roomauth.set(newId, newGroup); // name gets updated in Users
		this.users.set(newId, this.users.get(oldId));
		this.users.delete(oldId);
		this.roomauth.set(newId, newGroup);
		this.roomauth.delete(oldId);
		debug(`User rename in '${this.roomid}': '${from}' => '${to}'`);
	}

	/**
	 * @param {string} userid
	 * @return {string}
	 */
	getAuth(userid) {
		return this.roomauth.get(userid);
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

module.exports = Rooms;
