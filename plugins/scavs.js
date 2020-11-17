'use strict';

const CREATE_REGEX = /^<div class="broadcast-blue"><strong>A new (.+) Scavenger Hunt by <em>(.+)<\/em> has been started(?: by .+)?\.<br \/>The first hint is: .+<\/strong><\/div>$/;
const FINISH_REGEX = /^<div class="broadcast-blue"><strong>The .+scavenger hunt was ended (?:by .*?|automatically)\.(.+)<details style="cursor: pointer;"><summary>Solution: <\/summary>(.*)<\/details><\/strong><\/div>$/;
const ANSWER_REGEX = /^<br \/>\d+\) (.+)<span style="color: lightgreen">\[<em>(.*)<\/em>\]$/;

////**
/// * @typedef {object} ScavengerHunt
/// * @param {string} host
/// * @param {'practice' | 'official' | 'unrated' | 'mini'} type
/// * @param {string[]?} questions
/// * @param {boolean} completed
/// * @param {boolean} recycled
/// */

// FIXME
/** @typedef {{[k: string]: any}} ScavengerHunt */

const VALD_HUNT_TYPES = new Set(['regular', 'practice', 'official', 'mini', 'unrated']);

// @ts-ignore
let scavSubroom = Config.scavsSubroom || '';
// @ts-ignore
let huntLimit = Config.scavsHuntLimit || 1;

/** @type {ScavengerHunt[]} */
let hunts = [];

let immediate = true;
/** @type {Set<string>} */
const disabledTypes = new Set(['practice']);

/**
 * @param {string} string
 */
function answerTransform(string) {
	return Tools.unescapeHTML(Tools.stripHTML(string));
}

/**
 * @param {string} message
 */
function extractAnswers(message) {
	let questions = [];
	for (const line of message.split('</span>')) {
		if (!line) continue;
		const parts = line.match(ANSWER_REGEX);
		if (!parts) return;
		questions.push(`${answerTransform(parts[1])}|${answerTransform(parts[2]).replace(/\//g, ';')}`);
	}
	return questions;
}

Chat.events.on('html', (/** @type {Room} */room, /** @type {string[]} */details) => {
	if (!room) return;
	const html = details.join('|');

	let res;
	if ((res = html.match(CREATE_REGEX))) {
		const [, type, host] = res;
		if (disabledTypes.has(type)) return;
		room.pendingScavengerHunt = {type, host: Tools.unescapeHTML(host)};
	} else if ((res = html.match(FINISH_REGEX))) {
		const questions = extractAnswers(res[2]);
		if (!questions) return debug(`scavs regex is bad, matched but no answers on ${html}`);

		room.scavengerHunt = {
			questions,
			completed: true,
			type: room.pendingScavengerHunt && room.pendingScavengerHunt.type || 'unknown',
			host: room.pendingScavengerHunt && room.pendingScavengerHunt.host || 'unknown',
		};

		if (immediate && room.roomid !== scavSubroom) addHunt(room);
	}
});

/**
 * @param {Room} room
 */
function addHunt(room) {
	const hunt = room.scavengerHunt;
	if (!hunt) return debug(`scavs desync! adding hunt with no hunt present on room ${room.roomid}`);
	if (!hunt.completed) return debug(`scavs desync! adding unended hunt in ${room.roomid}`);
	hunt.recycled = true;
	hunts.unshift(hunt);
	if (hunts.length > huntLimit) hunts.pop();
	startHunts();
}

function startHunts() {
	if (!scavSubroom) return;
	if (!hunts.length) return;

	/** @type {string[][]} */
	const questions = [];
	/** @type {string[]} */
	const hosts = [];
	for (const hunt of hunts) {
		questions.push([`(Hunt by ${hunt.host}) ${hunt.questions[0]}`, ...hunt.questions.slice(1)]);
		hosts.push(hunt.host);
	}
	Chat.sendMessage(scavSubroom, `/endhunt\n/forceendhunt`);
	Chat.sendMessage(scavSubroom, `/startunratedhunt ${Config.nick}|${questions.reduce((a, b) => a.concat(b)).join('|')}`);
	Chat.sendMessage(scavSubroom, `Hunts from ${hosts.join(' & ')}`);
}

/** @type {ChatCommands} */
const commands = {
	scav: 'scavs',
	scavs: function (target, room) {
		if (!this.can('staff')) return;
		let [setting, ...options] = target.split(' ').map(s => s.trim());
		setting = toId(setting);
		let option = options.join('');
		switch (setting) {
		case 'recycle':
			option = toId(option);
			if (option === 'on') {
				if (immediate) return this.reply(`Hunts will already be immediately recycled`);
				immediate = true;
				this.reply(`Enabled automatic recycling of hunts.`);
			} else if (option === 'off') {
				if (!immediate) return this.reply(`Hunt recycling is already manual.`);
				immediate = false;
				this.reply(`Disabled automatic recycling of hunts.`);
			} else {
				this.reply(`Invalid option (valid options: on, off)`);
			}
			return;
		case 'next':
		case 'nexthunt':
			let huntRoom = option ? Rooms(option) : Rooms('scavengers');
			if (!huntRoom) return this.reply(`No room given.`);
			if (!huntRoom.scavengerHunt || huntRoom.scavengerHunt.recycled) return this.reply(`No pending hunts in ${huntRoom.roomid}`);
			addHunt(huntRoom);
			return;
		case 'redo':
			if (!room || room.roomid !== scavSubroom) return this.reply(`This command is only usable in the scavengers subroom.`);
			if (!hunts.length) return this.reply(`No hunts to start`);
			startHunts();
			return;
		case 'viewsettings':
		case 'modsettings':
			this.reply(`Hunt limit: ${huntLimit}, room: ${scavSubroom || 'not set'}, disabled types: ${Array.from(disabledTypes).join(', ') || 'none'}`);
			return;
		}
		if (!this.can('leader')) return;
		switch (setting) {
		case 'setroom':
			scavSubroom = option || (room && room.roomid);
			this.reply(`Set the room for recycling to ${scavSubroom}`);
			return;
		case 'huntlimit':
			if (!toId(option)) return this.reply(`Currently, ${huntLimit} hunts will be recycled together.`);
			const newHuntLimit = parseInt(option);
			if (isNaN(newHuntLimit)) return this.reply(`Invalid number.`);
			huntLimit = newHuntLimit;
			this.reply(`${huntLimit} hunts will be recycled together.`);
			hunts = hunts.slice(0, huntLimit);
			return;
		case 'disabletype':
		case 'disable':
			option = toId(option);
			if (!option) return this.reply(`Please specify a hunt type.`);
			if (!VALD_HUNT_TYPES.has(option)) this.reply(`${option} doesn't look like a real type, are you sure it's correct?`);
			if (disabledTypes.has(option)) return this.reply(`${option} hunts are already disabled.`);
			disabledTypes.add(option);
			this.reply(`Hunts of type ${option} have been disabled.`);
			return;
		case 'enabletype':
		case 'enable':
			option = toId(option);
			if (!option) return this.reply(`Please specify a hunt type.`);
			if (!disabledTypes.has(option)) return this.reply(`${option} hunts are already enabled.`);
			disabledTypes.delete(option);
			this.reply(`Hunts of type ${option} have been enabled.`);
			return;
		case 'cleardata':
			hunts = [];
			this.reply(`Hunt data has been cleared.`);
			return;
		default:
			this.reply('Invalid command');
		}
	},
};
exports.commands = commands;
