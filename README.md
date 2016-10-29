# DiscordMusicBot
A simple Discord Youtube and music bot that accepts youtube or direct music links and plays them in Discord.

Just a simple project to get me familiar with Eris...

# Instructions
1. Pull
2. `npm install`
3. Add your bot token to the top of index.js
4. `node index.js` or `forever start index.js` and away you go.

Note: when the bot joins a channel for the first time, it'll add a default youtube link to the queue (a 'ba dum tss' sound effect). 
Also please note that it takes a little bit of time to grab and extract the youtube audio stream when adding a song. The bot will tell you when the song properly gets added. 

If the bot crashes for some reason (I have pretty much no error handling, so it'll crash it you try and "play" something that's not a Youtube video), you'll have to restart it. I recommend running it under forever or pm2, which will restart it for you. After that, you'll need to `~~!join` again even though it may appear the bot is already in the channel.

#Commands
**~~!join** - bot joins your voice channel.  
**~~!add [youtube url]** - adds a song or playlist from YouTube to the queue. If you want to play a playlist, make sure that it's a playlist url and not a video with a playlist attached.  
**~~!addraw [mp3 url]** - adds a song to the queue. Needs to be a direct stream.  
**~~!skip** - skips the current song in the queue.  
**~~!kick** - kicks the bot from the voice channel.  
**~~!queue** - prints the current queue to the chat. Bot needs to have write access to the text channel.  
**~~!vol** - adjusts the volume of the bot on the server side. Ranges from 0 to 2.0, with 1.0 = 100% volume.  

# Stuff to do
- Error handling/sanity checking
- Guild config saving
- Other features
