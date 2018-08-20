'use strict';

let Chat = module.exports;

Chat.sendMessage = function (roomid, message) {
	const room = Rooms(roomid);
	if (!room && roomid) return debug("Sending to invalid room '" + roomid + "'");
	if (message.length > 300 && !['/', '!'].includes(message.charAt(0))) message = message.slice(0, 296) + '...';
	Chat.client.send(`${room ? room.roomid : ''}|${message}`);
};
Chat.sendPM = function (target, message) {
	if (message.length > 300 && !['/', '!'].includes(message.charAt(0))) message = message.slice(0, 296) + '...';
	Chat.client.send("|/pm " + target + "," + message);
};
/**
 * @param {string} roomid
 * @param {string} messageType
 * @param {string[]} parts
 */
function parse(roomid, messageType, parts) {
	if (roomid.startsWith('view-')) return parseChatPage(roomid, messageType, parts);
	let normalisedType = messageType;
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
		if (authChange) parseAuthChange(Rooms(roomid), authChange);
		normalisedType = 'raw'; // NOTE THAT THIS ISNT A |raw| HTML MESSAGE
		break;
	case 'join':
	case 'j':
	case 'J': {
		const [auth, nick] = Tools.splitUser(parts[0]);
		Rooms(roomid).userJoin(auth, nick);
		normalisedType = 'join';
		break;
	}
	case 'leave':
	case 'l':
	case 'L':
		Rooms(roomid).userLeave(parts[0]);
		normalisedType = 'leave';
		break;
	case 'name':
	case 'n':
	case 'N': {
		const [auth, newNick] = Tools.splitUser(parts[0]);
		const oldNick = parts[1];
		Rooms(roomid).userRename(oldNick, auth, newNick);
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
		Rooms(roomid).setTitle(parts[0]);
		break;
	case 'pagehtml':
		debug(`Recieved chat page html for ${roomid}`);
		break;
	case 'users':
		Rooms(roomid).updateUserlist(parts[0]);
		break;
	case 'deinit':
		Rooms(roomid).destroy();
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
			const [room, user] = /<p>(.+) has banned you from the room ([^.]+)[.]<\/p><p>To appeal/.exec(popup);
			console.log(`POPUP (ROOMBAN) - Banned from room '${room}' by '${user}'; please inspect the situation`);
		}
		debug(`POPUP: ${popup}`);
		break;
	case 'unlink':
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
	/*
		if (parts[0] !== 'userdetails') break;
		let details;
		try {
			details = JSON.parse(parts[1]);
		} catch (e) {
			console.error(`Error while parsing userdetails: ${e}\n`);
			console.log(parts[1]);
		}
		*/
		break;
	default:
		debug(`[parser.js.parse] Unhandled message: [${roomid}|${messageType}|${parts.join(',')}]`);
	}

	for (const id in Chat.listeners) {
		const listener = Chat.listeners[id];
		if (listener.messagesTypes !== true && !listener.messageTypes.includes(normalisedType)) continue;
		if (listener.rooms !== true && !listener.rooms.includes(roomid)) continue;
		const result = listener.callback(normalisedType, roomid, parts);
		// true decrememnts the count and continues, null drops the message, false continues as if nothing happened
		if (result === true) {
			if (listener.repeat !== true) listener.repeat--;
			if (listener.repeat === 0) delete Chat.listeners[id];
		} else if (result === null) {
			return;
		}
	}
}
Chat.listeners = {};

Chat.addListener = function (id, rooms, messageTypes, callback, repeat = true) {
	if (Chat.listeners[id]) throw new Error(`Trying to add existing listener: '${id}'`);
	Chat.listeners[id] = {rooms, messageTypes, callback, repeat};
	return id;
};
Chat.removeListener = function (id) {
	if (!Chat.listeners[id]) throw new Error(`Trying to remove nonexistent listener: '${id}'`);
	delete Chat.listeners[id];
	return id;
};
/**
 * Takes a parsed regex of [message, user, group] and updates auth
 * @param {Room} room
 * @param {[string, string, string]} authChange
 */
function parseAuthChange(room, authChange) {
	if (!room) return debug(`Setting auth for invalid room.`);
	const groupId = toId(authChange[2]);
	const group = Object.entries(Config.groups).find((e) => e[1].id === groupId);
	if (!group) return debug(`Invalid group ${groupId}`);
	room.auth.set(toId(authChange[1]), group[0]);
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
			parseAuthChange(room, authChange);
		} else {
			const roomOwner = /^\/log (.*?) was appointed Room Owner by .*$/.exec(message);
			if (roomOwner) room.auth.set(toId(roomOwner[1]), '#');
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
 * @param {string} messageType
 * @param {string[]} parts
 */
function parseChatPage(pageid, messageType, parts) {
	debug(`Viewing chat page '${pageid}'`);
}

class ChatParser {
	/**
	 * @param {string} message
	 * @param {User} user
	 * @param {Room | null} [room]
	 */
	constructor(message, user, room = null) {
		this.room = room;
		this.user = user;
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
	 * @param {User} [user]
	 * @param {Room | null} [room]
	 */
	parse(message = this.message, user = this.user, room = this.room) {
		const commandToken = Config.commandTokens.find(token => message.startsWith(token) && message !== token);
		if (!commandToken) return;

		[this.cmd, ...this.target] = message.slice(commandToken.length).split(' ');
		this.cmd = toId(this.cmd);
		this.target = this.target.join(' ');

		let command = Commands[this.cmd];
		if (typeof command === 'string') command = Commands[command];
		if (typeof command !== 'function') {
			if (typeof command !== 'undefined') debug(`[ChatParser#parse] Expected ${this.cmd} command to be a function, instead received ${typeof command}`);
			return;
		}
		debug(`[Commands.${this.cmd}] target = '${this.target}' | room = ${room ? room.roomid : 'PMs'} | user = ${user} | group = '${this.group}'`);
		command.call(this, this.target, room, user, this.cmd, message);
	}

	/**
	 * @param {string} message
	 */
	reply(message) {
		if (this.room) return sendMessage(this.room, message);
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
		sendMessage(pmRoom, `/pminfobox ${this.user}, ${message}`);
	}

	/**
	 * @param {string} userid
	 * @returns {User?}
	 */
	getUser(userid) {
		return this.room && this.room.users.get(toId(userid));
	}
	/**
	 * @param {string} permission
	 * @param {[string, string]?} targetUser
	 * @param {Room?} room
	 * @return {boolean}
	 */
	can(permission, targetUser, room) {
		if (Config.developers && Config.developers.includes(toId(this.user))) return true;
		if (permission === 'eval') return false;

		const groupsIndex = Object.keys(Config.groups);
		let group = this.group;
		//if (room && groupsIndex.indexOf(room.getAuth(this.userid)) > groupsIndex.indexOf(this.group)) group = room.getAuth(this.userid);
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
			return (targetUser && groupsIndex.indexOf(this.group) > groupsIndex.indexOf(targetUser[0]));
		case 's':
			return (targetUser && targetUser[1] === this.userid);
		default:
			return !!auth;
		}
	}
}

Chat.ChatParser = ChatParser;

const Client = require('./client.js');
Chat.client = new Client(parse);
