'use strict';

const HOST_CHAR = '#';
const COMMAND_CHAR = '>';
const SCUMCHAT_CHAR = ';';
const HYDRA_CHAR = '<';
const EVAL_CHAR = '&';

const ANON_GAMES = ['anon', 'hydra'];

const MAFIA_COMMANDS = [
	'l',
	'lynch',
	'ul',
	'unl',
	'unnolynch',
	'unlynch',
	'nl',
	'nolynch',
];

const INFO_MESSAGE = `
<h3>Hydra/Anon guide:</h3>
PM your bot to send messages to the room anonymously
<br />
<strong>Prefixes:</strong>
<dl>
	<dt>#</dt>
	<dd> - message the host. Messages from the host will be <span class="message-announce">walled</span></dd>
	<dt>&gt;</dt>
	<dd> - use mafia commands. For example, <code>&gt;lynch hoeenhero</code></dd>
	<dt>&semi;</dt>
	<dd> - message your scumpartners. Messages from your scumpartners will just have the message.</dd>
	<dt>&lt;</dt>
	<dd> - message the other members of your hydra. Messages from other hydra members will be prefixed with <code>(from head)</code>. Does not work in anon games, obviously.</dd>
</dl>`.replace(/\n/g, '');

class AnonSlave extends Chat.Slaves.SlaveClient {
	/**
	 * @param {Object} credentials
	 * @param {string} roomid
	 * @param {string[]} owners
	 * @param {string} hostid
	 * @param {string[]} logs
	 */
	constructor(credentials, roomid, owners, hostid, logs) {
		super(credentials, [roomid]);
		this.owners = owners;
		this.room = roomid;
		this.host = hostid;
		/** @type {string[]} */
		this.partners = [];
		this.client.on('message', (/**@type {string}*/r, /**@type {string}*/m, /**@type {string[]}*/p) => this.messageCallback(r, m, p));
		this.client.on('login', () => {
			this.sendOwners(`Hi!`);
		});
		// reference to a mutable array
		this.logs = logs;
	}

	/**
	 * @param {string} m
	 * @param {string} except
	 */
	sendOwners(m, except = '') {
		for (const owner of this.owners) {
			if (owner === except) continue;
			this.client.send(`|/pm ${owner},${m}`);
		}
	}

	/**
	 * @param {string} roomid
	 * @param {string} messageType
	 * @param {string[]} parts
	 */
	messageCallback(roomid, messageType, parts) {
		if (messageType === 'pm') {
			const senderid = toId(parts[0]);
			const message = parts.slice(2).join('|');
			if (senderid === this.userid) return;
			if (message.charAt(0) === EVAL_CHAR) {
				if (Config.developers.includes(senderid)) {
					let res = '';
					try {
						res = eval(message.slice(1));
					} catch (e) {
						res = e.message;
					}
					return this.client.send(pm(senderid, res));
				}
			}
			if (message.match(/^\/[A-Za-z\d]/)) return; // /raw messages and the like
			if (this.owners.includes(senderid)) {
				this.logs.push(`${this.name} (${senderid}): ${message}`);
				switch (message.charAt(0)) {
				case HOST_CHAR:
					this.client.send(pm(this.host, `(${senderid})${message}`));
					this.sendOwners("(to host)" + message, senderid);
					break;
				case SCUMCHAT_CHAR:
					if (this.partners.length) {
						for (const p of this.partners) {
							if (p === this.userid) continue;
							this.client.send(pm(p, message));
						}
						for (const p of this.owners) {
							if (p === senderid) continue;
							this.client.send(pm(p, "(to partner)" + message));
						}
					} else {
						this.client.send(pm(senderid, "You don't have any partners to send to..."));
					}
					break;
				case HYDRA_CHAR:
					for (const p of this.owners) {
						if (p === senderid) continue;
						this.client.send(pm(p, "(from head)" + message));
					}
					break;
				case COMMAND_CHAR:
					const spaceIndex = message.indexOf(' ');
					let command = '';
					let target = '';
					if (spaceIndex < 0) {
						command = toId(message);
					} else {
						command = toId(message.substr(0, spaceIndex));
						target = toId(message.substr(spaceIndex + 1));
					}
					if (command === 'mafia') {
						this.client.send(pm(senderid, "Don't include 'mafia' in your command"));
						return;
					}
					if (!MAFIA_COMMANDS.includes(command)) {
						this.client.send(pm(senderid, `${command} is not a valid command`));
						return;
					}
					this.client.send(sendRoom(this.room, `/mafia ${command} ${target}`));
					break;
				default:
					this.client.send(sendRoom(this.room, sanitise(message)));
				}
			} else if (this.partners.includes(senderid)) {
				this.sendOwners(message);
			} else if (senderid === this.host) {
				this.sendOwners(`/wall ${message}`);
			}
		}
	}
}

