'use strict';

/**
 * @param {Room} room
 * @param {string} word
 * @param {string} hint
 */
function createHangman(room, word, hint) {
	room.send(`/hangman new ${word}, ${hint}`);
	room.send(`Use \`\`/guess\`\` to answer`);
}
/**
 * @param {string} word
 * @param {string} hint
 */
function isValidHangman(word, hint) {
	word = word.replace(/[^A-Za-z '-]/g, '');
	if (!word || !hint) return false;
	if (word.replace(/ /g, '').length < 1) return false;
	if (word.length > 30) return false;
	if (word.split(' ').some(w => w.length > 20)) return false;
	if (!/[a-zA-Z]/.test(word)) return false;
	if (hint.length > 150) return false;
	return true;
}

const MAFIA_DATA = require('../mafia-data');

const commands = {
	/**
     * @param {string} target
     * @param {Room} room
     */
	hangman: function (target, room) {
		if (!this.can('games')) return;
		target = toId(target);
		let word = '';
		let hint = '';
		if (!target) target = ['theme', 'modifier', 'role'][~~(3 * Math.random())];
		if (/theme/.test(target)) {
			const themes = Object.values(MAFIA_DATA.themes);
			do {
				const theme = themes[~~(themes.length * Math.random())];
				if (typeof theme !== 'object') continue;
				word = theme.name;
				hint = theme.desc.split(':').slice(1).join(':');
			} while (!isValidHangman(word, hint));
		} else if (/modifier/.test(target)) {
			const modifiers = Object.values(MAFIA_DATA.modifiers);
			do {
				const modifier = modifiers[~~(modifiers.length * Math.random())];
				if (typeof modifier !== 'object') continue;
				word = modifier.name;
				hint = modifier.memo.map((/** @type {string} */s) => s.split(':').slice(1).join(':')).join(', ');
			} while (!isValidHangman(word, hint));
		} else if (/role/.test(target)) {
			const roles = Object.values(MAFIA_DATA.roles);
			do {
				const role = roles[~~(roles.length * Math.random())];
				if (typeof role !== 'object') continue;
				word = role.name;
				hint = role.memo.map((/** @type {string} */s) => s.split(':').slice(1).join(':')).join(', ');
			} while (!isValidHangman(word, hint));
		} else {
			return this.reply(`Invalid group`);
		}
		createHangman(room, word, `${target.charAt(0).toUpperCase()}${target.slice(1)}: ${hint}`);
	},
};

exports.commands = commands;
