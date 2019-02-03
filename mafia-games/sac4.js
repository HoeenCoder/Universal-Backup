'use strict';

/** @typedef {(this: MafiaTracker, ...args: string[]) => any} MafiaTrigger */
/** @typedef {{[e: string]: MafiaTrigger | string}} MafiaTriggers */

/** @type {{[k: string]: MafiaTriggers}} */
const Sacrifice4 = {
	triggers: {
		create: function (host) {
			if (this.aliveCount > 4) {
				this.sendRoom(`Too many players - aborting`);
				this.removeGame();
			} else if (this.aliveCount === 4) {
				this.game.events.join.call(this);
			}
			this.log(`created with playercount ${this.aliveCount}`);
		},
		sub: function (oldName, newName) {
			if (this.data.confirmedTown === toId(oldName)) this.data.confirmedTown = toId(newName);
		},
	},
	events: {
		join: function () {
			this.log(`joined`);
			if (this.aliveCount === 4) {
				this.sendRoom(`/mafia close\n/mafia setroles sacrifice\n/mafia start`);
				this.applyOption({nolynch: false, selflynch: "hammer"});
				this.sendRoom(`The game of sacrifice is starting!`);
				this.data.confirmedTown = '';
				this.data.deadMafia = false;
			}
		},
		add: function () {
			this.game.events.join.call(this);
		},
		kill: function (type, user, role) {
			const userid = toId(user);
			if (!role) return this.sendRoom(`Panic! - no role found`);
			if (role === "Mafia Sacrifice") {
				if (this.data.deadMafia) {
					this.destroy(`Both mafia are dead - town wins!`);
				} else {
					this.data.deadMafia = true;
					this.sendRoom(`A sacrifice has died - town can be lynched normally now`);
				}
			} else {
				if (this.data.deadMafia) {
					this.destroy(`Mafia have 50% - mafia wins!`);
				} else {
					if (this.data.confirmedTown && this.data.confirmedTown !== userid) {
						this.destroy(`Town have both members confirmed - town wins!`);
					} else {
						this.data.confirmedTown = userid;
						this.applyOption({add: [userid]});
					}
				}
			}
			this.applyOption({phase: "day"});
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
	sac: Sacrifice4,
};
