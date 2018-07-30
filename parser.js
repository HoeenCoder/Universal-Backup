'use strict';

module.exports = function parse(roomid, message) {
	const messages = message.split('\n');
	let initalizing = false;
	for (const m of messages) {
		if (m.charAt(0) !== '|') {
			return;
		}
		const [x, type, ...parts] = m.split('|'); // eslint-disable-line no-unused-vars
		switch (type) {
		case 'c:':
			// we dont care about timestamps
			parts.shift(); // eslint-disable-line no-fallthroughs
		case 'chat':
		case 'c':
			if (!initalizing) parseChat(roomid, parts[0] === '~' ? '~' : parts[0].substring(1), parts.slice(1).join('|'));
			break;
		case 'raw':
		case 'html':
		case '': // raw message
			break;
		case 'join':
		case 'j':
		case 'J':
			Rooms(roomid).userJoin(parts[0].substring(1), parts[0].substring(0, 1));
			break;
		case 'leave':
		case 'l':
		case 'L':
			Rooms(roomid).userLeave(parts[0].substring(1));
			break;
		case 'name':
		case 'n':
		case 'N':
			Users.renameUser(parts[0], parts[1].substring(0, 1), parts[1].substring(1));
			Rooms(roomid).renameUser(parts[0], parts[1].substring(0, 1), parts[1].substring(1));
			break;
		case 'uhtml':
		case 'uhtmlchange':
			break;
		case 'pm':
			parsePM(parts[0], parts.slice(2).join('|'));
			break;
		case 'init':
			Rooms.createRoom(roomid, parts[0]);
			initalizing = true;
			break;
		case 'title':
			Rooms.setTitle(roomid, parts[0]);
			break;
		case 'users':
			Rooms.updateUserlist(roomid, parts[0]);
			break;
		case 'deinit':
			Rooms.deinitRoom(parts[0]);
			break;
		case 'nametaken':
		case 'challstr':
		case 'updateuser':
			break; // Handled in client.js
		case 'formats':
		case 'updatesearch':
		case 'updatechallenges':
		case 'battle':
		case 'b':
		case 'usercount':
		case ':':
			break; // Unimportant to this bot
		case 'queryresponse':
			if (parts[0] !== 'userdetails') break;
			let details;
			try {
				details = JSON.parse(parts[1]);
			} catch (e) {
				console.error(`Error while parsing userdetails: ${e}\n`);
				console.log(parts[1]);
			}
			let user = Users(details.userid);
			if (!user) break;
			user.updateGlobalRank(details.group);
			break;
		default:
			debug(`Unhandled message: ${m}`);
		}
	}
};

/**
 * @param {string} roomid
 * @param {string} userid
 * @param {string} message
 */
function parseChat(roomid, userid, message) {
	let room = Rooms(roomid);
	let user = Users(userid);
	if (!room && roomid !== 'global') {
		debug(`When parsing chat, unable to find non-global room: ${roomid}`);
		return;
	}
	if (!user) {
		if (userid !== '~') debug(`When parsing chat, unable to find user: ${userid}`);
		return;
	}
	if (!Config.commandTokens.includes(message.charAt(0))) return;
	debug(`Start command: ${message}`);
	// Its a command!
	// TODO proper command parser
	//let token = message.substring(0, 1);
	let cmd = message.substring(1, message.indexOf(' '));
	message = message.slice(message.indexOf(' '));
	// Pass off to command parser here
	// Temp eval function
	if (cmd === 'eval') {
		if (!user.isDev) return false;
		try {
			let result = eval(message);
			if (result && result.then) {
				Client.send(`${roomid}|<< Promise`);
			} else {
				Client.send(`${roomid}|<< ${result.replace(/\n/g, ' ').slice(0, 250)}`);
			}
		} catch (e) {
			Client.send(`${roomid}|<< Error (check console)`);
			console.log(`[Eval Error]: ${e.stack}`);
		}
	}
}

function parsePM(from, message) {
	if (toId(from) === toId(Config.nick)) return;
}
