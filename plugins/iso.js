'use strict';

// this object usually sticks on MafiaTracker#iso
class ISO {
	/**
     * @param {Room} room
     */
	constructor(room) {
		if (!room.mafiaTracker) throw new Error(`ISO created with no mafia object`);
		/** @type {string[][]} */
		this.authors = [];
		/** @type {string[]} */
		this.log = [];

		this.startTime = Date.now();

		room.send('ISO started');
		room.mafiaTracker.addChatListener('chat', (/** @type {string[]} */details) => {
			this.addChat(details.slice(1).join('|'), details[0]);
		});
		room.mafiaTracker.addMafiaListener('day', (/** @type {string[]} */details) => {
			this.addHTML(`<span class="broadcast-blue">Day ${details[0]}</span>`, ['~']);
		});
		room.mafiaTracker.addMafiaListener('kill', (/** @type {string[]} */details, /** @type {string} */message) => {
			this.addHTML(`<span class="broadcast-blue">${Tools.stripHTML(message)}</span`, [details[1]]);
		});
		room.mafiaTracker.addMafiaListener('lynch', (/** @type {string[]} */details, /** @type {string} */message) => {
			const authors = [details[1]];
			if (details[2]) {
				authors.push(details[2]);
				if (details[3]) authors.push(details[3]);
			}
			this.addLine(message, authors);
		});
	}
	/**
     * @param {string} text
     * @param {string} author
     */
	addChat(text, author) {
		if (author === '~') return;
		text = Tools.escapeHTML(text).replace(/>here.?</ig, 'here  ').replace(/(click) (here)/ig, '$1  $2');
		this.addHTML(`<strong style="${Tools.colourName(author)}">${author.slice(1)}:</strong> ${text}`, [author]);
	}
	/**
     * @param {string} text
     * @param {string[]} authors
     */
	addLine(text, authors) {
		this.addHTML(Tools.escapeHTML(text), authors);
	}
	/**
     * @param {string} text
     * @param {string[]} authors
     */
	addHTML(text, authors) {
		this.log.push(`<div class="chat"><small>${this.getTimestamp()}</small> ${text}</div>`);
		this.authors.push(authors.map(a => a === '~' ? a : toId(a)));
	}
	getTimestamp() {
		if (!this.startTime) return '[]';

		/**
         * @param {number} v
         */
		function p02d(v) {
			return v < 10 ? '0' + v : v;
		}
		const delta = Date.now() - this.startTime;

		let s = Math.floor(delta / 1000);
		let h = Math.floor(s / (60 * 60));
		s = s - h * 60 * 60;
		let m = Math.floor(s / 60);
		s = s - m * 60;
		return `[${h ? `${p02d(h)}:` : ''}${p02d(m)}:${p02d(s)}]`;
	}
}

Mafia.events.on('gamestart', (/** @type {MafiaTracker} */tracker) => {
	tracker.iso = new ISO(tracker.room);
});

/** @type {import("../chat").ChatCommands} */
const commands = {
	i: function (target, room, user) {
		if (room) return this.replyPM(`Please use this command in PMS :)`);
		if (!Rooms.canPMInfobox(user)) return this.replyPM(`Can't PM you html, make sure you share a room in which I have the bot rank.`);

		const userid = toId(user);
		let args = target.split(',');

		let isoRoom = Rooms(args[0]);
		if (isoRoom && isoRoom.users.has(userid) && isoRoom.mafiaTracker) {
			args.shift();
		} else {
			isoRoom = [...Rooms.rooms.values()].find(room => room.mafiaTracker && room.mafiaTracker.players[userid]) || Rooms(Config.primaryRoom);
		}
		if (!isoRoom || !isoRoom.mafiaTracker || !isoRoom.mafiaTracker.iso) return this.replyPM(`No iso for room ${isoRoom ? isoRoom.roomid : 'undefined'}, if this isnt your room, give it as your first argument.`);

		const searchAuthors = ['~', ...args.map(toId)];
		const authors = isoRoom.mafiaTracker.iso.authors;
		const log = isoRoom.mafiaTracker.iso.log;
		let foundLog = [];

		for (let index = 0; index < authors.length; index++) {
			for (const author of authors[index]) {
				if (searchAuthors.includes(author)) {
					foundLog.push(log[index]);
					break;
				}
			}
		}
		let buf = `<details><summary>ISO for ${searchAuthors.slice(1).join(', ')}</summary><div role="log">${foundLog.join('')}</div></details>`;
		this.replyHTMLPM(buf);
	},
};

exports.commands = commands;
