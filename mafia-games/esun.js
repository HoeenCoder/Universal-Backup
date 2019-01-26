"use strict";

/** @type {{[k: number]: string}} */
const ESUN_ROLELIST = {
	5: 'Mafia Compulsive Janitor, OS Gunsmith, VT, VT, VT',
	6: 'Mafia Compulsive Janitor, Mafia, OS Gunsmith, OS Reviver, VT, VT',
	7: 'Mafia Compulsive Janitor, Mafia Coroner, Coroner, OS Gunsmith, VT, VT, VT',
	8: 'Mafia Compulsive Janitor, Mafia Coroner, Coroner, OS Gunsmith, VT, VT, VT, VT',
	9: 'Mafia Compulsive Janitor, Mafia Coroner, Coroner, OS Gunsmith, VT, VT, VT, VT, VT',
	10: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia, Coroner, One-Shot Gunsmith, One-Shot Reviver, VT, VT, VT, VT',
	11: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia, Coroner, One-Shot Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT',
	12: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia, Coroner, One-Shot Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT',
	13: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia, Mafia, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT',
	14: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia, Mafia, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT',
	15: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia Coroner, Mafia, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT, VT',
	16: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia Coroner, Mafia, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT, VT, VT',
	17: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia Coroner, Mafia, Mafia, Coroner, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT, VT',
	18: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia Coroner, Mafia, Mafia, Coroner, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT, VT, VT',
	19: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia Coroner, Mafia, Mafia, Coroner, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT, VT, VT, VT',
	20: 'Mafia Compulsive Janitor, Mafia Coroner, Mafia Coroner, Mafia, Mafia, Coroner, Coroner, Coroner, Gunsmith, One-Shot Reviver, VT, VT, VT, VT, VT, VT, VT, VT, VT, VT',
};

/** @type {{[k: string]: MafiaTriggers}} */
const ESun = {
	triggers: {
		start: function () {
			if (this.aliveCount < 5) return this.sendRoom('Not enough players.');
			const roleList = ESUN_ROLELIST[this.aliveCount];
			if (!roleList) return this.sendRoom(`No rolelist found for playercount ${this.aliveCount}`);
			this.sendRoom(`/mafia close\n/mafia setroles ${roleList}\n/mafia start`);
			this.applyOption({reveal: false});

			this.data.used = {};
			this.data.hasGun = '';
			this.data.revived = '';
			this.data.janitorsAlive = 0;
			this.data.coroners = [];
		},
		playerRoles: function () {
			for (const player of Object.values(this.players)) {
				if (player.role.includes('Coroner')) {
					this.data.coroners.push(player.user);
				}
				if (player.role.includes('Janitor')) this.data.janitorsAlive++;
			}
		},
		action: function (user, target) {
			const player = this.players[toId(user)];
			if (!player || player.dead) return "You aren't alive or in the game.";

			let action = player.role;
			if (player.role.includes('Mafia')) {
				action = 'Mafia';
			}
			if (target.startsWith('~')) {
				target = target.slice(1);
				action = 'gun';
			}

			const targetPlayer = this.players[toId(target)];
			if (!targetPlayer) return "Invalid target";
			if (player === targetPlayer) return "You cannot selftarget";

			if (['Vanilla Townie', 'Coroner'].includes(action)) action = 'gun';
			if (action.includes('Reviver') && !targetPlayer.dead) action = 'gun';
			if (action === 'gun') {
				const gunned = this.data.hasGun === player.user;
				if (!gunned) return "You don't have a gun or any other action";
			}

			if (action.includes('Reviver') !== targetPlayer.dead) return "Your target is dead, or you're trying to revive a living player";

			if (this.data.used[action]) return `You have already used your action${action.includes('OS') ? '' : ' today'}.`;
			this.data.used[action] = true;
			if (action !== 'gun' && this.data.revived === player.user) return "You were revived and lost your action.";

			if (action.includes('Mafia')) {
				this.applyOption({kill: [targetPlayer.user], deadline: 5});
			} else if (action === 'gun') {
				this.applyOption({kill: [targetPlayer.user], deadline: 5});
				this.data.hasGun = true;
			} else if (action.includes('Gunsmith')) {
				this.data.hasGun = targetPlayer.user;
				targetPlayer.send('/wall You have recieved a gun!');
				if (!['Vanilla Townie', 'Coroner'].includes(targetPlayer.role)) targetPlayer.send('To shoot your gun, use ``.action ~target``');
				player.send("Delivered");
			} else if (action.includes('Reviver')) {
				this.applyOption({add: [targetPlayer.user]});
				this.data.revived = targetPlayer.user;
				targetPlayer.send('/wall You have been revived!');
			}
		},
	},
	events: {
		day: function () {
			this.applyOption({deadline: 6});
		},
		plur: function (user) {
			this.sendRoom(`${user} was lynched to plurality!`);
			this.applyOption({kill: [user]});
		},
		night: function () {
			this.applyOption({phase: 'day'});
			for (const action in this.data.used) {
				if (!action.includes('OS')) delete this.data.used[action];
			}
			this.data.hasGun = false;
			delete this.data.used.gun;
		},
		kill: function (type, user, role) {
			const player = this.players[toId(user)];
			if (!player) return this.sendRoom('Panic! - no player found');
			const message = `/wall ${user} was the ${player.role}`;
			let coroCount = this.data.coroners.length;
			for (const coro of this.data.coroners) {
				const coroPlayer = this.players[toId(coro)];
				if (!coroPlayer) return this.sendRoom('Panic! - no coro player found');
				if (coroPlayer.dead) continue;
				coroCount--;
				coroPlayer.send(message);
			}
			if (this.data.hasGun === player.user) {
				this.data.hasGun = true;
				this.log(`Dropping gun off dead player`);
			}
			// always wait the full time so players cant find how many coros are left
			setTimeout(() => {
				if (player.role.includes('Janitor')) this.data.janitorsAlive--;
				if (!this.data.janitorsAlive) this.sendRoom(message);
	
				let town = [];
				let mafia = [];
				let deadMafia = [];
				for (const player of Object.values(this.players)) {
					if (player.dead) {
						if (player.role.includes('Mafia')) deadMafia.push(player.user);
						continue;
					}
					if (player.role.includes('Mafia')) {
						mafia.push(player.user);
					} else {
						town.push(player.user);
					}
				}
				if (mafia.length === 0) return this.destroy("All mafia are dead - Town wins!");
				if (mafia.length === town.length) return this.destroy(`Mafia have 50% - ${[...mafia, ...deadMafia].join(', ')} wins!`);
				this.applyOption({shifthammer: Math.floor(this.aliveCount / 2) + 1});	
			}, 0.6 * coroCount);
		},
		revive: function () {
			this.applyOption({shifthammer: Math.floor(this.aliveCount / 2) + 1});
		},
	},
};

exports.games = {
	esun: ESun,
};
