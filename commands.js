'use strict';

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	js: 'eval',
	eval: function (target, room, user) {
		if (!this.can('eval') || !target) return;
		try {
			let result = Tools.stringify(eval(target));
			result = result.replace(/\n/g, '');
			if (result.length > 250) {
				result = `${result.slice(0, 247)}...`;
			}
			this.reply(`<< ${result}`);
		} catch (e) {
			this.replyPM(`<< An error was thrown while trying to eval; please check the console.`);
			console.log(`[Commands.eval] An error occurred: ${e.stack}`);
		}
	},
	c: function (target, room, user) {
		if (!this.can('eval') || !target) return;
		this.reply(target);
	},
	git: function () {
		this.replyPM(`https://github.com/HoeenCoder/Universal-Backup/`);
	},
	hotpatch: function (target) {
		if (!this.can('eval')) return;
		Chat.uncacheDirectory('./plugins');
		Chat.uncacheFile('./commands.js');
		Chat.uncacheFile('./mafia.js');
		Chat.uncacheFile('./mafia-data.js');

		debug('HOTPATCHING');
		try {
			Chat.listeners = {};
			global.Mafia = require('./mafia');
			Chat.loadCommands();
		} catch (e) {
			this.replyPM(e);
		}
		this.replyPM('done. remember to recreate cooldown/iso if they were modified');
	},
	update: function (target) {
		if (!this.can('eval')) return;
		let result = '';
		try {
			result = String(require('child_process').execSync('git fetch origin master && git merge origin master'));
		} catch (e) {
			this.replyHTMLPM(e.replace(/\n/g, '<br/>'));
		}
		this.replyHTMLPM(result.replace(/\n/g, '<br/>'));
	},
	loadcredentials: function (target, room) {
		if (!this.can('eval')) return false;
		Chat.Slaves.LoadCredentials();
		this.reply(`Reloaded credentials. ${Chat.Slaves.CountCredentials()} accounts are available.`);
	},
};

exports.commands = commands;
