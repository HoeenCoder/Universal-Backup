'use strict';

const fs = require('fs');
const TIMEOUT = 10 * 1000;
let Questions = [];

function loadQuestions() {
	try {
		Questions = require('../config/trivia-questions.json');
	} catch (e) {} // file doesn't exist/isnt valid json
}
loadQuestions();

function writeQuestions() {
	fs.writeFileSync('./config/trivia-questions.json', JSON.stringify(Questions, null, 2));
}

class TriviaGame extends Rooms.RoomGame {
	/**
     * @param {Room} room
     * @param {number} scoreCap
     */
	constructor(room, scoreCap) {
		super(room);
		this.sendRoom(`A new game of trivia is starting! First to ${scoreCap} points wins!`);

		this.id = 'trivia';

		this.currentQuestion = '';
		this.currentAnswer = '';

		this.questionNum = 0;
		this.selectableIndexes = Object.keys(Questions);

		/** @type {{[u: string]: number}} */
		this.score = {};
		/** @type {number} */
		this.scoreCap = scoreCap;

		this.timer = null;

		this.nextQuestion();
	}

	nextQuestion() {
		if (this.timer) clearTimeout(this.timer);
		this.questionNum++;
		if (!this.selectableIndexes.length) {
			this.sendRoom(`No questions left!`);
			const winners = this.getWinners();
			if (winners) this.sendRoom(`Winner: ${winners[0].join(', ')} with ${winners[1]} points.`);
			this.destroy();
			return;
		}
		const questionIndex = this.selectableIndexes.splice(~~(Math.random() * this.selectableIndexes.length), 1);
		[this.currentQuestion, ...this.currentAnswer] = Questions[questionIndex];
		this.sendRoom(`Q${this.questionNum}: **${this.currentQuestion}**`);
		this.timer = setTimeout(() => this.skipQuestion(), TIMEOUT);
	}

	/**
     * @param {User} user
     * @param {string} answer
     */
	answer(user, answer) {
		answer = toId(answer);
		if (!answer) return;
		if (this.currentAnswer.includes(answer)) {
			this.sendRoom(` ${user.name} is correct with ${answer}!`);
			if (!this.score[user.userid]) {
				this.score[user.userid] = 1;
			} else {
				this.score[user.userid]++;
			}
			if (this.score[user.userid] >= this.scoreCap) {
				this.sendRoom(` **${user.name} wins!**`);
				this.destroy();
				return;
			}
			this.nextQuestion();
		}
	}

	getWinners() {
		// gets the users with the most points as [names[], points]
		let highestPoints = 0;
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

exports.commands = {
	trivia: function (target, room, user) {
		if (!room || !user.can('game')) return;
		if (room.game) return this.reply(`A game is already in progress`);
		let cap = parseInt(target);
		if (isNaN(cap) || cap < 1 || cap > Number.MAX_SAFE_INTEGER) cap = 5;
		room.game = new TriviaGame(room, cap);
	},
	g: 'guess',
	guess: function (target, room, user) {
		if (!room || !room.game || room.game.id !== 'trivia') return;
		room.game.answer(user, target);
	},
	addquestion: function (target, room, user) {
		if (!user.isDev) return;
		const question = target.split('|').map(n => n.trim());
		if (question.length < 2) return this.reply(`Invalid question.`);
		if (question.map(toId).some(n => !n)) return this.reply(`Questions must contain text.`);
		if (Questions.some(v => (toId(v[0]) === toId(question[0])))) return this.reply(`Question already exists in database.`);
		Questions.push([question[0], ...question.slice(1).map(toId)]);
		writeQuestions();
		return this.reply(`Question added successfully.`);
	},
	removequestion: function (target, room, user) {
		if (!user.isDev) return;
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
		if (!user.isDev) return;
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
};

