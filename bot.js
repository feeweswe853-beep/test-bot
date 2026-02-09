const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionsBitField, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus, entersState, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const DeepSeekAI = require('./deepseek-ai.js');

// إعداد مكتبة الصوت
try {
    require('@discordjs/opus');
    console.log('✅ مكتبة الصوت جاهزة باستخدام @discordjs/opus');
} catch (e1) {
    try {
        const OpusScript = require('opusscript');
        const encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);
        console.log('✅ مكتبة الصوت جاهزة باستخدام opusscript');
    } catch (e2) {
        console.warn('⚠️  لا توجد مكتبة opus متاحة:', e1.message, '/', e2.message);
    }
}

// الإعدادات الأساسية
const config = {
    token: process.env.DISCORD_TOKEN
};

// إضافة معرف المالك
const BOT_OWNER_ID = '1423320282281676878';
const OWNER_PREFIX = '!';

// ملف الإعدادات
const SETTINGS_FILE = 'settings.json';

// تهيئة DeepSeek AI
const deepseekAI = new DeepSeekAI(process.env.DEEPSEEK_API_KEY);

// دالة لتحميل الإعدادات
function loadSettings() {
    if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    }
    return {};
}

// دالة لحفظ الإعدادات
function saveSettings(settings) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// تحميل الإعدادات الحالية
const serverSettings = loadSettings();

// تعريف مجموعات الصوت
const audioSets = [
    {
        id: 'set1',
        name: 'الطقم الأول',
        waiting: 'waiting_call.mp3',
        background: 'background_music.mp3'
    },
    {
        id: 'set2',
        name: 'الطقم الثاني',
        waiting: 'waiting2_call.mp3',
        background: 'background2_music.mp3'
    },
    {
        id: 'set3',
        name: 'طقم بدون انتظار',
        waiting: null,
        background: 'background_music.mp3'
    }
];

// دالة للتحقق من اكتمال إعدادات السيرفر
function isServerSetupComplete(guildId) {
    const settings = serverSettings[guildId];
    if (!settings) return false;
    
    // مطلوب: category, voice, text, role
    return settings.categoryId && settings.voiceId && settings.textId && settings.adminRoleId;
}

// دالة للحصول على إعدادات سيرفر معين
function getServerSettings(guildId) {
    return serverSettings[guildId];
}

// دالة للحصول على مجموعة صوتية بالـ ID
function getAudioSetById(audioSetId) {
    return audioSets.find(set => set.id === audioSetId) || audioSets[0];
}

// دالة لعرض الإعدادات بشكل جميل
function formatSettings(guild, settings) {
    const audioSet = getAudioSetById(settings.audioSetId || 'set1');
    
    // محاولة جلب أسماء القنوات والرتب
    let categoryName = '❌ غير محدد';
    let voiceName = '❌ غير محدد';
    let textName = '❌ غير محدد';
    let roleName = '❌ غير محدد';
    
    try {
        if (settings.categoryId) {
            const category = guild.channels.cache.get(settings.categoryId);
            categoryName = category ? category.name : '❌ قناة غير موجودة';
        }
        
        if (settings.voiceId) {
            const voice = guild.channels.cache.get(settings.voiceId);
            voiceName = voice ? voice.name : '❌ قناة غير موجودة';
        }
        
        if (settings.textId) {
            const text = guild.channels.cache.get(settings.textId);
            textName = text ? text.name : '❌ قناة غير موجودة';
        }
        
        if (settings.adminRoleId) {
            const role = guild.roles.cache.get(settings.adminRoleId);
            roleName = role ? role.name : '❌ رتبة غير موجودة';
        }
    } catch (error) {
        console.log('خطأ في جلب البيانات:', error);
    }
    
    return `
**🎛️ إعدادات نظام الدعم**

**📂 التصنيف:** ${categoryName} \`(${settings.categoryId || 'غير محدد'})\`
**🎧 روم الانتظار:** ${voiceName} \`(${settings.voiceId || 'غير محدد'})\`
**💬 روم الإشعارات:** ${textName} \`(${settings.textId || 'غير محدد'})\`
**👑 رتبة الإدارة:** ${roleName} \`(${settings.adminRoleId || 'غير محدد'})\`
**🎵 مجموعة الصوت:** ${audioSet.name}
**🤖 نظام AI:** ${settings.aiEnabled ? '✅ مفعل' : '❌ معطل'}

**📊 حالة الإعدادات:** ${isServerSetupComplete(guild.id) ? '✅ مكتملة' : '❌ غير مكتملة'}

**📝 طريقة الاستخدام:**
1. العميل يدخل روم الانتظار
2. ${settings.aiEnabled ? 'المساعد الذكي سارة ترحب به' : 'البوت يشغل موسيقى انتظار'}
3. ${settings.aiEnabled ? 'سارة تجيب على أسئلته' : 'يرسل إشعار في روم الإشعارات'}
4. ${settings.aiEnabled ? 'إذا احتاج مشرف، يتم التنبيه' : 'المشرف يدخل روم الانتظار'}
5. ${settings.aiEnabled ? 'المشرف يتولى المحادثة' : 'ينشئ البوت روم خاص وينقل الجميع إليه'}
    `;
}

// دالة للتحذير إذا النظام غير مكتمل
async function warnAdminIfNotSetup(guild) {
    const settings = getServerSettings(guild.id);
    if (!isServerSetupComplete(guild.id)) {
        // البحث عن الإدمن الأول
        const admin = guild.members.cache.find(member => 
            member.permissions.has(PermissionsBitField.Flags.Administrator)
        );
        
        if (admin) {
            try {
                await admin.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('⚠️ تنبيه مهم!')
                            .setDescription(`**نظام الدعم في ${guild.name} غير مكتمل الإعداد!**\n\nالرجاء استخدام الأمر \`/help\` في سيرفر ${guild.name} لعرض أوامر الإعداد.`)
                            .addFields({
                                name: 'الأوامر الأساسية المطلوبة',
                                value: `\`/setup category\`\n\`/setup voice\`\n\`/setup text\`\n\`/setup role\``
                            })
                            .setFooter({ text: 'البوت لن يعمل بشكل صحيح حتى تكتمل الإعدادات' })
                    ]
                });
                console.log(`📩 تم إرسال تحذير للإدمن في ${guild.name}`);
            } catch (error) {
                console.log(`❌ لم أستطع إرسال رسالة للإدمن في ${guild.name}`);
            }
        }
    }
}

