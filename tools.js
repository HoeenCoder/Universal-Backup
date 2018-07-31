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
 * @param {string} user
 * @return {string[]}
 */
Tools.splitUser = function (user) {
	return [user.charAt(0), user.slice(1)];
};

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
		return `[` + value.map(elem => stringify(elem, depth + 1)).join(`, `) + `]`;
	}
	if (value instanceof RegExp || value instanceof Date || value instanceof Function) {
		if (depth && value instanceof Function) return `Function`;
		return `${value}`;
	}
	let constructorName = '';
	if (value.constructor && value.constructor.name && typeof value.constructor.name === 'string') {
		constructorName = value.constructor.name;
		if (constructorName === 'Object') constructorName = '';
	} else {
		constructorName = 'null';
	}
	if (value.toString) {
		try {
			const stringValue = value.toString();
			if (typeof stringValue === 'string' && stringValue !== '[object Object]' && stringValue !== `[object ${constructorName}]`) {
				return `${constructorName}(${stringValue})`;
			}
		} catch (e) {}
	}
	let buf = '';
	for (let k in value) {
		if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
		if (depth > 2 || (depth && constructorName)) {
			buf = '...';
			break;
		}
		if (buf) buf += `, `;
		if (!/^[A-Za-z0-9_$]+$/.test(k)) k = JSON.stringify(k);
		buf += `${k}: ` + stringify(value[k], depth + 1);
	}
	if (constructorName && !buf && constructorName !== 'null') return constructorName;
	return `${constructorName}{${buf}}`;
};
