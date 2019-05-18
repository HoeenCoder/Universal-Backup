'use strict';

const https = require('https');
const fs = require('fs');

/** @typedef {{[weapon: string]: Weapon}} Weapons */
/** @typedef {{[area in MenuMode]: MapSet}} Rotation */
/** @typedef {'regular' | 'ranked' | 'league'} MenuMode */
/** @typedef {SetInfo[]} MapSet */
/**
 * @typedef {Object} SetInfo
 * @property {string} map1
 * @property {string} map2
 * @property {string} mode
 * @property {number} endTime
 * @property {number} startTime
 */
/**
 * @typedef {Object} Weapon
 * @property {string} id
 * @property {string} name
 * @property {string} class
 * @property {string} subClass
 * @property {string} sub
 * @property {string} subId
 * @property {string} special
 * @property {string} specialId
 * @property {number} points
 * @property {number} unlocked
 * @property {number} cost
 * @property {Stats} stats
 * @property {string} weight
 * @property {number} ink
 * @property {number=} first
 * @property {number=} flick
 */
/**
 * @typedef Stats
 * @property {number} range // all classes [slot 1]
 * @property {number=} firerate // shooters, blasters [slot 2]
 * @property {number=} damage // shooters, nozzlenoses, brellas [slot 3], sloshers, dualies [slot 2]
 * @property {number=} chargespeed // chargers, splatlings [slot 2]
 * @property {number=} mobility // chargers, splatlings [slot 3], dualies [slot 2]
 * @property {number=} impact // blasters [slot 3]
 * @property {number=} inkspeed // rollers, brushes [slot 2]
 * @property {number=} handling // rollers, brushes, sloshers [slot 3]
 * @property {number=} durability // brellas [slot 2]
 */
/**
 * @typedef Profile
 * @property {string} userid
 * @property {string} level
 * @property {Ranks} ranks
 * @property {string} weapon
 * @property {string} title
 * @property {string} team
 */
/**
 * @typedef Ranks
 * @property {string} sz
 * @property {string} tc
 * @property {string} rm
 * @property {string} cb
 */

/** @type {Rotation} */
let SplatoonMaps = {
	regular: [],
	ranked: [],
	league: [],
};

// Load profile data
/** @type {{[userid: string]: Profile}} */
let profiles = {};
try {
	profiles = JSON.parse(fs.readFileSync('./config/splatoon-profiles.json'));
} catch (e) {
	// file probably dosen't exist, should fix itself on first write.
	if (e.code !== 'ENOENT') throw e;
}
function writeProfileJson() {
	fs.writeFileSync('./config/splatoon-profiles.json', JSON.stringify(profiles));
}

// Load data for weapon/weaponsearch
/** @type {Weapons} */
const weapons = JSON.parse(fs.readFileSync('./config/splatoon.json'));
const statNames = {
	range: 'Range',
	firerate: 'Fire Rate',
	damage: 'Damage',
	chargespeed: 'Charge Speed',
	mobility: 'Mobility',
	impact: 'Impact',
	inkspeed: 'Ink Speed',
	handling: 'Handling',
	durability: 'Durability',
};
/** @type {{[key: string]: string[]}} */
const searches = {
	class: [],
	sub: [],
	special: [],
	weight: [],
	searchableValues: Object.keys(statNames).concat(['cost', 'unlocked', 'ink', 'flick', 'first', 'points']),
};
for (let key in weapons) {
	/** @type {Weapon} */
	let weapon = weapons[key];
	if (!searches.class.includes(toId(weapon.subClass))) searches.class.push(toId(weapon.subClass));
	if (!searches.sub.includes(weapon.subId)) searches.sub.push(weapon.subId);
	if (!searches.special.includes(weapon.specialId)) searches.special.push(weapon.specialId);
	if (!searches.weight.includes(toId(weapon.weight))) searches.weight.push(toId(weapon.weight));
}