// ================ البوت الأساسي ================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// تعريف الـ Slash Commands مع أوامر AI الجديدة
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعدادات نظام الدعم الصوتي')
        .addSubcommand(subcommand =>
            subcommand
                .setName('category')
                .setDescription('تحديد التصنيف للغرف الخاصة')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID التصنيف')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('تحديد روم الانتظار الصوتي')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID روم الصوت')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('تحديد روم إرسال الإشعارات')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID روم النص')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('تحديد رتبة الإدارة')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID الرتبة')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('waiting')
                .setDescription('اختيار مجموعة الصوت')
                .addStringOption(option =>
                    option.setName('set')
                        .setDescription('اختر مجموعة الصوت')
                        .setRequired(true)
                        .addChoices(
                            { name: 'الطقم الأول', value: 'set1' },
                            { name: 'الطقم الثاني', value: 'set2' },
                            { name: 'طقم بدون انتظار', value: 'set3' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('عرض الإعدادات الحالية')),
    new SlashCommandBuilder()
        .setName('reset')
        .setDescription('مسح كل الإعدادات'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('عرض كل الأوامر المتاحة'),
    // أوامر AI الجديدة
    new SlashCommandBuilder()
        .setName('ai')
        .setDescription('إعدادات المساعد الذكي')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('تفعيل/تعطيل المساعد الذكي')
                .addStringOption(option =>
                    option.setName('state')
                        .setDescription('حالة النظام')
                        .setRequired(true)
                        .addChoices(
                            { name: '✅ تفعيل المساعد الذكي', value: 'enable' },
                            { name: '❌ تعطيل المساعد الذكي', value: 'disable' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('اختبار المساعد الذكي')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('رسالة الاختبار')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('personality')
                .setDescription('تغيير شخصية المساعد')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('نوع الشخصية')
                        .setRequired(true)
                        .addChoices(
                            { name: '👧 سارة (مصرية)', value: 'default' },
                            { name: '👩‍💼 نور (احترافية)', value: 'professional' },
                            { name: '👸 ياسمين (خليجية)', value: 'friendly' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('حالة المساعد الذكي')),
    new SlashCommandBuilder()
        .setName('automatic')
        .setDescription('العودة للنظام التلقائي (إيقاف AI)')
].map(command => command.toJSON());

// تخزين البيانات
const activeCalls = new Map();
const voiceConnections = new Map();
const privateRooms = new Map();
const guildAudioIndex = new Map();
const aiSessions = new Map(); // جلسات AI جديدة

// دالة لاختيار مجموعة صوت
function getNextAudioSet(guildId) {
    const settings = getServerSettings(guildId);
    if (!settings || !settings.audioSetId) return audioSets[0];
    
    const audioSet = getAudioSetById(settings.audioSetId);
    
    if (!audioSet.waiting) {
        return audioSet;
    }
    
    if (!guildAudioIndex.has(guildId)) {
        guildAudioIndex.set(guildId, 0);
    }
    
    const availableSets = audioSets.filter(set => set.waiting);
    const index = guildAudioIndex.get(guildId) % availableSets.length;
    const selected = availableSets[index];
    guildAudioIndex.set(guildId, (index + 1) % availableSets.length);
    
    return selected;
}

// دالة لإنشاء اتصال صوتي
async function getOrCreateConnection(channel) {
    try {
        const guildId = channel.guild.id;
        
        if (voiceConnections.has(guildId)) {
            const conn = voiceConnections.get(guildId);
            try {
                if (conn && conn.state && conn.state.status !== VoiceConnectionStatus.Destroyed) {
                    return conn;
                }
            } catch (err) {}
        }

        console.log(`🔊 إنشاء اتصال صوتي جديد في ${channel.name}`);
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        voiceConnections.set(guildId, connection);
        return connection;
        
    } catch (error) {
        console.error('❌ خطأ في الاتصال الصوتي:', error);
        return null;
    }
}

// دالة تشغيل الصوت
function playAudio(connection, fileName, userId, shouldLoop = false, audioSet = null) {
    try {
        // إذا كان اسم الملف رابط URL (Google TTS)
        if (fileName.startsWith('http')) {
            console.log(`🔊 تشغيل TTS من URL`);
            
            // سيحتاج تنفيذ مختلف لتحميل URL
            // هذا مثال مبسط
            const resource = createAudioResource(fileName, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });

            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Stop
                }
            });

            player.play(resource);
            try { connection.subscribe(player); } catch (err) { console.warn('⚠️ فشل الاشتراك:', err.message); }
            
            return player;
        }
        
        // إذا كان ملف محلي
        const soundPath = path.join(__dirname, fileName);
        if (!fs.existsSync(soundPath)) {
            console.log(`❌ ملف ${fileName} مش موجود`);
            return null;
        }

        const input = fs.createReadStream(soundPath);
        const resource = createAudioResource(input, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });

        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        });

        player.play(resource);
        try { connection.subscribe(player); } catch (err) { console.warn('⚠️ فشل الاشتراك بالمشغل:', err.message); }

        if (shouldLoop) {
            player.on(AudioPlayerStatus.Idle, () => {
                if (activeCalls.has(userId)) {
                    const callData = activeCalls.get(userId);
                    if (!callData.isBotMuted && callData.audioSet) {
                        console.log(`🔄 تكرار موسيقى ${callData.audioSet.name} للعميل ${userId}`);
                        playAudio(connection, callData.audioSet.background, userId, true, callData.audioSet);
                    } else if (!callData || !callData.audioSet) {
                        playAudio(connection, fileName, userId, true, audioSet);
                    }
                }
            });
        }

        return player;

    } catch (error) {
        console.error(`❌ خطأ في تشغيل ${fileName}:`, error);
        return null;
    }
}

