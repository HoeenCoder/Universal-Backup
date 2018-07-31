'use strict';

let Rooms = Object.assign(getRoom, {
	rooms: new Map(),
	addRoom,
});

class Room {
	constructor() {
		this.title = '';
		this.roomtype = '';
		this.roomid = '';
		this.userCount = 0;
		this.users = new Map(); // userid => object
		this.roomauth = new Map(); // userid => string with symbol
	}
	destroy() {
		/*for (const [userid, user] of this.users.entries()) {
		}*/
		Rooms.rooms.delete(this.roomid);
	}

	setTitle(newTitle) {
		this.title = newTitle;
	}

	updateUserlist(users) {
		const list = users.slice(users.indexOf(',') + 1).split(',');
		this.userList = list.slice().map(u => u.substring(1));
		this.userCount = this.userList.length;
		for (let i = 0; i < this.userList.length; i++) {
			this.userJoin(this.userList[i], list[i].substring(0, 1));
		}
	}

	userLeave(name) {
		const userid = toId(name);
		const user = this.users.get(userid);
		if (!user) return debug(`User trying to leave a room theyre not in at room ${this.roomid} user ${userid}`);
		this.roomauth.delete(userid);
	}

	userJoin(name, group) {
		const user = Users.addUser(name);
		this.users.set(user.userid, user);
		this.roomauth.set(user.userid, group);
	}

	userRename(from, newGroup, to) {
		// this should ALWAYS be dealt with in the user/global scope before the room scope
		const oldId = toId(from);
		const newId = toId(to);
		if (oldId === newId) return this.roomauth.set(newId, newGroup); // name gets updated in Users
		this.users.set(newId, this.users.get(oldId));
		this.users.delete(oldId);
		this.roomauth.set(newId, newGroup);
		this.roomauth.delete(oldId);
		debug(`Renaming in room '${this.title}': '${from}' => '${to}'`);
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
function addRoom(roomid, roomtype) {
	let room = Rooms(roomid);
	if (room) {
		if (room.roomtype !== roomtype) {
			debug(`Recreating room ${room.id} - ${room.roomtype} as ${roomid} - ${roomtype}`);
		} else {
			return room;
		}
	}
	room = new Room();
	room.roomid = roomid;
	room.title = roomid;
	Rooms.rooms.set(roomid, room);
	debug(`INIT ROOM: ${roomid}`);
	return room;
}

module.exports = Rooms;
