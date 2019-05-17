'use strict';

const fs = require('fs');
const TIMEOUT = 10 * 1000;

/** @type {string[][]} */
let Questions = [];
function loadQuestions() {
	try {
		const data = fs.readFileSync('./config/trivia-questions.json');
		Questions = JSON.parse(data.toString());
	} catch (e) {} // file doesn't exist/isnt valid json
}
loadQuestions();

function writeQuestions() {
	fs.writeFileSync('./config/trivia-questions.json', JSON.stringify(Questions, null, 2));
}

class Trivia extends Rooms.RoomGame {
	/**
     * @param {Room} room
     * @param {number} scoreCap
	 * @param {string} name
     */
	constructor(room, scoreCap, name) {
		super(room);
		this.sendRoom(`A new game of ${name} is starting! First to ${scoreCap} points wins!`);

		/** @type {any} */
		this.currentQuestion = null;

		this.questionNum = 0;

		/** @type {{[u: string]: number}} */
		this.score = {};
		/** @type {number} */
		this.scoreCap = scoreCap;

		/** @type {NodeJS.Timer?} */
		this.timer = null;
	}

	/**
	 * This function is reponsible for issuing the next question
	 */
	nextQuestion() {
		this.sendRoom(`next question not implemented`);
	}

	/**
	 * This function is reponsible for taking an answer, verifying it, and moving to the next question if correct.
	 * @param {string} user
	 * @param {string} answer
	 */
	answer(user, answer) {
		this.sendRoom(`answer not implemented`);
	}
	/**
	 * @returns {[string[], number]?}
	 */
	getWinners() {
		// gets the users with the most points as [names[], points]
		let highestPoints = 0;
		/** @type {string[]} */
		let users = [];
		for (const [user, points] of Object.entries(this.score)) {
			if (points < highestPoints) continue;
			if (points === highestPoints) {
				users.push(user);
			} else if (points > highestPoints) {
				users = [user];
				highestPoints = points;
			}
		}
		return highestPoints !== 0 ? [users, highestPoints] : null;
	}

	skipQuestion() {
		this.sendRoom(`The question was skipped.`);
		this.nextQuestion();
	}

	end() {
		this.sendRoom(`The game of trivia was ended.`);
		const winners = this.getWinners();
		if (winners) this.sendRoom(`Winner: ${winners[0].join(', ')} with ${winners[1]} points.`);
		this.destroy();
	}

	destroy() {
		if (this.timer) clearTimeout(this.timer);
		super.destroy();
	}
}

class AnswerTrivia extends Trivia {
	/**
	 * @param {Room} room
	 * @param {number} scoreCap
	 */
	constructor(room, scoreCap) {
		super(room, scoreCap, 'answer');

		this.questions = Tools.lazyShuffle(Questions);
		/** @type {string[]} */
		this.currentAnswer = [];

		this.nextQuestion();
	}

	nextQuestion() {
		if (this.timer) clearTimeout(this.timer);
		this.questionNum++;
		const question = this.questions.next();
		if (!question.value && question.done) {
			this.sendRoom(`No questions left!`);
			const winners = this.getWinners();
			if (winners) this.sendRoom(`Winner: ${winners[0].join(', ')} with ${winners[1]} points.`);
			this.destroy();
			return;
		}
		[this.currentQuestion, ...this.currentAnswer] = question.value;
		this.sendRoom(`Q${this.questionNum}: **${this.currentQuestion}**`);
		this.timer = setTimeout(() => this.skipQuestion(), TIMEOUT);
	}

	/**
     * @param {string} user
     * @param {string} answer
     */
	answer(user, answer) {
		answer = toId(answer);
		if (!answer) return;
		if (this.currentAnswer.includes(answer)) {
			this.sendRoom(` ${user} is correct with ${answer}!`);
			const userid = toId(user);
			if (!this.score[userid]) {
				this.score[userid] = 1;
			} else {
				this.score[userid]++;
			}
			if (this.score[userid] >= this.scoreCap) {
				this.sendRoom(` **${user} wins!**`);
				this.destroy();
				return;
			}
			this.nextQuestion();
		}
	}
}
/** @type {{[k: string]: string | string[]}} */
let Themes = {};
function loadThemes() {
	const themeData = Mafia.data.themes;
	for (const theme in themeData) {
		if (typeof themeData[theme] === 'string') {
			Themes[theme] = themeData[theme];
		} else {
			/** @type {string[]} */
			let entries = [];
			for (const key in themeData[theme]) {
				if (!isNaN(parseInt(key))) {
					entries.push(themeData[theme][key]);
				}
			}
			Themes[theme] = entries;
		}
	}
}
loadThemes();

