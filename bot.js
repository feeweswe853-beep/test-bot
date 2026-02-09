const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, StreamType, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Readable } = require('stream');
const GroqAI = require('./groq-ai');

// Basic config
const config = { token: process.env.DISCORD_TOKEN };

// initialize AI (Groq)
const ai = new GroqAI(process.env.GROQ_API_KEY);

// persistent settings
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
function loadSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return {}; }
  }
  return {};
}
function saveSettings(s) { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); }
const settings = loadSettings();

// active voice sessions keyed by userId
const activeSessions = new Map();

// create client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Minimal slash commands
const commands = [
  {
    name: 'setup',
    description: 'Simple setup commands',
    options: [
      {
        name: 'ai',
        description: 'enable or disable ai',
        type: 3, // STRING
        required: true,
        choices: [ { name: 'enable', value: 'enable' }, { name: 'disable', value: 'disable' } ]
      }
    ]
  },
  {
    name: 'setupvoice',
    description: 'Set voice channel id to use for AI',
    options: [ { name: 'id', description: 'voice channel id', type: 3, required: true } ]
  }
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(config.token);
    await rest.put(Routes.applicationCommands((await client.application.fetch()).id), { body: commands });
    console.log('✅ Registered minimal slash commands');
  } catch (e) { console.error('Failed to register commands', e); }
}

// Helper: play TTS in connection using Google Translate TTS (female Arabic)
async function playTTS(connection, text) {
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(text)}`;

    const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const audioBuffer = Buffer.from(res.data);

    // Convert Buffer to Readable stream to avoid invalid chunk types
    const stream = Readable.from([audioBuffer]);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
    player.play(resource);
    try { connection.subscribe(player); } catch (err) { console.warn('subscribe failed', err); }
    return player;
  } catch (e) { console.error('playTTS error', e); return null; }
}

// Start AI session for a user when they join the configured voice channel
async function startSession(guild, member) {
  if (!settings[guild.id] || !settings[guild.id].voiceId) return false;
  const voiceId = settings[guild.id].voiceId;
  if (!voiceId) return false;
  if (activeSessions.has(member.id)) return true;

  try {
    const channel = await guild.channels.fetch(voiceId);
    if (!channel) return false;

    const connection = joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: false });
    // wait for ready
    connection.on(VoiceConnectionStatus.Ready, () => console.log('Voice connection ready'));

    // welcome message from AI
    const welcome = 'أهلًا، أنا سارة، تكلمني هنا بأي رسالة وسأرد عليك بصوتي';
    setTimeout(() => playTTS(connection, welcome), 800);

    activeSessions.set(member.id, { guildId: guild.id, channelId: channel.id, connection });
    return true;
  } catch (e) { console.error('startSession error', e); return false; }
}

// Stop AI session when user leaves
async function stopSession(userId) {
  const s = activeSessions.get(userId);
  if (!s) return;
  try {
    if (s.connection) {
      try { s.connection.destroy(); } catch {}
    }
  } catch(e){}
  activeSessions.delete(userId);
}

// handle messages from users who have active sessions
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const userId = message.author.id;
  if (!activeSessions.has(userId)) return;
  const session = activeSessions.get(userId);
  if (!session || !session.connection) return;

  // send user message to AI and play response
  try {
    const response = await ai.getResponse(userId, message.content, 'default');
    if (response) playTTS(session.connection, response);
  } catch (e) { console.error('AI respond error', e); }
});

// Slash command handler (minimal)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName } = interaction;

  if (commandName === 'setup') {
    const state = interaction.options.getString('ai');
    if (!settings[interaction.guildId]) settings[interaction.guildId] = { aiEnabled: false, voiceId: null };
    settings[interaction.guildId].aiEnabled = state === 'enable';
    saveSettings(settings);
    await interaction.reply({ content: `AI is now ${settings[interaction.guildId].aiEnabled ? 'enabled' : 'disabled'}`, ephemeral: true });
    return;
  }

  if (commandName === 'setupvoice') {
    const id = interaction.options.getString('id');
    if (!settings[interaction.guildId]) settings[interaction.guildId] = { aiEnabled: false, voiceId: null };
    settings[interaction.guildId].voiceId = id;
    saveSettings(settings);
    await interaction.reply({ content: `Voice channel set to: ${id}`, ephemeral: true });
    return;
  }
});

// When user joins or leaves voice channel
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    const guild = newState.guild || oldState.guild;
    const gSettings = settings[guild.id] || {};

    // joined configured voice
    if (newState.channelId && newState.channelId === gSettings.voiceId && newState.channelId !== oldState.channelId) {
      if (gSettings.aiEnabled) {
        await startSession(guild, member);
      }
      return;
    }

    // left configured voice
    if (oldState.channelId && oldState.channelId === gSettings.voiceId && newState.channelId !== oldState.channelId) {
      // stop session for that user
      await stopSession(member.id);
    }
  } catch (e) { console.error('voiceStateUpdate error', e); }
});

// ready
client.on('ready', async () => {
  console.log('✅ Bot ready', client.user.tag);
  await registerCommands();
});

// login
if (!config.token) { console.error('DISCORD_TOKEN missing'); process.exit(1); }
client.login(config.token).catch(e=>console.error('login error', e));
