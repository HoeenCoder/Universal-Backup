'use strict';

/**
 * Autoreply to commands with a set response.
 * Intended for use with custom ideas and the like
 */

const fs = require('fs');
const REPLY_FILE = './config/replies.json';

// caching this cause it's probably expensive
let ranks = Object.keys(Config.groups);

/** @typedef {{rank: string, reply: string}} ReplyObject */
/** @type {{[k: string]: ReplyObject}} */
let Replies = {};
try {
	Replies = JSON.parse(fs.readFileSync(REPLY_FILE).toString());
} catch (e) {}

function writeReplies() {
	fs.writeFileSync(REPLY_FILE, JSON.stringify(Replies));
}

let awaitingCode = {roomid: '', name: '', rank: ''};
/**
 * @param {string} type
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseCode(type, roomid, parts) {
	if (awaitingCode.roomid !== roomid) return;
	const message = parts.join('|');
	if (message.startsWith('<div class="infobox"><details><summary>See code...</summary><div class="chat"><code style="white-space: pre-wrap; display: table">') ||
        message.startsWith('<div class="infobox"><div class="chat"><code style="white-space: pre-wrap; display: table">')) {
		const code = message.slice(130, -29).replace(/<br \/>/g, '\n');
		Replies[awaitingCode.name] = {rank: awaitingCode.rank, reply: code};
		writeReplies();
		Chat.sendMessage(roomid, `Added reply for name ${awaitingCode.name}`);
		awaitingCode = {roomid: '', name: '', rank: ''};
	}
}
/**
 * @param {string} type
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseChat(type, roomid, parts) {
	const message = parts.slice(1).join('|');
	if (Config.commandTokens.includes(message.charAt(0))) {
		const cmd = toId(message.substr(0, message.indexOf(' ') + 1 || undefined));
		const custom = Replies[cmd];
		if (custom) {
			const rank = parts[0].charAt(0);
			if (ranks.indexOf(rank) <= ranks.indexOf(custom.rank) || Config.developers.includes(toId(parts[0]))) {
				Chat.sendMessage(roomid, custom.reply);
			}
		}
	}
}

const CODE_STRING = '!';

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	addcustom: function (target, room) {
		if (!this.can('roommanagement')) return;
		let [name, rank, ...text] = target.split(',');
		if (!name || !rank || !text) return this.replyPM('Invalid syntax.');
		const reply = text.join(',').trim();
		name = toId(name);
		rank = rank.trim();
		if (!rank || rank.length !== 1) return this.replyPM('Invalid rank.');
		if (Replies[name]) return this.replyPM('A command with this name already exists');
		if (text.join(',') === CODE_STRING) {
			if (!room) return this.replyPM(`You need to be in a room for this...`);
			awaitingCode = {roomid: room.roomid, name, rank};
			this.reply('Listening for the next !code');
		} else {
			Replies[name] = {rank, reply};
			writeReplies();
			this.reply('Added');
		}
	},
	deletecustom: function (target) {
		if (!this.can('roommanagement')) return;
		const name = toId(target);
		if (!Replies[name]) return this.reply(`${name} is not a command.`);
		delete Replies[name];
		writeReplies();
		return this.reply(`Done`);
	},
	viewcustoms: function () {
		if (!this.can('games')) return;
		this.replyPM(Object.keys(Replies).join(', '));
	},
};
const listeners = {
	"customreply-code": {
		rooms: true,
		messageTypes: ['html'],
		repeat: true,
		callback: parseCode,
	},
	"customreply-chat": {
		rooms: true,
		messageTypes: ['chat'],
		repeat: true,
		callback: parseChat,
	},
};

module.exports = {
	commands,
	listeners,
};
