'use strict';

let Users = Object.assign(getUser, {
	users: new Map(),
	addUser,
	renameUser,
});

class User {
	constructor(name) {
		this.userid = toId(name);
		this.name = name;
		this.group = ' ';
		this.isDev = this.hasDevAccess();
		this.rooms = [];

		// Get global rank
		Client.send(`|/cmd userdetails ${this.userid}`);
	}

	/**
	 * @param {string} permission
	 * @param {User?} targetUser
	 * @param {Room?} room
	 * @return {boolean}
	 */
	can(permission, targetUser, room) {
		let groupsIndex = Object.keys(Config.groups);
		let group = this.group;
		if (room && groupsIndex.indexOf(room.getAuth(this.userid)) > groupsIndex.indexOf(this.group)) group = room.getAuth(this.userid);
		let permissions = Config.groups[group];
		if (!permissions) return false; // ??!
		if (permission.root || this.isDev) return true;
		let auth = permissions[permission];
		if (auth === undefined && permissions.inherit) {
			let depth = 0;
			while (auth === undefined && permission.inherit && depth < 10) {
				permissions = Config.groups[permissions.inherit];
				if (!permissions) break;
				auth = permissions[permission];
				depth++;
			}
		}
		switch (auth) {
		case 'u':
			return (targetUser && groupsIndex.indexOf(this.group) > groupsIndex.indexOf(targetUser.group));
		case 's':
			return (targetUser && targetUser.userid === this.userid);
		default:
			return !!auth;
		}
	}

	/**
	 * @return {boolean}
	 */
	hasDevAccess() {
		if (['hoeenhero', 'jumbowhales'].indexOf(this.userid) > -1) return true;
		return false;
	}

	/**
	 * @param {string} group
	 */
	updateGlobalRank(group) {
		this.group = group;
	}
}

function getUser(name) {
	if (typeof name === 'object') return name;
	return Users.users.get(toId(name));
}

// adds a user, or if the user already exists, return them
function addUser(name) {
	let user = Users(toId(name));
	if (user) return user;
	user = new User(name);
	Users.users.set(toId(name), user);
	debug(`INIT USER: ${user.name}`);
	return user;
}

function renameUser(from, to) {
	const oldId = toId(from);
	const newId = toId(to);
	// this can fire multiple times, since the rename message gets sent to each room theyre in
	if (!Users(oldId) && Users(newId)) return true;
	const user = Users(oldId);
	if (!user) return debug(`Renaming non-existent user ${from} to ${to}`);
	user.name = to.substring(1);
	let group = to.substring(0, 1);
	if (!(group in Config.groups)) {
		debug(`Unhandled group: ${group} for ${to}`);
		group = ' ';
	}
	user.group = group;
	user.userid = newId;
	Users.users.set(newId, user);
	Users.users.delete(oldId);
	debug(`RENAME USER: ${oldId} => ${user.name}`);
	return true;
}

module.exports = Users;
