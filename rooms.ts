"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rooms = exports.Room = void 0;
class Room {
    constructor(roomid, roomType) {
        /** userid -> name */
        this.users = new Map();
        this.auth = new Map();
        this.game = null;
        this.mafiaTracker = null;
        this.iso = null;
        this.mafiaCooldown = null;
        this.mafiaUGO = null;
        // fixme
        this.scavengerHunt = null;
        this.pendingScavengerHunt = null;
        this.roomid = roomid;
        this.title = roomid;
        this.roomType = roomType;
        // auth is strictly roomauth, gets updated on /roomauth and on (pro/de)mote messages
        sendMessage('', `/cmd roominfo ${this.roomid}`); // need to use roomauth1 because it gives the roomname
    }
    send(message) {
        sendMessage(this.roomid, message);
    }
    destroy() {
        debug(`DEINIT ROOM: ${this.roomid}`);
        exports.Rooms.rooms.delete(this.roomid);
    }
    setTitle(newTitle) {
        this.title = newTitle;
    }
    updateUserlist(users) {
        const userList = users.split(',').slice(1);
        for (const user of userList) {
            this.userJoin(user);
        }
    }
    get userList() {
        return [...this.users.keys()];
    }
    get userCount() {
        return this.userList.length;
    }
    userLeave(name) {
        const [, username] = Tools.splitUser(name);
        const userid = toId(username);
        const user = this.users.get(userid);
        if (!user)
            return debug(`User '${userid}' trying to leave a room '${this.roomid}' when they're not in it`);
        //this.auth.delete(userid);
        this.users.delete(userid);
    }
    userJoin(name) {
        const [, username] = Tools.splitUser(name);
        const userid = toId(username);
        this.users.set(userid, username);
        //this.auth.set(userid, group);
    }
    userRename(from, to) {
        const [, oldName] = Tools.splitUser(from);
        const [, newName] = Tools.splitUser(to);
        const oldId = toId(oldName);
        const newId = toId(newName);
        if (oldId === newId) {
            this.users.set(newId, newName);
            //this.auth.set(newId, newGroup);
            return;
        }
        this.users.delete(oldId);
        //this.auth.delete(oldId);
        this.users.set(newId, newName);
        //this.auth.set(newId, newGroup);
        debug(`User rename in '${this.roomid}': '${from}' => '${to}'`);
        if (this.game && this.game.onRename)
            this.game.onRename(oldId, newName);
    }
    getAuth(userid) {
        return this.auth.get(userid) || ' ';
    }
}
exports.Room = Room;
function getRoom(roomid) {
    if (!roomid)
        return null;
    if (typeof roomid === 'object')
        return roomid;
    return exports.Rooms.rooms.get(roomid.startsWith('groupchat') ? roomid : toId(roomid)) || null;
}
function addRoom(roomid, roomType) {
    let room = exports.Rooms(roomid);
    if (room) {
        if (room.roomType !== roomType) {
            debug(`Recreating room '${room.roomid}@${room.roomType}' as '${roomid}@${roomType}'`);
        }
        else {
            return room;
        }
    }
    room = new Room(roomid, roomType);
    exports.Rooms.rooms.set(roomid, room);
    debug(`INIT ROOM: ${roomid}`);
    return room;
}
/**
 * Returns the roomid where the bot has the bot rank and where the target is in
 * Returns a valid roomid or null
 */
function canPMInfobox(user) {
    const nick = toId(Config.nick);
    user = toId(user);
    for (const room of [...exports.Rooms.rooms.values()]) {
        if (room.getAuth(nick) === '*') {
            if (room.users.has(user))
                return room.roomid;
        }
    }
    return null;
}
const room_game_js_1 = require("./room-game.js");
exports.Rooms = Object.assign(getRoom, {
    Room,
    rooms: new Map(),
    addRoom,
    canPMInfobox,
    RoomGame: room_game_js_1.RoomGame,
    RoomGamePlayer: room_game_js_1.RoomGamePlayer,
});