async function splatoonUpdate() {
	debug(`Fetching Splatoon Rotations...`);
	const reqOptions = {
		host: 'splatoon2.ink',
		path: '/data/schedules.json',
		agent: false,
		method: 'GET',
	};
	const req = https.request(reqOptions, res => {
		res.setEncoding('utf8');
		let data = '';
		res.on('data', chunk => {
			data += chunk;
		});
		res.on('end', () => {
			let rawData = JSON.parse(data);
			/** @type {Rotation} */
			let newMaps = {
				regular: [],
				ranked: [],
				league: [],
			};
			// Parse into a workable form
			for (let base of ['regular', 'gachi', 'league']) {
				for (let i = 0; i < rawData[base].length; i++) {
					/** @type {SetInfo} */
					let block = {
						map1: rawData[base][i].stage_a.name,
						map2: rawData[base][i].stage_b.name,
						mode: rawData[base][i].rule.name,
						endTime: rawData[base][i].end_time * 1000,
						startTime: rawData[base][i].start_time * 1000,
					};
					/** @type {MenuMode} */
					let area = (base === 'gachi' ? 'ranked' : base);
					newMaps[area].push(block);
				}
			}
			SplatoonMaps = newMaps;
			debug(`Splatoon Rotations loaded.`);
		});
	});
	req.on('error', e => {
		console.error(`Error while attempting to obtain splatoon map data: ${e.stack}`);
		return;
	});
	req.end();
}
// Load rotation JSON
splatoonUpdate();

