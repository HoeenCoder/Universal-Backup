'use strict';
// i'm sorry, gods, but typescript doesn't allow breaking this line up
// the type is called "MessageType", the only special thing is "chatpage"
/** @typedef {'chatpage' | 'chat' | 'html' | 'raw' | 'join' | 'leave' | 'name' | 'pm' | 'init' | 'title' | 'pagehtml' | 'users' | 'deinit' | 'noinit' | 'popup' | 'error' | 'unlink' | 'notify' | 'formats' | 'tour' | 'updatesearch' | 'updatechallenges' | 'battle' | 'b' | 'usercount' | ':' | 'customgroups' | 'queryresponse'} MessageType */


let Chat = module.exports;

const fs = require('fs');
const path = require('path');

Chat.events = new Tools.Events();

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
/** @type {{[k: string]: function}} */
Chat.Commands = {};

Chat.loadCommands = function () {
	Chat.Commands = require('./commands.js').commands;
	const files = fs.readdirSync('plugins');
	for (const file of files) {
		if (file.substr(-3) !== '.js') continue;
		const plugin = require('./plugins/' + file);
		Object.assign(Chat.Commands, plugin.commands);
	}
	debug(`${Object.keys(Chat.Commands).length} commands/aliases loaded`);
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
	case 'uhtml':
	case 'uhtmlchange':
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
		if (room) room.userJoin(parts[0]);
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
		if (room) room.userRename(parts[1], parts[0]);
		normalisedType = 'name';
		break;
	}
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
		let details;
		try {
			details = JSON.parse(parts[1]);
		} catch (e) {
			console.error(`Error while parsing queryresponse: ${e}\n`);
			console.log(parts[1]);
		}
		if (!details) return;
		if (parts[0] === 'userdetails') {
			if (details.userid === toId(Config.nick)) {
				Chat.client.auth = details.group;
				debug(`Setting self auth to "${details.group}"`);
			}
		} else if (parts[0] === 'roominfo') {
			const room = Rooms(details.id);
			if (!room) return false;
			for (const [rank, users] of Object.entries(details.auth)) {
				for (const user of users) {
					room.auth.set(toId(user), rank);
				}
			}
		}
		break;
	default:
		debug(`[parser.js.parse] Unhandled message: [${roomid}|${messageType}|${parts.join(',')}]`);
	}
	Chat.events.emit(normalisedType, room, parts);
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
	new ChatParser(message, user, room).parse();
}

/**
 * @param {string} from
 * @param {string} message
 */
function parsePM(from, message) {
	if (toId(from) === toId(Config.nick)) return;
	const user = Tools.splitUser(from);
	new ChatParser(message, user, null).parse();
}

/**
 * @param {string} pageid
 * @param {string[]} parts
 */
function parseChatPage(pageid, parts) {
	debug(`Viewing chat page '${pageid}'`);
	Chat.events.emit('chatpage', pageid, parts);
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

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

class ChatParser {
	/**
	 * @param {string} message
	 * @param {string[]} user
	 * @param {Room | null} [room]
	 */
	constructor(message, user, room = null) {
		this.room = room;
		this.auth = user[0] || ' ';
		this.user = user[1] || '';
		this.userid = toId(this.user);
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
				Chat.events.emit('command', room, [user, this.cmd, ...target]);
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
	 * @param {'host' | 'auth' | 'staff' | 'leader' | 'dev'} permission
	 * @param {Room?} room
	 * @return {boolean}
	 */
	can(permission, room = null) {
		if (Config.developers && Config.developers.includes(this.userid)) return true;
		if (permission === 'dev') return false;

		let group = this.auth;
		// todo - rewrite this when the new |groups| protocol arrives
		switch (permission) {
		case 'host':
			if (room && room.mafiaTracker && room.mafiaTracker.hostid === this.userid) return true;
		case 'auth':
			if (group === '+') return true;
		case 'staff':
			if (['%', '@', '*'].includes(group)) return true;
		case 'leader':
			if (['#', '&', '~'].includes(group)) return true;
		}
		return false;
	}
}

Chat.ChatParser = ChatParser;

const Client = require('./client.js');
Chat.client = new Client({});
Chat.client.on('message', parse);
Chat.client.on('page', parseChatPage);

const Slaves = require('./slaves.js');
Chat.Slaves = Slaves;
