const Eris = require('eris');
const youtubedl = require('youtube-dl');
const urlHelper = require('url');
const request = require('request');
const fs = require('fs');


/*
Guild object:
{
 	messageChannelID = the message channel it will respond on,
	voiceChannelID = the id of the voice channel it is in,
	voiceConn = the voice connection of the voice channel it is in,
	queue = the current queue of songs (Song[]),
	firstSong = whether or not it needs to play the first song yet
}

Song object:
{
	url = direct url to the mp3 stream,
	ytUrl = original youtube url,
	title = song display name
}

*/
let activeGuilds = new Map();

fs.readFile("activeGuildState", (err, data) => {
	if (!err) {
		let saveObject = JSON.parse(data);
		for (let i = 0; i < saveObject.guilds.length; i++) {
			let guild = { queue: saveObject.queues[i] };
			activeGuilds.set(saveObject.guilds[i], guild);
		}
	}	
});

function getYtStreamUrl(ytUrl, callback) {
	youtubedl.getInfo(ytUrl, [], function(err, info) {
		if (err) {
			console.log(err);
			callback(null);
		} else {
			let songs = [];
			if (Object.prototype.toString.call(info) !== '[object Array]') {
				info = [info];
			}
			for (let i = 0; i < info.length; i++) {
				//Get the highest quality audio stream
				let video = info[i];
				let highestBitrate = 0;
				let bestFormat;
				for (let j = 0; j < video.formats.length; j++) {
					let format = video.formats[j];
					if (format.format.indexOf('audio only') == -1)
						continue;
					if (format.abr > highestBitrate) {
						highestBitrate = format.abr;
						bestFormat = format;
					}
				}
				songs.push({ url: bestFormat.url, ytUrl: video.webpage_url, title: video.title });
			}
			
			callback(songs);
		}
	});
}

function getScStreamUrl(scUrl, callback) {
	let requestUrl = 'http://api.soundcloud.com/resolve?url=' + scUrl + '&client_id=' + SC_CLIENT_ID;

	request({url: requestUrl, json: true}, function(err, res, body) {
		if (!err && res.statusCode === 200) {
			let streamUrl = body.stream_url + '?client_id=' + SC_CLIENT_ID;
			//We do a GET again to follow the soundcloud redirect to their cdn
			request.get(streamUrl, function(err2, res2, body2) {
				//Callback expects an array of Song objects so we wrap it
				callback([{ title: body.title, url: res2.request.uri.href }]);
			});
		} else {
			callback(null);
		}
	});
}

//Callback expects an array of Song objects
function getStreamUrl(url, callback) {
	let urlObj = urlHelper.parse(url);
	let hostname = urlObj.hostname;
	console.log(hostname);
	
	if (hostname === 'youtube.com' || hostname === 'www.youtube.com')
		getYtStreamUrl(url, callback);
	else if (hostname === 'soundcloud.com' || hostname === 'www.youtube.com')
		getScStreamUrl(url, callback);
	else 
		callback(null);
}

function addSongRaw(guild, song) {
	console.log("Added raw link: " + song.url);
	if (!song.ytUrl)
		song.ytUrl = "Raw audio stream (no youtube link)";
	guild.queue.push(song);
	saveGuildStatus();
	
	if (guild.firstSong || guild.queue.length == 1) {
		guild.firstSong = false;
		playNextSong(guild);
	}
	bot.createMessage(guild.messageChannelID, "Added '" + song.title + "' to the queue!");
}

//Note that we process the song url (if it's youtube or soundcloud) when we add it, not when
//we play it. Although this means that some song mp3s may expire if the queue is very long,
//it means we can grab the title for the display name. I'll probably add something later to make
//it regenerate an mp3 link if it tries to play and fails instantly.
function addSong(guild, ytUrl) {
	console.log("Added youtube link: " + ytUrl);
	getStreamUrl(ytUrl, function(songs) {
		if (songs)
			for (let i = 0; i < songs.length; i++) {
				song = songs[i];
				addSongRaw(guild, song);
			}
		else
			bot.createMessage(guild.messageChannelID, "Invalid song url.");
	});
}

//Starts playing the next song.
function playNextSong(guild) {
	let voiceConn = guild.voiceConn;
	let queue = guild.queue;
	
	if (queue.length > 0) {
		console.log("Now playing: " + queue[0].title + "; " + queue[0].url);
		voiceConn.playResource(queue[0].url, { inlineVolume: true });
	}
}

//Skips the current song in the queue.
function skipSong(guild) {
	if (guild.voiceConn.playing) {
		guild.voiceConn.stopPlaying();
		console.log("Stopping previous track");
	}
}

let messageLengthCap = 2000;
function listQueue(guild) {
	let queue = guild.queue;
	if (guild.queue.length == 0) {
		bot.createMessage(guild.messageChannelID, "No songs in the queue.");
	} else {
		let message = "Current queue:\n";
		for (let i = 0; i < queue.length; i++) {
			message += (i+1) + ". " + queue[i].title + "\n";
		}
		
		if (message.length > messageLengthCap) {
			let messageCount = Math.ceil(message.length / messageLengthCap);
			let messages = [];
			let j = 0;
			for (let i = 0; i < messageCount - 1; i++, j+= messageLengthCap) {
				bot.createMessage(guild.messageChannelID, message.substr(j, messageLengthCap));
			}
			bot.createMessage(guild.messageChannelID, message.substr(j));
		} else {
			bot.createMessage(guild.messageChannelID, message);
		}
	}
}

