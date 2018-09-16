'use strict';

const Tools = module.exports;

/**
 * @param {any} text
 * @return {string}
 */
Tools.toId = function (text) {
	if (text && text.id) {
		text = text.id;
	} else if (text && text.userid) {
		text = text.userid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
};

/**
 * @param {any[]} arr
 */
Tools.lazyShuffle = function* (arr) {
	/** @type {number[]} */
	let selectableKeys = Object.keys(arr).map(n => parseInt(n));
	while (selectableKeys.length) {
		yield arr[selectableKeys.splice(~~(Math.random() * selectableKeys.length), 1)[0]];
	}
};

/**
 * @param {string} user
 * @return {string[]}
 */
Tools.splitUser = function (user) {
	return [user.charAt(0), user.slice(1)];
};
/**
 * @param {string} str
 */
Tools.escapeHTML = function (str) {
	if (!str) return '';
	return ('' + str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\//g, '&#x2f;');
};
/**
 * @param {string} str
 */
Tools.unescapeHTML = function (str) {
	if (!str) return '';
	return ('' + str).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x2f;/g, '/');
};
/**
 * Strips HTML from a string.
 *
 * @param {string} html
 * @return {string}
 */
Tools.stripHTML = function (html) {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, '');
};
/**
 * Visualizes eval output in a slightly more readable form
 * Borrowed from PS
 * @param {any} value
 */
Tools.stringify = function (value, depth = 0) {
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
		return `[` + value.map(elem => Tools.stringify(elem, depth + 1)).join(`, `) + `]`;
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
		buf += `${displayedKey}: ` + Tools.stringify(value[key], depth + 1);
	}
	if (constructor && !buf && constructor !== 'null') return constructor;
	return `${constructor}{${buf}}`;
};

/**
 * From https://github.com/Zarel/Pokemon-Showdown/blob/master/chat.js#L1401
 * Takes a number of milliseconds and turns it into a string that specifies how long it is
 * @param {number} number
 * @param {{[key: string]: any}} options
 */
Tools.toDurationString = function (number, options = {}) {
	const date = new Date(+number);
	const parts = [date.getUTCFullYear() - 1970, date.getUTCMonth(), date.getUTCDate() - 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
	const roundingBoundaries = [6, 15, 12, 30, 30];
	const unitNames = ["second", "minute", "hour", "day", "month", "year"];
	const positiveIndex = parts.findIndex(elem => elem > 0);
	const precision = (options && options.precision ? options.precision : parts.length);
	if (options && options.hhmmss) {
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
};
