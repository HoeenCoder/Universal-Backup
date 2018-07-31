'use strict';

module.exports = function parse(roomid, message) {
	if (roomid.slice(0, 5) === 'view-') return parseChatPage(roomid, message);

	const messages = message.split('\n');
	let initalizing = false;
	for (const m of messages) {
		if (m.charAt(0) !== '|') {
			return;
		}
		const [x, type, ...parts] = m.split('|'); // eslint-disable-line no-unused-vars
		switch (type) {
		case 'c:':
			// we dont care about timestamps
			parts.shift(); // eslint-disable-line no-fallthroughs
		case 'chat':
		case 'c':
			if (!initalizing) parseChat(roomid, parts[0] === '~' ? '~' : parts[0].substring(1), parts.slice(1).join('|'));
			break;
		case 'raw':
		case 'html':
		case '': // raw message
			break;
		case 'join':
		case 'j':
		case 'J':
			Rooms(roomid).userJoin(parts[0].substring(1), parts[0].substring(0, 1));
			break;
		case 'leave':
		case 'l':
		case 'L':
			Rooms(roomid).userLeave(parts[0].substring(1));
			break;
		case 'name':
		case 'n':
		case 'N':
			Users.renameUser(parts[1], parts[0].substring(0, 1), parts[0].substring(1), initalizing);
			Rooms(roomid).userRename(parts[1], parts[0].substring(0, 1), parts[0].substring(1));
			break;
		case 'uhtml':
		case 'uhtmlchange':
			break;
		case 'pm':
			parsePM(parts[0], parts.slice(2).join('|'));
			break;
		case 'init':
			Rooms.addRoom(roomid, parts[0]);
			initalizing = true;
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
			debug(`Popup: ${parts.join('|')}`);
			break;
		case 'nametaken':
		case 'challstr':
		case 'updateuser':
			break; // Handled in client.js
		case 'unlink':
		case 'formats':
		case 'tour':
		case 'updatesearch':
		case 'updatechallenges':
		case 'battle':
		case 'b':
		case 'usercount':
		case ':':
			break; // Unimportant to this bot
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
			debug(`Unhandled message: ${m}`);
		}
	}
};

/**
 * @param {string} roomid
 * @param {string} userid
 * @param {string} message
 */
function parseChat(roomid, userid, message) {
	let room = Rooms(roomid);
	let user = Users(userid);
	if (!room && roomid !== 'global') {
		debug(`When parsing chat, unable to find non-global room: ${roomid}`);
		return;
	}
	if (!user) {
		if (userid !== '~') debug(`When parsing chat, unable to find user: ${userid}`);
		return;
	}
	const parser = new ChatParser(message, user, room); // eslint-disable-line no-unused-vars
}

function parsePM(from, message) {
	if (toId(from) === toId(Config.nick)) return;
	let user = Users.addUser(from);
	const parser = new ChatParser(message, user, null); // eslint-disable-line no-unused-vars
}
function parseChatPage(pageid, message) {
	debug(`Viewing chat page ${pageid}`);
}

// borrowed from ps
global.stringify = function (value, depth = 0) {
	if (value === undefined) return `undefined`;
	if (value === null) return `null`;
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${value}`;
	}
	if (typeof value === 'string') {
		return `"${value}"`; // NOT ESCAPED
	}
	if (typeof value === 'symbol') {
		return value.toString();
	}
	if (Array.isArray(value)) {
		if (depth > 10) return `[array]`;
		return `[` + value.map(elem => stringify(elem, depth + 1)).join(`, `) + `]`;
	}
	if (value instanceof RegExp || value instanceof Date || value instanceof Function) {
		if (depth && value instanceof Function) return `Function`;
		return `${value}`;
	}
	let constructor = '';
	if (value.constructor && value.constructor.name && typeof value.constructor.name === 'string') {
		constructor = value.constructor.name;
		if (constructor === 'Object') constructor = '';
	} else {
		constructor = 'null';
	}
	if (value.toString) {
		try {
			const stringValue = value.toString();
			if (typeof stringValue === 'string' && stringValue !== '[object Object]' && stringValue !== `[object ${constructor}]`) {
				return `${constructor}(${stringValue})`;
			}
		} catch (e) {}
	}
	let buf = '';
	for (let k in value) {
		if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
		if (depth > 2 || (depth && constructor)) {
			buf = '...';
			break;
		}
		if (buf) buf += `, `;
		if (!/^[A-Za-z0-9_$]+$/.test(k)) k = JSON.stringify(k);
		buf += `${k}: ` + stringify(value[k], depth + 1);
	}
	if (constructor && !buf && constructor !== 'null') return constructor;
	return `${constructor}{${buf}}`;
};

class ChatParser {
	constructor(message, user, room) {
		this.room = room;
		this.user = Users(user);
		if (!this.user) {
			if (room) debug(`User desync in room ${room.id} user ${user}`);
			this.user = Users.addUser(user);
		}
		this.message = message;
		this.parse();
	}

	parse(message, user, room) {
		room = room || this.room;
		user = user || this.user;
		message = message || this.message;

		if (!Config.commandTokens.includes(message.charAt(0))) return;

		const spaceIndex = message.indexOf(' ');
		if (spaceIndex < 0) {
			this.cmd = message;
			this.target = '';
		} else {
			this.cmd = message.slice(1, spaceIndex);
			this.target = message.slice(spaceIndex + 1);
		}
		let commandCB = Commands[this.cmd];
		if (typeof commandCB !== 'function') commandCB = Commands[commandCB];
		if (typeof commandCB !== 'function') return debug(`Bad command ${this.cmd}`);
		commandCB.call(this, this.target, room, user, this.cmd, message);
	}

	reply(message) {
		if (this.room) return sendMessage(this.room, message);
		sendPM(this.user, message);
	}
}
