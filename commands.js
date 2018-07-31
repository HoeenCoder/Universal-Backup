'use strict';

module.exports = {
	js: 'eval',
	'eval': function (target, room, user) {
		if (!user.isDev || !target) return;
		try {
			let result = Tools.stringify(eval(target));
			result = result.replace(/\n/g, '');
			if (result.length > 250) {
				result = `${result.slice(0, 247)}...`;
			}
			this.reply(`<< ${result}`);
		} catch (e) {
			sendPM(user, `<< An error was thrown while trying to eval; please check the console.`);
			console.log(`[Commands.eval] An error occurred: ${e.stack}`);
		}
	},
	git: function () {
		sendPM(this.user, `https://github.com/HoeenCoder/Universal-Backup/`);
	},
};
