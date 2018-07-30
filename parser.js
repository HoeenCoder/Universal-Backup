'use strict';

module.exports = function parse(roomid, message) {
	const messages = message.split('\n');
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
			parseChat(roomid, parts[0].substring(0, 1), parts[0].substring(1), parts.slice(1).join('|'));
			break;
		case '': // raw message, not sure if this is actually sent anywhere
			break;
		case 'join':
		case 'j':
			Rooms(roomid).userJoin(parts[0]);
			break;
		case 'leave':
		case 'l':
			Rooms(roomid).userLeave(parts[0]);
			break;
		case 'name':
		case 'n':
			Users.renameUser(parts[0], parts[1]);
			Rooms(roomid).renameUser(parts[0], parts[1]);
			break;
		case 'html':
		case 'uhtml':
		case 'uhtmlchange':
			break;
		case 'pm':
			parsePM(parts[0], parts[1], parts.slice(2).join('|'));
			Client.send(`|${parts[2].slice(1)}`);
			break;
		case 'init':
			Rooms.createRoom(roomid, parts[0]);
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
			break;
		case 'battle':
		case 'b':
			break;
		case 'usercount':
			// we probably don't care about any of these
			break;
		case 'queryresponse':
			break;
		default:
			debug(`Unhandled message: ${message}`);
		}
	}
};

function parseChat(roomid, group, user, message, rest) {

}

function parsePM(from, message, rest) {

}
