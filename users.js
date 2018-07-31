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
		if (!(group in Config.groups)) {
			debug(`Unhandled group: ${group} for ${this.name}`);
			group = ' ';
		}
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

function renameUser(from, newGroup, to, init) {
	const oldId = toId(from);
	const newId = toId(to);
	let user = Users(oldId);
	if (oldId === newId) return user.updateGlobalRank(newGroup); // happens on promos/locks
	// this can fire multiple times, since the rename message gets sent to each room theyre in
	if (!user && Users.users.has(newId)) return true;
	if (!user) {
		if (!init) debug(`Renaming non-existent user ${from} to ${to}`);
		// this can trigger without a valid user object being created if we're reading the backlog
		// todo reimplement/ignore when this happens
		user = addUser(to);
		user.updateGlobalRank(newGroup);
		Users.users.set(newId, user);
		debug(`RENAME CREATE: ${user.name}`);
		return true;
	}
	user.name = to;
	user.updateGlobalRank(newGroup);
	user.userid = newId;
	Users.users.set(newId, user);
	Users.users.delete(oldId);
	debug(`RENAME USER: '${oldId}' => '${user.name}'`);
	return true;
}

module.exports = Users;