// دالة لوقف الصوت
function stopAllAudioForUser(userId) {
    const callData = activeCalls.get(userId);
    if (!callData) return;
    
    if (callData.musicPlayer) {
        callData.musicPlayer.stop();
    }
    if (callData.waitingPlayer) {
        callData.waitingPlayer.stop();
    }
}

// دالة لإنشاء روم صوتي خاص
async function createPrivateVoiceRoom(guild, settings, userId, clientName, adminId, adminName) {
    try {
        console.log(`🆕 إنشاء روم صوتي خاص للعميل ${clientName}`);
        
        let category;
        try {
            category = await guild.channels.fetch(settings.categoryId);
        } catch (error) {
            category = null;
        }
        
        const cleanClientName = clientName.replace(/[^\w\u0600-\u06FF]/g, '-').substring(0, 15);
        const roomNumber = Math.floor(Math.random() * 1000);
        
        const voiceChannel = await guild.channels.create({
            name: `Supp-${cleanClientName}-${roomNumber}`,
            type: ChannelType.GuildVoice,
            parent: category ? category.id : null,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
                },
                {
                    id: userId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
                },
                {
                    id: adminId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.MoveMembers]
                },
                {
                    id: settings.adminRoleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
                }
            ]
        });
        
        console.log(`✅ تم إنشاء الروم: ${voiceChannel.name}`);
        return voiceChannel;
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الروم الخاص:', error);
        return null;
    }
}

// دالة لنقل الأعضاء للروم الخاص
async function moveToPrivateRoom(guild, userId, adminId, privateRoomId) {
    try {
        console.log(`🚚 نقل الأعضاء للروم الخاص`);
        
        const privateRoom = await guild.channels.fetch(privateRoomId);
        if (!privateRoom) {
            throw new Error('❌ الروم الخاص مش موجود');
        }
        
        // نقل العميل
        const clientMember = await guild.members.fetch(userId);
        if (clientMember.voice.channel) {
            await clientMember.voice.setChannel(privateRoomId);
            console.log(`✅ تم نقل العميل ${clientMember.user.tag}`);
        }
        
        // نقل المشرف
        const adminMember = await guild.members.fetch(adminId);
        if (adminMember.voice.channel) {
            await adminMember.voice.setChannel(privateRoomId);
            console.log(`✅ تم نقل المشرف ${adminMember.user.tag}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في نقل الأعضاء:', error);
        return false;
    }
}

// دالة لحذف الروم الخاص
async function deletePrivateRoom(guild, roomId) {
    try {
        const room = await guild.channels.fetch(roomId);
        if (room) {
            await room.delete('انتهت المكالمة');
            console.log(`🗑️ تم حذف الروم الخاص: ${room.name}`);
            return true;
        }
    } catch (error) {
        return false;
    }
}

// دالة لإرسال إشعار طلب جديد
async function sendNewCallNotification(guild, settings, userId, userName) {
    try {
        const textChannel = await guild.channels.fetch(settings.textId);
        if (!textChannel) return;
        
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📞 طلب دعم صوتي جديد')
            .setDescription(`**يوجد عميل في انتظار الدعم**`)
            .addFields(
                { name: '👤 العميل', value: `${userName}\n<@${userId}>`, inline: true },
                { name: '🕐 الوقت', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
                { name: '📍 المكان', value: `<#${settings.voiceId}>`, inline: true }
            )
            .setFooter({ text: 'الرجاء التوجه للروم الصوتي لتولي الطلب' })
            .setTimestamp();
        
        await textChannel.send({
            content: `<@&${settings.adminRoleId}> 📢 عميل في انتظار الدعم!`,
            embeds: [embed]
        });
        
        console.log(`📤 تم إرسال إشعار طلب جديد للعميل ${userName}`);
        
    } catch (error) {
        console.error('❌ خطأ في إرسال إشعار الطلب:', error);
    }
}

// دالة لإرسال إشعار استلام الطلب
async function sendAdminAcceptNotification(guild, settings, userId, adminId, adminName, clientName) {
    try {
        const textChannel = await guild.channels.fetch(settings.textId);
        if (!textChannel) return;
        
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ تم استلام الطلب')
            .setDescription(`**تم تولي طلب الدعم بنجاح**`)
            .addFields(
                { name: '👤 العميل', value: `${clientName}\n<@${userId}>`, inline: true },
                { name: '👑 المشرف', value: `${adminName}\n<@${adminId}>`, inline: true },
                { name: '⏰ الوقت', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
            )
            .setTimestamp();
        
        await textChannel.send({ 
            content: `📢 **تم استلام الطلب**\nالمشرف <@${adminId}> استلم طلب <@${userId}>`,
            embeds: [embed] 
        });
        
        console.log(`📤 تم إرسال إشعار استلام الطلب`);
        
    } catch (error) {
        console.error('❌ خطأ في إرسال إشعار الاستلام:', error);
    }
}

// دالة للتحقق من وجود مشرف في الروم
function getAdminInVoice(channel, settings) {
    if (!channel || !settings || !settings.adminRoleId) return null;
    
    // فقط الرتبة المحددة في الإعدادات
    return channel.members.find(member => 
        member.roles.cache.has(settings.adminRoleId) && 
        !member.user.bot
    );
}

// دالة للتحقق من صلاحيات استخدام الأوامر
function canUseSetupCommands(member, guild, settings) {
    // 1. Owner للسيرفر
    if (guild.ownerId === member.id) return true;
    
    // 2. عنده Admin Permission
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    
    // 3. عنده الرتبة المحددة للإدارة (إذا تم إعدادها)
    if (settings?.adminRoleId && member.roles.cache.has(settings.adminRoleId)) return true;
    
    return false;
}

// دالة لتسجيل الـ Slash Commands
async function registerCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(config.token);
        
        console.log('🔄 جاري تسجيل الـ Slash Commands...');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        
        console.log('✅ تم تسجيل الـ Slash Commands بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في تسجيل الـ Slash Commands:', error);
    }
}

// ================ نظام AI Chatbot ================

