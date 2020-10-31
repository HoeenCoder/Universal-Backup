type MessageType =
	  'chatpage' 
	| 'chat' 
	| 'html' | 'raw' 
	| 'join' | 'leave' | 'name' 
	| 'pm' 
	| 'init' | 'title' | 'pagehtml' | 'users' | 'deinit' | 'noinit' 
	| 'popup' | 'error' | 'unlink' | 'notify' 
	| 'formats' | 'tour' | 'updatesearch' | 'updatechallenges' | 'battle' | 'b' | 'usercount' | ':' 
	| 'customgroups' | 'queryresponse';

import { readdirSync } from 'fs';
import { resolve as resolvePath } from 'path';

import { Client } from './client';

export namespace Chat {
	export const events = new Tools.Events();

	export function sendMessage(roomid: string, message: string) {
		const room = roomid ? Rooms(roomid) : null;
		if (!room && roomid) return debug("Sending to invalid room '" + roomid + "'");
		if (message.length > 300 && !['/', '!'].includes(message.charAt(0))) message = message.slice(0, 296) + '...';
		client.send(`${room ? room.roomid : ''}|${message}`);
	}
	export function sendPM(target: string, message: string) {
		if (message.length > 300 && !['/', '!'].includes(message.charAt(0))) message = message.slice(0, 296) + '...';
		client.send("|/pm " + target + "," + message);
	}
	/**
	 * Waits for the same time as it would take to send `duration` messages
	 */
	export function wait(duration: number) {
		client.send((new Array(duration).fill(true)));
	}

	export function loadCommands() {
		for (const command in Commands) delete Commands[command];

		Object.assign(Commands, require('./commands.js').commands)
		// FIXME
		const files = readdirSync('dist/plugins');
		for (const file of files) {
			if (file.substr(-3) !== '.js') continue;
			const plugin = require('./plugins/' + file);
			Object.assign(Commands, plugin.commands);
		}
		debug(`${Object.keys(Commands).length} commands/aliases loaded`);
	}

	export function uncacheDirectory(dir: string) {
		const root = resolvePath(dir);
		for (const key in require.cache) {
			if (key.startsWith(root)) delete require.cache[key];
		}
	}
	export function uncacheFile(file: string) {
		const filepath = resolvePath(file);
		delete require.cache[filepath];
	}

