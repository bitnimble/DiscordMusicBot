const Eris = require('eris');
const youtubedl = require('youtube-dl');
const urlHelper = require('url');
const request = require('request');

let bot = new Eris("TOKENHERE");
let SC_CLIENT_ID = 'SoundCloud client ID here';

let activeGuilds = {};

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
	
	if (guild.firstSong || guild.queue.length == 1) {
		guild.firstSong = false;
		playNextSong(guild);
	}
	bot.createMessage(guild.messageChannelID, "Added '" + song.title + "' to the queue!");
}

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

function playNextSong(guild) {
	let voiceConn = guild.voiceConn;
	let queue = guild.queue;
	
	if (queue.length > 0) {
		console.log("Now playing: " + queue[0].title + "; " + queue[0].url);
		voiceConn.playResource(queue[0].url, { inlineVolume: true });
	}
}

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
				
				let guild = { messageChannelID: msg.channel.id, voiceChannelID: msg.member.voiceState.channelID, voiceConn: voiceConn, queue: [], firstSong: true };
				activeGuilds[msg.member.guild.id] = guild;
				
				addSong(guild, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
				
				guild.voiceConn.on("end", () => {
					console.log("Song ended");
					guild.queue.splice(0, 1);
					if (guild.queue.length > 0) {
						console.log("\nStarting next track");
						playNextSong(guild);
					}
				});
				
				guild.voiceConn.on("error", () => {
					console.log("Song failed! ----------------------------------------------------------- ");
					bot.createMessage(guild.messageChannelID, "Song encoding failed! Skipping track '" + guild.queue[0].title + "'");
					
					guild.queue.splice(0, 1);
					if (guild.queue.length > 0) {
						console.log("\nStarting next track");
						playNextSong(guild);
					}
				});
			});
		}
		return;
	}
	
	let guild = activeGuilds[msg.member.guild.id];
	if (!guild)
		return;
	if (msg.content == "~~!skip") {
		skipSong(guild);
	} else if (msg.content.startsWith("~~!add ")) {
		let url = msg.content.substr(7);
		addSong(guild, url);
	} else if (msg.content.startsWith("~~!addraw ")) {
		let url = msg.content.substr(10);
		addSongRaw(guild, { title: 'Direct stream', url: url });
	} else if (msg.content == "~~!queue") {
		listQueue(guild);
	} else if (msg.content == "~~!kick") {
		if (activeGuilds[msg.member.guild.id]) {
			bot.leaveVoiceChannel(activeGuilds[msg.member.guild.id].voiceChannelID);
			activeGuilds[msg.member.guild.id] = undefined;
		}
	} else if (msg.content.startsWith("~~!vol ")) {
		let volumeString = msg.content.substr(7);
		let volume = parseFloat(volumeString);
		if (volume != NaN) {
			guild.voiceConn.setVolume(volume);
		}
	}
});

bot.connect();