// دالة لبدء محادثة AI
async function startAIConversation(guildId, userId, userName, connection) {
    try {
        console.log(`🤖 بدء محادثة AI مع ${userName}`);
        
        // حفظ جلسة AI
        aiSessions.set(userId, {
            guildId,
            userName,
            connection,
            startTime: Date.now(),
            messageCount: 0,
            personality: 'default'
        });
        
        // تشغيل صوت ترحيب AI
        playAudio(connection, 'ai_welcome.mp3', userId, false);
        
        // بعد 3 ثواني، البدء بمحادثة AI
        setTimeout(async () => {
            const session = aiSessions.get(userId);
            if (!session) return;
            
            try {
                // الحصول على رد من AI
                const response = await deepseekAI.getResponse(
                    userId,
                    "عميل جديد دخل روم الدعم ويريد المساعدة",
                    session.personality
                );
                
                console.log(`🤖 AI رد: ${response}`);
                
                // تحويل الرد لصوت وتشغيله (مؤقتاً نستخدم Google TTS)
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(response)}`;
                playAudio(connection, ttsUrl, userId, false);
                
                session.messageCount++;
                
            } catch (error) {
                console.error('❌ خطأ في AI:', error);
            }
        }, 3000);
        
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في بدء محادثة AI:', error);
        return false;
    }
}

// دالة لإيقاف محادثة AI
function stopAIConversation(userId) {
    if (aiSessions.has(userId)) {
        const session = aiSessions.get(userId);
        console.log(`🤖 إيقاف محادثة AI مع ${session.userName}`);
        aiSessions.delete(userId);
        
        // تشغيل صوت وداع
        if (session.connection) {
            playAudio(session.connection, 'ai_goodbye.mp3', userId, false);
        }
        
        return true;
    }
    return false;
}

// ================ نظام Control Panel للمالك ================

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // فقط المالك يستخدم Prefix Commands
    if (message.author.id !== BOT_OWNER_ID) return;
    
    // التحقق من البادئة
    if (!message.content.startsWith(OWNER_PREFIX)) return;
    
    const args = message.content.slice(OWNER_PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // أمر panel لعرض لوحة التحكم
    if (command === 'panel') {
        const panelEmbed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('👑 لوحة تحكم المالك - مع نظام AI')
            .setDescription(`**مرحباً ${message.author.username}**\nالبادئة: \`${OWNER_PREFIX}\``)
            .addFields(
                {
                    name: '🤖 **أوامر AI الجديدة**',
                    value: `\`/ai setup enable\` - تفعيل المساعد الذكي\n\`/ai setup disable\` - تعطيل المساعد\n\`/ai test\` - اختبار المساعد\n\`/automatic\` - العودة للنظام العادي`
                },
                {
                    name: '📊 **أوامر الإحصائيات**',
                    value: `\`${OWNER_PREFIX}stats\` - إحصائيات البوت\n\`${OWNER_PREFIX}servers [صفحة]\` - قائمة السيرفرات\n\`${OWNER_PREFIX}server <ID>\` - معلومات سيرفر محدد\n\`${OWNER_PREFIX}locklist\` - قائمة السيرفرات المقفلة`
                },
                {
                    name: '📢 **أوامر البث**',
                    value: `\`${OWNER_PREFIX}broadcast <رسالة>\` - إرسال للجميع\n\`${OWNER_PREFIX}dm <ID_السيرفر> <رسالة>\` - إرسال لمالك سيرفر`
                },
                {
                    name: '⚙️ **أوامر التحكم**',
                    value: `\`${OWNER_PREFIX}lock <ID_السيرفر>\` - قفل البوت في سيرفر محدد\n\`${OWNER_PREFIX}unlock <ID_السيرفر>\` - فتح البوت في سيرفر\n\`${OWNER_PREFIX}leave <ID_السيرفر>\` - طلع البوت\n\`${OWNER_PREFIX}clearsettings <ID_السيرفر>\` - مسح إعدادات\n\`${OWNER_PREFIX}clearownerdm\` - مسح الشات الخاص مع المالك`
                },
                {
                    name: '👑 **أوامر عامة**',
                    value: `\`${OWNER_PREFIX}panel\` - عرض هذه اللوحة\n\`${OWNER_PREFIX}help\` - المساعدة`
                }
            )
            .setFooter({ text: `ID المالك: ${BOT_OWNER_ID} | ${client.guilds.cache.size} سيرفر | AI Sessions: ${aiSessions.size}` })
            .setTimestamp();
        
        await message.reply({ embeds: [panelEmbed] });
        return;
    }
    
    // أمر stats معدل مع AI
    if (command === 'stats') {
        const totalServers = client.guilds.cache.size;
        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalActiveCalls = activeCalls.size;
        const totalPrivateRooms = privateRooms.size;
        const completedSetups = client.guilds.cache.filter(g => isServerSetupComplete(g.id)).size;
        
        // السيرفرات المقفلة
        const lockedServers = serverSettings.lockedServers || [];
        const allLockedCount = lockedServers.length;
        const activeLocked = lockedServers.filter(id => client.guilds.cache.has(id)).length;
        
        // إحصائيات AI
        const aiStats = deepseekAI.getStats();
        
        const statsEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📊 إحصائيات البوت مع AI')
            .addFields(
                { name: '🏠 السيرفرات', value: `\`${totalServers}\` سيرفر`, inline: true },
                { name: '👥 الأعضاء', value: `\`${totalMembers.toLocaleString()}\` عضو`, inline: true },
                { name: '✅ الإعدادات المكتملة', value: `\`${completedSetups}\` سيرفر`, inline: true },
                { name: '📞 المكالمات النشطة', value: `\`${totalActiveCalls}\` مكالمة`, inline: true },
                { name: '🤖 جلسات AI', value: `\`${aiSessions.size}\` جلسة`, inline: true },
                { name: '🔒 الرومات الخاصة', value: `\`${totalPrivateRooms}\` روم`, inline: true },
                { name: '🚫 السيرفرات المقفلة', value: `\`${allLockedCount}\` سيرفر (${activeLocked} موجودة)`, inline: true },
                { name: '🔌 حالة AI', value: aiStats.apiStatus, inline: true },
                { name: '🟢 وقت التشغيل', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
            )
            .setFooter({ text: `مالك البوت: ${message.author.tag}` })
            .setTimestamp();
        
        await message.reply({ embeds: [statsEmbed] });
        return;
    }
    
    // أوامر أخرى للمالك
    if (command === 'servers') {
        const page = parseInt(args[0]) || 1;
        const guilds = Array.from(client.guilds.cache.values());
        const pageSize = 10;
        const totalPages = Math.ceil(guilds.length / pageSize);
        
        if (page > totalPages || page < 1) {
            return message.reply(`❌ الصفحة غير موجودة. الإجمالي: ${totalPages}`);
        }
        
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageGuilds = guilds.slice(start, end);
        
        const serversEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`📊 قائمة السيرفرات (${page}/${totalPages})`)
            .setDescription(pageGuilds.map((g, i) => {
                const settings = getServerSettings(g.id);
                const status = isServerSetupComplete(g.id) ? '✅' : '❌';
                return `${i + 1}. ${status} **${g.name}** \n   ID: \`${g.id}\` | أعضاء: ${g.memberCount}`;
            }).join('\n'))
            .setFooter({ text: `هذه صفحة ${page} من ${totalPages}` })
            .setTimestamp();
        
        return message.reply({ embeds: [serversEmbed] });
    }
    
    if (command === 'leave') {
        const serverId = args[0];
        if (!serverId) return message.reply('❌ استخدم: `!leave <server_id>`');
        
        try {
            const guild = await client.guilds.fetch(serverId);
            await guild.leave();
            message.reply(`✅ تم الخروج من السيرفر: ${guild.name}`);
        } catch (error) {
            message.reply(`❌ خطأ: ${error.message}`);
        }
        return;
    }
    
    if (command === 'lock') {
        const serverId = args[0];
        if (!serverId) return message.reply('❌ استخدم: `!lock <server_id>`');
        
        if (!serverSettings.lockedServers) serverSettings.lockedServers = [];
        if (!serverSettings.lockedServers.includes(serverId)) {
            serverSettings.lockedServers.push(serverId);
            saveSettings(serverSettings);
            message.reply(`🔒 تم قفل السيرفر: ${serverId}`);
        } else {
            message.reply(`⚠️ السيرفر مقفول بالفعل`);
        }
        return;
    }
    
    if (command === 'unlock') {
        const serverId = args[0];
        if (!serverId) return message.reply('❌ استخدم: `!unlock <server_id>`');
        
        if (!serverSettings.lockedServers) serverSettings.lockedServers = [];
        const index = serverSettings.lockedServers.indexOf(serverId);
        if (index > -1) {
            serverSettings.lockedServers.splice(index, 1);
            saveSettings(serverSettings);
            message.reply(`🔓 تم فتح السيرفر: ${serverId}`);
        } else {
            message.reply(`⚠️ السيرفر غير مقفول`);
        }
        return;
    }
});

