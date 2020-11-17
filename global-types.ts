type ID = '' | (string & {__isID: true});

type AnyObject = {[k: string]: any};

type Config = typeof import('./config/config-example');

type Room = Rooms.Room;
type Rooms = Rooms.Rooms;
namespace Rooms {
    export type Room = import('./rooms').Room;
    export type Rooms = typeof import('./rooms').Rooms;
}

type RoomGame = RoomGames.RoomGame;
type RoomGamePlayer = RoomGames.RoomGamePlayer;
namespace RoomGames {
    export type RoomGame = import('./room-game').RoomGame;
    export type RoomGamePlayer = import('./room-game').RoomGamePlayer;
}

type ChatCommands = Chat.Commands;
namespace Chat {
    export type Commands = import('./chat').Chat.ChatCommands;
}

type MafiaTracker = Mafia.Tracker;
type MafiaISO = Mafia.ISO;
type MafiaCooldown = Mafia.Cooldown;
namespace Mafia {
    export type Tracker = import('./mafia').MafiaTrackerType;
    export type ISO = import('./plugins/iso').ISO;
    export type Cooldown = import('./plugins/mafiacooldown').MafiaCooldownT;
}