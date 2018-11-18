'use strict';

const HOST_CHAR = '#';
const COMMAND_CHAR = '>';
const SCUMCHAT_CHAR = ';';
const EVAL_CHAR = '&';

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
	 */
	sendOwners(m) {
		for (const owner of this.owners) {
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
						res = eval(message);
					} catch (e) {
						res = e.message;
					}
					return this.client.send(`|/pm ${senderid}, ${res}`);
				}
			}
			if (this.owners.includes(senderid)) {
				switch (message.charAt(0)) {
				case HOST_CHAR:
					this.client.send(`|/pm ${this.host},${message}`);
					break;
				case SCUMCHAT_CHAR:
					if (this.partners.length) {
						for (const p of this.partners) {
							this.client.send(`|/pm ${p},${message}`);
						}
					} else {
						this.client.send(`|/pm ${senderid},You don't have any partners to send to...`);
					}
					break;
				case COMMAND_CHAR:
					parts = parts.map(toId);
					if (message.substr(1, 5) !== 'mafia') return;
					this.client.send(`${this.room}|/${message.slice(1)}`);
					break;
				default:
					if (message.startsWith('/') || message.startsWith('!')) return;
					this.client.send(`${this.room}|${sanitise(message)}`);
					this.logs.push(`${this.name} (${senderid}): ${message}`);
				}
			} else if (senderid === this.host) {
				this.sendOwners(`/wall ${message}`);
			}
		}
	}
}

/**
 * @param {string} message
 */
function sanitise(message) {
	return message.replace(/\*+/g, '*');
}

class AnonController extends Rooms.RoomGame {
	/**
	 * @param {Room} room
	 */
	constructor(room) {
		super(room);
		this.gameid = 'anon';
		this.waitingConnect = 0;
		this.slaves = {};
		/** @type {string[]} */
		this.logs = [];
		/** @type {string[]} */
		this.listeners = [];
		if (!this.room || !this.room.mafiaTracker) {
			this.sendRoom(`Panic! - no mafia game running`);
		} else {
			this.sendRoom(`/mafia forcecohost ${Config.nick}`);
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

			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-subhost`, [this.room.roomid], ['subhost'], true,
				(/** @type {string} */p) => this.subhost(p[0])
			));
			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-gameend`, [this.room.roomid], ['gameend'], true,
				(/** @type {string} */p) => this.destroy()
			));
			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-playerroles`, [this.room.roomid], ['playerroles'], true,
				() => this.sendPlayerRoles()
			));
		}
	}

	/**
	 * @param {string[]} owners
	 */
	addPlayer(owners) {
		const ownerids = owners.sort().join('');
		if (this.slaves[ownerids]) return this.slaves[ownerids];
		const credentials = Chat.Slaves.getCredentials();
		if (!credentials) return this.sendRoom(`Panic! - no available credentials`);
		const room = this.room || {};
		this.slaves[ownerids] = new AnonSlave(credentials, room.roomid, owners, room.mafiaTracker && room.mafiaTracker.hostid, this.logs);
		this.slaves[ownerids].client.on('login', () => {
			this.waitingConnect--;
			if (!this.waitingConnect) this.addSlaves();
		});
		this.waitingConnect++;
		for (const owner of owners) {
			Chat.sendPM(owner, `Use ${credentials.nick} to talk.`);
		}
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
			slave.sendOwners(`Your role is: ${this.room.mafiaTracker.players[slave.userid].role}`);
		}
	}

	/**
	 * @param {string[]} members
	 */
	addScumGroup(members) {
		let failed = [];
		let slaves = [];
		let slaveids = [];
		for (const member of members) {
			let slave = this.slaves[member];
			if (!slave) {
				failed.push(member);
			} else {
				slaves.push(slave);
				slaveids.push(member);
			}
		}
		for (const [i, slave] of slaves.entries()) {
			const partners = slaveids.slice();
			partners.splice(i, 1); // FUCK JS
			slave.partners = partners;
		}
		if (failed.length) return `Failed to add ${failed.join(', ')}`;
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

	destroy() {
		for (const id in this.slaves) {
			this.slaves[id].kill();
		}
		this.sendRoom(`Killed ${Object.keys(this.slaves).length}`);
		for (const id of this.listeners) {
			Mafia.removeMafiaListener(id);
		}
		if (this.logs.length) this.sendRoom(`!code ${this.logs.join('\n')}`);
	}

	end() {
		this.destroy();
	}
}


/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	an: function (target, room, user) {
		if (!room) return;
		if (!this.can('games')) return;
		room.game = new AnonController(room);
	},
	ag: function (target, room, user) {
		const anonRoom = [...Rooms.rooms.values()].find(r => !!(r.game && r.game.gameid === 'anon'));
		if (!anonRoom) return;
		const game = /** @type {AnonController} */ (anonRoom.game);
		game.addScumGroup(target.split(',').map(toId));
	},
};

exports.commands = commands;