class KuncTrivia extends Trivia {
	/**
	 * @param {Room} room
	 * @param {number} scoreCap
	 */
	constructor(room, scoreCap) {
		super(room, scoreCap, 'kunc');

		this.themes = Tools.lazyShuffle(Object.keys(Themes));
		/** @type {string} */
		this.currentQuestion = '';

		this.nextQuestion();
	}

	nextQuestion() {
		if (this.timer) clearTimeout(this.timer);
		this.questionNum++;
		let question;
		do {
			question = this.themes.next();
			if (!question.value && question.done) {
				this.sendRoom(`No questions left!`);
				const winners = this.getWinners();
				if (winners) this.sendRoom(`Winner: ${winners[0].join(', ')} with ${winners[1]} points.`);
				this.destroy();
				return;
			}
			question = Themes['' + question.value];
		} while (!Array.isArray(question));
		const setup = question[~~(question.length * Math.random())];
		this.currentQuestion = setup;

		/** @type {{[k: string]: number}} */
		let count = {};
		let roles = [];
		for (const role of setup.split(',').map((/** @type {string} */x) => x.trim())) {
			count[role] = count[role] ? count[role] + 1 : 1;
		}
		for (const role in count) {
			roles.push(count[role] > 1 ? `${count[role]}x ${role}` : role);
		}

		this.sendRoom(`**Q${this.questionNum}**: ${roles.join(', ')}`);
		this.timer = setTimeout(() => this.skipQuestion(), TIMEOUT);
	}

	/**
	 * @param {string} user
	 * @param {string} answer
	 */
	answer(user, answer) {
		answer = toId(answer);
		if (!answer) return;

		let setup = Themes[answer];
		if (!setup) return;
		if (typeof setup === 'string') setup = Themes[setup];
		if (!Array.isArray(setup)) return this.sendRoom(`bad alias in '${answer}'`);
		if (setup.includes(this.currentQuestion)) {
			this.sendRoom(` ${user} is correct with ${answer}!`);
			const userid = toId(user);
			if (!this.score[userid]) {
				this.score[userid] = 1;
			} else {
				this.score[userid]++;
			}
			if (this.score[userid] >= this.scoreCap) {
				this.sendRoom(` **${user} wins!**`);
				this.destroy();
				return;
			}
			this.nextQuestion();
		}
	}
}

/** @type {import("../chat").ChatCommands} */
const commands = {
	g: 'guess',
	guess: function (target, room, user) {
		if (!room || !room.game || !(room.game instanceof Trivia)) return;
		const game = /** @type {Trivia} */ (room.game);
		game.answer(user, target);
	},

	trivia: function (target, room, user) {
		if (!room || !this.can('games')) return;
		if (room.game) return this.reply(`A game is already in progress`);
		let cap = parseInt(target);
		if (isNaN(cap) || cap < 1 || cap > Number.MAX_SAFE_INTEGER) cap = 5;
		room.game = new AnswerTrivia(room, cap);
	},
	addquestion: function (target, room, user) {
		if (!this.can('games')) return;
		/** @type {string[]} */
		const question = target.split('|').map((/** @type {string} */n) => n.trim());
		if (question.length < 2) return this.reply(`Invalid question.`);
		if (question.map(toId).some(n => !n)) return this.reply(`Questions must contain text.`);
		if (Questions.some(v => (toId(v[0]) === toId(question[0])))) return this.reply(`Question already exists in database.`);
		Questions.push([question[0], ...question.slice(1).map(toId)]);
		writeQuestions();
		return this.reply(`Question added successfully.`);
	},
	removequestion: function (target, room, user) {
		if (!this.can('games')) return;
		let targetIndex = parseInt(target);
		if (isNaN(targetIndex)) {
			target = toId(target);
			targetIndex = Questions.map(q => toId(q[0])).indexOf(target);
		}
		const question = Questions[targetIndex];
		if (!question) return this.reply(`Invalid question.`);
		Questions.splice(targetIndex, 1);
		writeQuestions();
		this.reply(`Removed question ${question.join('|')}`);
		return;
	},
	questions: function (target, room, user) {
		if (!this.can('games')) return;
		if (!Questions.length) return this.replyPM(`No questions`);
		if (room && !room.roomid.startsWith('groupchat-')) return this.replyPM(`Please don't use this in a proper room`);
		let entries = [];
		for (let i = 0; i < Questions.length; i++) {
			entries.push(`${i}: ${Questions[i][0]}`);
		}
		if (!room) {
			this.replyHTMLPM(entries.join('<br />'));
		} else {
			this.reply(`!code ${entries.join('\n')}`);
		}
	},

	kunc: function (target, room, user) {
		if (!room || !this.can('games')) return;
		if (room.game) return this.reply(`A game is already in progress`);
		let cap = parseInt(target);
		if (isNaN(cap) || cap < 1 || cap > Number.MAX_SAFE_INTEGER) cap = 5;
		room.game = new KuncTrivia(room, cap);
	},
};

exports.commands = commands;