// ================ نظام Slash Commands مع AI ================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    const { commandName, options, guild, member, user } = interaction;
    
    // التحقق إذا السيرفر مقفل
    const lockedServers = serverSettings.lockedServers || [];
    if (lockedServers.includes(guild.id)) {
        return interaction.reply({ 
            content: '❌ **يجب تجديد الاشتراك :<**\n\nموقع تجديد الاشتراك: [ https://siennaai.pages.dev/ ]',
            ephemeral: true 
        });
    }
    
    // الحصول على إعدادات السيرفر
    let settings = getServerSettings(guild.id);
    if (!settings) {
        settings = {
            audioSetId: 'set1',
            aiEnabled: false,
            aiPersonality: 'default'
        };
        serverSettings[guild.id] = settings;
    }
    
    // التحقق من الصلاحيات
    if (!canUseSetupCommands(member, guild, settings)) {
        return interaction.reply({ 
            content: '❌ **ليس لديك الصلاحية لاستخدام هذه الأوامر!**\n\nفقط مالك السيرفر والمشرفون يمكنهم استخدام أوامر الإعداد.',
            ephemeral: true 
        });
    }
    
    // أمر المساعدة المعدل
    if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🆘 مركز المساعدة - بوت الدعم الصوتي مع AI')
            .setDescription('**قائمة الأوامر المتاحة للإدارة**\n\n**📍 استخدم `/` ثم اكتب اسم الأمر**')
            .addFields(
                { 
                    name: '🤖 **أوامر المساعد الذكي AI**', 
                    value: `
**\`/ai setup\`**
• تفعيل/تعطيل المساعد الذكي
• **الهدف:** سارة تساعد العملاء تلقائياً

**\`/ai test\`**
• اختبار المساعد الذكي
• **الهدف:** تأكد أن AI شغال

**\`/ai personality\`**
• تغيير شخصية المساعد
• **سارة:** مصرية مرحة
• **نور:** احترافية فصحى
• **ياسمين:** خليجية ودودة

**\`/automatic\`**
• العودة للنظام العادي
• **الهدف:** إيقاف AI والعودة للوضع الأصلي
                    `
                },
                { 
                    name: '📝 **الخطوة الأولى: الإعداد الإجباري**', 
                    value: `
1️⃣ **\`/setup category\`**
2️⃣ **\`/setup voice\`**
3️⃣ **\`/setup text\`**
4️⃣ **\`/setup role\`**
                    `
                },
                { 
                    name: '🎵 **إعدادات الصوت**', 
                    value: `
**\`/setup waiting\`**
• اختيار مجموعة الصوت
                    `
                },
                { 
                    name: '👁️ **أوامر العرض والتحكم**', 
                    value: `
**\`/setup show\`**
• عرض الإعدادات الحالية

**\`/reset\`**
• مسح كل الإعدادات

**\`/help\`**
• عرض هذه القائمة
                    `
                }
            )
            .addFields(
                {
                    name: '⚠️ **ملاحظات هامة**',
                    value: `
1. **AI يعمل مع نظام الانتظار**
2. **عند دخول عميل:** سارة تترحب وترد عليه
3. **إذا احتاج مشرف:** يتم إرسال إشعار
4. **لإيقاف AI:** استخدم \`/automatic\`
                    `
                }
            )
            .setFooter({ 
                text: `السيرفر: ${guild.name} | AI: ${settings.aiEnabled ? '✅ مفعل' : '❌ معطل'}` 
            })
            .setTimestamp();
        
        return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
    
    // أمر AI الجديد
    if (commandName === 'ai') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'setup') {
            const state = options.getString('state');
            settings.aiEnabled = state === 'enable';
            serverSettings[guild.id] = settings;
            saveSettings(serverSettings);
            
            const embed = new EmbedBuilder()
                .setColor(settings.aiEnabled ? 0x2ecc71 : 0xe74c3c)
                .setTitle(settings.aiEnabled ? '✅ تم تفعيل المساعد الذكي!' : '❌ تم تعطيل المساعد الذكي')
                .setDescription(settings.aiEnabled 
                    ? `**سارة جاهزة الآن للرد على العملاء!**\n\nعند دخول أي عميل لروم الانتظار، سارة ستترحب به وترد على أسئلته تلقائياً.\n\n**مميزات سارة:**\n• 🎤 صوت أنثوي مصري\n• 🤖 ذكاء اصطناعي متقدم\n• ⚡ ردود فورية\n• 😊 ودودة ومرحة`
                    : 'تم تعطيل المساعد الذكي، النظام يعمل بالوضع العادي.')
                .addFields({
                    name: '⚙️ الإعدادات',
                    value: `• **الحالة:** ${settings.aiEnabled ? 'نشط' : 'غير نشط'}\n` +
                           `• **الاسم:** ${settings.aiPersonality === 'default' ? 'سارة' : settings.aiPersonality === 'professional' ? 'نور' : 'ياسمين'}\n` +
                           `• **الشخصية:** ${settings.aiPersonality === 'default' ? 'مصرية مرحة' : settings.aiPersonality === 'professional' ? 'احترافية' : 'خليجية ودودة'}\n` +
                           `• **النظام:** DeepSeek AI`
                })
                .setFooter({ text: settings.aiEnabled ? 'استخدم /ai test للتجربة' : 'استخدم /ai setup enable للتفعيل' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (subcommand === 'test') {
            await interaction.deferReply({ ephemeral: true });
            
            const testMessage = options.getString('message') || 'مرحباً، هل يمكنك مساعدتي؟';
            
            try {
                const response = await deepseekAI.getResponse(
                    user.id,
                    testMessage,
                    settings.aiPersonality || 'default'
                );
                
                const personalityName = settings.aiPersonality === 'default' ? 'سارة' : 
                                     settings.aiPersonality === 'professional' ? 'نور' : 'ياسمين';
                
                const embed = new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle(`🤖 اختبار المساعد الذكي (${personalityName})`)
                    .setDescription('**نتيجة الاختبار:**')
                    .addFields(
                        { name: '🧪 **طلبت:**', value: testMessage, inline: false },
                        { name: `🎤 **${personalityName} ردت:**`, value: response, inline: false }
                    )
                    .addFields({
                        name: '📊 **حالة AI:**',
                        value: `• **النظام:** DeepSeek\n• **الشخصية:** ${personalityName}\n• **الحالة:** ✅ يعمل بشكل ممتاز`,
                        inline: false
                    })
                    .setFooter({ text: 'المساعد جاهز للعمل مع العملاء!' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('❌ فشل اختبار AI')
                            .setDescription(`**حدث خطأ:**\n\`${error.message}\``)
                            .setFooter({ text: 'تحقق من اتصال الإنترنت أو حاول لاحقاً' })
                    ]
                });
            }
            return;
        }
        
        else if (subcommand === 'personality') {
            const personality = options.getString('type');
            
            const personalities = {
                'default': { name: 'سارة', desc: 'مصرية مرحة' },
                'professional': { name: 'نور', desc: 'احترافية فصحى' },
                'friendly': { name: 'ياسمين', desc: 'خليجية ودودة' }
            };
            
            settings.aiPersonality = personality;
            serverSettings[guild.id] = settings;
            saveSettings(serverSettings);
            
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('🎭 تم تغيير شخصية المساعد!')
                .setDescription(`**المساعد الجديد:** ${personalities[personality].name}`)
                .addFields(
                    { name: '👤 **الاسم:**', value: personalities[personality].name, inline: true },
                    { name: '🎭 **الشخصية:**', value: personalities[personality].desc, inline: true },
                    { name: '🗣️ **اللهجة:**', value: personality === 'default' ? 'مصرية' : personality === 'professional' ? 'فصحى' : 'خليجية', inline: true }
                )
                .setFooter({ text: 'التغيير ساري المفعول على المحادثات الجديدة' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (subcommand === 'status') {
            const aiStats = deepseekAI.getStats();
            const activeAICount = Array.from(aiSessions.values()).filter(s => s.guildId === guild.id).length;
            
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📊 حالة المساعد الذكي')
                .addFields(
                    { name: '🔌 **حالة الاتصال:**', value: aiStats.apiStatus, inline: true },
                    { name: '🤖 **الشخصية:**', value: settings.aiPersonality === 'default' ? 'سارة' : settings.aiPersonality === 'professional' ? 'نور' : 'ياسمين', inline: true },
                    { name: '📈 **المحادثات النشطة:**', value: `${activeAICount}`, inline: true },
                    { name: '🎯 **حالة النظام:**', value: settings.aiEnabled ? '✅ مفعل' : '❌ معطل', inline: true },
                    { name: '💾 **المحادثات المخزنة:**', value: `${aiStats.totalConversations}`, inline: true },
                    { name: '⚡ **الاستجابة:**', value: 'جيدة', inline: true }
                )
                .setFooter({ text: 'DeepSeek AI | نظام دعم ذكي' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        return;
    }
    
    // أمر Automatic للعودة للنظام العادي
    if (commandName === 'automatic') {
        settings.aiEnabled = false;
        serverSettings[guild.id] = settings;
        saveSettings(serverSettings);
        
        // إيقاف كل جلسات AI في هذا السيرفر
        for (const [userId, session] of aiSessions.entries()) {
            if (session.guildId === guild.id) {
                stopAIConversation(userId);
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('🔄 العودة للنظام التلقائي')
            .setDescription('**تم إيقاف المساعد الذكي والعودة للنظام الأصلي**')
            .addFields({
                name: '📋 **طريقة العمل الجديدة:**',
                value: `
1. العميل يدخل روم الانتظار
2. البوت يشغل موسيقى انتظار
3. يرسل إشعار في روم الإشعارات
4. المشرف يدخل روم الانتظار
5. ينشئ البوت روم خاص وينقل الجميع إليه
                `
            })
            .setFooter({ text: 'استخدم /ai setup enable للعودة لنظام AI' })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // أوامر setup المختلفة
    if (commandName === 'setup') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'category') {
            const categoryId = options.getString('id');
            settings.categoryId = categoryId;
            serverSettings[guild.id] = settings;
            saveSettings(serverSettings);
            
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ تم تعيين التصنيف')
                .setDescription(`تم تعيين التصنيف: \`${categoryId}\``)
                .setFooter({ text: 'الخطوة التالية: /setup voice' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (subcommand === 'voice') {
            const voiceId = options.getString('id');
            settings.voiceId = voiceId;
            serverSettings[guild.id] = settings;
            saveSettings(serverSettings);
            
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ تم تعيين روم الصوت')
                .setDescription(`تم تعيين روم الانتظار: \`${voiceId}\``)
                .setFooter({ text: 'الخطوة التالية: /setup text' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (subcommand === 'text') {
            const textId = options.getString('id');
            settings.textId = textId;
            serverSettings[guild.id] = settings;
            saveSettings(serverSettings);
            
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ تم تعيين روم النص')
                .setDescription(`تم تعيين روم الإشعارات: \`${textId}\``)
                .setFooter({ text: 'الخطوة التالية: /setup role' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (subcommand === 'role') {
            const roleId = options.getString('id');
            settings.adminRoleId = roleId;
            serverSettings[guild.id] = settings;
            saveSettings(serverSettings);
            
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ تم تعيين الرتبة')
                .setDescription(`تم تعيين رتبة الإدارة: \`${roleId}\``)
                .addFields({
                    name: '🎉 إعدادات مكتملة!',
                    value: 'البوت جاهز للعمل الآن\nاستخدم `/setup show` لعرض الإعدادات'
                })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (subcommand === 'waiting') {
            const audioSet = options.getString('set');
            settings.audioSetId = audioSet;
            serverSettings[guild.id] = settings;
            saveSettings(serverSettings);
            
            const audioSetDetails = getAudioSetById(audioSet);
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ تم اختيار مجموعة الصوت')
                .setDescription(`**${audioSetDetails.name}**`)
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (subcommand === 'show') {
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setDescription(formatSettings(guild, settings));
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        return;
    }
    
    // أمر Reset
    if (commandName === 'reset') {
        delete serverSettings[guild.id];
        saveSettings(serverSettings);
        
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🗑️ تم مسح الإعدادات')
            .setDescription('تم حذف جميع الإعدادات. استخدم `/setup` مرة أخرى للإعداد الجديد')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ================ نظام الصوت الأساسي مع AI ================

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const member = newState.member;
        if (!member || member.user.bot) return;
        
        const guildId = newState.guild.id;
        const settings = getServerSettings(guildId);
        
        // إذا النظام غير مكتمل، تجاهل
        if (!isServerSetupComplete(guildId)) {
            return;
        }
        
        const supportVoiceId = settings.voiceId;
        const supportTextId = settings.textId;
        const supportCategoryId = settings.categoryId;
        const adminRoleId = settings.adminRoleId;
        
        const voiceChannel = newState.channel;
        
        // دخول روم الانتظار
        if (newState.channelId === supportVoiceId && newState.channelId !== oldState.channelId) {
            // لو دخل شخص معاه الرتبة المحددة
            if (member.roles.cache.has(adminRoleId)) {
                console.log(`👑 ${member.user.tag} (إدارة) دخل روم الانتظار`);
                
                // إذا كان هناك جلسات AI، توقفها
                const clientsInRoom = voiceChannel.members.filter(m => 
                    !m.user.bot && !m.roles.cache.has(adminRoleId)
                );
                
                for (const clientMember of clientsInRoom.values()) {
                    stopAIConversation(clientMember.id);
                }
                
                // تفعيل إشعار تولي الطلب للمشرفين الآخرين
                const staffMembers = voiceChannel.members.filter(m => 
                    !m.user.bot && m.roles.cache.has(adminRoleId) && m.id !== member.id
                );
                
                if (staffMembers.size > 0) {
                    console.log(`✅ استقبال الطلب بنجاح بواسطة ${member.user.tag}`);
                }
                return;
            }
            
            // دخول عميل عادي لروم الانتظار
            console.log(`👤 ${member.user.tag} دخل روم الانتظار`);
            
            if (!voiceChannel) return;
            
            // التحقق إذا فيه مشرف موجود
            const existingAdmin = getAdminInVoice(voiceChannel, settings);
            
            // إذا فيه مشرف موجود، نبدأ عملية إنشاء روم خاص فوراً
            if (existingAdmin) {
                console.log(`⚡ العميل ${member.user.tag} دخل ومشرف موجود بالفعل`);
                
                // إيقاف أي جلسة AI لهذا العميل
                stopAIConversation(member.id);
                
                // تحضير إنشاء الروم الخاص
                const privateRoom = await createPrivateVoiceRoom(
                    guild, 
                    settings, 
                    member.id, 
                    member.user.username, 
                    existingAdmin.id,
                    existingAdmin.user.username
                );
                
                if (privateRoom) {
                    // إشعار استقبال الطلب
                    await sendAdminAcceptNotification(
                        guild, 
                        settings, 
                        member.id, 
                        existingAdmin.id, 
                        existingAdmin.user.username,
                        member.user.username
                    );
                    
                    // نقل الأعضاء للروم الخاص
                    setTimeout(() => {
                        moveToPrivateRoom(guild, member.id, existingAdmin.id, privateRoom.id);
                    }, 1000);
                    
                    // حفظ معلومات الروم الخاص
                    privateRooms.set(privateRoom.id, {
                        guildId: guild.id,
                        clientId: member.id,
                        adminId: existingAdmin.id,
                        createdAt: Date.now(),
                        endTime: null
                    });
                }
                return;
            }
            
            // ========== نظام AI الجديد ==========
            if (settings.aiEnabled) {
                console.log(`🤖 بدء محادثة AI مع ${member.user.tag}`);
                
                // 1. البوت يدخل مع العميل
                const connection = await getOrCreateConnection(voiceChannel);
                if (!connection) {
                    console.error('❌ فشل الاتصال الصوتي');
                    return;
                }
                
                // 2. بدء محادثة AI
                await startAIConversation(guildId, member.id, member.user.tag, connection);
                
                // 3. إرسال إشعار أن AI يبدأ العمل
                try {
                    const textChannel = await voiceChannel.guild.channels.fetch(supportTextId);
                    if (textChannel) {
                        const aiEmbed = new EmbedBuilder()
                            .setColor(0x9b59b6)
                            .setTitle('🤖 بدأت المحادثة مع المساعد الذكي')
                            .setDescription(`**سارة تبدأ محادثة مع عميل جديد**`)
                            .addFields(
                                { name: '👤 العميل', value: `${member.user.tag}\n<@${member.id}>`, inline: true },
                                { name: '📍 المكان', value: `<#${supportVoiceId}>`, inline: true },
                                { name: '🤖 المساعد', value: settings.aiPersonality === 'default' ? 'سارة' : settings.aiPersonality === 'professional' ? 'نور' : 'ياسمين', inline: true }
                            )
                            .setFooter({ text: 'المساعد الذكي يجيب على استفسارات العميل' })
                            .setTimestamp();
                        
                        await textChannel.send({ 
                            content: `<@&${adminRoleId}> 🤖 بدأت محادثة AI مع عميل`,
                            embeds: [aiEmbed] 
                        });
                    }
                } catch (error) {
                    console.error('❌ خطأ في إرسال إشعار AI:', error);
                }
                
                return;
            }
            // ========== نهاية نظام AI ==========
            
            // إذا AI معطل، نستخدم النظام القديم
            console.log(`⏳ تشغيل موسيقى الانتظار للعميل ${member.user.tag}`);
            
            // البوت يدخل روم الصوت
            const connection = await getOrCreateConnection(voiceChannel);
            if (!connection) {
                console.error('❌ فشل الاتصال الصوتي');
                return;
            }
            
            // تشغيل موسيقى الانتظار
            const audioSet = getNextAudioSet(guild.id);
            const waitingPlayer = playAudio(connection, audioSet.waiting || audioSet.background, member.id, true, audioSet);
            
            // تخزين بيانات المكالمة
            activeCalls.set(member.id, {
                memberId: member.id,
                userName: member.user.tag,
                joinedAt: Date.now(),
                guildId: guild.id,
                voiceChannelId: voiceChannel.id,
                waitingPlayer: waitingPlayer,
                musicPlayer: null,
                isBotMuted: false,
                audioSet: audioSet
            });
            
            // إرسال إشعار الطلب الجديد
            await sendNewCallNotification(guild, settings, member.id, member.user.tag);
            
            return;
        }
        
        // خروج من روم الانتظار
        if (oldState.channelId && newState.channelId !== oldState.channelId) {
            const memberId = member.id;
            
            // إذا كان روم الانتظار
            if (oldState.channelId === supportVoiceId) {
                // إيقاف جلسة AI إذا كانت موجودة
                if (aiSessions.has(memberId)) {
                    stopAIConversation(memberId);
                }
                
                // إيقاف الأصوات الجارية
                stopAllAudioForUser(memberId);
                
                // حذف بيانات المكالمة
                activeCalls.delete(memberId);
                
                console.log(`👤 غادر ${member.user.tag} من روم الانتظار`);
            }
            
            // إذا كان روم خاص
            const privateRoomEntry = Array.from(privateRooms.entries()).find(
                entry => entry[0] === oldState.channelId
            );
            
            if (privateRoomEntry) {
                const [roomId, roomData] = privateRoomEntry;
                
                // إذا غادر الاثنين معاً، احذف الروم
                const roomMembers = await guild.channels.cache.get(roomId)?.members;
                if (!roomMembers || roomMembers.size === 0) {
                    await deletePrivateRoom(guild, roomId);
                    privateRooms.delete(roomId);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ خطأ في voiceStateUpdate:', error);
    }
});

// ================ حدث البوت جاهز ================

client.on('ready', async () => {
    console.log(`✅ البوت جاهز! ${client.user.tag}`);
    console.log(`🏠 البوت موجود في ${client.guilds.cache.size} سيرفر`);
    
    // تسجيل الأوامر
    await registerCommands();
});

// ... باقي الكود كما هو (الأحداث الأخرى) ...

// تسجيل الدخول
if (!config.token) {
    console.error('❌ المتغير البيئي DISCORD_TOKEN غير معبأ. أضف التوكن ثم أعد التشغيل.');
    process.exit(1);
}

console.log('🚀 بدء تشغيل البوت مع نظام AI...');
console.log('🤖 DeepSeek API:', deepseekAI.getStats().apiStatus);

client.login(config.token).catch(err => console.error('❌ فشل تسجيل الدخول:', err));

// معالجة الأخطاء
process.on('unhandledRejection', error => {
    console.error('❌ خطأ غير معالج:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ استثناء غير معالج:', error);
});

// تنظيف الاتصالات عند إيقاف العملية
process.on('SIGINT', async () => {
    console.log('🛑 إغلاق - تنظيف الاتصالات الصوتية وجلسات AI');
    
    // إيقاف كل جلسات AI
    aiSessions.clear();
    
    // تنظيف الاتصالات الصوتية
    for (const [guildId, conn] of voiceConnections.entries()) {
        try { conn.destroy(); } catch (e) {}
        voiceConnections.delete(guildId);
    }
    
    console.log('✅ تم التنظيف بنجاح');
    process.exit(0);
});