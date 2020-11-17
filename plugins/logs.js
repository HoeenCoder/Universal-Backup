
'use strict';

const HORRIBLE_REGEX = new RegExp(`(.*)` + Tools.LYNCHES_REGEX.source + `(.*)`, 'ms');

Chat.events.on('pm', (/** @type {Room} */room, /** @type {string[]} */details) => {
	let [from, originalMessage] = [details[0], details.slice(2).join('|')];

	if (!originalMessage.startsWith('/raw')) return;
	originalMessage = originalMessage.slice(5);

	/** @type {string} */
	// fixme bad hack to work around ts bug
	let message = Tools.findCode(originalMessage) || '';
	if (!message) return;

	const userid = toId(from);

	const gameRoom = [...Rooms.rooms.values()].find(room => room.mafiaTracker && room.mafiaTracker.players[userid]);
	if (!gameRoom || !gameRoom.mafiaTracker) return Chat.sendPM(userid, `Can't see you as a player in any game.`);
	const player = gameRoom.mafiaTracker.players[userid];
	if (!player || (player.dead && !player.treestump)) return Chat.sendPM(userid, `You are dead and cannot talk.`);
	if (gameRoom.mafiaTracker.phase !== "day") return Chat.sendPM(userid, `You can only send logs during the day.`);

	/** @param {string} text */
	function formatChat(text) {
		return text
			.split('\n')
			.map(line => {
				let res = Tools.parsePSLine(line);
				if (!res) {
					return `<div>${Tools.escapeHTML(line)}</div>`;
				} else if (res.length === 3) {
					return Tools.formatHTMLMessage(res[0], res[1], res[2]);
				} else {
					// no author, probably a lynch message
					return `<div class="chat"><small>${res[0]}</small><em>${Tools.escapeHTML(res[1])}</em></div>`;
				}
			})
			.join('');
	}
	let outputBuf = '';
	let match;

	// this is pretty bad
	// we want to match against lynches, and apply the lynch transform to them
	// and then match against every line that's not a lynch, and apply a
	// different transform. we do this by making the lynch regex consume the
	// text on either side, transforming the text before the lynches, and then
	// applying this recursively to the text after the lynches.
	let loop = 0;
	while ((match = message.match(HORRIBLE_REGEX))) {
		if (loop++ === 1000) throw new Error(`inf loop`);
		let [, preceeding, lynches1, lynches2, succeeding] = match;
		outputBuf += formatChat(preceeding);
		outputBuf += Tools.formatHTMLLynchBox(lynches1, lynches2);
		message = succeeding;
	}
	outputBuf += formatChat(message);

	outputBuf = `<details><summary>Logs posted by <username>${Tools.escapeHTML(from)}</username></summary>${outputBuf}</details>`;
	gameRoom.send(`/addhtmlbox ${outputBuf}`);
	if (gameRoom.mafiaTracker && gameRoom.mafiaTracker.iso) {
		gameRoom.mafiaTracker.iso.addLine(`${from} posted logs`, [userid]);
	}
});
