'use strict';

let Rooms = Object.assign(getRoom, {
	rooms: new Map(),
	createRoom,
	deinitRoom,
	setTitle,
	updateUserlist,
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
		for (const user of this.users.entries()) {
			const thisRoomIndex = user.rooms.indexOf(this.roomid);
			if (thisRoomIndex < 0) return debug(`Room desync on destroy for room ${this.roomid} user ${user.userid}`);
			user.rooms.splice(thisRoomIndex, 1);
		}
	}

	userLeave(name) {
		const userid = toId(name);
		const user = this.users.get(userid);
		if (!user) return debug(`User trying to leave a room theyre not in at room ${this.roomid} user ${userid}`);
		const thisRoomIndex = user.rooms.indexOf(this.roomid);
		user.rooms.splice(thisRoomIndex, 1);
		this.users.delete(userid);
		this.roomauth.delete(userid);
	}

	userJoin(name, group) {
		let user = Users(name);
		if (!user) user = Users.addUser(name);
		this.users.set(user.userid, user);
		this.roomauth.set(user.userid, group);
	}

	userRename(from, to, newGroup) {
		// this should ALWAYS be dealt with in the user/global scope before the room scope
		const oldId = toId(from);
		const newId = toId(to);
		this.users.set(newId, this.users.get(oldId));
		this.users.delete(oldId);
		this.roomauth.set(newId, newGroup);
		this.roomauth.delete(oldId);
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
function createRoom(roomid, roomtype) {
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
/**
 * @param {string} roomid
 * @param {string} title
 */
function setTitle(roomid, title) {
	let room = Rooms(roomid);
	if (!room) {
		debug(`Setting the title of a non-existent room - ${roomid}: ${title}`);
		room = createRoom(roomid, '');
	}
	if (room.title === title) return room;
	room.title = title;
	return room;
}
/**
 * @param {string} roomid
 * @param {string} users
 */
function updateUserlist(roomid, users) {
	let room = Rooms(roomid);
	if (!room) {
		debug(`Updating the userlist of a non-existent room - ${roomid}`);
		room = createRoom(roomid, '');
	}
	let list = users.slice(users.indexOf(',') + 1).split(',');
	room.userList = list.slice().map(u => u.substring(1));
	room.userCount = room.userList.length;
	for (let i = 0; i < room.userList.length; i++) {
		room.userJoin(room.userList[i], list[i].substring(0, 1));
	}
	return room;
}

function deinitRoom(roomid) {
	// this exists to deal with pages
	// todo support pages
	let room = Rooms(roomid);
	if (!room) {
		debug(`deinit message for a nonexistent room - ${roomid}`);
		return false;
	}
	room.destroy();
	Rooms.rooms.delete(roomid);
	debug(`DEINIT ROOM: ${roomid}`);
	return true;
}

module.exports = Rooms;
