'use strict';

/**
 * Autoreply to commands with a set response.
 * Intended for use with custom ideas and the like
 */

const fs = require('fs');
const REPLY_FILE = './config/replies.json';

const CODE_REGEX = new RegExp(
	'<div class="infobox"><div class="chat">' +
	'<code style="white-space: pre-wrap; display: table; tab-size: 3">(.+)<\\/code><\\/div>'
);
const CODE_ML_REGEX = new RegExp(
	'<div class="infobox"><div class="chat"><details class="readmore code" style="white-space: pre-wrap; display: table; tab-size: 3">' +
	'<summary>(.+)<\\/summary>' +
	'(.+)<\\/details><\\/div><\\/div>'
);

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

Chat.events.on('command', (/** @type {Room} */room, /** @type {string[]} */details) => {
	const user = details[0];
	const cmd = details[1];
	const custom = Replies[cmd];
	if (custom) {
		const rank = user.charAt(0);
		if (ranks.indexOf(rank) <= ranks.indexOf(custom.rank) || Config.developers.includes(toId(user))) {
			room.send(custom.reply);
		}
	}
});

const CODE_STRING = '!';

/** @type {import("../chat").ChatCommands} */
const commands = {
	addcustom: function (target, room) {
		if (!this.can('roommanagement')) return;
		let [name, rank, ...text] = target.split(',');
		if (!name || !rank || !text) return this.replyPM('Invalid syntax.');
		const reply = text.join(',').trim();
		name = toId(name);
		rank = rank.trim();
		if (!rank || rank.length !== 1) return this.replyPM('Invalid rank.');
		if (Replies[name] || Chat.commands[name]) return this.replyPM('A command with this name already exists');
		if (text.join(',') === CODE_STRING) {
			if (!room) return this.replyPM(`You need to be in a room for this...`);

			Chat.events.on('html', (/**@type {Room} */codeRoom, /**@type {string[]} */details) => {
				if (codeRoom !== room) return false;
				const message = details.join('|');
				let res;
				if ((res = message.match(CODE_REGEX))) {
					Replies[name] = {rank, reply: res[1].replace(/<br \/>/g, '\n').trim()};
				} else if ((res = message.match(CODE_ML_REGEX))) {
					Replies[name] = {rank, reply: `${res[1].replace(/<br \/>/g, '\n')}\n${res[2].replace(/<br \/>/g, '\n')}`};
				} else {
					return false;
				}
				writeReplies();
				this.reply(`Added command ${name}`);
				return true;
			}, true);

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

exports.commands = commands;
