'use strict';

const WebSocketClient = require('websocket').client;
const https = require('https');

class Client {
	constructor() {
		this.connected = false;
		this.closed = false;
		/** @type {WebSocketClient?} */
		this.socket = null;
		/** @type {any?} */ // not sure what this would be called
		this.connection = null;
		/** @type {{[id: string]: string, [str: string]: string}} */
		this.chalstr = {id: '', str: ''};
		/** @type {string[][]} */
		this.sendQueue = [];
		/** @type {NodeJS.Timer?} */
		this.sendTimer = null;
		this.messageCallback = (roomid, message) => {};
	}

	connect() {
		this.socket = new WebSocketClient();
		this.socket.on('connectionFailed', (err) => {
			console.log(`Connection failed!`);
		});
		this.socket.on('connect', (connection) => {
			console.log(`Connected!`);
			this.connected = true;
			this.connection = connection;

			connection.on('message', (message) => {
				if (message.type === 'utf8') { // ??!
					this.receive(message.utf8Data);
				}
			});
		});
		this.socket.on('error', (e) => {
			console.log(`Error with connection: ${e}`);
		});
		this.closed = false;
		const id = ~~(Math.random() * 900) + 100;
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
		let str = '';
		for (let i = 0, l = chars.length; i < 8; i++) {
			str += chars.charAt(~~(Math.random() * l));
		}
		const conStr = 'ws://' + Config.server + ':' + Config.port + '/showdown/' + id + '/' + str + '/websocket';
		console.log(`Connecting to ${Config.server}:${Config.port}...`);
		this.socket.connect(conStr);
	}

	disconnect() {
		this.closed = true;
		if (this.connection) this.connection.close();
	}

	send(data) {
		if (this.connection && this.connection.connected) {
			if (!Array.isArray(data)) data = [data];
			if (data.length > 3) {
				while (data.length > 3) {
					debug(`Queueing: ${data}`);
					this.sendQueue.push(data.splice(0, 3));
				}
			}
			debug(`Queueing: ${data}`);
			this.sendQueue.push(data);
			if (!this.sendTimer) {
				this.sendTimer = setInterval(() => {
					if (!this.sendQueue.length) return;
					let toSend = JSON.stringify(this.sendQueue.shift());
					this.connection.send(toSend);
				}, 1000);
			}
		} else {
			debug(`Can't send: ${data}; disconnected`);
		}
	}

	receive(message) {
		let flag = message.substring(0, 1);
		switch (flag) {
		case 'a':
			message = JSON.parse(message.slice(1));
			if (Array.isArray(message)) {
				for (let i = 0; i < message.length; i++) this.onMessage(message[i]);
			} else {
				this.onMessage(message);
			}
			break;
		}
	}

	onMessage(message) {
		debug(`new message: ${message}`);
		let roomid = 'lobby';
		if (message.charAt(0) === '>') {
			roomid = message.slice(1, message.indexOf('\n'));
			message = message.slice(0, roomid.length + 2); // Slice the roomid out
		}

		if (message.substr(0, 10) === '|challstr|') {
			this.chalstr.id = message.split('|')[2];
			this.chalstr.str = message.split('|')[3];
			let reqOptions = {
				hostname: "play.pokemonshowdown.com",
				path: "/~~showdown/action.php",
				agent: false,
			};

			let data = null;
			if (!Config.pass) {
				reqOptions.method = 'GET';
				reqOptions.path += `?act=getassertion&userid=${toId(Config.nick)}&challengekeyid=${this.chalstr.id}&challenge=${this.chalstr.str}`;
			} else {
				reqOptions.method = 'POST';
				data = `act=login&name=${toId(Config.nick)}&pass=${Config.pass}&challengekeyid=${this.chalstr.id}&challenge=${this.chalstr.str}`;
				reqOptions.headers = {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': data.length,
				};
			}
			debug(`Sending login to ${reqOptions.path} ${data ? '| Data: ' + data : ''}`);

			const req = https.request(reqOptions, res => {
				res.setEncoding('utf8');
				let data = '';
				res.on('data', chunck => {
					data += chunck;
				});
				res.on('end', () => {
					if (data === ';') {
						console.log(`LOGIN FAILED - The name ${Config.nick} is registered and ${Config.pass ? 'an invalid' : 'no'} password was provided.`);
						return process.exit(1);
					}
					if (data.length < 50) {
						console.log(`LOGIN FAILED - ${data}`);
						return process.exit(1);
					}
					if (data.indexOf('heavy load') > -1) {
						console.log(`LOGIN FAILED - The login server is experiencing heavy load and cannot accomidate the bot's connection right now.`);
						return process.exit(1);
					}
					try {
						data = JSON.parse(data.substring(1));
						if (data.actionsuccess) {
							data = data.assertion;
						} else {
							console.log(`Unable to login - request was not sucessful\n`);
							console.log(JSON.stringify(data));
							console.log(`\n`);
							process.exit(1);
						}
					} catch (e) {}
					this.send(`|/trn ${Config.nick},0,${data}`);
				});
			});
			req.on('error', e => {
				console.error(`Error while logging in: ${e}`);
				return;
			});
			if (data) req.write(data);
			req.end();
		}
		if (message.substring(0, 11) === '|nametaken|') {
			message = message.split('|');
			if (message[3].indexOf('inappropriate') > -1) {
				console.log(`FORCE-RENAMED - A global staff member consider's this bot's username (${Config.nick}) inappropriate.`);
				console.log(`Please rename the bot to something more appropriate and restart the bot.`);
				process.exit(1);
			}
			console.log(`NAMETAKEN - The username ${Config.nick}, is already being used.`);
			process.exit(1);
		}
		if (message.substring(0, 12) === '|updateuser|') {
			message = message.split('|');
			console.log(`NAME UPDATE: ${message[2]}`);
			if (message[2] === Config.nick) console.log(`Sucessfully logged in as ${Config.nick}`);
			return;
		}
		this.messageCallback(roomid, message);
	}
}

exports.Client = new Client();
