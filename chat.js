'use strict';
// i'm sorry, gods, but typescript doesn't allow breaking this line up
// the type is called "MessageType", the only special thing is "chatpage"
/** @typedef {'chatpage' | 'chat' | 'html' | 'raw' | 'join' | 'leave' | 'name' | 'uhtml' | 'pm' | 'init' | 'title' | 'pagehtml' | 'users' | 'deinit' | 'noinit' | 'popup' | 'error' | 'unlink' | 'notify' | 'formats' | 'tour' | 'updatesearch' | 'updatechallenges' | 'battle' | 'b' | 'usercount' | ':' | 'customgroups' | 'queryresponse'} MessageType */


let Chat = module.exports;
const fs = require('fs');
const path = require('path');
/**
 * @param {string | null} roomid
 * @param {string} message
 */
Chat.sendMessage = function (roomid, message) {
	const room = roomid ? Rooms(roomid) : null;
	if (!room && roomid) return debug("Sending to invalid room '" + roomid + "'");
	if (message.length > 300 && !['/', '!'].includes(message.charAt(0))) message = message.slice(0, 296) + '...';
	Chat.client.send(`${room ? room.roomid : ''}|${message}`);
};
/**
 * @param {string} target
 * @param {string} message
 */
Chat.sendPM = function (target, message) {
	if (message.length > 300 && !['/', '!'].includes(message.charAt(0))) message = message.slice(0, 296) + '...';
	Chat.client.send("|/pm " + target + "," + message);
};
/**
 * @param {number} duration
 */
Chat.wait = function (duration) {
	Chat.client.send((new Array(duration).fill(true)));
};
Chat.commands = {};
Chat.listeners = {};

Chat.loadCommands = function () {
	Chat.Commands = require('./commands.js').commands;
	const files = fs.readdirSync('plugins');
	for (const file of files) {
		if (file.substr(-3) !== '.js') continue;
		const plugin = require('./plugins/' + file);
		Object.assign(Chat.Commands, plugin.commands);
		Object.assign(Chat.listeners, plugin.listeners);
		Object.assign(Mafia.listeners, plugin.mafiaListeners);
	}
	// Object.assign(Chat.Commands, Mafia.commands);
	debug(`${Object.keys(Chat.Commands).length} commands/aliases loaded`);
	debug(`${Object.keys(Chat.listeners).length} listeners loaded`);
	debug(`${Object.keys(Mafia.listeners).length} mafia listeners loaded`);
};

/**
 * @param {string} id
 * @param {string[] | true} rooms
 * @param {MessageType[] | true} messageTypes
 * @param {function} callback
 * @param {number | true} repeat
 */
Chat.addListener = function (id, rooms, messageTypes, repeat, callback) {
	if (Chat.listeners[id]) debug(`Overwriting existing listener: '${id}'`);
	Chat.listeners[id] = {rooms, messageTypes, callback, repeat};
	return id;
};
/**
 * @param {string} id
 */
Chat.removeListener = function (id) {
	if (!Chat.listeners[id]) return false;
	delete Chat.listeners[id];
	return true;
};

/**
 * @param {string} dir
 */
Chat.uncacheDirectory = function (dir) {
	const root = path.resolve(dir);
	for (const key in require.cache) {
		if (key.startsWith(root)) delete require.cache[key];
	}
};
/**
 * @param {string} file
 */
Chat.uncacheFile = function (file) {
	const filepath = path.resolve(file);
	delete require.cache[filepath];
};

/**
 * @param {string} roomid
 * @param {string} messageType
 * @param {string[]} parts
 */