	function parse(roomid: string, messageType: string, parts: string[]) {
		if (roomid.startsWith('view-')) return parseChatPage(roomid, parts);
		let normalisedType: MessageType;
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
			normalisedType = messageType;
			break;
		case 'init':
			Rooms.addRoom(roomid, parts[0]);
			normalisedType = messageType;
			break;
		case 'title':
			if (room) room.setTitle(parts[0]);
			normalisedType = messageType;
			break;
		case 'pagehtml':
			// this never actually gets hit because client code gives the message to parseChatPage before this point
			debug(`Recieved chat page html for ${roomid}`);
			normalisedType = messageType;
			break;
		case 'users':
			if (room) room.updateUserlist(parts[0]);
			normalisedType = messageType;
			break;
		case 'deinit':
			if (room) room.destroy();
			normalisedType = messageType;
			break;
		case 'noinit':
			if (parts[0] === 'joinfailed') {
				const room = /You are banned from the room "(.*)"/.exec(parts[1]);
				if (room) console.log(`Join failed - Banned from room ${room[1]}`);
			} else if (parts[1] === 'nonexistent') {
				const room = /The room "(.*)" does not exist\./.exec(parts[1]);
				if (room) console.log(`Join failed - The room ${room[1]} does not exist or is modjoined`);
			}
			normalisedType = messageType;
			break;
		case 'popup':
			let popup = parts.join('|');
			if (popup.includes('has banned you from the room')) {
				const message = /<p>(.+) has banned you from the room ([^.]+)[.]<\/p><p>To appeal/.exec(popup);
				if (!message) return;
				console.log(`POPUP (ROOMBAN) - Banned from room '${message[1]}' by '${message[2]}'; please inspect the situation`);
			}
			debug(`POPUP: ${popup}`);
			normalisedType = messageType;
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
			normalisedType = messageType;
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
				for (const [rank, users] of Object.entries(details.auth as {[k: string]: string})) {
					for (const user of users) {
						room.auth.set(toId(user), rank);
					}
				}
			}
			normalisedType = messageType;
			break;
		default:
			debug(`[parser.js.parse] Unhandled message: [${roomid}|${messageType}|${parts.join(',')}]`);
			normalisedType = messageType as MessageType;
		}
		Chat.events.emit(normalisedType, room, parts);
	}

	/**
	 * Takes a parsed regex of [message, user, group] and updates auth
	 */
	function parseAuthChange(room: Room, user: string, rank: string) {
		if (!room) return debug(`Setting auth for invalid room.`);
		const groupId = toId(rank);
		const group = Object.entries(Config.groups).find((e) => e[1].id === groupId);
		if (!group) return debug(`Invalid group ${groupId}`);
		room.auth.set(toId(user), group[0]);
	}

	function parseChat(roomid: string, userstr: string, message: string) {
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

	function parsePM(from: string, message: string) {
		if (toId(from) === toId(Config.nick)) return;
		const user = Tools.splitUser(from);
		new ChatParser(message, user, null).parse();
	}

	function parseChatPage(pageid: string, parts: string[]) {
		debug(`Viewing chat page '${pageid}'`);
		Chat.events.emit('chatpage', pageid, parts);
	}
	export function strong(room: Room | null, message: string) {
		if (!room) return `/wall ${message}`;
		const auth = room.auth.get(toId(Config.nick));
		if (auth === ' ' || auth === '+') return `**${message}**`;
		return `/wall ${message}`;
	};

	export type ChatCommand = (
		this: ChatParser,
		target: string, room: Room | null,
		user: string, cmd: string, message: string
	) => void;
	export type ChatCommands = {[cmd: string]: string | ChatCommand};

	export const Commands: ChatCommands = {};

	export class ChatParser {
		room: Room | null;
		auth: string;
		user: string;
		userid: string;
		message: string;

		cmd: string = '';
		target: string = '';
		constructor(message: string, user: string[], room: Room | null = null) {
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
			this.cmd = cmd.toLowerCase();
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
			debug(`[Commands.${this.cmd}] target = '${this.target}' | room = ${room ? room.roomid : 'PMs'} | user = ${user} | group = '${this.auth}'`);
			command.call(this, this.target, room, user, this.cmd, message);
		}

		reply(message: string) {
			if (this.room) return sendMessage(this.room.roomid, message);
			sendPM(this.user, message);
		}

		replyPM(message: string) {
			sendPM(this.user, message);
		}

		replyHTMLPM(message: string) {
			const pmRoom = Rooms.canPMInfobox(toId(this.user));
			if (!pmRoom) return this.replyPM(`Can't send you HTML, make sure that I have the bot rank in a room you're in.`);
			Chat.sendMessage(pmRoom, `/pminfobox ${this.user}, ${message}`);
		}

		strong(message: string) {
			return Chat.strong(this.room, message);
		}

		getUser(userid: string) {
			return this.room && this.room.users.get(toId(userid)) || null;
		}

		can(permission: 'host' | 'auth' | 'authhost' | 'staff' | 'leader' | 'dev', room: Room | null = null): boolean {
			if (Config.developers && Config.developers.includes(this.userid)) return true;
			if (permission === 'dev') return false;
			if (permission === 'authhost') return this.can('auth') && this.can('host');

			let group = (room && room.auth.get(this.userid)) || this.auth;
			// todo - rewrite this when the new |groups| protocol arrives
			switch (permission) {
			case 'host':
				if (room?.mafiaTracker?.hostid === this.userid) return true;
				// falls through
			case 'auth':
				if (group === '+') return true;
				// falls through
			case 'staff':
				if (['%', '@', '*'].includes(group)) return true;
				// falls through
			case 'leader':
				if (['#', '&', '~'].includes(group)) return true;
			}
			return false;
		}
	}

	export const client = new Client({});
	client.on('message', parse);
	client.on('page', parseChatPage);

	export const Slaves = require('./slaves.js');
}