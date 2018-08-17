'use strict';

module.exports = Mafia;

Mafia.listeners = {};

Mafia.addMafiaListener = function (id, rooms, events, callback, repeat = true) {
	if (Mafia.listeners[id]) throw new Error(`Trying to add existing mafia listener: '${id}'`);
	Mafia.listeners[id] = {rooms, events, callback, repeat};
	return id;
};
Mafia.removeMafiaListener = function (id) {
	if (!Mafia.listeners[id]) throw new Error(`Trying to remove nonexistent mafia listener: '${id}'`);
	delete Mafia.listeners[id];
	return id;
};

function emitEvent(roomid, event, details, message) {
	for (const id in Mafia.listeners) {
		const listener = Mafia.listeners[id];
		if (listener.events !== true && !listener.events.includes(event)) continue;
		if (listener.rooms !== true && !listener.rooms.includes(roomid)) continue;
		const result = listener.callback(event, roomid, details, message);

		if (result === true) {
			if (listener.repeat !== true) listener.repeat--;
			if (listener.repeat === 0) delete Mafia.listeners[id];
		}
	}
	debug(`MAFIAEVENT: ${event}: ${JSON.stringify(details)} in ${roomid}: "${message}"`);
}

function parseChat(messageType, roomid, parts) {
	const author = parts[0];
	const message = parts.slice(1).join('|');

	if (author === '~') {
		let lynch = /^(.*) has (lynch|unlynch)ed (.*)\.$/.exec(message);
		if (lynch) return emitEvent(roomid, lynch[2], [lynch[1], lynch[3]], message);
		lynch = /^(.*) has shifted their lynch from (.*) to (.*)$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynchshift', lynch.slice(1, 4), message);
		lynch = /^(.*) has abstained from lynching\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'nolynch', [lynch[1]], message);
		lynch = /^(.*) is no longer abstaining from lynching\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'unnolynch', [lynch[1]], message);

		const playerList = /^\*\*Players \(\d+\)\*\*: (.*)$/.exec(message);
		if (playerList) return emitEvent(roomid, 'players', [playerList[1]], message);
	}
}

function parseHTML(messageType, roomid, parts) {
	const message = parts.join('|');
	if (message === '<div class="broadcast-blue">The game of Mafia is starting!</div>') return emitEvent(roomid, 'gamestart', [], message);
	if (message === 'mafia|<div class="infobox">The game of Mafia has ended.</div>') return emitEvent(roomid, 'gameend', [], message);

	const night = /^<div class="broadcast-blue">Night (\d+). PM the host your action, or idle\.<\/div>$/.exec(message);
	if (night) return emitEvent(roomid, 'night', [night[1]], message);
	const day = /^<div class="broadcast-blue">Day (\d+)\. The hammer count is set at (\d+)<\/div>$/.exec(message);
	if (day) {
		console.log("DAY EVENT");
		return emitEvent(roomid, 'day', day.slice(1, 3), message);
	}
	let kill = /^<div class="broadcast-blue">(.+) was kicked from the game!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'kick', [kill[1]], message);
	kill = /^<div class="broadcast-blue">(.+) has been treestumped!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'treestump', [kill[1]], message);
	kill = /^<div class="broadcast-blue">(.+) became a restless spirit!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'spirit', [kill[1]], message);
	kill = /^<div class="broadcast-blue">(.+) became a restless treestump!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'spiritstump', [kill[1]], message);

	kill = /^<div class="broadcast-blue">(.+) was eliminated! .+'s role was <span style="font-weight:bold;color:(.+)">(.+)<\/span>\.<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'kill', [kill[1], kill[3], kill[2]], message); // player, role, color

	kill = /^<div class="broadcast-blue">(.+) was revived!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'revive', [kill[1]], message);

	kill = /^<div class="broadcast-blue">(.+) has been added to the game by (.+)!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'add', kill.slice(1, 3), message);

	kill = /^<div class="broadcast-blue">Hammer! (.+) was lynched!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'hammer', [kill[1]], message);

	let hammer = /^<div class="broadcast-blue">The hammer count has been set at (\d+), and lynches have been reset\.<\/div>$/.exec(message);
	if (hammer) return emitEvent(roomid, 'sethammer', [hammer[1]], message);
	hammer = /^<div class="broadcast-blue">The hammer count has been shifted to (\d+)\. Lynches have not been reset\.<\/div>$/.exec(message);

	let deadline = /^<strong>The deadline has been set for (\d+) minutes\.<\/strong>$/.exec(message);
	if (deadline) return emitEvent(roomid, 'deadlineset', [deadline[1]], message);
	deadline = /^<strong>The deadline is in (\d+) minutes(?: (\d+) seconds)?\.$/.exec(message);
	if (deadline) return emitEvent(roomid, 'deadline', deadline.slice(1, 3), message);
}

function parseRaw(messageType, roomid, parts) {
	const message = parts.join('|');
	const leave = /^(.*) has (join|left)(?:ed)? the game\.$/.exec(message);
	if (leave) return emitEvent(roomid, leave[2], [leave[1]], message);
}

Chat.addListener("mafia-events-chat", true, ['chat'], parseChat, true);
Chat.addListener("mafia-events-html", true, ['html', 'uhtml'], parseHTML, true);
Chat.addListener("mafia-events-raw", true, ['raw'], parseRaw, true);
