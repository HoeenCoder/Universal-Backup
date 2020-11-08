type anyFunction = (...args: any) => any;

export namespace Tools {
	/**
	 * Taken from pokemon-showdown
	 */
	export function toId(text: any) {
		if (!text) return '';
		if (text && text.id) {
			text = text.id;
		} else if (text && text.userid) {
			text = text.userid;
		}
		if (typeof text !== 'string' && typeof text !== 'number') return '';
		return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '') as ID;
	}

	export type EventHandler = {event: string, once: boolean, callback: anyFunction};
	export class Emitter<T> {
		events: {[event: string]: EventHandler[]} = {};
		// FIXME
		emit(event: string, ...params: any[]) {
			const events = this.events[event];
			if (!events || !events.length) return;
			for (let idx = 0; idx < events.length; idx++) {
				const res = events[idx].callback(...params);
				if (events[idx].once && res) {
					events.splice(idx, 1);
					idx--;
				}
			}
		}
		on(event: string, callback: anyFunction, once = false) {
			if (!this.events[event]) this.events[event] = [];
			const eventHandler = {event, once, callback};
			this.events[event].push(eventHandler);
			return eventHandler;
		}
		remove(handler: EventHandler) {
			const events = this.events[handler.event];
			const index = events.findIndex(e => e === handler);
			if (index < 0) return;
			events.splice(index, 1);
		}
	}
	export const Events = Emitter;

	export function* lazyShuffle(arr: any[]) {
		let selectableKeys = Object.keys(arr).map(n => parseInt(n));
		while (selectableKeys.length) {
			yield arr[selectableKeys.splice(~~(Math.random() * selectableKeys.length), 1)[0]];
		}
	}

	export function splitUser(user: string) {
		// happens when logging out
		if (user.charAt(0).match(/[a-z0-9]/i)) return [' ', ...user.split('@')];
		return [user.charAt(0), ...user.slice(1).split('@')];
	}
	export function sanitize(message: string) {
		const messageid = toId(message);
		for (const phrase of Config.bannedWords) {
			if (messageid.includes(phrase)) return false;
		}
		return message.trim().replace(/\*+/g, '*').replace(/^[/!]+/, '');
	}
	/**
	 * Taken from pokemon-showdown
	 */
	export function escapeHTML(str: string) {
		if (!str) return '';
		return ('' + str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\//g, '&#x2f;');
	}
	/**
	 * Adapted from pokemon-showdown
	 */
	export function unescapeHTML(str: string) {
		if (!str) return '';
		return ('' + str).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x2f;/g, '/');
	}
	/**
	 * Taken from pokemon-showdown
	 * Strips HTML from a string.
	 */
	export function stripHTML(html: string) {
		if (!html) return '';
		return html.replace(/<[^>]*>/g, '');
	}
	/**
	 * Taken from pokemon-showdown
	 * Visualizes eval output in a slightly more readable form
	 */
	export function stringify(value: any, depth = 0): string {
		if (value === undefined) return `undefined`;
		if (value === null) return `null`;
		if (typeof value === 'number' || typeof value === 'boolean') {
			return `${value}`;
		}
		if (typeof value === 'string') {
			return `"${value}"`; // NOT ESCAPED
		}
		if (typeof value === 'symbol') {
			return value.toString();
		}
		if (Array.isArray(value)) {
			if (depth > 10) return `[array]`;
			return `[` + value.map(elem => stringify(elem, depth + 1)).join(`, `) + `]`;
		}
		if (value instanceof RegExp || value instanceof Date || value instanceof Function) {
			if (depth && value instanceof Function) return `Function`;
			return `${value}`;
		}
		let constructor = '';
		if (value.constructor && value.constructor.name && typeof value.constructor.name === 'string') {
			constructor = value.constructor.name;
			if (constructor === 'Object') constructor = '';
		} else {
			constructor = 'null';
		}
		if (value.toString) {
			try {
				const stringValue = value.toString();
				if (typeof stringValue === 'string' && stringValue !== '[object Object]' && stringValue !== `[object ${constructor}]`) {
					return `${constructor}(${stringValue})`;
				}
			} catch (e) {}
		}
		let buf = '';
		for (let key in value) {
			if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
			if (depth > 2 || (depth && constructor)) {
				buf = '...';
				break;
			}
			if (buf) buf += `, `;
			let displayedKey = key;
			if (!/^[A-Za-z0-9_$]+$/.test(key)) displayedKey = JSON.stringify(key);
			buf += `${displayedKey}: ` + stringify(value[key], depth + 1);
		}
		if (constructor && !buf && constructor !== 'null') return constructor;
		return `${constructor}{${buf}}`;
	}

	/**
	 * Taken from pokemon-showdown
	 * Takes a number of milliseconds and turns it into a string that specifies how long it is
	 */
	export function toDurationString(number: number, options: Partial<Record<'hhmmss' | 'precision', any>> = {}) {
		const date = new Date(+number);
		const parts = [date.getUTCFullYear() - 1970, date.getUTCMonth(), date.getUTCDate() - 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
		const roundingBoundaries = [6, 15, 12, 30, 30];
		const unitNames = ["second", "minute", "hour", "day", "month", "year"];
		const positiveIndex = parts.findIndex(elem => elem > 0);
		const precision = (options.precision ? options.precision : parts.length);
		if (options.hhmmss) {
			let string = parts.slice(positiveIndex).map(value => value < 10 ? "0" + value : "" + value).join(":");
			return string.length === 2 ? "00:" + string : string;
		}
		// round least significant displayed unit
		if (positiveIndex + precision < parts.length && precision > 0 && positiveIndex >= 0) {
			if (parts[positiveIndex + precision] >= roundingBoundaries[positiveIndex + precision - 1]) {
				parts[positiveIndex + precision - 1]++;
			}
		}
		return parts.slice(positiveIndex).reverse().map((value, index) => value ? value + " " + unitNames[index] + (value > 1 ? "s" : "") : "").reverse().slice(0, precision).join(" ").trim();
	}

	/**
	 * Taken from pokemon-showdown
	 * @param s string 1
	 * @param t string 2
	 * @param l limit
	 * @return distance
	 */
	export function levenshtein(s: string, t: string, l = 0) {
		// Original levenshtein distance function by James Westgate, turned out to be the fastest
		let d: number[][] = [];

		// Step 1
		let n = s.length;
		let m = t.length;

		if (n === 0) return m;
		if (m === 0) return n;
		if (l && Math.abs(m - n) > l) return Math.abs(m - n);

		// Create an array of arrays in javascript (a descending loop is quicker)
		for (let i = n; i >= 0; i--) d[i] = [];

		// Step 2
		for (let i = n; i >= 0; i--) d[i][0] = i;
		for (let j = m; j >= 0; j--) d[0][j] = j;

		// Step 3
		for (let i = 1; i <= n; i++) {
			let s_i = s.charAt(i - 1);

			// Step 4
			for (let j = 1; j <= m; j++) {
				// Check the jagged ld total so far
				if (i === j && d[i][j] > 4) return n;

				let t_j = t.charAt(j - 1);
				let cost = (s_i === t_j) ? 0 : 1; // Step 5

				// Calculate the minimum
				let mi = d[i - 1][j] + 1;
				let b = d[i][j - 1] + 1;
				let c = d[i - 1][j - 1] + cost;

				if (b < mi) mi = b;
				if (c < mi) mi = c;

				d[i][j] = mi; // Step 6
			}
		}

		// Step 7
		return d[n][m];
	}

	export const LINE_REGEX = /^[ ]?([ +%@#&~*].+): (.*)$/;
	export function parsePSLine(line: string): [string, string, string] | [string, string] | null {
		let timestamp = '';
		if (line.startsWith('[') && line.includes(']')) {
			const endTimestampIndex = line.indexOf(']');
			timestamp = line.slice(0, endTimestampIndex + 1);
			line = line.slice(endTimestampIndex + 1);
		}
		let match = LINE_REGEX.exec(line);
		if (match) {
			return [timestamp, match[1], match[2]];
		} else if (timestamp) {
			return [timestamp, line];
		}
		return null;
	}
	/**
	 * Produces HTML that resembles a PS chat message
	 */
	export function formatHTMLMessage(timestamp: string | null, author: string, message: string) {
		if (!' +%@#&~'.includes(author.charAt(0))) author = ' ' + author;

		return `<div class="chat">` +
			(timestamp ? `<small>${timestamp}</small> ` : ``) +
			`<strong>` +
				`<small>${author.charAt(0)}</small>` +
				`<username>${escapeHTML(author.slice(1))}</username>: ` +
			`</strong>` +
			`<em>${escapeHTML(message)}</em>` +
		`</div>`;
	}

	export const LYNCHES_REGEX = /^(Lynches \(Hammer: (?:\d+|NaN|Disabled)\))((?:\n\d+\*? .{1,18} \(.+\))*)/gm;
	export function formatHTMLLynchBox(firstLine: string, rest: string) {
		return `<div class="notice"><div class="infobox">` +
			`<strong>${escapeHTML(firstLine)}</strong><br/>` +
			escapeHTML(rest).replace(/\n+/g, '<br/>') + '<br/>' +
		`</div></div>`;
	}

	export const SINGLE_CODE_REGEX = new RegExp(
		String.raw`^<div class="infobox"><code style="white-space: pre-wrap; display: table; tab-size: 3">` +
		String.raw`(.*)` +
		String.raw`<\/code><\/div>$`,
	);
	export const MULTI_CODE_REGEX = new RegExp(
		String.raw`^<div class="infobox"><details class="readmore code" style="white-space: pre-wrap; display: table; tab-size: 3">` +
		String.raw`<summary>(.*)<\/summary>` +
		String.raw`(.*)` +
		String.raw`<\/details><\/div>$`
	);
	/**
	 * Given a !code block, tries to extract the input
	 */
	export function findCode(text: string) {
		let match;
		if ((match = SINGLE_CODE_REGEX.exec(text))) {
			return unescapeHTML(match[1].replace(/<br \/>/g, '\n'));
		} else if ((match = MULTI_CODE_REGEX.exec(text))) {
			return unescapeHTML(
				match[1].replace(/<br \/>/g, '\n') + '\n' + match[2].replace(/<br \/>/g, '\n')
			);
		}
		return false;
	}
}