function parse(roomid, messageType, parts) {
	if (roomid.startsWith('view-')) return parseChatPage(roomid, parts);
	let normalisedType = messageType;
	const room = Rooms(roomid);
	switch (messageType) {
	case 'c:':
		// we dont care about timestamps
		parts.shift(); // eslint-disable-line no-fallthroughs
	case 'chat':
	case 'c':
		parseChat(roomid, parts[0], parts.slice(1).join('|'));
		normalisedType = 'chat';
		break;
	case 'raw':
	case 'html':
		normalisedType = 'html';
		break;
	case '': // raw message
		const authChange = /\((.*) was demoted to Room (.*) by .*\.\)/.exec(parts.join('|'));
		if (authChange) {
			if (!room) throw new Error(`Roomdemote in non existent room ${roomid}`);
			parseAuthChange(room, authChange[1], authChange[2]);
		}
		normalisedType = 'raw'; // NOTE THAT THIS ISNT A |raw| HTML MESSAGE
		break;
	case 'join':
	case 'j':
	case 'J': {
		const [auth, nick] = Tools.splitUser(parts[0]);
		if (room) room.userJoin(auth, nick);
		normalisedType = 'join';
		break;
	}
	case 'leave':
	case 'l':
	case 'L':
		if (room) room.userLeave(parts[0]);
		normalisedType = 'leave';
		break;
	case 'name':
	case 'n':
	case 'N': {
		const [auth, newNick] = Tools.splitUser(parts[0]);
		const oldNick = parts[1];
		if (room) room.userRename(oldNick, auth, newNick);
		normalisedType = 'name';
		break;
	}
	case 'uhtml':
	case 'uhtmlchange':
		normalisedType = 'uhtml';
		break;
	case 'pm':
		parsePM(parts[0], parts.slice(2).join('|'));
		break;
	case 'init':
		Rooms.addRoom(roomid, parts[0]);
		break;
	case 'title':
		if (room) room.setTitle(parts[0]);
		break;
	case 'pagehtml':
		// this never actually gets hit because client code gives the message to parseChatPage before this point
		debug(`Recieved chat page html for ${roomid}`);
		break;
	case 'users':
		if (room) room.updateUserlist(parts[0]);
		break;
	case 'deinit':
		if (room) room.destroy();
		break;
	case 'noinit':
		if (parts[0] === 'joinfailed') {
			const room = /You are banned from the room "(.*)"/.exec(parts[1]);
			if (room) console.log(`Join failed - Banned from room ${room[1]}`);
		} else if (parts[1] === 'nonexistent') {
			const room = /The room "(.*)" does not exist\./.exec(parts[1]);
			if (room) console.log(`Join failed - The room ${room[1]} does not exist or is modjoined`);
		}
		break;
	case 'popup':
		let popup = parts.join('|');
		const authRoom = /^To look up auth for a user, use \/userauth (.*)$/.exec(parts[parts.length - 1]);
		if (authRoom) {
			const roomid = authRoom[1];
			const room = Rooms(roomid);
			if (!room) return debug(`Recieved roomauth for invalid room: ${authRoom}`);
			const lines = popup.split('||');
			if (/(.*) room auth/.test(lines[0])) lines.splice(0, 2);
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const auth = /.* \((.)\)/.exec(line);
				if (auth) {
					const group = auth[1];
					const users = lines[i + 1].split(',').map(toId);
					for (const user of users) {
						room.auth.set(user, group);
					}
				}
			}
		}
		if (popup.includes('has banned you from the room')) {
			const message = /<p>(.+) has banned you from the room ([^.]+)[.]<\/p><p>To appeal/.exec(popup);
			if (!message) return;
			console.log(`POPUP (ROOMBAN) - Banned from room '${message[1]}' by '${message[2]}'; please inspect the situation`);
		}
		debug(`POPUP: ${popup}`);
		break;
	case 'error':
	case 'unlink':
	case 'notify':
	case 'formats':
	case 'tour':
	case 'updatesearch':
	case 'updatechallenges':
	case 'battle':
	case 'b':
	case 'usercount':
	case ':':
	case 'customgroups': // might want to handle this
		break; // not needed for the bot
	case 'queryresponse':
		if (parts[0] !== 'userdetails') break;
		let details;
		try {
			details = JSON.parse(parts[1]);
		} catch (e) {
			console.error(`Error while parsing userdetails: ${e}\n`);
			console.log(parts[1]);
		}
		if (details.userid === toId(Config.nick)) {
			Chat.client.auth = details.group;
			debug(`Setting self auth to "${details.group}"`);
		}
		break;
	default:
		debug(`[parser.js.parse] Unhandled message: [${roomid}|${messageType}|${parts.join(',')}]`);
	}
	emitEvent(normalisedType, roomid, parts);
}
/**
 * I'm not type checking the message type because it's a massive pain, just try not to do anything stupid with it.
 * THE ONLY CUSTOM TYPE ALLOWED IS CHATPAGE
 * @param {string} type
 * @param {string} roomid
 * @param {string[]} parts
 */
function emitEvent(type, roomid, parts) {
	for (const id in Chat.listeners) {
		const listener = Chat.listeners[id];
		if (listener.messageTypes !== true && !listener.messageTypes.includes(type)) continue;
		if (listener.rooms !== true && !listener.rooms.includes(roomid)) continue;
		const result = listener.callback(type, roomid, parts);
		// true decrememnts the count and continues, null drops the message, false continues as if nothing happened
		if (result === true) {
			if (listener.repeat !== true) listener.repeat--;
			if (listener.repeat === 0) delete Chat.listeners[id];
		} else if (result === null) {
			return;
		}
	}
}

/**
 * Takes a parsed regex of [message, user, group] and updates auth
 * @param {Room} room
 * @param {string} user
 * @param {string} rank
 */
function parseAuthChange(room, user, rank) {
	if (!room) return debug(`Setting auth for invalid room.`);
	const groupId = toId(rank);
	const group = Object.entries(Config.groups).find((e) => e[1].id === groupId);
	if (!group) return debug(`Invalid group ${groupId}`);
	room.auth.set(toId(user), group[0]);
}

/**
 * @param {string} roomid
 * @param {string} userstr
 * @param {string} message
 */
