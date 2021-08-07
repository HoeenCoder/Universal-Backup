// this object usually sticks on MafiaTracker#iso
export class ISO {
	authors: string[][] = [];
	log: string[] = [];
	/** {name: [lines, votes placed]} */
	dayStats: {[user: string]: [number, number]} = {};
	mafiaTracker: MafiaTracker;
	startTime: number;
	nightCount: string = '-1';
	constructor(room: Room) {
		if (!room.mafiaTracker) throw new Error(`ISO created with no mafia object`);
		this.mafiaTracker = room.mafiaTracker;
		this.startTime = Date.now();

		room.send('ISO started');
		room.mafiaTracker.addChatListener('chat', (details) => {
			this.addChat(details.slice(1).join('|'), details[0]);
		});
		room.mafiaTracker.addMafiaListener('day', (details) => {
			this.addHTML(`<span class="broadcast-blue">Day ${details[0]}</span>`, ['~']);
			this.dayStats = {};
			for (const player in this.mafiaTracker.players) {
				if (!this.mafiaTracker.players[player].dead) this.dayStats[player] = [0, 0];
			}
		});
		room.mafiaTracker.addMafiaListener('kill', (details, message) => {
			this.addHTML(`<span class="broadcast-blue">${Tools.stripHTML(message)}</span`, [details[1]]);
		});
		room.mafiaTracker.addMafiaListener('lynch', (details, message) => {
			const authors = [details[1]];
			if (details[2]) {
				authors.push(details[2]);
				if (details[3]) authors.push(details[3]);
			}
			this.addLine(message, authors);

			const author = toId(details[1]);
			if (!(author in this.dayStats)) return;
			this.dayStats[author][1]++;
		});

		room.mafiaTracker.addMafiaListener('night', (/** @type {string[]} */details) => {
			this.nightCount = details[0];
			this.sendActivity();
		});
	}
	addChat(text: string, author: string) {
		if (author === '~') return;
		text = Tools.escapeHTML(text).replace(/>here.?</ig, 'here  ').replace(/(click) (here)/ig, '$1  $2');
		this.addHTML(`<username>${Tools.escapeHTML(author.slice(1))}:</username> ${text}`, [author]);

		author = toId(author);
		if (!(author in this.dayStats)) return;
		this.dayStats[author][0]++;
	}
	addLine(text: string, authors: string[]) {
		this.addHTML(Tools.escapeHTML(text), authors);
	}
	addHTML(text: string, authors: string[]) {
		this.log.push(`<div class="chat"><small>${this.getTimestamp()}</small> ${text}</div>`);
		this.authors.push(authors.map(a => a === '~' ? a : toId(a)));
	}
	getTimestamp() {
		if (!this.startTime) return '[]';

		function p02d(v: number) {
			return v < 10 ? '0' + v : v;
		}
		const delta = Date.now() - this.startTime;

		let s = Math.floor(delta / 1000);
		let h = Math.floor(s / (60 * 60));
		s = s - h * 60 * 60;
		let m = Math.floor(s / 60);
		s = s - m * 60;
		return `[${h ? `${p02d(h)}:` : ''}${p02d(m)}:${p02d(s)}]`;
	}

	sendActivity(target: string | null = null) {
		const user = toId(target) || this.mafiaTracker.hostid;
		const buf = Object.entries(this.dayStats)
			.sort((a, b) => a[1][0] - b[1][0])
			.reduce((acc, val) => {
				return acc + `<div><username>${val[0]}:</username> ${val[1][0]} lines, ${val[1][1]} votes</div>`;
			}, '');
		if (buf) {
			const pmRoom = Rooms.canPMInfobox(user);
			if (!pmRoom) return Chat.sendPM(user, `Can't send you HTML, make sure that I have the bot rank in a room you're in.`);
			Chat.sendMessage(pmRoom, `/pminfobox ${user}, <div>Linecounts for day ${this.nightCount || 1}</div>${buf}`);
		}
	}
}

Mafia.events.on('gamestart', (tracker: MafiaTracker) => {
	tracker.iso = new ISO(tracker.room);
});

export const commands: ChatCommands = {
	i(target, room, user) {
		if (room) return this.replyPM(`Please use this command in PMS :)`);
		if (!Rooms.canPMInfobox(user)) return this.replyPM(`Can't PM you html, make sure you share a room in which I have the bot rank.`);

		const userid = toId(user);
		let args = target.split(',');

		let isoRoom = Rooms(args[0]);
		if (isoRoom && isoRoom.users.has(userid) && isoRoom.mafiaTracker) {
			args.shift();
		} else {
			isoRoom = [...Rooms.rooms.values()].find(room => room.mafiaTracker && room.mafiaTracker.players[userid]) || Rooms(Config.primaryRoom);
		}
		if (!isoRoom || !isoRoom.mafiaTracker || !isoRoom.mafiaTracker.iso) return this.replyPM(`No iso for room ${isoRoom ? isoRoom.roomid : 'undefined'}, if this isnt your room, give it as your first argument.`);

		const searchAuthors = ['~', ...args.map(toId)];
		const authors = isoRoom.mafiaTracker.iso.authors;
		const log = isoRoom.mafiaTracker.iso.log;
		let foundLog = [];

		for (let index = 0; index < authors.length; index++) {
			for (const author of authors[index]) {
				if (searchAuthors.includes(author)) {
					foundLog.push(log[index]);
					break;
				}
			}
		}
		let buf = `<details><summary>ISO for ${searchAuthors.slice(1).join(', ')}</summary><div role="log">${foundLog.join('')}</div></details>`;
		this.replyHTMLPM(buf);
	},
	activity(target, room, user) {
		if (room) return this.replyPM(`Please use this command in PMS :)`);
		if (!Rooms.canPMInfobox(user)) return this.replyPM(`Can't PM you html, make sure you share a room in which I have the bot rank.`);

		const userid = toId(user);
		let args = target.split(',');

		let isoRoom = Rooms(args[0]);
		if (isoRoom && isoRoom.users.has(userid) && isoRoom.mafiaTracker) {
			args.shift();
		} else {
			isoRoom = [...Rooms.rooms.values()].find(room => room.mafiaTracker && room.mafiaTracker.players[userid]) || Rooms(Config.primaryRoom);
		}
		if (!isoRoom || !isoRoom.mafiaTracker || !isoRoom.mafiaTracker.iso) return this.replyPM(`No iso for room ${isoRoom ? isoRoom.roomid : 'undefined'}, if this isnt your room, give it as your first argument.`);
		isoRoom.mafiaTracker.iso.sendActivity(user);
	},
};

