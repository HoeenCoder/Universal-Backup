
import * as ChatType from './chat'
import * as ConfigType from './config/config-example'
import * as ToolsType from './tools'
import * as RoomsType from './rooms'
import * as MafiaType from './mafia-tracker'

declare global {
    const Chat: typeof ChatType
    const sendMessage: typeof ChatType.sendMessage
    const sendPM: typeof ChatType.sendPM
    const Config: typeof ConfigType
    const Mafia: typeof MafiaType
    const Tools: typeof ToolsType
    const toId: typeof ToolsType.toId
    const Rooms: typeof RoomsType
    const debug: any
    const log: any

    const Room: typeof RoomsType.Room
    const CommandContext: typeof ChatType.ChatParser
    const MafiaTracker: typeof MafiaType.MafiaTracker
}
