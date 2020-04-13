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
		}
		this.writeData();
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

	if (match = /^(-?\d+) (?:point was|points were) awarded to(?: the .+ faction:)?: (.+)$/.exec(message)) {
		const players = match[2].split(',');
		ladder.addPoints(parseInt(match[1]), players);
	} else if (match = /MVP and (\d+) points were awarded to: (.+)/.exec(message)) {
		mvpLadder.addPoints(1, [match[2]]);
		ladder.addPoints(parseInt(match[1]), [match[2]]);
	}
});

/** @type {import("../chat").ChatCommands} */
const commands = {
	resetladders: function (target, room, user) {
		if (!this.can('leader')) return this.reply(`access denied`);
		ladder.reset();
		mvpLadder.reset();
		return this.reply(`done`);
    },
    addpoints: function(target, room, user) {
        if (!this.can('leader')) return this.reply(`access denied`);
        let [pointsStr, ...targets] = target.split(',')
        const points = parseInt(pointsStr);
        ladder.addPoints(points, targets);
    },
    addmvp: function(target, room, user) {
        if (!this.can('leader')) return this.reply(`access denied`);
        let [pointsStr, ...targets] = target.split(',')
        const points = parseInt(pointsStr);
        mvpLadder.addPoints(points, targets);    
    },
    ladder: function(target, room, user) {
        if (!this.can('staff') || !room) return;
        return room.send(`!code ` + Object.entries(ladder.data).map(([user, points]) => `${user}: ${points}`).join('\n'));
    },
    mvpladder: function(target, room, user) {
        if (!this.can('staff') || !room) return;
        return room.send(`!code ` + Object.entries(mvpLadder.data).map(([user, points]) => `${user}: ${points}`).join('\n'));
    },
};

exports.commands = commands;
