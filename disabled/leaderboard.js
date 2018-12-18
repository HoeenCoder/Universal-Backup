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

/** @type {[string, number][] | null} */
let LADDERCACHE;
/** @type {[string, number][] | null} */
let MVPCACHE;

function writePoints(mvp = false) {
	if (mvp) {
		fs.writeFileSync(MVPLADDER_PATH, JSON.stringify(MVPLADDER, null, 2));
		MVPCACHE = null;
	} else {
		fs.writeFileSync(LADDER_PATH, JSON.stringify(LADDER, null, 2));
		LADDERCACHE = null;
	}
}

/**
 * @param {boolean} mvp
 */
function getLadder(mvp = false) {
	let totalPoints;
	if (mvp) {
		if (MVPCACHE) return MVPCACHE;
		totalPoints = MVPLADDER;
	} else {
		if (LADDERCACHE) return LADDERCACHE;
		totalPoints = Object.assign({}, LADDER);
		for (const userid in MVPLADDER) {
			if (!totalPoints[userid]) totalPoints[userid] = 0;
			totalPoints[userid] += MVPLADDER[userid] * (Config.MVPPoints || MVP_POINTS);
		}
	}
	const res = Object.entries(totalPoints).sort((a, b) => b[1] - a[1]);
	if (mvp) {
		MVPCACHE = res;
	} else {
		LADDERCACHE = res;
	}
	return res;
}

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	mvpladder: 'ladder',
	ladder: function (target, room, user, cmd) {
		let mvp = cmd === 'mvpladder';
		const points = getLadder(mvp);

		let buf = `<details><summary>${cmd === 'mvpladder' ? 'MVP Ladder' : 'Ladder'}</summary><table><th>Userid</th><th>${cmd === 'mvpladder' ? 'MVPs' : 'Points'}</th>`;
		const MainRoom = Rooms(Config.primaryRoom);

		let regsShown = 0;
		const showAuth = !!target;
		buf += points.map(([userid, points], i) => {
			let it = false;
			if (MainRoom && MainRoom.auth.get(userid)) {
				if (!showAuth) {
					return '';
				} else {
					it = true;
				}
			} else {
				regsShown++;
			}
			const bold = regsShown <= REGS_SHOWN;
			return `<tr><td>${it ? '<em>' : ''}${bold ? '<strong>' : ''}${userid}${bold ? '</strong>' : ''}${it ? '</em>' : ''}</td><td>${points}</td></tr>`;
		}).join('');
		buf += `</table></details>`;
		if (room && this.can('broadcast', null, room)) {
			this.reply('/addhtmlbox ' + buf);
		} else {
			this.replyHTMLPM(buf);
		}
	},

	position: function (target, room, user) {
		if (room && !this.can('broadcast', null, room)) return this.replyPM(`Please use this command in PMs :)`);
		const userid = toId(target) || toId(user);
		if (userid === 'target') return this.reply(`nice try`);
		if (!(userid in LADDER || userid in MVPLADDER)) return this.reply(`${userid} doesn't have any points.`);

		const ladder = getLadder();
		const MainRoom = Rooms(Config.primaryRoom);

		let usersAhead = 0;
		let points = 0;
		for (const [u, p] of ladder) {
			if (u === userid) {
				points = p;
				break;
			}
			if (!MainRoom || !MainRoom.auth.get(u)) usersAhead++;
		}
		this.reply(`${userid} has ${usersAhead} reg${usersAhead !== 1 ? 's' : ''} in front of them, with ${points} points!`);
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
			points = mvp ? 1 : (Config.WinPoints || WIN_POINTS);
			targets.push(pointsArg);
		}
		targets = targets.map(toId);
		if (cmd === 'lose' || cmd === 'unmvp') points *= -1;

		const targetLadder = (mvp ? MVPLADDER : LADDER);
		for (const user of targets) {
			if (!user) continue;
			if (!targetLadder[user]) targetLadder[user] = 0;
			targetLadder[user] += points;
			if (!targetLadder[user]) delete targetLadder[user];
		}
		writePoints(mvp);
		this.reply(`Gave ${points}${mvp ? ' MVP' : ''} point${points !== 1 ? 's' : ''} to ${targets.length} user${targets.length > 1 ? 's' : ''}.`);
	},
};

exports.commands = commands;
