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
	help: function () {
		this.replyPM(`https://github.com/HoeenCoder/Universal-Backup/blob/master/docs.md`);
	},
	update: function (target) {
		if (!this.can('eval')) return;
		let result = '';
		try {
			result = String(require('child_process').execSync('git fetch origin master && git merge origin master'));
		} catch (e) {
			this.replyHTMLPM(e ? e.replace(/\n/g, '<br/>') : 'Crash while updating');
		}
		this.replyHTMLPM(result ? result.replace(/\n/g, '<br/>') : 'Error while updating');
	},
	loadcredentials: function (target, room) {
		if (!this.can('eval')) return false;
		Chat.Slaves.LoadCredentials();
		this.reply(`Reloaded credentials. ${Chat.Slaves.CountCredentials()} accounts are available.`);
	},
};

Chat.events.on('pm', (/**@type {any} */room, /** @type {string[]} */details) => {
	if (Config.developers.includes(toId(details[0]))) {
		if (details[2].startsWith('/invite ')) {
			Chat.sendMessage(null, `/join ${details[2].slice(8)}`);
		}
	}
});

exports.commands = commands;
