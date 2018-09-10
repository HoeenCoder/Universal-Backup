'use strict';

/** @typedef {(this: MafiaTracker, ...args: string[]) => any} MafiaTrigger */
/** @typedef {{[e: string]: MafiaTrigger | string}} MafiaTriggers */

/** @type {{[k: string]: MafiaTriggers}} */
const AitC = {
	triggers: {
		start: function () {
			const roleList = ["King", "Goo Assassin", ...Array(this.aliveCount - 2).fill("Guard")];
			this.sendRoom(`/mafia close\n/mafia setroles ${roleList.join(',')}\n/mafia start`);
			this.applyOption({phase: "night", nolynch: false});
			this.sendRoom(`The game of AitC is starting. Assassin, bold \`\`SHOOT <player>\`\` to shoot. The day will start once king PMs have been sent.`);
		},
		chat: function (author, message) {
			const player = this.players[toId(author)];
			if (!player || player.dead) return;

			const target = /\*\*shoot (.*)\*\*/i.exec(message);
			if (!target) return;
			const targetUser = this.players[toId(target[1])];
			if (!targetUser || targetUser.dead) return this.sendRoom(`Invalid target`);
			if (player.role === "Goo Assassin") {
				this.applyOption({kill: [author, target[1]]});
				this.destroy();
			} else {
				this.applyOption({kill: [author]});
				this.sendRoom(`AUTOHOST - [${toId(author)}] tried to shoot in AitC as ${player.role}`);
			}
		},
		playerRoles: function () {
			let king = '';
			for (const player of Object.values(this.players)) {
				if (player.role === 'King') {
					king = player.user;
					break;
				}
			}
			for (const player of Object.values(this.players)) {
				if (player.role !== "Goo Assassin") player.send(`The king is \`\`${king}\`\``);
			}
			this.applyOption({phase: 'day'});
		},
	},
	events: {
		kill: function (type, user, role) {
			if (this.phase === 'signups') return;
			if (!role) return this.sendRoom(`Panic! - no role found`);
			if (role === "Goo Assassin") {
				this.destroy(`Assassin is dead - Royalty wins`);
			} else {
				this.applyOption({phase: "day"});
			}
		},
		day: function () {
			this.applyOption({deadline: 6});
		},
		plur: function (user) {
			this.sendRoom(`${user} was lynched to plurality!`);
			this.applyOption({kill: [user]});
		},
	},
};

exports.games = {
	aitc: AitC,
};
