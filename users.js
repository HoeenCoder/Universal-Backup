'use strict';

let Users = Object.assign(getUser, {
	/** @type {Map<string, User>} */
	users: new Map(),
	addUser,
	renameUser,
});

class User {
	constructor(name) {
		this.userid = toId(name);
		this.name = name;
		this.group = ' ';

		// Get global rank
		Client.send(`|/cmd userdetails ${this.userid}`);
	}

	destroy() {
		Users.users.delete(this.userid);
	}

	/**
	 * @param {string} permission
	 * @param {User?} targetUser
	 * @param {Room?} room
	 * @return {boolean}
	 */
	can(permission, targetUser, room) {
		const groupsIndex = Object.keys(Config.groups);
		let group = this.group;
		if (room && groupsIndex.indexOf(room.getAuth(this.userid)) > groupsIndex.indexOf(this.group)) group = room.getAuth(this.userid);
		let permissions = Config.groups[group];
		if (!permissions) return false; // ??!
		if (permissions.root || this.isDev) return true;
		let auth = permissions[permission];
		if (auth === undefined && permissions.inherit) {
			let depth = 0;
			while (auth === undefined && permissions.inherit && depth < 10) {
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
	 * @type {boolean}
	 */
	get isDev() {
		return ['hoeenhero', 'jumbowhales'].includes(this.userid);
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

/**
 * @return {User | null}
 */
function getUser(name) {
	if (typeof name === 'object') return name;
	return Users.users.get(toId(name));
}

/**
 * Creates a new user object for `name`, returning it if it
 * already exists.
 * @param {string} name
 * @return {User}
 */
function addUser(name) {
	let user = Users(toId(name));
	if (user) return user;
	user = new User(name);
	Users.users.set(toId(name), user);
	debug(`INIT USER: ${user.name}`);
	return user;
}

/**
 * @param {string} from
 * @param {string} newGroup
 * @param {string} to
 * @param {boolean} [init]
 */
function renameUser(from, newGroup, to, init = false) {
	const oldId = toId(from);
	const newId = toId(to);
	let user = Users(oldId);
	if (oldId === newId) {
		user.name = to;
		return;
	}
	if (!user) {
		// this can fire multiple times, since the rename message gets sent to each room theyre in
		if (Users.users.has(newId)) return true;
		if (!init) debug(`Renaming non-existent user ${from} to ${to}`);
		// this can trigger without a valid user object being created if we're reading the backlog
		// todo reimplement/ignore when this happens
		user = addUser(to);
		user.updateGlobalRank(newGroup);
		Users.users.set(newId, user);
		debug(`RENAME CREATE: ${user.name}`);
		return;
	}
	user.name = to;
	user.updateGlobalRank(newGroup);
	user.userid = newId;
	Users.users.set(newId, user);
	Users.users.delete(oldId);
	debug(`RENAME USER: '${oldId}' => '${user.name}'`);
}

module.exports = Users;
