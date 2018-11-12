'use strict';
const HOST_CHAR = '#';
const COMMAND_CHAR = '>';
const SCUMCHAT_CHAR = ';';

class AnonSlave extends Chat.Slaves.SlaveClient {
	/**
	 * @param {Object} credentials
	 * @param {string} roomid
	 * @param {string} owner
	 * @param {string} hostid
	 */
	constructor(credentials, roomid, owner, hostid) {
		super(credentials, [roomid]);
		this.owner = owner;
		this.ownerid = toId(owner);
		this.room = roomid;
		this.host = hostid;
		/** @type {string[]} */
		this.partners = [];
		this.client.on('message', (/**@type {string}*/r,/**@type {string}*/m,/**@type {string[]}*/p) => this.messageCallback(r,m,p));
		this.client.on('login', () => {
			this.client.send(`|/pm ${this.ownerid}, Hi!`);
		});
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

			if (senderid === this.ownerid) {
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
					this.client.send(`${this.room}|${sanitise(message)}`);
				}
			} else if (senderid === this.host) {
				this.client.send(`|/pm ${this.ownerid},/wall ${message}`);
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
		this.listeners = [];
		if (!this.room || !this.room.mafiaTracker) {
			this.sendRoom(`Panic! - no mafia game running`);
		} else {
			for (const player of Tools.lazyShuffle(Object.keys(this.room.mafiaTracker.players))) {
				this.addPlayer(player);
			}
			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-subhost`, [this.room.roomid], ['subhost'], true,
								(/** @type {string} */p) => this.subhost(p[0])
			));
			this.listeners.push(Mafia.addMafiaListener(`anon-${this.room.roomid}-gameend`, [this.room.roomid], ['gameend'], true,
			(/** @type {string} */p) => this.destroy()
			));
		}
	}

	/**
	 * @param {string} owner
	 */
	addPlayer(owner) {
		const ownerid = toId(owner);
		if (this.slaves[ownerid]) return this.slaves[ownerid];
		const credentials = Chat.Slaves.getCredentials();
		if (!credentials) return this.sendRoom(`Panic! - no available credentials`);
		const room = this.room || {};
		this.slaves[ownerid] = new AnonSlave(credentials, room.roomid, ownerid, room.mafiaTracker && room.mafiaTracker.hostid);
		this.slaves[ownerid].client.on('login', () => {
			this.waitingConnect--;
			if (!this.waitingConnect) this.addSlaves();
		});
		this.waitingConnect++;
		Chat.sendPM(owner, `Use ${credentials.nick} to talk.`);
	}

	addSlaves() {
		this.sendRoom(`Adding slave clients...`);
		let slaves = Tools.lazyShuffle(Object.keys(this.slaves));
		for (const slave of Tools.lazyShuffle(Object.values(this.slaves))) {
			this.sendRoom(`/mafia forcesub ${slaves.next().value}, ${slave.name}`);
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
		const anonRoom = [...Rooms.rooms.values()].find(r => !!(r.game && r.game.gameid === 'lighthouse'));
		if (!anonRoom) return;
		const game = /** @type {AnonController} */ (anonRoom.game);
		game.addScumGroup(target.split(',').map(toId));
	}
}

exports.commands = commands;