function listNowPlaying(guild) {
	let queue = guild.queue;
	if (guild.queue.length == 0) {
		bot.createMessage(guild.messageChannelID, "No songs is currently playing.");
	} else {
		let songName = queue[0].title;
		songName.replace("*", "\*");
		bot.createMessage(guild.messageChannelID, "**Now playing: " + songName + "**");
	}
}

function initVoiceConnection(msg, voiceConn) {
	console.log("Joined channel " + msg.member.voiceState.channelID);
	
	let guild = activeGuilds.get(msg.member.guild.id);
	let newGuild = false;
	if (guild) {
		guild.messageChannelID = msg.channel.id;
		guild.voiceChannelID = msg.member.voiceState.channelID;
		guild.voiceConn = voiceConn;
	} else {
		guild = { messageChannelID: msg.channel.id, voiceChannelID: msg.member.voiceState.channelID, voiceConn: voiceConn, queue: [], firstSong: true };
		newGuild = true;
	}
	guild.initialised = true;
	bot.createMessage(guild.messageChannelID, "o7");
	
	activeGuilds.set(msg.member.guild.id, guild);
	if (newGuild || guild.queue.length == 0)
		addSong(guild, 'https://www.youtube.com/watch?v=nmPPCkF6-fk');
	else
		playNextSong(guild);
	
	let nextSong = () => {
		guild.queue.splice(0, 1);
		saveGuildStatus();
		if (guild.queue.length > 0) {
			console.log("\nStarting next track");
			playNextSong(guild);
		}
	};
	
	guild.voiceConn.on("end", () => {
		if (guild.initialised) {
			console.log("Song ended");
			nextSong();
		}
	});
	
	guild.voiceConn.on("error", () => {
		if (guild.initialised) {
			console.log("Song failed! ----------------------------------------------------------- ");
			bot.createMessage(guild.messageChannelID, "Song encoding failed! Skipping track '" + guild.queue[0].title + "'");
			nextSong();
		}
	});
}

function saveGuildStatus() {
	let saveObject = { guilds: [], queues: [] };
	for (let [id, guild] of activeGuilds) {
		saveObject.guilds.push(id);
		saveObject.queues.push(guild.queue);
	}
	
	fs.writeFile("activeGuildState", JSON.stringify(saveObject), function (err) {
		if (err)
			console.log(err);
	});
}

bot.on("ready", () => {
	console.log("Ready!");
});

//Command processing
bot.on("messageCreate", (msg) => {
	//Join a voice channel
	let guild = activeGuilds.get(msg.member.guild.id);
	if (msg.content == "~~!join") {
		if (guild && guild.initialised) {
			console.log("Already in guild ID " + msg.member.guild.id + "!");
		} else {
			bot.joinVoiceChannel(msg.member.voiceState.channelID).catch((err) => {
				console.log(err);
			}).then((voiceConn) => {
				initVoiceConnection(msg, voiceConn);
			});
		}
		return;
	}
	
	let url;
	if (!guild)
		return;
	if (msg.content == "~~!skip") { //Skip the current track in the queue
		skipSong(guild);
	} else if (msg.content.startsWith("~~!add ")) { //Add a song to the queue
		url = msg.content.substr(7);
		addSong(guild, url);
	} else if (msg.content.startsWith("~~!addraw ")) { //Add a direct mp3/stream to the queue
		url = msg.content.substr(10);
		if (!url.startsWith("http://") && !url.startsWith("https://"))
			url = "http://" + url;
		addSongRaw(guild, { title: 'Direct stream', url: url });
	} else if (msg.content == "~~!queue") { //List the current queue
		listQueue(guild);
	} else if (msg.content == "~~!np") {
		listNowPlaying(guild);
	} else if (msg.content == "~~!kick") { //Kick the bot from the VC
		guild.initialised = false;
		bot.leaveVoiceChannel(guild.voiceChannelID);
	} else if (msg.content.startsWith("~~!vol ")) { //Set the current volume
		let volumeString = msg.content.substr(7);
		let volume = parseFloat(volumeString);
		if (volume != NaN) {
			guild.voiceConn.setVolume(volume);
		}
	} else if (msg.content.startsWith("~~!eval ")) {
		if (msg.author.id != ownerId) {
			bot.createMessage(msg.channel.id, "Nobody likes to be Alone.");
			return;
		}
		let command = msg.content.substr(8);
		let result;
		try {
			result = eval(command);
		} catch (e) {
			result = e;
		}
		bot.createMessage(msg.channel.id, result);
	} else if (msg.content == "~~!clear") {
		let firstSong = guild.queue[0];
		guild.queue = [];
		if (firstSong)
			guild.queue.push(firstSong);
	}
});

bot.connect();