/**
 * @param {string} room
 * @param {string} message
 */
function sendRoom(room, message) {
	return `${room}|${message}`;
}
/**
 * @param {string} user
 * @param {string} message
 */
function pm(user, message) {
	return `|/pm ${user},${message}`;
}

/**
 * @param {string} message
 */
function sanitise(message) {
	return message.trim().replace(/\*+/g, '*').replace(/^[/!]+/, '');
}

class AnonController extends Rooms.RoomGame {
	/**
	 * @param {Room} room
	 */
	constructor(room) {
		super(room);
		this.gameid = 'anon';
		this.waitingConnect = 0;
		/** @type {{[k: string]: AnonSlave}} */
		this.slaves = {};
		/** @type {string[]} */
		this.logs = [];
		/** @type {string[]} */
		this.listeners = [];
		this.setupPlayers();

		if (!this.room || !this.room.mafiaTracker) {
			this.sendRoom(`Panic! - no mafia game running`);
		} else {
			this.sendRoom(`/mafia forcecohost ${Config.nick}`);
			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-subhost`, [this.room.roomid], ['subhost'], true,
				(/** @type {string} */p) => this.subhost(p[0])
			));
			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-gameend`, [this.room.roomid], ['gameend'], true,
				(/** @type {string} */p) => this.destroy()
			));
			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-playerroles`, [this.room.roomid], ['playerroles'], true,
				() => this.sendPlayerRoles()
			));
			this.sendRoom(`!htmlbox ${INFO_MESSAGE}`);
		}
	}

	setupPlayers() {
		if (this.room && this.room.mafiaTracker) {
			this.sendRoom(`/mafia close`);
			for (const player of Tools.lazyShuffle(Object.keys(this.room.mafiaTracker.players))) {
				this.addPlayer([toId(player)]);
			}
			let buf = '';
			for (const playerid in this.slaves) {
				buf += `<br/>${playerid}: ${this.slaves[playerid].name}`;
			}
			const pmRoom = Rooms.canPMInfobox(toId(this.room.mafiaTracker.hostid));
			if (!pmRoom) {
				Chat.sendPM(this.room.mafiaTracker.hostid, `Can't send you HTML, make sure that I have the bot rank in a room you're in.`);
			} else {
				sendMessage(pmRoom, `/pminfobox ${this.room.mafiaTracker.hostid}, ${buf}`);
			}
		}
	}
	/**
	 * @param {string[]} owners
	 */
	addPlayer(owners) {
		const ownerids = owners.sort().join('');
		if (this.slaves[ownerids]) return;
		const credentials = Chat.Slaves.GetCredentials();
		if (!credentials) {
			this.sendRoom(`Panic! - no available credentials`);
			return;
		}
		const room = this.room || {};
		// @ts-ignore
		this.slaves[ownerids] = new AnonSlave(credentials, room.roomid || '', owners, (room.mafiaTracker && room.mafiaTracker.hostid) || '', this.logs);
		this.slaves[ownerids].client.on('login', () => {
			this.onConnect(ownerids);
		});
		this.waitingConnect++;
		for (const owner of owners) {
			Chat.sendPM(owner, `Use ${credentials.nick} to talk.`);
		}
	}

	/**
	 * @param {string} slaveId
	 * @param {string} prev
	 * @param {string} next
	 */
	substitute(slaveId, prev, next) {
		if (!this.findSlave(slaveId)) return `${slaveId} is not a valid account.`;
		if (!this.removeOwner(slaveId, prev)) return `${prev} is not an owner of ${slaveId}`;
		return this.addOwner(slaveId, next);
	}
	/**
	 * @param {string} slaveId
	 * @param {string} owner
	 */
	addOwner(slaveId, owner) {
		const slave = this.findSlave(slaveId);
		if (!slave) return `${slaveId} is not a valid slave account.`;
		this.slaves[slave].owners.push(toId(owner));
		return `Added ${owner} to ${slaveId}`;
	}
	/**
	 * @param {string} slaveId
	 * @param {string} owner
	 */
	removeOwner(slaveId, owner) {
		const slave = this.findSlave(slaveId);
		if (!slave) return null;
		const ownerIndex = this.slaves[slave].owners.indexOf(owner);
		if (ownerIndex < 0) return false;
		this.slaves[slave].owners.splice(ownerIndex, 1);
		return true;
	}

	/**
	 * @param {string} slaveid
	 */
	onConnect(slaveid) {
		this.waitingConnect--;
		if (this.waitingConnect === 0) this.addSlaves();
	}
	addSlaves() {
		this.sendRoom(`Adding slave clients...`);
		let slaves = Tools.lazyShuffle(Object.keys(this.slaves));
		for (const slave of Tools.lazyShuffle(Object.values(this.slaves))) {
			this.sendRoom(`/mafia forcesub ${slaves.next().value}, ${slave.name}`);
		}
	}

	sendPlayerRoles() {
		if (!this.room || !this.room.mafiaTracker) return;
		for (const slave of Object.values(this.slaves)) {
			slave.sendOwners(`/wall Your role is: ${this.room.mafiaTracker.players[slave.userid].role}`);
		}
	}

	/**
	 * @param {string[]} members
	 */
	addScumGroup(members) {
		let memberids = [];
		for (const member of members) {
			const memberid = this.findSlave(member);
			if (!memberid) return `Invalid slave ${member}`;
			memberids.push(memberid);
		}
		for (const member of memberids) {
			this.slaves[member].partners = members;
			this.slaves[member].sendOwners(`/wall You are in a scum group containing ${members.join(', ')}`);
			this.slaves[member].sendOwners("To send a message to your scum group, prefix it with ``;``");
		}
		return `All adds successful`;
	}

	/**
	 * @param {string} to
	 */
	subhost(to) {
		for (const slave of Object.values(this.slaves)) {
			slave.host = to;
		}
	}

	/**
	 *
	 * @param {string} id
	 */
	findSlave(id) {
		for (const [ownerid, slave] of Object.entries(this.slaves)) {
			if (slave.userid === id) return ownerid;
		}
	}

	destroy() {
		for (const id in this.slaves) {
			this.slaves[id].kill();
		}
		this.sendRoom(`Killed ${Object.keys(this.slaves).length}`);
		for (const id of this.listeners) {
			Mafia.removeMafiaListener(id);
		}
		if (this.logs.length) this.sendRoom(`!code ${this.logs.join('\n')}`);
		super.destroy();
	}

	end() {
		this.destroy();
	}
}

class HydraController extends AnonController {
	/**
	 * @param {Room} room
	 */
	constructor(room) {
		super(room);
		this.gameid = 'hydra';
		this.sendRoom(`A new hydra game has started! Add players with the \`\`head\`\` command!`);
	}

	/**
	 * @param {string} slaveid
	 */
	onConnect(slaveid) {
		if (!this.room) return;
		this.room.send(`/mafia forceadd ${this.slaves[slaveid].userid}`);
	}
	setupPlayers() {
		if (this.room && this.room.mafiaTracker && this.room.mafiaTracker.aliveCount) {
			Chat.sendPM(this.room.roomid, 'Players should be added through the ``head`` command.');
		}
	}

	/**
	 * @param {string[]} owners
	 */
	addPlayer(owners) {
		if (this.room) {
			for (const owner of owners) {
				if (!this.room.users.has(owner)) {
					return `${owner} is not in the room`;
				}
			}
		}
		return super.addPlayer(owners);
	}
	// noop
	addSlaves() {}
}

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	anon: 'an',
	an: function (target, room, user) {
		if (!room) return;
		if (!this.can('games')) return;
		if (room.game) return this.reply(`A ${room.game.gameid} game is already running.`);
		room.game = new AnonController(room);
	},
	ag: function (target, room, user) {
		const anonRoom = [...Rooms.rooms.values()].find(r => !!(r.game && ANON_GAMES.includes(r.game.gameid)));
		if (!anonRoom) return;
		if (!this.can('games')) return;
		const game = /** @type {AnonController} */ (anonRoom.game);
		const reply = game.addScumGroup(target.split(',').map(toId));
		if (reply) this.reply(reply);
	},
	hydra: function (target, room, user) {
		if (!room) return;
		if (!this.can('games')) return;
		if (room.game) return this.reply(`A ${room.game.gameid} game is already running.`);
		room.game = new HydraController(room);
	},
	addslave: 'head',
	head: function (target, room, user) {
		const anonRoom = [...Rooms.rooms.values()].find(r => !!(r.game && ANON_GAMES.includes(r.game.gameid)));
		if (!anonRoom) return;
		if (!this.can('games')) return;
		const game = /** @type {AnonController} */ (anonRoom.game);
		const players = target.split(',').map(toId);
		const res = game.addPlayer(players);
		// typescript
		if (res !== (void 0) && res) this.reply(res);
	},
	killslave: function (target, room, user) {
		if (!this.can('games')) return;
		if (!room || !room.game || !ANON_GAMES.includes(room.game.gameid)) return;
		const game = /** @type {AnonController | HydraController} */ (room.game);
		const slaveid = game.findSlave(toId(target));
		if (!slaveid) return this.reply(`Invalid target`);
		game.slaves[slaveid].kill();
		delete game.slaves[slaveid];
	},
	addowner: 'sub',
	removeowner: 'sub',
	sub: function (target, room, user, cmd) {
		const anonRoom = [...Rooms.rooms.values()].find(r => !!(r.game && ANON_GAMES.includes(r.game.gameid)));
		if (!anonRoom) return;
		if (!this.can('games')) return;
		const game = /** @type {AnonController} */ (anonRoom.game);
		const [slaveId, targetId, target2Id] = target.split(',').map(toId);
		if (!targetId || !slaveId) return this.reply('Invalid syntax.');
		if (cmd === 'addowner') {
			this.reply(game.addOwner(slaveId, targetId));
		} else if (cmd === 'removeowner') {
			const res = game.removeOwner(slaveId, targetId);
			if (res === null) {
				return this.reply(`${slaveId} is not a valid account.`);
			} else if (res === false) {
				this.reply(`${targetId} is not an owner of ${slaveId}`);
			} else {
				this.reply(`Successfully removed`);
			}
		} else {
			if (!target2Id) return this.reply(`Invalid syntax.`);
			return this.reply(game.substitute(slaveId, targetId, target2Id));
		}
	},
	hydrahelp: 'anonhelp',
	anonhelp: function (target, room) {
		if (!room) return;
		if (!this.can('games')) return;
		this.reply(`!htmlbox ${INFO_MESSAGE}`);
	},
};

exports.commands = commands;

