declare namespace NodeJS {
	interface Global {
		Chat: any
		sendMessage: any
		sendPM: any
		Config: any
		Mafia: any
		Rooms: any
		Tools: any
		toId(i: any): string
		debug(m: string): void
		log(m: string): void
    }
}
