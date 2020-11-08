
import { Chat as ChatType } from './chat'
import * as ConfigType from './config/config-example'
import { Tools as ToolsType } from './tools'
import { Rooms as RoomsType } from './rooms'
import * as MafiaType from './mafia'

declare global {
    namespace NodeJS {
        interface Global {
            Chat: any;
            sendMessage: any;
            sendPM: any;
            Config: any;
            Mafia: any;
            Tools: any;
            toId: any;
            Rooms: any;
            debug: any;
            log: any;
        }
    }
    const Chat: typeof ChatType;
    const sendMessage: typeof ChatType.sendMessage
    const sendPM: typeof ChatType.sendPM
    const Config: typeof ConfigType
    const Mafia: typeof MafiaType
    const Tools: typeof ToolsType
    const toId: typeof ToolsType.toId
    const Rooms: typeof RoomsType
    const debug: (msg: string) => void;
    const log: (msg: string) => void;

    const Room: typeof RoomsType.Room
    const CommandContext: typeof ChatType.ChatParser
    const MafiaTracker: typeof MafiaType.MafiaTracker
}
