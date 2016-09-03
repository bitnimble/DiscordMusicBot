const Eris = require('eris');
var youtubedl = require('youtube-dl');

var bot = new Eris("TOKENHERE");

var activeGuilds = {};

function getStreamUrl(ytUrl, callback) {
	youtubedl.getInfo(ytUrl, [], function(err, info) {
		if (err) {
			console.log(err);
			callback(null);
		}
		else {
			var highestBitrate = 0;
			var bestFormat;
			for (var i = 0; i < info.formats.length; i++) {
				var format = info.formats[i];
				if (format.format.indexOf('audio only') == -1)
					continue;
				if (format.abr > highestBitrate) {
					highestBitrate = format.abr;
					bestFormat = format;
				}
			}
			
			callback(bestFormat.url);
		}
	});
}

function addSongRaw(guild, url, ytUrl) {
	console.log("Added raw link: " + url);
	if (!ytUrl)
		ytUrl = "Raw audio stream (no youtube link)";
	guild.queue.push( { url: url, ytUrl: ytUrl });
	
	if (guild.firstSong || guild.queue.length == 1) {
		guild.firstSong = false;
		playNextSong(guild);
	}
	bot.createMessage(guild.messageChannelID, "Added a song to the queue!");
}

function addSong(guild, ytUrl) {
	console.log("Added youtube link: " + ytUrl);
	getStreamUrl(ytUrl, function(url) {
		if (url)
			addSongRaw(guild, url, ytUrl);
		else
			bot.createMessage(guild.messageChannelID, "Invalid song url.");
	});
}

function playNextSong(guild) {
	var voiceConn = guild.voiceConn;
	var queue = guild.queue;
	
	if (queue.length > 0) {
		voiceConn.playResource(queue[0].url);
	}
}

function skipSong(guild) {
	if (guild.voiceConn.playing) {
		guild.voiceConn.stopPlaying();
		console.log("Stopping previous track");
	}
}

function listQueue(guild) {
	var queue = guild.queue;
	if (guild.queue.length == 0) {
		bot.createMessage(guild.messageChannelID, "No songs in the queue.");
	} else {
		bot.createMessage(guild.messageChannelID, "Current queue:");
		for (var i = 0; i < queue.length; i++) {
			bot.createMessage(guild.messageChannelID, (i+1) + ". " + queue[i].ytUrl);
		}
	}
}

bot.on("ready", () => {
	console.log("Ready!");
});

bot.on("messageCreate", (msg) => {
	if (msg.content == "~~!join") {		
		if (activeGuilds[msg.member.guild.id]) {
			console.log("Already in guild ID " + msg.member.guild.id + "!");
		} else {
			bot.joinVoiceChannel(msg.member.voiceState.channelID).catch((err) => {
				console.log(err);
			}).then((voiceConn) => {
				console.log("Joined channel " + msg.member.voiceState.channelID);
				
				var guild = { messageChannelID: msg.channel.id, voiceChannelID: msg.member.voiceState.channelID, voiceConn: voiceConn, queue: [], firstSong: true };
				activeGuilds[msg.member.guild.id] = guild;
				
				addSong(guild, 'https://www.youtube.com/watch?v=6zXDo4dL7SU');
				
				guild.voiceConn.on("end", () => {
					guild.queue.splice(0, 1);
					if (guild.queue.length > 0) {
						console.log("Starting next track");
						playNextSong(guild);
					}
				});
			});
		}
		return;
	}
	
	var guild = activeGuilds[msg.member.guild.id];
	if (!guild)
		return;
	if (msg.content == "~~!skip") {
		skipSong(guild);
	} else if (msg.content.startsWith("~~!add ")) {
		var url = msg.content.substr(7);
		addSong(guild, url);
	} else if (msg.content == "~~!queue") {
		listQueue(guild);
	} else if (msg.content == "~~!kick") {
		if (activeGuilds[msg.member.guild.id]) {
			bot.leaveVoiceChannel(activeGuilds[msg.member.guild.id].voiceChannelID);
			activeGuilds[msg.member.guild.id] = undefined;
		}
	}
});

bot.connect();