function parseChat(roomid, userstr, message) {
	const room = Rooms(roomid);
	let user = Tools.splitUser(userstr);
	if (!room && roomid !== 'global') {
		debug(`When parsing chat, unable to find non-global room: ${roomid}`);
		return;
	}
	if (message.substr(0, 4) === '/log') {
		const authChange = /^\/log (.*) was (?:promoted|demoted) to Room ([a-zA-Z]*) by .*\.$/.exec(message);
		if (authChange) {
			if (!room) throw new Error(`Auth change in non existent room ${roomid}`);
			parseAuthChange(room, authChange[1], authChange[2]);
		} else {
			const roomOwner = /^\/log (.*?) was appointed Room Owner by .*$/.exec(message);
			if (roomOwner && room) room.auth.set(toId(roomOwner[1]), '#');
		}
	}

	if (!user[1] && user[0] === '~') user = ['', '~'];
	if (user[1] === Config.nick) return;
	new ChatParser(message, user[1], room).parse();
}

/**
 * @param {string} from
 * @param {string} message
 */
function parsePM(from, message) {
	if (toId(from) === toId(Config.nick)) return;
	const user = Tools.splitUser(from);
	new ChatParser(message, user[1], null).parse();
}

/**
 * @param {string} pageid
 * @param {string[]} parts
 */
function parseChatPage(pageid, parts) {
	debug(`Viewing chat page '${pageid}'`);
	emitEvent('chatpage', pageid, parts);
}
/**
* @param {Room?} room
* @param {string} message
*/
Chat.strong = function (room, message) {
	if (!room) return `/wall ${message}`;
	const auth = room.auth.get(toId(Config.nick));
	if (auth === ' ' || auth === '+') return `**${message}**`;
	return `/wall ${message}`;
};

class ChatParser {
	/**
	 * @param {string} message
	 * @param {string} user
	 * @param {Room | null} [room]
	 */
	constructor(message, user, room = null) {
		this.room = room;
		this.user = user;
		this.userid = toId(user);
		if (this.room) {
			this.group = this.room.getAuth(toId(this.user));
		} else {
			const primaryRoom = Rooms(Config.primaryRoom);
			this.group = primaryRoom && primaryRoom.getAuth(toId(this.user));
		}
		this.message = message;
	}

	/**
	 * @param {string} [message]
	 * @param {string} [user]
	 * @param {Room | null} [room]
	 */
	parse(message = this.message, user = this.user, room = this.room) {
		const commandToken = Config.commandTokens.find(token => message.startsWith(token) && message !== token);
		if (!commandToken) return;

		const [cmd, ...target] = message.slice(commandToken.length).split(' ');
		/** @type {string} **/
		this.cmd = toId(cmd);
		/** @type {string} **/
		this.target = target.join(' ');

		let command = Chat.Commands[this.cmd];
		if (typeof command === 'string') command = Chat.Commands[command];
		if (typeof command !== 'function') {
			if (typeof command !== 'undefined') {
				debug(`[ChatParser#parse] Expected ${this.cmd} command to be a function, instead received ${typeof command}`);
			} else {
				emitEvent('command', room && room.roomid || '', target);
			}
			return;
		}
		debug(`[Commands.${this.cmd}] target = '${this.target}' | room = ${room ? room.roomid : 'PMs'} | user = ${user} | group = '${this.group}'`);
		command.call(this, this.target, room, user, this.cmd, message);
	}

	/**
	 * @param {string} message
	 */
	reply(message) {
		if (this.room) return sendMessage(this.room.roomid, message);
		sendPM(this.user, message);
	}

	/**
	 * @param {string} message
	 */
	replyPM(message) {
		sendPM(this.user, message);
	}

	/**
	 * @param {string} message
	 */
	replyHTMLPM(message) {
		const pmRoom = Rooms.canPMInfobox(toId(this.user));
		if (!pmRoom) return this.replyPM(`Can't send you HTML, make sure that I have the bot rank in a room you're in.`);
		Chat.sendMessage(pmRoom, `/pminfobox ${this.user}, ${message}`);
	}

	/**
	 * @param {string} message
	 */
	strong(message) {
		return Chat.strong(this.room, message);
	}
	/**
	 * @param {string} userid
	 * @returns {string?}
	 */
	getUser(userid) {
		return this.room && this.room.users.get(toId(userid)) || null;
	}
	/**
	 * @param {string} permission
	 * @param {[string, string]?} targetUser
	 * @param {Room?} room
	 * @return {boolean}
	 */
	can(permission, targetUser = null, room = null) {
		if (Config.developers && Config.developers.includes(toId(this.user))) return true;
		if (permission === 'eval') return false;

		const groupsIndex = Object.keys(Config.groups);
		let group = this.group;
		//if (room && groupsIndex.indexOf(room.getAuth(this.userid)) > groupsIndex.indexOf(this.group)) group = room.getAuth(this.userid);
		if (!group) group = ' '; // should never happen
		let permissions = Config.groups[group];
		if (!permissions) return false; // ??!
		if (permissions.root) return true;
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
			return !!(targetUser && groupsIndex.indexOf(group) > groupsIndex.indexOf(targetUser[0]));
		case 's':
			return !!(targetUser && targetUser[1] === this.userid);
		default:
			return !!auth;
		}
	}
}

Chat.ChatParser = ChatParser;

const Client = require('./client.js');
Chat.client = new Client({});
Chat.client.on('message', parse);
Chat.client.on('page', parseChatPage);

const Slaves = require('./slaves.js');
Chat.Slaves = Slaves;

