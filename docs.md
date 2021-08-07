# Universal Backup - a bot for Mafia on Pokemon Showdown

## Modules:
- [anon.js - Commands for anonymous and hydra games through slave accounts](#anonjs---commands-for-anonymous-and-hydra-games-through-slave-accounts)
- [iso.js - Player isolation in mafia games](#isojs---player-isolation-in-mafia-games)
- [lighthouse.js - Automated darkness day for lighthouse](#lighthousejs---automated-darkness-day-for-lighthouse)
- [leavers.js - Leaderboard penalty for leaving games](#leaversjs---leaderboard-penalty-for-leaving-games)
- [mafia.js - Commands to control scripted mafia games](#mafiajs---commands-to-control-scripted-mafia-games)
- [ps-links-suck.js - Linking MafiaScum themes with trailing punctuation properly](#ps-links-suckjs---linking-mafiascum-themes-with-trailing-punctuation-properly)
- [reply.js - Dynamic custom commands](#replyjs---dynamic-custom-commands)
- [mafiacooldown.js - Automated chill time between games](#mafiacooldownjs---automated-chill-time-between-games)
- [room-games.js - Generic commands for interacting with roomgames](#room-gamesjs---generic-commands-for-interacting-with-roomgames)
- [hangman.js - Start PS hangmans from mafia data entries](#hangmanjs---start-ps-hangmans-from-mafia-data-entries)
- [trivia.js - First-answer trivia and theme KunC](#triviajs---first-answer-trivia-and-theme-kunc)
- [commands.js - Misc / Administrative commands](#commandsjs---misc--administrative-commands)
## Disabled Modules:
- [leaderboard.js - Leaderboard used for the voice challenge](#leaderboardjs---leaderboard-used-for-the-voice-challenge)
- [ugm.js - Host tracking, faction points for WGO](#ugmjs---host-tracking-faction-points-for-wgo)


## Modules:

### commands.js - Misc / Administrative commands

> `js | eval <target>`

Evaluates the given javascript. Requires developer access.

> `c <target`

Replies with the given input. Requires dev.

> `update`

Runs `git fetch origin master && git merge origin master`. Requires dev.

> `hotpatch`

Attempts to patch commands and mafia while the bot is running. Questionable effectiveness. Requires dev.

> `git | docs`

PMs a link to the github page or this doccument respectively.

### anon.js - Commands for anonymous and hydra games through slave accounts

The anon module uses "slave" accounts, controlled by Universal Backup which receive and forward PMs from players. Two main modes are supported, anon and hydra.

In anonymous games, each player has one account. It is not publically revealed which player controls which account. 

> `anon | an`

Starts an anonymous game. Should be used AFTER all players have joined. Requires %.

In hydra games, each account is controlled by multiple players. It may or may not be public which players are controlling which account.

> `hydra`

Starts a hydra game. Should be used BEFORE any players have joined. Requires %.

> `head <player_1, player_2, player_n>`

Adds a "head" to the hydra. The given players will be assigned one account together. Requires %.

Several commands are common to both modes, as they both function reasonably similarly:

> `ag <slave_1, slave_2, slave_n>`

Adds a scum group to the game. Players can communicate within their group through message prefixes, see below.

> `addowner | removeowner <slave>, <player>`

Adds/Removes an owner from the given slave. Owners can send messages through PMing the slave.

> `sub <slave>, <player1>, <player2>`

Replaces the owner of `slave` `player1` with `player2`.

> `killslave <slave>`

Kills a slave account, disconnecting it. Should only be used in emergencies.

> `loadcredentials`

Reloads slave credentials from `./config/credentials.json`. Requires dev. `(this actually exists in commands.js)`

> Message Prefixes

- No prefix - message will be sent to the room normally.
- `>message` - used for commands, eg `>vote HoeenHero`.
- `;message` - message will be sent to scumpartners.
- `<message` - message will be sent to other owners. For use with hydras only.
- `&message` - message will be executed as javascript and the result returned. Requires dev.

### hangman.js - Start PS hangmans from mafia data entries

> `hangman <theme | modifier | role | ''>`

Attempts to start a room hangman off a random theme, modifier, or role. If neither of those are given, picks one at random. Requires %.

### iso.js - Player isolation in mafia games

The ISO plugin allows one to view any combination of player's messages by themselves.

> `i | isolation <player_1, player_2, player_n>`

Gets the messages from only the given players.

> `si | systemisolation | gamelog`

Gets the game messages (night, day, kills, revives, etc)

> `istart | istop`

Starts / stops ISO recording. Usually unnecessary, since ISO recording will automatically start / stop with games. Requires %.

> `enableiso`

Enables the ISO listener. This must be enabled for ISO to work at all. Requires #.

### leavers.js - Leaderboard penalty for leaving games

The leaver plugin is enabled by default. If a player leaves (gets subbed out) of an official game twice within the same month, they lose 5 points on the mafia leaderboard. The grace leaver is automatically reset after the month.

> `official | /wall official`

Marks the current game as an official. Needs to be done any time between gamestart and gameend for the plugin to work. Requires %.

> `notofficial`

Marks the game as not an official, making the plugin not take effect. Requires %.

> `leaver | unleaver <player>`

Marks `player` as either a leaver or not in the current game, making them lose / not lose points after the current game. Requires %.

> `clearleaver <player>`

Clears the grace leaver for this month for `player`. Requires %.

### lighthouse.js - Automated darkness day for lighthouse

Lighthouse has the unique mechanic of a darkness day, where messages are anonymous through the host. Universal Backup can be used to relay messages automatically.

> `lighthouse`

Starts a lighthouse session. Players in the current mafia game will be able to send messages anonymously by PMing the bot. Requires %.

> `lhstop | lhresume`

Pauses/Unpauses the current lighthouse session. When the session is paused, messages and lynches will not work. Requires %.

> `l | ul <player>`

Lynches or unlynches the player. The user must be a player in the current lighthouse game.

> `lynches`

Shows the current lynch counts. Requires %.

> `modlynches`

Shows the current lynch counts non anonymously. Should only be used in emergencies.

> `logs`

PMs the user the logs from the game, including any messages the bot refused to send. Requires %.

### mafia.js - Commands to control scripted mafia games
Not all of these commands will work all the time, depending on which triggers the current game supports.

> `game <gameid>`

Starts the game `gameid`. The bot must be the main host of the current mafia game. Requires %.

> `start`

Attempts to start the current game. Requires %.

> `action | a <target>`

Performs your action on `target`. Results will vary depending on running game.

### mafiacooldown.js - Automated chill time between games

This system is similar to the Game Corner cooldown, where the last two themes hosted are prohibited, and games can only start every 10 minutes.

> `theme <name>`

Adds the theme `name`  to the play history. Requires % or game host.

> `t`

Shows the current themes on cooldown.

> `cooldown`

Shows the current time remaining on the cooldown.

> `enablecd | disablecd`

Temporarily enables or disables the cooldown. Requires %.

> `createcd`

Enables the cooldown in the current room. Must be used before any other commands will work. Requires #.

### ps-links-suck.js - Linking MafiaScum themes with trailing punctuation properly
PS will automatically strip punctuation from the end of links AS A FEATURE. However, MafiaScum loves ending their themenames with punctuation. This plugin detects that and posts the proper link. No action is required for this to work.

### reply.js - Dynamic custom commands
This module allows for the addition of custom commands that return a simple reply.

> `addcustom <name>, <rank>, <reply>`

Adds a custom command, triggered with `name`, requiring `rank` or higher to use, and replying with `reply`.


Multiline replies are supported. To add these, use `addcustom <name>, <rank>, !`, and then immediately send your multiline message through `!code`.

Requires #.

> `deletecustom <name>`

Deletes the custom command `name`. Requires #.

> `viewcustoms`

Returns a list of each custom command. Requires #.

### room-games.js - Generic commands for interacting with roomgames

> `join | leave | end`

These commands vary depending on the roomgame running, but in general should do as the name suggests.

### trivia.js - First-answer trivia and theme KunC
In this game, a question is asked, and the first person to answer gets a point. The first person to reach the scorecap is the winner.

> `trivia <scorecap>`
> `kunc <scorecap>`

Starts a game of trivia or KunC with scorecap `scorecap`. Supports absurdly large numbers, but please don't do that. Requires %.


> `g | guess <answer>`

Guesses in the current trivia / KunC game.

> `addquestion <question>|<answer_1>|<answer_2>|<answer_n>`

Adds a question to the database. Answers are only checked based on alphanumeric characters.

> `removequestion <question>`

Removes the given question from the database. `question` can either be the index number (from `questions`) or the text of the question itself. Requires %.

> `questions`

Views the question database. Should be used in PMs or in a groupchat. Requires %.

## Disabled Plugins:

These plugins are located in the `disabled` directory, and will not be loaded unless moved.
### leaderboard.js - Leaderboard used for the voice challenge
The leaderboard plugin contains three constants. `WIN_POINTS` and `MVP_POINTS` are the points awarded for winning and getting MVP, respectively. `REGS_SHOWN` controls how many unranked users are displayed when the leaderboard is broadcast.

> `ladder | mvpladder`

Shows the top `REGS_SHOWN` unranked users, on either the points or MVP ladder.

> `position <target>`

Finds how many points `target` has, and how many unranked users are ahead of them. Defaults to the one using the command if no target is given.

> `win | lose | mvp | unmvp <points>, <user_1>, <user_2>, <user_n>`

Awards `points` to the given users. If `points` isn't given, defaults to `Config.WinPoints` points or 1 MVP. If using `lose` or `unmvp`, subtracts that many instead. Requires %.

### ugm.js - Host tracking, faction points for WGO

While the UGM tracker is enabled, the bot will automatically add UGM points to the host, based off the playercount.

The points are given through WGO Bot / UGM Bot, using the command `.addpoints <points>, <players>` This of course requires WGO Bot to exist for this to be useful.

To support faction tracking, the bot will automatically cohost itself for every game.

> `ugm`
> `disableugm`

Starts/Stops tracking games and automatically awarding host points in the current room. Requires #.

> `winfaction <faction>`

Awards UGM points to `faction`. Valid factions are anything recognised by the script. Requires % or game host.

> `mvp <user>`

Awards MVP points to `user`, based off the current game's playercount. Requires %.
