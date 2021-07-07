const steam = require("steam");
const fs = require("fs");
const crypto = require("crypto");
const dota2 = require("dota2");
const util = require('util');
const steamClient = new steam.SteamClient();
const steamUser = new steam.SteamUser(steamClient);
const steamFriends = new steam.SteamFriends(steamClient);
const Dota2 = new dota2.Dota2Client(steamClient, true);
const config = require('./config.json')

// Friend SteamId
const friendId = config.friendId;

// Create file for handler bot
steamUser.on('updateMachineAuth', function (sentry, callback) {
  var hashedSentry = crypto.createHash('sha1').update(sentry.bytes).digest();
  fs.writeFileSync('sentry', hashedSentry)
  console.log("sentryfile saved");
  callback({
    sha_file: hashedSentry
  });
});

let logOnDetails = {
  "account_name": config.steam_user,
  "password": config.steam_pass,
}

// Login, only passing authCode if it exists
if (config.steam_guard_code) logOnDetails.auth_code = config.steam_guard_code;
if (config.two_factor_code) logOnDetails.two_factor_code = config.two_factor_code;

try {
  var sentry = fs.readFileSync('sentry');
  if (sentry.length) logOnDetails.sha_sentryfile = sentry;
} catch (beef) {
  console.log("Cannot load the sentry. " + beef);
}

steamClient.connect();
steamClient.on('connected', function () {
  steamUser.logOn(logOnDetails);
});

steamClient.on('logOnResponse', function(logonResp) {
  if (logonResp.eresult == steam.EResult.OK) {
    steamFriends.setPersonaState(steam.EPersonaState.Busy); // to display your steamClient's status as "Online"
    steamFriends.setPersonaName(config.steam_name); // to change its nickname
    console.log("Logged on.");

    Dota2.launch();

    Dota2.on("ready", function () {
      console.log("Dota2 ready.");

      const lobbyData = {
        "game_name": "Super Server BR",
        "server_region": dota2.ServerRegion.BRAZIL,
        "game_mode": dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_CM,
        "series_type": 0,
        "game_version": 1,
        "allow_cheats": false,
        "fill_with_bots": false,
        "allow_spectating": true,
        "pass_key": "pass123",
        "radiant_series_wins": 0,
        "dire_series_wins": 0,
        "allchat": true
      }

      // Create lobby
      Dota2.createPracticeLobby(lobbyData, (err, data) => {
        if (err) console.log('Error in create lobby: ', err)

        // Invite player to Lobby
        Dota2.inviteToLobby(friendId)
      });

      Dota2.on('lobbyInviteUpdate', (lobbyInvite) => {
        console.log('Invite: ', JSON.stringify(lobbyInvite))
      });

      Dota2.on("practiceLobbyUpdate", function (lobby) {
        // Remove BOT to team
        Dota2.practiceLobbyKickFromTeam(Dota2.AccountID)

        // Auth BOT in chat in lobby
        let chatChannel = `Lobby_${lobby.lobby_id}`
        Dota2.joinChat(chatChannel, dota2.schema.lookupEnum('DOTAChatChannelType_t').values.DOTAChannelType_Lobby);

        Dota2.sendMessage('Welcome to the Lobby', chatChannel)
        console.log("practiceLobbyUpdate: ", lobby)
      });
    });

    Dota2.on("unready", function onUnready() {
      console.log("Node-dota2 unready.");
    });
    Dota2.on("chatMessage", function (channel, personaName, message) {
      console.log('Chat: ', [channel, personaName, message].join(", "));
    });
    Dota2.on("unhandled", function (kMsg) {
      console.log("UNHANDLED MESSAGE " + dota2._getMessageName(kMsg));
    });
  }
});

steamClient.on('loggedOff', function(eresult) {
  console.log("Logged off from Steam.");
});

steamClient.on('error', function(error) {
  console.log("Connection closed by server: " + error);
});

steamClient.on('servers', function(servers) {
  console.log("Received servers.");
  fs.writeFile('servers', JSON.stringify(servers), (err) => {
    if (err) { if (this.debug) console.log("Error writing "); }
    else { if (this.debug) console.log(""); }
  });
});

// Cancel process with CTRL+C
process.on('SIGINT', function () {
  Dota2.exit()
});