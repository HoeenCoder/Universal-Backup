'use strict';

const CREATE_REGEX = /^<div class="broadcast-blue"><strong>A new (.+) Scavenger Hunt by <em>(.+)<\/em> has been started\.<br \/>The first hint is: .+<\/strong><\/div>$/;
const FINISH_REGEX = /^<div class="broadcast-blue"><strong>The .+scavenger hunt was ended (?:by .*?|automatically)\.(.+)<details style="cursor: pointer;"><summary>Solution: <\/summary>(.*)<\/details><\/strong><\/div>$/;
const ANSWER_REGEX = /^<br \/>\d+\) (.+)<span style="color: lightgreen">\[<em>(.*)<\/em>\]$/;

// @ts-ignore
let scavSubroom = Config.scavsSubroom || '';

/** @type {string[][]} */
let scavQuestions = [];
/** @type {string[]} */
let hosts = [];
let huntLimit = 2;

/** @type {Map<Room, {huntType: string, host: string}>} */
const ongoingHunts = new Map();

const disabledTypes = new Set(['practice']);

Chat.events.on('html', (/** @type {Room} */room, /** @type {string[]} */details) => {
	if (!room) return;
	const html = Tools.unescapeHTML(details.join('|'));

	let res = html.match(FINISH_REGEX);
	if (res) {
		const [, , sols] = res;
		let questions = [];
		for (const line of sols.split('</span>')) {
			if (!line) continue;
			const parts = line.match(ANSWER_REGEX);
			if (!parts) return;
			questions.push(`${parts[1]}|${parts[2].replace(/\//g, ';')}`);
		}
		const hunt = ongoingHunts.get(room);
		if (hunt && disabledTypes.has(toId(hunt.huntType))) return;
		const host = hunt ? hunt.host : 'unknown';
		addHunt(host, questions);
		return;
	}
	res = html.match(CREATE_REGEX);
	if (res) {
		const [, huntType, host] = res;
		if (toId(host) === Config.nickid) return;
		ongoingHunts.set(room, {huntType, host});
	}
});

/**
 * @param {string} host
 * @param {string[]} questions
 * */
function addHunt(host, questions) {
	questions[0] = `(Hunt by ${host}) ${questions[0]}`;
	scavQuestions.unshift(questions);
	hosts.push(host || 'unknown');
	if (scavQuestions.length > huntLimit) {
		scavQuestions.pop();
		hosts.pop();
	}
	Chat.sendMessage(scavSubroom, '/resethunt');
	Chat.sendMessage(scavSubroom, `/startunratedhunt ${Config.nick}|${scavQuestions.reduce((a, b) => a.concat(b)).join('|')}`);
	Chat.sendMessage(scavSubroom, `Hunts from ${hosts.join(' & ')}`);
}

/** @type {import("../chat").ChatCommands} */
const commands = {
	scavoptions: function (target) {
		if (!this.can('roommanagement')) return;
		let [setting, option] = target.split(',');
		setting = toId(setting);
		if (setting === 'room') {
			scavSubroom = option.trim();
			this.reply(`Set the subroom to ${scavSubroom}`);
		} else if (setting === 'hunts') {
			huntLimit = parseInt(option);
			this.reply(`Set the amount of hunts to ${huntLimit}`);
		} else if (setting === 'disable') {
			const type = toId(option);
			if (disabledTypes.has(type)) return this.reply(`${option} is already disabled`);
			disabledTypes.add(type);
			this.reply(`Disabled recycling ${type} hunts`);
		} else if (setting === 'enable') {
			const type = toId(option);
			if (disabledTypes.delete(type)) {
				this.reply(`Enabled recycling hunts of ${type}`);
			} else {
				this.reply(`Disabled recycling hunts of ${type}`);
			}
		}
	},
};
exports.commands = commands;
