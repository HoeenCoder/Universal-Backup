/**
 * Configuration file
 *
 * This file stores the configuration for the bot.
 */

'use strict';

// Connection details
// play.pokemonshowdown.com
exports.server = 'sim.smogon.com';
exports.port = 8000;
exports.serverid = 'showdown';
// localhost.psim.us
/*
exports.server = 'localhost';
exports.port = 8000;
exports.serverid = 'localhost';
*/

// Nickname and password for the bot
exports.nick = '';
exports.pass = '';

// Avatar number for the bot
exports.avatar = 52;

// List of rooms to try and join after the bot starts
exports.autojoin = ['lobby'];
// Command characters for the bot
exports.commandTokens = ['@'];

// Debug mode - Prints more info to the console, useful for fixing issues
exports.debugMode = false;

/**
 * Permissions by rank
 *
 * The permissions for each rank are stored here.
 * permission: true - Always let this rank perform these commands
 * permission: 'u' - This rank can use commands on users of lesser rank
 * if no target user is provided in the check, it will allow the command to run anyways
 * permission: 's' - This rank can use these commands on themselves, but nobody else
 * permission: false - This rank cannot use commands that require this permission
 * simply not defining the permission for the rank will act as if its set to false
 *
 * Inheriting lower rank positions
 *
 * inherit: 'ranksymbol' can be used to inherit a lower rank's permissions.
 * If there are duplicates, the higher rank will overide the lower rank.
 * EX: if & inherits @ which inherits % and % has perm: u and @ has perm: true
 * "perm" will be true for & since the highest rank with perm defined (@) is true
 * explicit perm: false declarations will also be inherited, but undefined permissions may be overwritten.
 *
 * Permissions List
 * root - This group automatically has all permissions set to true, only supports true.
 * listen - If this is not set to a truthy value, the bot will ignore users of this rank
 *
 */
exports.groups = {
	'~': {
		name: 'Administrator',
		id: 'administrator',
		root: true,
	},
	'&': {
		name: 'Leader',
		id: 'leader',
		inherit: '#',

	},
	'#': {
		name: 'Room Owner',
		id: 'roomowner',
		inherit: '@',

	},
	'*': {
		name: 'Bot',
		id: 'bot',
		inherit: '@',

	},
	'@': {
		name: 'Moderator',
		id: 'moderator',
		inherit: '%',

	},
	'%': {
		name: 'Driver',
		id: 'driver',
		inherit: '+',

	},
	'+': {
		name: 'Voice',
		id: 'voice',
		inherit: ' ',

	},
	' ': {
		name: 'Regular User',
		id: 'regularuser',
		listen: true,
	},
	'!': {
		name: 'Muted',
		id: 'muted',
		inherit: ' ',
		listen: false,
	},
	'\u203d': {
		name: 'Locked',
		id: 'locked',
		inherit: '!',
	},
};
