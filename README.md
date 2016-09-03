# DiscordMusicBot
A simple bot that accepts youtube links and plays them in Discord.

Just a simple project to get me familiar with Eris...

# Instructions
1. Pull
2. `npm install`
3. Add your bot token to the top of index.js
4. `node index.js` or `forever start index.js` and away you go.

Note: when the bot joins a channel for the first time, it'll add a default youtube link to the queue (a 'ba dum tss' sound effect). 
Also please note that it takes a little bit of time to grab and extract the youtube audio stream when adding a song. The bot will tell you when the song properly gets added. 

#Commands
**~~!join** - bot joins your voice channel.  
**~~!add** [youtube url] - adds a song to the queue.  
**~~!skip** - skips the current song in the queue.  
**~~!kick** - kicks the bot from the voice channel.  
**~~!queue** - prints the current queue to the chat. Bot needs to have write access to the text channel.  

# Stuff to do
- Playlists/multiple link addition
- Error handling/sanity checking
- Guild config saving
- Other features
