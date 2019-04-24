'use strict';

const https = require('https');

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

/** @type {Rotation} */
let SplatoonMaps = {
	regular: [],
	ranked: [],
	league: [],
};

// Load JSON
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
		});
	});
	req.on('error', e => {
		console.error(`Error while attempting to obtain splatoon data: ${e.stack}`);
		return;
	});
	req.end();
}
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
};

exports.commands = commands;
