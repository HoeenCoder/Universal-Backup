'use strict';

const LB_FILE = 'config/maflb-lb.json';
const MVP_FILE = 'config/maflb-mvp.json';

const fs = require('fs');

class Ladder {
	/**
     * @param {string} file
     */
	constructor(file) {
		this.filename = file;
		/** @type {{[k: string]: number}} */
		this.data = {};
		try {
			this.data = JSON.parse(fs.readFileSync(file).toString());
		} catch (e) {}
	}
	writeData() {
		fs.writeFileSync(this.filename, JSON.stringify(this.data));
	}
	/**
     * @param {number} points
     * @param {string[]} users
     */
	addPoints(points, users) {
		for (const user of users) {
			const id = toId(user);
			if (!(id in this.data)) this.data[id] = 0;
			this.data[id] += points;
			if (!this.data[id]) delete this.data[id];
		}
		this.writeData();
	}
	visualize() {
		return Object.entries(this.data)
			.sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
			.map(([name, points]) => `<div><username>${name}</username>: ${points}</div>`)
			.join('');
	}
	reset() {
		this.data = {};
		this.writeData();
	}
}

const ladder = new Ladder(LB_FILE);
const mvpLadder = new Ladder(MVP_FILE);

Chat.events.on('raw', (/** @type {Room} */room, /** @type {string} */parts) => {
	if (!room || room.roomid !== 'mafia') return;
	const message = parts[0];
	let match;

	if ((match = /^(-?\d+) (?:point was|points were) awarded to:(?: the .+ faction:)? (.+)$/.exec(message))) {
		const players = match[2].split(',');
		if (players[0].includes(':')) players[0] = players[0].split(':')[1]; // ?????
		ladder.addPoints(parseInt(match[1]), players);
	} else if ((match = /MVP and (\d+) points were awarded to: (.+)/.exec(message))) {
		mvpLadder.addPoints(1, [match[2]]);
		ladder.addPoints(parseInt(match[1]), [match[2]]);
	}
});

/** @type {ChatCommands} */
const commands = {
	resetladders: function (target, room, user) {
		if (!this.can('leader')) return this.reply(`access denied`);
		ladder.reset();
		mvpLadder.reset();
		return this.reply(`done`);
	},
	addpoints: function (target, room, user) {
		if (!this.can('staff')) return this.reply(`access denied`);
		let [pointsStr, ...targets] = target.split(',');
		const points = parseInt(pointsStr);
		ladder.addPoints(points, targets);
		this.reply(`gave ${points} points to ${targets.length} users`);
	},
	addmvp: function (target, room, user) {
		if (!this.can('staff')) return this.reply(`access denied`);
		let [pointsStr, ...targets] = target.split(',');
		const points = parseInt(pointsStr);
		mvpLadder.addPoints(points, targets);
		this.reply(`gave ${points} mvp points to ${targets.length} users`);
	},
	lb: 'ladder',
	leaderboard: 'ladder',
	ladder: function (target, room, user) {
		if (this.can('auth') && room) return room.send(`/adduhtml thtlb,<details><summary>Leaderboard:</summary>${ladder.visualize()}</details>`);
		this.replyHTMLPM(`<div><strong>Leaderboard:</strong>${ladder.visualize()}</div>`);
	},
	mvplb: 'mvpladder',
	mvpleaderboard: 'mvpladder',
	mvpladder: function (target, room, user) {
		if (this.can('auth') && room) return room.send(`/adduhtml thtmvp,<details><summary>MVP Leaderboard:</summary>${mvpLadder.visualize()}</details>`);
		this.replyHTMLPM(`<div><strong>MVP Leaderboard:</strong>${mvpLadder.visualize()}</div>`);
	},
};

exports.commands = commands;
