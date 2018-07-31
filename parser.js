'use strict';

module.exports = function parse(roomid, messageType, parts) {
	if (roomid.startsWith('view-')) return parseChatPage(roomid, messageType, parts);

	switch (messageType) {
	case 'c:':
		// we dont care about timestamps
		parts.shift(); // eslint-disable-line no-fallthroughs
	case 'chat':
	case 'c':
		parseChat(roomid, parts[0] === '~' ? '~' : parts[0].slice(1), parts.slice(1).join('|'));
		break;
	case 'raw':
	case 'html':
	case '': // raw message
		break;
	case 'join':
	case 'j':
	case 'J': {
		const [auth, nick] = Tools.splitUser(parts[0]);
		Rooms(roomid).userJoin(nick, auth);
		break;
	}
	case 'leave':
	case 'l':
	case 'L':
		Rooms(roomid).userLeave(parts[0].slice(1));
		break;
	case 'name':
	case 'n':
	case 'N': {
		const [auth, newNick] = Tools.splitUser(parts[0]);
		const oldNick = parts[1];
		Users.renameUser(oldNick, auth, newNick);
		Rooms(roomid).userRename(oldNick, auth, newNick);
		break;
	}
	case 'uhtml':
	case 'uhtmlchange':
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
	case 'users':
		Rooms(roomid).updateUserlist(parts[0]);
		break;
	case 'deinit':
		Rooms(roomid).destroy();
		break;
	case 'noinit':
		if (parts[0] === 'joinfailed') {
			const room = /You are banned from the room "(.*)"/.exec(parts[1]);
			if (room) debug(`Join failed - Banned from room ${room[1]}`);
		} else if (parts[1] === 'nonexistent') {
			const room = /The room "(.*)" does not exist\./.exec(parts[1]);
			if (room) debug(`Join failed - The room ${room[1]} does not exist or is modjoined`);
		}
		break;
	case 'popup':
		let popup = parts.join('|');
		if (popup.includes('has banned you from the room')) {
			const [room, user] = /<p>(.+) has banned you from the room ([^.]+)[.]<\/p><p>To appeal/.exec(popup);
			debug(`POPUP (ROOMBAN) - Banned from room '${room}' by '${user}'; please inspect the situation`);
		}
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
		let user = Users(details.userid);
		if (!user) break;
		user.updateGlobalRank(details.group);
		break;
	default:
		debug(`[parser.js.parse] Unhandled message: [${roomid}|${messageType}|${parts.join(',')}]`);
	}
};

/**
 * @param {string} roomid
 * @param {string} userstr
 * @param {string} message
 */
function parseChat(roomid, userstr, message) {
	let room = Rooms(roomid);
	let user = Users(userstr);
	if (!room && roomid !== 'global') {
		debug(`When parsing chat, unable to find non-global room: ${roomid}`);
		return;
	}
	if (!user) {
		if (userstr !== '~') debug(`When parsing chat, unable to find user: ${userstr}`);
		return;
	}
	if (user.userid === toId(Config.nick)) return;
	new ChatParser(message, user, room).parse();
}

function parsePM(from, message) {
	if (toId(from) === toId(Config.nick)) return;
	let user = Users.addUser(from);
	new ChatParser(message, user, null).parse();
}

function parseChatPage(pageid, messageType, parts) {
	debug(`Viewing chat page '${pageid}'`);
}

class ChatParser {
	constructor(message, user, room) {
		this.room = room;
		this.user = Users(user);
		if (!this.user) {
			if (room) debug(`User desync in room ${room.id} user ${user}`);
			this.user = Users.addUser(user);
		}
		this.message = message;
	}

	parse(message, user, room) {
		room = room || this.room;
		user = user || this.user;
		message = message || this.message;

		const commandToken = Config.commandTokens.find(token => message.startsWith(token));
		if (!commandToken) return;

		[this.cmd, this.target] = message.slice(commandToken.length).split(' ');

		let command = Commands[this.cmd];
		if (typeof command === 'string') command = Commands[command];
		if (typeof command !== 'function') return debug(`[ChatParser#parse] Expected ${this.cmd} command to be a function, instead received ${typeof command}`);
		debug(`[Commands.${this.cmd}] target = ${this.target} | room = ${room.roomid} | user = ${user.userid}`);
		command.call(this, this.target, room, user, this.cmd, message);
	}

	reply(message) {
		if (this.room) return sendMessage(this.room, message);
		sendPM(this.user, message);
	}
}