// Prunes expired rotations, pulls new data if there is none left.
async function pruneMaps() {
	// To prevent issues when calclating during rotation changes, record Date.now, now.
	const now = Date.now();
	/** @type {MenuMode} */
	let mode = "regular"; // dumb hack for typescript
	for (mode in SplatoonMaps) {
		for (let i = 0; i < SplatoonMaps[mode].length; i++) {
			if (SplatoonMaps[mode][i].endTime <= now) {
				SplatoonMaps[mode].splice(i, 1);
				i--;
			}
		}
		if (SplatoonMaps[mode].length < 3) {
			// were out of/running out of data! Get new info and stop pruning since we will be up to date afterwords.
			await splatoonUpdate();
			break;
		}
	}
}

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	later: 'maps',
	next: 'maps',
	async maps(target, room, user, cmd) {
		if (room && toId(room.title) !== 'splatoon') return this.reply(`This command can only be used in the Splatoon room.`);
		await pruneMaps();
		const now = Date.now();
		let index = 0;
		if (cmd === 'next') index = 1;
		if (cmd === 'later') index = 2;
		if (!SplatoonMaps.regular[index]) this.reply(`Rotation Data not found, maybe its not loaded yet?`);
		this.reply(`**Regular Battle**: ${SplatoonMaps.regular[index].mode} on __${SplatoonMaps.regular[index].map1}__ and __${SplatoonMaps.regular[index].map2}__`);
		this.reply(`**Ranked Battle**: ${SplatoonMaps.ranked[index].mode} on __${SplatoonMaps.ranked[index].map1}__ and __${SplatoonMaps.ranked[index].map2}__`);
		this.reply(`**League Battle**: ${SplatoonMaps.league[index].mode} on __${SplatoonMaps.league[index].map1}__ and __${SplatoonMaps.league[index].map2}__`);
		if (!index) {
			this.reply(`Rotation ends in ${Tools.toDurationString((SplatoonMaps.regular[index].endTime - now), {precision: 2})}`);
		} else {
			this.reply(`Rotation starts in ${Tools.toDurationString((SplatoonMaps.regular[index].startTime - now), {precision: 2})}`);
		}
	},
	randomweapon: 'weapon',
	randweapon: 'weapon',
	weapon(target, room, user, cmd) {
		if (room && toId(room.title) !== 'splatoon') return this.reply(`This command can only be used in the Splatoon room.`);
		if (cmd !== 'weapon') target = Object.keys(weapons)[Math.floor(Math.random() * Object.keys(weapons).length)];
		let id = toId(target);
		if (!weapons[id]) return this.reply(`The weapon your looking for does not exist, try checking your spelling.`);
		let statString = ``;
		for (let stat in weapons[id].stats) {
			// @ts-ignore
			statString += `**${statNames[stat]}**: ${weapons[id].stats[stat]} | `;
		}
		statString += `**Weight**: ${weapons[id].weight} | **Ink Tank Consumption Per Shot**: ${weapons[id].ink}%`;
		if (weapons[id].first) {
			statString += ` | **Ink Tank Consumption on First Shot**: ${weapons[id].first}%`;
		} else if (weapons[id].flick) {
			statString += ` | **Ink Tank Consumption Per Vertical Flick**: ${weapons[id].flick}%`;
		}
		this.reply(`[${weapons[id].subClass}] **${weapons[id].name}** (${weapons[id].sub} + ${weapons[id].special} [${weapons[id].points}pts]). Unlocked at Level ${weapons[id].unlocked} and costs ${weapons[id].cost} cash.`);
		this.reply(statString);
	},
	ws: 'weaponsearch',
	weaponsearch(target, room, user) {
		if (room && toId(room.title) !== 'splatoon') return this.reply(`This command can only be used in the Splatoon room.`);
		if (room && !this.can('auth')) return this.replyPM(`You must be of rank Voice or higher to use that command in ${room.title}`);
		const helpInfo = `**Splatoon 2 Weapon Search Help**: https://pastebin.com/xB3L2epz`;
		let paramaters = target.split(',').map(part => {
			let parts = part.trim().split(' ');
			parts[0] = toId(parts[0]);
			if (!parts[1]) return parts;
			parts[1] = parts[1].trim();
			if (!parts[2]) return parts;
			parts[2] = toId(parts[2]);
			return parts;
		});
		if (!paramaters.length || !toId(target)) return this.reply(helpInfo);
		const options = {
			class: '',
			sub: '',
			special: '',
			weight: '',
			searches: [], // [['range', '>', 20], ['points', '<', 200]];
			usedSearches: [],
			showAll: false,
		};
		// Loop through the paramaters to setup options
		for (let i = 0; i < paramaters.length; i++) {
			let parts = paramaters[i];
			// @ts-ignore
			let value = parts.join('');
			let broken = false;
			// Basic paramaters
			if (value === 'all') {
				options.showAll = true;
				continue;
			}
			for (let type in searches) {
				if (type === 'searchableValues') continue;
				if (!searches[type].includes(value)) continue;
				// match found
				// @ts-ignore
				if (options[type]) {
					// @ts-ignore User passed multiple of a type of paramater
					this.reply(`Multiple ${type === 'class' ? 'classes' : type + 's'} provided (${options[type]} and ${value}). You can only have one of these selected each search.`);
					return this.reply(helpInfo);
				}
				// @ts-ignore
				options[type] = toId(value);
				broken = true;
				break;
			}
			if (broken) continue;
			// Compare paramaters
			if (!searches.searchableValues.includes(parts[0])) {
				// Ok, its not setup right
				this.reply(`Invalid search paramater "${parts.join(' ')}".`);
				return this.reply(helpInfo);
			}
			if (parts.length !== 3) {
				this.reply(`Search paramater was not setup correctly "${parts.join(' ')}".`);
				return this.reply(helpInfo);
			}
			const num = Number(parts[2]);
			if (isNaN(num) || num < 0 || !['<', '<=', '=', '>=', '>'].includes(parts[1])) {
				this.reply(`Search paramater was not setup correctly "${parts.join(' ')}".`);
				return this.reply(helpInfo);
			}
			// @ts-ignore
			options.searches.push([parts[0], parts[1], num]);
			// @ts-ignore
			options.usedSearches.push(parts[0]);
		}
		// Run the Search
		let matches = [];
		for (let key in weapons) {
			const weapon = weapons[key];
			if (options.class && toId(weapon.subClass) !== options.class) continue;
			if (options.sub && weapon.subId !== options.sub) continue;
			if (options.special && weapon.specialId !== options.special) continue;
			if (options.weight && toId(weapon.weight) !== options.weight) continue;
			// specific searches
			const baseKeys = ['cost', 'unlocked', 'ink', 'flick', 'first', 'points'];
			let broken = false;
			for (let i = 0; i < options.searches.length; i++) {
				const search = options.searches[i];
				if (baseKeys.includes(search[0])) {
					if (!weapon[search[0]] && weapon[search[0]] !== 0) {
						broken = true;
						break;
					}
					switch (search[1]) {
					case '<':
						if (!(weapon[search[0]] < search[2])) broken = true;
						break;
					case '<=':
						if (!(weapon[search[0]] <= search[2])) broken = true;
						break;
					case '=':
						if (weapon[search[0]] !== search[2]) broken = true;
						break;
					case '>=':
						if (!(weapon[search[0]] >= search[2])) broken = true;
						break;
					case '>':
						if (!(weapon[search[0]] > search[2])) broken = true;
						break;
					default:
						// ???
						throw new Error(`Unexpected search token "${search[1]}".`);
					}
				} else {
					if (!weapon.stats[search[0]] && weapon.stats[search[0]] !== 0) {
						broken = true;
						break;
					}
					switch (search[1]) {
					case '<':
						if (!(weapon.stats[search[0]] < search[2])) broken = true;
						break;
					case '<=':
						if (!(weapon.stats[search[0]] <= search[2])) broken = true;
						break;
					case '=':
						if (weapon.stats[search[0]] !== search[2]) broken = true;
						break;
					case '>=':
						if (!(weapon.stats[search[0]] >= search[2])) broken = true;
						break;
					case '>':
						if (!(weapon.stats[search[0]] > search[2])) broken = true;
						break;
					default:
						// ???
						throw new Error(`Unexpected search token "${search[1]}".`);
					}
				}
				if (broken) break;
			}
			if (broken) continue;
			matches.push(weapon.name);
		}
		if (!matches.length) return this.reply(`No weapons matched your search.`);
		let reply = `<b>Weapons that match your search</b>:<br/>`;
		for (let i = 0; i < matches.length; i++) {
			if (i >= 15 && !options.showAll) {
				reply += `<br/> and ${matches.length - 15} more. Add the "all" paramater to show all matches.`;
				break;
			}
			reply += `<button class="button" name="send" value="${!room ? `/pm ${Config.nick}, ` : ''}${Config.commandTokens[0]}weapon ${matches[i]}">${matches[i]}</button> `;
		}
		if (!room) {
			this.replyHTMLPM(reply);
		} else {
			this.reply(`/addhtmlbox ${reply}`);
		}
	},
	profile(target, room, user) {
		if (room && toId(room.title) !== 'splatoon') return this.reply(`This command can only be used in the Splatoon room.`);
		if (room && !this.can('auth')) return this.replyPM(`You must be of rank Voice or higher to use that command in ${room.title}`);
		if (!room) {
			let isInRoom = false;
			Rooms.rooms.forEach(r => {
				if (r.users.has(toId(user)) && r.auth.get(toId(Config.nick)) === '*') {
					isInRoom = true;
					return;
				}
			});
			if (!isInRoom) return this.reply(`This command makes use of PM HTML boxes. Because of this, you must share a room with me that I have the bot rank in. Consider joining <<splatoon>>.`);
		}

		target = toId(target);
		if (!target) target = toId(user);
		if (!profiles[target]) return this.reply(`${target} has not setup a profile, have them set one up with ${Config.commandTokens[0]}editprofile.`);
		const profile = profiles[target];

		let out = room ? `/addhtmlbox ` : `/pminfobox ${user}, `;
		out += `<table style="border: 1px solid"><tr><th style="border-bottom: 1px solid" colspan="2">${Tools.escapeHTML(target)}'s Profile</th></tr>`;
		out += `<tr><th style="border-right: 1px solid">Level</th><td>${profile.level}</td></tr>`;
		out += `<tr><th style="border-right: 1px solid">Ranks</th><td><b>SZ</b>: ${profile.ranks.sz} <b>TC</b>: ${profile.ranks.tc} <b>RM</b>: ${profile.ranks.rm} <b>CB</b>: ${profile.ranks.cb}</td></tr>`;
		out += `<tr><th style="border-right: 1px solid">Grizzco Title</th><td>${profile.title}</td></tr>`;
		out += `<tr><th style="border-right: 1px solid">Weapon</th><td><button class="button" name="send" value="/pm ${Config.nick}, ${Config.commandTokens[0]}weapon ${toId(profile.weapon)}">${profile.weapon}</button></td></tr>`;
		out += `<tr><th style="border-right: 1px solid">Team</th><td>${Tools.escapeHTML(profile.team)}</td></tr></table>`;

		Chat.sendMessage('splatoon', out);
	},
	editprofile(target, room, user) {
		if (room) return this.reply(`This command can only be used in PMs.`);

		let userid = toId(user);
		if (!profiles[userid]) {
			profiles[userid] = {
				userid: userid,
				level: '1',
				ranks: {
					sz: 'C-',
					tc: 'C-',
					rm: 'C-',
					cb: 'C-',
				},
				weapon: weapons['splattershotjr'].name,
				title: 'Intern',
				team: 'None',
			};
		}

		let parts = target.split(',').map(x => {
			return x.trim();
		});
		let key = toId(parts.shift());

		switch (key) {
		case 'level':
			// 34, 56*
			let levelStr = parts.shift();
			let stared = false;
			if (!levelStr) {
				return this.reply(`No level provided, use the format ${Config.commandTokens[0]}editprofile level, [level OR level*].`);
			}
			if (levelStr.endsWith('*')) {
				stared = true;
				levelStr = levelStr.substring(0, levelStr.length - 1);
			}
			let level = parseInt(levelStr);
			if (isNaN(level) || level < 1 || level > 99) return this.reply(`The level needs to be between 1 and 99.`);

			profiles[userid].level = level + (stared ? '*' : '');
			writeProfileJson();
			return this.reply(`Your level was set to ${profiles[userid].level}.`);
		case 'rank':
			// sz/tc/rm/cb, C/B/A/S/X(+/-)
			let mode = toId(parts.shift());
			if (!['sz', 'tc', 'rm', 'cb'].includes(mode)) return this.reply(`Invalid mode provided, use the format ${Config.commandTokens[0]}editprofile rank, [sz OR tc OR rm OR cb], [valid rank]. Valid ranks are C-, C, C+, B-, B, B+, A-, A, A+, S, S+, X`);
			let rank = parts.shift();
			if (!rank) return this.reply(`Invalid mode provided, use the format ${Config.commandTokens[0]}editprofile rank, [sz OR tc OR rm OR cb], [valid rank]. Valid ranks are C-, C, C+, B-, B, B+, A-, A, A+, S, S+, X`);
			rank = rank.toUpperCase();
			if (!['C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S', 'S+', 'X'].includes(rank)) return this.reply(`Invalid mode provided, use the format ${Config.commandTokens[0]}editprofile rank, [sz OR tc OR rm OR cb], [valid rank]. Valid ranks are C-, C, C+, B-, B, B+, A-, A, A+, S, S+, X`);

			// @ts-ignore
			profiles[userid].ranks[mode] = rank;
			writeProfileJson();
			return this.reply(`Your ${mode.toUpperCase()} rank was set to ${rank}.`);
		case 'title':
		case 'grizzco':
			let title = toId(parts.shift());
			const titles = {
				'intern': 'Intern',
				'apprentice': 'Apprentice',
				'parttimer': 'Part-Timer',
				'gogetter': 'Go-Getter',
				'overachiever': 'Overachiever',
				'profreshional': 'Profreshional',
			};
			// @ts-ignore
			if (!titles.hasOwnProperty(title)) return this.reply(`Invalid Grizzco title provided, use the format ${Config.commandTokens[0]}editprofile title, [title]. Valid titles are: ${Object.keys(titles).map(t => { return titles[t]; }).join(', ')}`);

			// @ts-ignore
			profiles[userid].title = titles[title];
			writeProfileJson();
			// @ts-ignore
			return this.reply(`Your grizzco title was set to ${titles[title]}.`);
		case 'weapon':
			let weapon = toId(parts.shift());
			if (!weapons.hasOwnProperty(weapon)) return this.reply(`Invalid weapon provided, use the format ${Config.commandTokens[0]}editprofile weapon, [weapon]. Valid weapons can be found with ${Config.commandTokens[0]}weaponsearch`);

			profiles[userid].weapon = weapons[weapon].name;
			writeProfileJson();
			return this.reply(`Your weapon was set to the ${weapons[weapon].name}`);
		case 'clan':
		case 'team':
			let team = parts.shift();
			if (!team) team = 'None';
			if (team.length > 20) return this.reply(`Your ${key} name is too long, it cannot be longer than 20 characters.`);

			profiles[userid].team = team;
			writeProfileJson();
			return this.reply(`Your team was set to ${team}`);
		default:
			return this.reply(`Invalid option selected, use the format ${Config.commandTokens[0]}editprofile [level OR rank OR title OR weapon OR team], [options]. Use each subcommand for more information.`);
		}
	},
};

exports.commands = commands;
