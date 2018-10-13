'use strict';

const fs = require('fs');

const LADDER_PATH = './config/lb_ladder.json';
const MVPLADDER_PATH = './config/lb_mvpladder.json';

const WIN_POINTS = 5;
const MVP_POINTS = 5;

const REGS_SHOWN = 25;
/**
 * @param {string} path
 */
function loadFile(path) {
	try {
		const data = fs.readFileSync(path);
		return JSON.parse(data.toString());
	} catch (e) {} // file doesn't exist/isnt valid json
	return {};
}

/** @type {{[k: string]: number}} */
let LADDER = loadFile(LADDER_PATH);
/** @type {{[k: string]: number}} */
let MVPLADDER = loadFile(MVPLADDER_PATH);

function writePoints() {
	fs.writeFileSync(LADDER_PATH, JSON.stringify(LADDER, null, 2));
	fs.writeFileSync(MVPLADDER_PATH, JSON.stringify(MVPLADDER, null, 2));
}

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	mvpladder: 'ladder',
	ladder: function (target, room, user, cmd) {
		/** @type {{[k: string]: number}} */
		let totalPoints = {};
		if (cmd === 'mvpladder') {
			totalPoints = MVPLADDER;
		} else {
			totalPoints = Object.assign({}, LADDER);
			for (const userid in MVPLADDER) {
				if (!totalPoints[userid]) totalPoints[userid] = 0;
				totalPoints[userid] += MVPLADDER[userid] * (Config.MVPPoints || MVP_POINTS);
			}
		}
		let buf = `<details><summary>${cmd === 'mvpladder' ? 'MVP Ladder' : 'Ladder'}</summary><table><th>Userid</th><th>${cmd === 'mvpladder' ? 'MVPs' : 'Points'}</th>`;
		const MainRoom = Rooms(Config.primaryRoom);
		buf += Object.entries(totalPoints).sort((a, b) => b[1] - a[1]).map(([userid, points], i) => {
			if (MainRoom && MainRoom.auth.get(userid)) return '';
			const it = i <= REGS_SHOWN;
			return `<tr><td>${it ? '<em>' : ''}${userid}${it ? '</em>' : ''}</td><td>${points}</td></tr>`;
		}).join('');
		buf += `</table></details>`;
		if (room && this.can('broadcast', null, room)) {
			this.reply('/addhtmlbox ' + buf);
		} else {
			this.replyHTMLPM(buf);
		}
	},

	mvp: 'win',
	unmvp: 'win',
	lose: 'win',
	win: function (target, room, user, cmd) {
		if (!this.can('games', null, room)) return;
		let [pointsArg, ...targets] = target.split(',');
		let points = parseInt(pointsArg);
		const mvp = cmd.includes('mvp');
		if (!points || isNaN(points)) {
			points = mvp ? 1 : WIN_POINTS;
			targets.push(pointsArg);
		}
		targets = targets.map(toId);
		if (cmd === 'lose' || cmd === 'unmvp') points *= -1;

		const targetLadder = (mvp ? MVPLADDER : LADDER);
		for (const user of targets) {
			if (!targetLadder[user]) targetLadder[user] = 0;
			targetLadder[user] += points;
		}
		writePoints();
		this.reply(`Gave ${points}${mvp ? ' MVP' : ''} points to ${targets.length} user${targets.length > 1 ? 's' : ''}.`);
	},
};

exports.commands = commands;
