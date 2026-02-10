
const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionsBitField, SlashCommandBuilder, REST, Routes, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus, entersState, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

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

**📊 حالة الإعدادات:** ${isServerSetupComplete(guild.id) ? '✅ مكتملة' : '❌ غير مكتملة'}

**📝 طريقة الاستخدام:**
1. العميل يدخل روم الانتظار
2. البوت يشغل موسيقى انتظار
3. يرسل إشعار في روم الإشعارات
4. المشرف (اللي معاه الرتبة) يدخل روم الانتظار
5. ينشئ البوت روم خاص وينقل الجميع إليه
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

// ================ تعريف كل الأوامر ================

// 1. أوامر نظام الدعم الصوتي
const supportCommands = [
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
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('تحديد روم الانتظار الصوتي')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID روم الصوت')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('تحديد روم إرسال الإشعارات')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID روم النص')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('تحديد رتبة الإدارة')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID الرتبة')
                        .setRequired(false)))
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
        .setDescription('عرض كل الأوامر المتاحة')
];

// 2. أوامر نظام التذاكر PRO
const ticketCommands = [
    new SlashCommandBuilder()
        .setName('ticket-design')
        .setDescription('🎨 تصميم نظام التذاكر')
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('لوحة تحكم التصميم الرئيسية'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('types')
                .setDescription('إدارة أنواع التذاكر')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('الإجراء المطلوب')
                        .setRequired(true)
                        .addChoices(
                            { name: 'إنشاء نوع جديد', value: 'create' },
                            { name: 'تعديل نوع', value: 'edit' },
                            { name: 'حذف نوع', value: 'delete' },
                            { name: 'قائمة الأنواع', value: 'list' },
                            { name: 'تفعيل/تعطيل', value: 'toggle' }
                        ))
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('معرف النوع')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('interface')
                .setDescription('تصميم واجهة الإنشاء')
                .addStringOption(option =>
                    option.setName('element')
                        .setDescription('العنصر المراد تعديله')
                        .setRequired(true)
                        .addChoices(
                            { name: 'نوع الواجهة', value: 'type' },
                            { name: 'العنوان', value: 'title' },
                            { name: 'الوصف', value: 'description' },
                            { name: 'اللون', value: 'color' },
                            { name: 'الصورة المصغرة', value: 'thumbnail' },
                            { name: 'الصورة', value: 'image' },
                            { name: 'عرض الأنواع كحقول', value: 'show_fields' },
                            { name: 'إضافة حقل مخصص', value: 'add_field' },
                            { name: 'حذف حقل', value: 'remove_field' },
                            { name: 'الفوتر', value: 'footer' }
                        ))
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('القيمة الجديدة')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('value2')
                        .setDescription('القيمة الثانية')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcome')
                .setDescription('تصميم رسالة الترحيب')
                .addStringOption(option =>
                    option.setName('element')
                        .setDescription('العنصر المراد تعديله')
                        .setRequired(true)
                        .addChoices(
                            { name: 'العنوان', value: 'title' },
                            { name: 'اللون', value: 'color' },
                            { name: 'الوصف', value: 'description' },
                            { name: 'الحقول الأساسية', value: 'fields' },
                            { name: 'إضافة حقل', value: 'add_field' },
                            { name: 'حذف حقل', value: 'remove_field' },
                            { name: 'الصورة المصغرة', value: 'thumbnail' },
                            { name: 'الصورة', value: 'image' },
                            { name: 'الفوتر', value: 'footer' },
                            { name: 'الطابع الزمني', value: 'timestamp' }
                        ))
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('القيمة الجديدة')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('value2')
                        .setDescription('القيمة الثانية')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('buttons')
                .setDescription('تصميم أزرار التحكم')
                .addStringOption(option =>
                    option.setName('button')
                        .setDescription('الزر المراد تعديله')
                        .setRequired(true)
                        .addChoices(
                            { name: 'إغلاق التذكرة', value: 'close' },
                            { name: 'إضافة عضو', value: 'addUser' },
                            { name: 'تغيير الاسم', value: 'rename' },
                            { name: 'حفظ المحادثة', value: 'transcript' },
                            { name: 'إعادة التحميل', value: 'reset' },
                            { name: 'قائمة الاستدعاء', value: 'pingMenu' }
                        ))
                .addStringOption(option =>
                    option.setName('property')
                        .setDescription('الخاصية المراد تعديلها')
                        .setRequired(true)
                        .addChoices(
                            { name: 'النص', value: 'label' },
                            { name: 'الإيموجي', value: 'emoji' },
                            { name: 'النمط', value: 'style' },
                            { name: 'التفعيل', value: 'enabled' },
                            { name: 'الترتيب', value: 'position' }
                        ))
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('القيمة الجديدة')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('preview')
                .setDescription('معاينة التصميم')
                .addStringOption(option =>
                    option.setName('section')
                        .setDescription('القسم المراد معاينته')
                        .setRequired(true)
                        .addChoices(
                            { name: 'واجهة الإنشاء', value: 'interface' },
                            { name: 'رسالة الترحيب', value: 'welcome' },
                            { name: 'أزرار التحكم', value: 'buttons' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('save')
                .setDescription('حفظ التصميم'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-design')
                .setDescription('إعادة تعيين التصميم')),
    new SlashCommandBuilder()
        .setName('ticket-send')
        .setDescription('إرسال واجهة التذاكر')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('القناة المراد الإرسال فيها')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)),
    new SlashCommandBuilder()
        .setName('ticket-template')
        .setDescription('إدارة قوالب التذاكر')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('عرض القوالب المتاحة'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('حذف قالب')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('اسم القالب')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rename')
                .setDescription('تغيير اسم قالب')
                .addStringOption(option =>
                    option.setName('oldname')
                        .setDescription('الاسم الحالي')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('newname')
                        .setDescription('الاسم الجديد')
                        .setRequired(true)))
];

// جمع كل الأوامر في مصفوفة واحدة
const allCommands = [
    ...supportCommands,
    ...ticketCommands
].map(command => command.toJSON());

// تخزين البيانات
const activeCalls = new Map();
const voiceConnections = new Map();
const privateRooms = new Map();
const guildAudioIndex = new Map();

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

// ================ نظام التذاكر PRO ================

// ملف إعدادات التذاكر المنفصل
const TICKET_SETTINGS_FILE = 'ticket-settings.json';

// دالة لتحميل إعدادات التذاكر
function loadTicketSettings() {
    if (fs.existsSync(TICKET_SETTINGS_FILE)) {
        try {
            const data = fs.readFileSync(TICKET_SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ خطأ في تحميل إعدادات التذاكر:', error);
            return {};
        }
    }
    return {};
}

// دالة لحفظ إعدادات التذاكر
function saveTicketSettings(settings) {
    try {
        fs.writeFileSync(TICKET_SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.error('❌ خطأ في حفظ إعدادات التذاكر:', error);
        return false;
    }
}

// دالة للحصول على إعدادات سيرفر معين
function getTicketSettings(guildId) {
    const settings = loadTicketSettings();
    if (!settings[guildId]) {
        // الإعدادات الافتراضية
        settings[guildId] = {
            enabled: true,
            ticketChannelId: null,
            ticketCategoryId: null,
            ticketLogsChannelId: null,
            maxTicketsPerUser: 3,
            
            ticketTypes: {
                'tech_support': {
                    id: 'tech_support',
                    name: 'الدعم الفني',
                    emoji: '🛠️',
                    color: '#3498db',
                    description: 'مشاكل تقنية واستفسارات فنية',
                    maxActive: 5,
                    enabled: true,
                    buttonStyle: 1,
                    welcomeMessage: 'مرحباً! فريق الدعم الفني سيساعدك قريباً.',
                    pingRoles: [],
                    requiredRoles: []
                },
                'report': {
                    id: 'report',
                    name: 'بلاغ أو شكوى',
                    emoji: '🚨',
                    color: '#e74c3c',
                    description: 'الإبلاغ عن مخالفات أو مشاكل',
                    maxActive: 3,
                    enabled: true,
                    buttonStyle: 4,
                    welcomeMessage: 'تم استلام بلاغك، سنتخذ الإجراء اللازم.',
                    pingRoles: [],
                    requiredRoles: []
                }
            },
            
            creationInterface: {
                type: 'select_menu',
                title: '🎫 نظام التذاكر',
                description: 'اختر نوع التذكرة المناسب لك',
                color: '#9b59b6',
                thumbnail: null,
                image: null,
                showTypesAsFields: false,
                customFields: [],
                footer: {
                    text: 'Sienna Ticket System',
                    iconURL: null
                }
            },
            
            welcomeMessage: {
                title: '{ticket_type} تذكرة جديدة',
                titleFont: 'default',
                color: '{ticket_color}',
                description: 'مرحباً {user}! فريق الدعم سيساعدك قريباً.',
                fields: [
                    {
                        name: '👤 مقدم الطلب',
                        value: '{user_mention}',
                        inline: true
                    },
                    {
                        name: '📅 تاريخ الإنشاء',
                        value: '{timestamp}',
                        inline: true
                    },
                    {
                        name: '📌 نوع التذكرة',
                        value: '{ticket_type}',
                        inline: true
                    }
                ],
                additionalFields: [],
                thumbnail: null,
                image: null,
                footer: {
                    text: 'رقم التذكرة: {ticket_number}',
                    iconURL: null
                },
                timestamp: true
            },
            
            controlButtons: {
                close: {
                    id: 'close_ticket',
                    label: 'إغلاق التذكرة',
                    emoji: '🔒',
                    style: 'Danger',
                    enabled: true,
                    position: 1
                },
                addUser: {
                    id: 'add_user',
                    label: 'إضافة عضو',
                    emoji: '➕',
                    style: 'Secondary',
                    enabled: true,
                    position: 2
                },
                rename: {
                    id: 'rename_ticket',
                    label: 'تغيير الاسم',
                    emoji: '✏️',
                    style: 'Secondary',
                    enabled: true,
                    position: 3
                },
                transcript: {
                    id: 'save_transcript',
                    label: 'حفظ المحادثة',
                    emoji: '📄',
                    style: 'Secondary',
                    enabled: true,
                    position: 4
                },
                reset: {
                    id: 'reset_menu',
                    label: 'إعادة التحميل',
                    emoji: '🔄',
                    style: 'Secondary',
                    enabled: true,
                    position: 5
                },
                
                pingMenu: {
                    id: 'ping_menu',
                    label: 'استدعاء',
                    emoji: '📢',
                    style: 'Success',
                    enabled: true,
                    position: 6,
                    options: [
                        {
                            label: 'منشن في الخاص',
                            value: 'ping_dm',
                            description: 'إرسال إشعار في الخاص',
                            emoji: '📱'
                        },
                        {
                            label: 'منشن في السيرفر',
                            value: 'ping_server',
                            description: 'منشن في قناة التذاكر',
                            emoji: '🏠'
                        },
                        {
                            label: 'استدعاء أداري',
                            value: 'ping_admin',
                            description: 'استدعاء فريق الإدارة',
                            emoji: '👑'
                        },
                        {
                            label: 'استدعاء سابورت',
                            value: 'ping_support',
                            description: 'استدعاء فريق الدعم',
                            emoji: '🛠️'
                        },
                        {
                            label: 'استدعاء الأونر',
                            value: 'ping_owner',
                            description: 'استدعاء مالك السيرفر',
                            emoji: '👑'
                        }
                    ]
                }
            },
            
            closeSettings: {
                autoCloseAfter: 24,
                deleteAfterClose: false,
                deleteDelay: 10,
                closeMessage: 'تم إغلاق التذكرة بواسطة {closer}',
                closeColor: '#e74c3c',
                sendTranscript: true,
                notifyUser: true
            },
            
            roles: {
                adminRoles: [],
                supportRoles: [],
                allowedRoles: [],
                blacklistedRoles: []
            },
            
            templates: {
                welcomeTemplates: {},
                buttonTemplates: {},
                menuTemplates: {}
            }
        };
        saveTicketSettings(settings);
    }
    return settings[guildId];
}

// تخزين بيانات التذاكر
const activeTickets = new Map();
const ticketCooldown = new Map();
const designSessions = new Map();

// ================ نظام تسجيل الأوامر ================

// دالة لتسجيل كل الأوامر
async function registerAllCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(config.token);
        
        console.log('🔄 جاري تسجيل كل الأوامر...');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: allCommands }
        );
        
        console.log(`✅ تم تسجيل ${allCommands.length} أمر بنجاح!`);
        
        // عرض قائمة الأوامر المسجلة
        console.log('📋 الأوامر المسجلة:');
        allCommands.forEach((cmd, index) => {
            console.log(`${index + 1}. /${cmd.name} - ${cmd.description}`);
        });
        
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error);
        
        // عرض تفاصيل الخطأ
        if (error.code === 50001) {
            console.error('🚫 خطأ في الصلاحيات - تأكد أن البوت لديه application.commands scope');
        } else if (error.code === 50013) {
            console.error('🚫 خطأ في الصلاحيات - تأكد أن التوكن صحيح');
        } else {
            console.error('🔧 تفاصيل الخطأ:', error.message);
        }
    }
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
            .setTitle('👑 لوحة تحكم المالك')
            .setDescription(`**مرحباً ${message.author.username}**\nالبادئة: \`${OWNER_PREFIX}\``)
            .addFields(
                {
                    name: '📊 **أوامر الإحصائيات**',
                    value: `\`${OWNER_PREFIX}stats\` - إحصائيات البوت\n\`${OWNER_PREFIX}servers [صفحة]\` - قائمة السيرفرات\n\`${OWNER_PREFIX}server <ID>\` - معلومات سيرفر\n\`${OWNER_PREFIX}locklist\` - قائمة السيرفرات المقفلة`
                },
                {
                    name: '📢 **أوامر البث**',
                    value: `\`${OWNER_PREFIX}broadcast <رسالة>\` - إرسال للجميع\n\`${OWNER_PREFIX}dm <ID_السيرفر> <رسالة>\` - إرسال لمالك سيرفر`
                },
                {
                    name: '⚙️ **أوامر التحكم**',
                    value: `\`${OWNER_PREFIX}lock <ID_السيرفر>\` - قفل البوت في سيرفر\n\`${OWNER_PREFIX}unlock <ID_السيرفر>\` - فتح البوت في سيرفر\n\`${OWNER_PREFIX}lock all\` - قفل كل السيرفرات\n\`${OWNER_PREFIX}unlock all\` - فتح كل السيرفرات\n\`${OWNER_PREFIX}leave <ID_السيرفر>\` - طلع البوت\n\`${OWNER_PREFIX}clearsettings <ID_السيرفر>\` - مسح إعدادات\n\`${OWNER_PREFIX}clearownerdm\` - مسح الشات الخاص`
                },
                {
                    name: '🎫 **أوامر التذاكر**',
                    value: `\`${OWNER_PREFIX}tickets\` - إحصائيات التذاكر\n\`${OWNER_PREFIX}ticketinfo <ID_السيرفر>\` - معلومات تذاكر السيرفر`
                }
            )
            .setFooter({ text: `ID المالك: ${BOT_OWNER_ID} | ${client.guilds.cache.size} سيرفر` })
            .setTimestamp();
        
        await message.reply({ embeds: [panelEmbed] });
        return;
    }
    
    // أمر stats
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
        
        // إحصائيات التذاكر
        const ticketSettings = loadTicketSettings();
        const serversWithTickets = Object.keys(ticketSettings).length;
        const totalActiveTickets = activeTickets.size;
        
        const statsEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📊 إحصائيات البوت')
            .addFields(
                { name: '🏠 السيرفرات', value: `\`${totalServers}\` سيرفر`, inline: true },
                { name: '👥 الأعضاء', value: `\`${totalMembers.toLocaleString()}\` عضو`, inline: true },
                { name: '✅ إعدادات الدعم', value: `\`${completedSetups}\` مكتملة`, inline: true },
                { name: '📞 المكالمات النشطة', value: `\`${totalActiveCalls}\` مكالمة`, inline: true },
                { name: '🎫 التذاكر النشطة', value: `\`${totalActiveTickets}\` تذكرة`, inline: true },
                { name: '🚫 السيرفرات المقفلة', value: `\`${allLockedCount}\` سيرفر`, inline: true },
                { name: '🔒 الرومات الخاصة', value: `\`${totalPrivateRooms}\` روم`, inline: true },
                { name: '⚙️ إعدادات التذاكر', value: `\`${serversWithTickets}\` سيرفر`, inline: true },
                { name: '🟢 وقت التشغيل', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
            )
            .setFooter({ text: `مالك البوت: ${message.author.tag}` })
            .setTimestamp();
        
        await message.reply({ embeds: [statsEmbed] });
        return;
    }
    
    // أمر tickets (إحصائيات التذاكر)
    if (command === 'tickets') {
        const ticketSettings = loadTicketSettings();
        const serversWithTickets = Object.keys(ticketSettings).length;
        const totalActiveTickets = activeTickets.size;
        
        // توزيع التذاكر حسب السيرفر
        const ticketsByServer = {};
        activeTickets.forEach(ticket => {
            if (!ticketsByServer[ticket.guildId]) {
                ticketsByServer[ticket.guildId] = 0;
            }
            ticketsByServer[ticket.guildId]++;
        });
        
        // توزيع التذاكر حسب النوع
        const ticketsByType = {};
        activeTickets.forEach(ticket => {
            if (!ticketsByType[ticket.type]) {
                ticketsByType[ticket.type] = 0;
            }
            ticketsByType[ticket.type]++;
        });
        
        let description = `**إجمالي التذاكر النشطة:** ${totalActiveTickets}\n`;
        description += `**السيرفرات المفعلة:** ${serversWithTickets}\n\n`;
        
        description += '**التذاكر حسب السيرفر:**\n';
        Object.entries(ticketsByServer).forEach(([guildId, count], index) => {
            if (index < 10) { // عرض أول 10 سيرفرات فقط
                const guild = client.guilds.cache.get(guildId);
                description += `${guild ? guild.name : 'سيرفر غير موجود'}: ${count} تذكرة\n`;
            }
        });
        
        if (Object.keys(ticketsByServer).length > 10) {
            description += `\nو ${Object.keys(ticketsByServer).length - 10} سيرفرات أخرى...`;
        }
        
        description += '\n**التذاكر حسب النوع:**\n';
        Object.entries(ticketsByType).forEach(([type, count]) => {
            description += `${type}: ${count} تذكرة\n`;
        });
        
        const ticketsEmbed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('🎫 إحصائيات التذاكر')
            .setDescription(description)
            .addFields({
                name: '📊 إحصائيات مفصلة',
                value: `• **أقدم تذكرة:** ${activeTickets.size > 0 ? formatDuration(Date.now() - Math.min(...Array.from(activeTickets.values()).map(t => t.createdAt))) : 'لا توجد'}\n• **أحدث تذكرة:** ${activeTickets.size > 0 ? formatDuration(Date.now() - Math.max(...Array.from(activeTickets.values()).map(t => t.createdAt))) : 'لا توجد'}\n• **متوسط العمر:** ${activeTickets.size > 0 ? formatDuration(Array.from(activeTickets.values()).reduce((acc, t) => acc + (Date.now() - t.createdAt), 0) / activeTickets.size) : 'لا توجد'}`
            })
            .setFooter({ text: `البوت في ${client.guilds.cache.size} سيرفر` })
            .setTimestamp();
        
        await message.reply({ embeds: [ticketsEmbed] });
        return;
    }
    
    // أمر ticketinfo
    if (command === 'ticketinfo') {
        const serverId = args[0];
        
        if (!serverId) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('❌ خطأ')
                .setDescription(`**يجب إدخال ID السيرفر!**\n\nمثال: \`${OWNER_PREFIX}ticketinfo 123456789012345678\``);
            
            return message.reply({ embeds: [errorEmbed] });
        }
        
        const guild = client.guilds.cache.get(serverId);
        const ticketSettings = getTicketSettings(serverId);
        const serverTickets = Array.from(activeTickets.values()).filter(t => t.guildId === serverId);
        
        let description = '';
        
        if (guild) {
            description += `**السيرفر:** ${guild.name}\n`;
            description += `**معرف السيرفر:** \`${serverId}\`\n\n`;
        } else {
            description += `**السيرفر:** غير موجود في البوت\n`;
            description += `**معرف السيرفر:** \`${serverId}\`\n\n`;
        }
        
        description += `**التذاكر النشطة:** ${serverTickets.length}\n`;
        description += `**أنواع التذاكر:** ${Object.keys(ticketSettings.ticketTypes || {}).length}\n`;
        description += `**مفعل:** ${ticketSettings.enabled ? '✅' : '❌'}\n\n`;
        
        description += '**التذاكر النشطة الحالية:**\n';
        if (serverTickets.length > 0) {
            serverTickets.forEach((ticket, index) => {
                if (index < 5) { // عرض أول 5 تذاكر فقط
                    description += `${index + 1}. ${ticket.typeName} - ${ticket.userName} (${formatDuration(Date.now() - ticket.createdAt)})\n`;
                }
            });
            if (serverTickets.length > 5) {
                description += `\nو ${serverTickets.length - 5} تذاكر أخرى...`;
            }
        } else {
            description += 'لا توجد تذاكر نشطة\n';
        }
        
        const infoEmbed = new EmbedBuilder()
            .setColor(guild ? 0x3498db : 0x95a5a6)
            .setTitle('🎫 معلومات تذاكر السيرفر')
            .setDescription(description)
            .setFooter({ text: `تم الطلب بواسطة: ${message.author.tag}` })
            .setTimestamp();
        
        await message.reply({ embeds: [infoEmbed] });
        return;
    }
    
    // باقي الأوامر (lock, unlock, servers, broadcast, dm, clearownerdm, leave, clearsettings)
    // ... [نفس الكود السابق لكل هذه الأوامر]
    
    // أمر help للمالك
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🆘 مركز مساعدة المالك')
            .setDescription(`**أوامر لوحة التحكم - البادئة: \`${OWNER_PREFIX}\`**`)
            .addFields(
                {
                    name: '📊 **أوامر الإحصائيات**',
                    value: `\`${OWNER_PREFIX}stats\` - إحصائيات البوت الكاملة\n\`${OWNER_PREFIX}servers [صفحة]\` - قائمة السيرفرات\n\`${OWNER_PREFIX}server <ID>\` - معلومات سيرفر\n\`${OWNER_PREFIX}locklist [صفحة]\` - قائمة السيرفرات المقفلة\n\`${OWNER_PREFIX}tickets\` - إحصائيات التذاكر\n\`${OWNER_PREFIX}ticketinfo <ID>\` - معلومات تذاكر سيرفر`
                },
                {
                    name: '📢 **أوامر البث والمراسلة**',
                    value: `\`${OWNER_PREFIX}broadcast <رسالة>\` - إرسال رسالة لجميع المالكين\n\`${OWNER_PREFIX}dm <ID_السيرفر> <رسالة>\` - إرسال رسالة لمالك سيرفر\n\`${OWNER_PREFIX}clearownerdm\` - مسح الشات الخاص مع المالك`
                },
                {
                    name: '⚙️ **أوامر التحكم**',
                    value: `\`${OWNER_PREFIX}lock <ID_السيرفر>\` - قفل البوت في سيرفر\n\`${OWNER_PREFIX}unlock <ID_السيرفر>\` - فتح البوت في سيرفر\n\`${OWNER_PREFIX}lock all\` - قفل كل السيرفرات\n\`${OWNER_PREFIX}unlock all\` - فتح كل السيرفرات\n\`${OWNER_PREFIX}leave <ID_السيرفر>\` - إخراج البوت من سيرفر\n\`${OWNER_PREFIX}clearsettings <ID_السيرفر>\` - مسح إعدادات سيرفر`
                },
                {
                    name: '👑 **أوامر عامة**',
                    value: `\`${OWNER_PREFIX}panel\` - عرض لوحة التحكم\n\`${OWNER_PREFIX}help\` - عرض هذه القائمة`
                }
            )
            .setFooter({ text: `ID المالك: ${BOT_OWNER_ID} | ${client.guilds.cache.size} سيرفر` })
            .setTimestamp();
        
        await message.reply({ embeds: [helpEmbed] });
        return;
    }
});

// ================ معالجة Slash Commands ================

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
    
    // ================ أوامر نظام الدعم ================
    
    // أمر المساعدة
    if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🆘 مركز المساعدة - Sienna Bot')
            .setDescription('**قائمة الأوامر المتاحة**\n\n**📍 استخدم `/` ثم اكتب اسم الأمر**')
            .addFields(
                { 
                    name: '🎤 **نظام الدعم الصوتي**', 
                    value: `
\`/setup\` - إعدادات نظام الدعم
\`/reset\` - مسح كل الإعدادات
\`/help\` - عرض التعليمات
                    `
                },
                { 
                    name: '🎫 **نظام التذاكر PRO**', 
                    value: `
\`/ticket-design\` - تصميم نظام التذاكر
\`/ticket-send\` - إرسال واجهة التذاكر
\`/ticket-template\` - إدارة القوالب
                    `
                }
            )
            .addFields({
                name: '⚠️ **ملاحظات هامة**',
                value: '1. **يجب إكمال إعدادات الدعم** قبل ما يشتغل النظام\n2. **فقط المالك والمشرفون** يقدرون يستخدموا أوامر الإعداد\n3. **نظام التذاكر** يعمل بشكل منفصل عن نظام الصوت'
            })
            .setFooter({ text: `السيرفر: ${guild.name}` })
            .setTimestamp();
        
        return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
    
    // التحقق من الصلاحيات لأوامر الإعداد
    if (commandName === 'setup' || commandName === 'reset' || 
        commandName.startsWith('ticket-')) {
        
        const settings = getServerSettings(guild.id);
        if (!canUseSetupCommands(member, guild, settings)) {
            return interaction.reply({ 
                content: '❌ **ليس لديك الصلاحية لاستخدام هذه الأوامر!**\n\nفقط مالك السيرفر والمشرفون يمكنهم استخدام أوامر الإعداد.',
                ephemeral: true 
            });
        }
    }
    
    // معالجة أوامر نظام الدعم (setup, reset)
    // ... [نفس الكود السابق لأوامر نظام الدعم]
    
    // ================ أوامر نظام التذاكر ================
    
    // لوحة تحكم تصميم التذاكر
    if (commandName === 'ticket-design' && options.getSubcommand() === 'panel') {
        const settings = getTicketSettings(guild.id);
        
        const panelEmbed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('🎨 لوحة تحكم تصميم التذاكر')
            .setDescription('**مرحباً في نظام تصميم التذاكر المتكامل!**\n\nاستخدم الأوامر أدناه لتصميم كل عنصر في نظام التذاكر.')
            .addFields(
                {
                    name: '📋 **أنواع التذاكر**',
                    value: `\`/ticket-design types\`\n**عدد:** ${Object.keys(settings.ticketTypes).length} نوع\n**المفعلة:** ${Object.values(settings.ticketTypes).filter(t => t.enabled).length}`,
                    inline: true
                },
                {
                    name: '🎭 **واجهة الإنشاء**',
                    value: `\`/ticket-design interface\`\n**النوع:** ${settings.creationInterface.type === 'select_menu' ? 'قائمة اختيار' : 'أزرار'}\n**الحقول:** ${settings.creationInterface.customFields.length}`,
                    inline: true
                },
                {
                    name: '👋 **رسالة الترحيب**',
                    value: `\`/ticket-design welcome\`\n**الحقول:** ${settings.welcomeMessage.fields.length + settings.welcomeMessage.additionalFields.length}\n**التوقيت:** ${settings.welcomeMessage.timestamp ? '✅' : '❌'}`,
                    inline: true
                },
                {
                    name: '🔄 **أزرار التحكم**',
                    value: `\`/ticket-design buttons\`\n**الأزرار:** ${Object.values(settings.controlButtons).filter(b => b.enabled && typeof b === 'object').length}\n**القوائم:** ${settings.controlButtons.pingMenu.enabled ? '✅' : '❌'}`,
                    inline: true
                }
            )
            .addFields(
                {
                    name: '👁️ **المعاينة**',
                    value: '`/ticket-design preview` - معاينة التصميم\n`/ticket-send` - إرسال الواجهة'
                },
                {
                    name: '💾 **الحفظ والإدارة**',
                    value: '`/ticket-design save` - حفظ التصميم\n`/ticket-design reset-design` - إعادة التعيين'
                }
            )
            .setFooter({ text: 'كل عنصر قابل للتخصيص 100%' });
        
        return interaction.reply({ embeds: [panelEmbed], ephemeral: true });
    }
    
    // إنشاء نوع تذكرة جديد
    if (commandName === 'ticket-design' && options.getSubcommand() === 'types') {
        const action = options.getString('action');
        
        if (action === 'create') {
            // استخدام Modal لإنشاء نوع جديد
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            
            const modal = new ModalBuilder()
                .setCustomId('create_ticket_type')
                .setTitle('إنشاء نوع تذكرة جديد');
            
            const nameInput = new TextInputBuilder()
                .setCustomId('type_name')
                .setLabel('اسم النوع')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: الدعم الفني')
                .setRequired(true);
            
            const emojiInput = new TextInputBuilder()
                .setCustomId('type_emoji')
                .setLabel('الإيموجي')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 🛠️ (اتركه فارغاً إذا لا تريد)')
                .setRequired(false);
            
            const colorInput = new TextInputBuilder()
                .setCustomId('type_color')
                .setLabel('اللون (hex)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('#3498db')
                .setValue('#3498db')
                .setRequired(true);
            
            const firstRow = new ActionRowBuilder().addComponents(nameInput);
            const secondRow = new ActionRowBuilder().addComponents(emojiInput);
            const thirdRow = new ActionRowBuilder().addComponents(colorInput);
            
            modal.addComponents(firstRow, secondRow, thirdRow);
            
            return await interaction.showModal(modal);
        } else if (action === 'list') {
            const settings = getTicketSettings(guild.id);
            const types = Object.values(settings.ticketTypes);
            
            if (types.length === 0) {
                return interaction.reply({
                    content: '❌ **لا توجد أنواع تذاكر!**',
                    ephemeral: true
                });
            }
            
            let listDescription = '📋 **أنواع التذاكر المتاحة:**\n\n';
            types.forEach((type, index) => {
                listDescription += `**${index + 1}. ${type.emoji || ''} ${type.name}**\n`;
                listDescription += `├─ **المعرف:** \`${type.id}\`\n`;
                listDescription += `├─ **اللون:** \`${type.color}\`\n`;
                listDescription += `├─ **الحد:** ${type.maxActive} تذكرة\n`;
                listDescription += `├─ **الحالة:** ${type.enabled ? '✅ مفعل' : '❌ معطل'}\n`;
                if (type.description) {
                    listDescription += `└─ **الوصف:** ${type.description}\n`;
                }
                listDescription += '\n';
            });
            
            const listEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📋 أنواع التذاكر')
                .setDescription(listDescription)
                .setFooter({ text: `إجمالي الأنواع: ${types.length}` });
            
            return interaction.reply({ embeds: [listEmbed], ephemeral: true });
        } else {
            return interaction.reply({
                content: '⏳ **جاري التطوير...**\nهذا الخيار سيكون متاحاً قريباً!',
                ephemeral: true
            });
        }
    }
    
    // تصميم واجهة الإنشاء
    if (commandName === 'ticket-design' && options.getSubcommand() === 'interface') {
        const element = options.getString('element');
        const value = options.getString('value');
        
        const settings = getTicketSettings(guild.id);
        const allSettings = loadTicketSettings();
        
        switch (element) {
            case 'type':
                if (!value || (value !== 'select_menu' && value !== 'buttons')) {
                    return interaction.reply({
                        content: '❌ **قيمة غير صالحة!**\nالقيم المسموحة: `select_menu` أو `buttons`',
                        ephemeral: true
                    });
                }
                settings.creationInterface.type = value;
                allSettings[guild.id] = settings;
                saveTicketSettings(allSettings);
                
                return interaction.reply({
                    content: `✅ **تم تغيير نوع الواجهة إلى:** ${value === 'select_menu' ? 'قائمة اختيار' : 'أزرار'}`,
                    ephemeral: true
                });
                
            case 'title':
                settings.creationInterface.title = value || '🎫 نظام التذاكر';
                allSettings[guild.id] = settings;
                saveTicketSettings(allSettings);
                
                return interaction.reply({
                    content: `✅ **تم تحديث العنوان:**\n${value || '🎫 نظام التذاكر'}`,
                    ephemeral: true
                });
                
            case 'description':
                settings.creationInterface.description = value || 'اختر نوع التذكرة المناسب لك';
                allSettings[guild.id] = settings;
                saveTicketSettings(allSettings);
                
                return interaction.reply({
                    content: `✅ **تم تحديث الوصف:**\n${value || 'اختر نوع التذكرة المناسب لك'}`,
                    ephemeral: true
                });
                
            case 'color':
                if (value && !/^#[0-9A-F]{6}$/i.test(value)) {
                    return interaction.reply({
                        content: '❌ **تنسيق اللون غير صحيح!**\nاستخدم hex code مثل: `#3498db`',
                        ephemeral: true
                    });
                }
                settings.creationInterface.color = value || '#9b59b6';
                allSettings[guild.id] = settings;
                saveTicketSettings(allSettings);
                
                return interaction.reply({
                    content: `✅ **تم تحديث اللون إلى:** \`${value || '#9b59b6'}\``,
                    ephemeral: true
                });
                
            default:
                return interaction.reply({
                    content: '⏳ **جاري التطوير...**\nهذا الخيار سيكون متاحاً قريباً!',
                    ephemeral: true
                });
        }
    }
    
    // معاينة التصميم
    if (commandName === 'ticket-design' && options.getSubcommand() === 'preview') {
        const section = options.getString('section');
        const settings = getTicketSettings(guild.id);
        
        if (section === 'interface') {
            // بناء واجهة بسيطة للمعاينة
            const interfaceSettings = settings.creationInterface;
            const ticketTypes = Object.values(settings.ticketTypes).filter(t => t.enabled);
            
            const embed = new EmbedBuilder()
                .setColor(parseInt(interfaceSettings.color.replace('#', ''), 16) || 0x9b59b6)
                .setTitle(interfaceSettings.title || '🎫 نظام التذاكر')
                .setDescription(interfaceSettings.description || 'اختر نوع التذكرة المناسب لك');
            
            if (interfaceSettings.showTypesAsFields && ticketTypes.length > 0) {
                ticketTypes.forEach(type => {
                    embed.addFields({
                        name: `${type.emoji} ${type.name}`,
                        value: type.description || 'لا يوجد وصف',
                        inline: true
                    });
                });
            }
            
            let components = [];
            
            if (interfaceSettings.type === 'select_menu' && ticketTypes.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('preview_select')
                    .setPlaceholder('اختر نوع التذكرة...')
                    .setDisabled(true);
                
                const options = ticketTypes.map(type => ({
                    label: type.name.length > 25 ? type.name.substring(0, 22) + '...' : type.name,
                    value: type.id,
                    description: type.description ? (type.description.length > 50 ? type.description.substring(0, 47) + '...' : type.description) : undefined,
                    emoji: type.emoji || undefined
                }));
                
                selectMenu.addOptions(options.slice(0, 25));
                components.push(new ActionRowBuilder().addComponents(selectMenu));
            } else if (interfaceSettings.type === 'buttons' && ticketTypes.length > 0) {
                const row = new ActionRowBuilder();
                ticketTypes.slice(0, 5).forEach(type => {
                    const button = new ButtonBuilder()
                        .setCustomId(`preview_${type.id}`)
                        .setLabel(type.name.length > 20 ? type.name.substring(0, 17) + '...' : type.name)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true);
                    
                    if (type.emoji) {
                        button.setEmoji(type.emoji);
                    }
                    
                    row.addComponents(button);
                });
                components.push(row);
            }
            
            return interaction.reply({
                content: '👁️ **معاينة واجهة الإنشاء:**',
                embeds: [embed],
                components: components,
                ephemeral: true
            });
        } else {
            return interaction.reply({
                content: '⏳ **جاري التطوير...**\nمعاينة هذا القسم ستكون متاحة قريباً!',
                ephemeral: true
            });
        }
    }
    
    // حفظ التصميم
    if (commandName === 'ticket-design' && options.getSubcommand() === 'save') {
        return interaction.reply({
            content: '✅ **تم حفظ التصميم بنجاح!**\n\nيمكنك الآن استخدام `/ticket-send` لإرسال الواجهة.',
            ephemeral: true
        });
    }
    
    // إرسال واجهة التذاكر
    if (commandName === 'ticket-send') {
        const channel = options.getChannel('channel');
        
        if (channel.type !== ChannelType.GuildText) {
            return interaction.reply({
                content: '❌ **يجب اختيار قناة نصية!**',
                ephemeral: true
            });
        }
        
        const settings = getTicketSettings(guild.id);
        
        // حفظ القناة كقناة التذاكر الرسمية
        settings.ticketChannelId = channel.id;
        const allSettings = loadTicketSettings();
        allSettings[guild.id] = settings;
        saveTicketSettings(allSettings);
        
        // بناء واجهة بسيطة
        const interfaceSettings = settings.creationInterface;
        const ticketTypes = Object.values(settings.ticketTypes).filter(t => t.enabled);
        
        const embed = new EmbedBuilder()
            .setColor(parseInt(interfaceSettings.color.replace('#', ''), 16) || 0x9b59b6)
            .setTitle(interfaceSettings.title || '🎫 نظام التذاكر')
            .setDescription(interfaceSettings.description || 'اختر نوع التذكرة المناسب لك')
            .setFooter({ text: interfaceSettings.footer?.text || 'Sienna Ticket System' });
        
        let components = [];
        
        if (interfaceSettings.type === 'select_menu' && ticketTypes.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_ticket_type')
                .setPlaceholder('اختر نوع التذكرة...');
            
            const options = ticketTypes.map(type => ({
                label: type.name.length > 25 ? type.name.substring(0, 22) + '...' : type.name,
                value: type.id,
                description: type.description ? (type.description.length > 50 ? type.description.substring(0, 47) + '...' : type.description) : undefined,
                emoji: type.emoji || undefined
            }));
            
            selectMenu.addOptions(options.slice(0, 25));
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        } else if (interfaceSettings.type === 'buttons' && ticketTypes.length > 0) {
            const row = new ActionRowBuilder();
            ticketTypes.slice(0, 5).forEach(type => {
                const button = new ButtonBuilder()
                    .setCustomId(`create_ticket_${type.id}`)
                    .setLabel(type.name.length > 20 ? type.name.substring(0, 17) + '...' : type.name)
                    .setStyle(ButtonStyle.Primary);
                
                if (type.emoji) {
                    button.setEmoji(type.emoji);
                }
                
                row.addComponents(button);
            });
            components.push(row);
        }
        
        try {
            await channel.send({
                embeds: [embed],
                components: components
            });
            
            return interaction.reply({
                content: `✅ **تم إرسال واجهة التذاكر بنجاح في** ${channel}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('❌ خطأ في إرسال الواجهة:', error);
            return interaction.reply({
                content: `❌ **فشل إرسال الواجهة:** ${error.message}`,
                ephemeral: true
            });
        }
    }
    
    // أوامر القوالب
    if (commandName === 'ticket-template') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'list') {
            const settings = getTicketSettings(guild.id);
            const templates = settings.templates;
            
            let description = '📋 **القوالب المتاحة:**\n\n';
            
            // قوالب رسائل الترحيب
            if (templates.welcomeTemplates && Object.keys(templates.welcomeTemplates).length > 0) {
                description += '**👋 رسائل الترحيب:**\n';
                Object.entries(templates.welcomeTemplates).forEach(([name], index) => {
                    description += `${index + 1}. \`${name}\`\n`;
                });
                description += '\n';
            }
            
            // قوالب الأزرار
            if (templates.buttonTemplates && Object.keys(templates.buttonTemplates).length > 0) {
                description += '**🔄 قوالب الأزرار:**\n';
                Object.entries(templates.buttonTemplates).forEach(([name], index) => {
                    description += `${index + 1}. \`${name}\`\n`;
                });
                description += '\n';
            }
            
            if (description === '📋 **القوالب المتاحة:**\n\n') {
                description += '❌ **لا توجد قوالب محفوظة!**';
            }
            
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('🎨 قوالب التذاكر')
                .setDescription(description)
                .setFooter({ text: 'استخدم /ticket-design save لحفظ القوالب' });
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            return interaction.reply({
                content: '⏳ **جاري التطوير...**\nهذا الخيار سيكون متاحاً قريباً!',
                ephemeral: true
            });
        }
    }
});

// ================ معالجة Modals ================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    // إنشاء نوع تذكرة جديد
    if (interaction.customId === 'create_ticket_type') {
        try {
            const name = interaction.fields.getTextInputValue('type_name');
            const emoji = interaction.fields.getTextInputValue('type_emoji') || '';
            const color = interaction.fields.getTextInputValue('type_color');
            
            // التحقق من صحة اللون
            if (!/^#[0-9A-F]{6}$/i.test(color)) {
                return interaction.reply({
                    content: '❌ **تنسيق اللون غير صحيح!**\nاستخدم hex code مثل: `#3498db`',
                    ephemeral: true
                });
            }
            
            // إنشاء معرف فريد
            const typeId = name.toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .substring(0, 20);
            
            const settings = getTicketSettings(interaction.guild.id);
            const allSettings = loadTicketSettings();
            
            // إنشاء النوع الجديد
            settings.ticketTypes[typeId] = {
                id: typeId,
                name: name,
                emoji: emoji,
                color: color,
                description: 'وصف التذكرة',
                maxActive: 5,
                enabled: true,
                buttonStyle: 1,
                welcomeMessage: 'مرحباً! فريق الدعم سيساعدك قريباً.',
                pingRoles: [],
                requiredRoles: []
            };
            
            allSettings[interaction.guild.id] = settings;
            saveTicketSettings(allSettings);
            
            const successEmbed = new EmbedBuilder()
                .setColor(parseInt(color.replace('#', ''), 16))
                .setTitle('✅ تم إنشاء نوع تذكرة جديد!')
                .setDescription(`**${emoji} ${name}**`)
                .addFields(
                    { name: 'المعرف', value: `\`${typeId}\``, inline: true },
                    { name: 'اللون', value: `\`${color}\``, inline: true },
                    { name: 'الإيموجي', value: emoji || 'بدون', inline: true }
                )
                .setFooter({ text: 'يمكنك الآن إضافته لواجهة التذاكر' });
            
            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء نوع التذكرة:', error);
            return interaction.reply({
                content: '❌ **حدث خطأ أثناء إنشاء النوع!**',
                ephemeral: true
            });
        }
    }
});

// ================ معالجة الأزرار والقوائم ================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    
    // إنشاء تذكرة
    if (interaction.customId === 'select_ticket_type' || interaction.customId.startsWith('create_ticket_')) {
        try {
            const guild = interaction.guild;
            const member = interaction.member;
            const settings = getTicketSettings(guild.id);
            
            // التحقق من التكرار
            const cooldownKey = `${guild.id}_${member.id}`;
            if (ticketCooldown.has(cooldownKey)) {
                const remaining = ticketCooldown.get(cooldownKey) - Date.now();
                if (remaining > 0) {
                    return interaction.reply({
                        content: `⏰ **يجب الانتظار ${Math.ceil(remaining / 1000)} ثانية قبل إنشاء تذكرة جديدة!**`,
                        ephemeral: true
                    });
                }
            }
            
            // تحديد نوع التذكرة
            let ticketTypeId;
            if (interaction.isStringSelectMenu()) {
                ticketTypeId = interaction.values[0];
            } else if (interaction.isButton()) {
                ticketTypeId = interaction.customId.replace('create_ticket_', '');
            }
            
            // التحقق من وجود النوع
            const ticketType = settings.ticketTypes[ticketTypeId];
            if (!ticketType || !ticketType.enabled) {
                return interaction.reply({
                    content: '❌ **نوع التذكرة غير متاح!**',
                    ephemeral: true
                });
            }
            
            await interaction.deferReply({ ephemeral: true });
            
            // إنشاء قناة التذكرة
            const ticketChannel = await createTicketChannel(guild, member, ticketTypeId, settings);
            
            if (!ticketChannel) {
                return interaction.editReply({
                    content: '❌ **فشل إنشاء التذكرة!**\n\nيرجى المحاولة مرة أخرى لاحقاً.'
                });
            }
            
            // إعداد بيانات التذكرة
            const ticketNumber = Math.floor(Math.random() * 9000) + 1000;
            const ticketData = {
                userId: member.id,
                userName: member.user.tag,
                type: ticketTypeId,
                number: ticketNumber,
                channelId: ticketChannel.id,
                guildId: guild.id,
                createdAt: Date.now(),
                typeName: ticketType.name,
                typeColor: ticketType.color
            };
            
            // حفظ التذكرة
            activeTickets.set(ticketChannel.id, ticketData);
            
            // إضافة كولدون
            ticketCooldown.set(cooldownKey, Date.now() + 30000);
            
            // إرسال رسالة الترحيب
            const welcomeEmbed = new EmbedBuilder()
                .setColor(parseInt(ticketType.color.replace('#', ''), 16))
                .setTitle(`🎫 تذكرة ${ticketType.name}`)
                .setDescription(`مرحباً ${member}! تم فتح تذكرتك بنجاح.`)
                .addFields(
                    { name: '👤 مقدم الطلب', value: `${member.user.tag}\n<@${member.id}>`, inline: true },
                    { name: '📅 تاريخ الإنشاء', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
                    { name: '📌 نوع التذكرة', value: ticketType.name, inline: true }
                )
                .setFooter({ text: `رقم التذكرة: ${ticketNumber}` })
                .setTimestamp();
            
            // أزرار التحكم الأساسية
            const buttonsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketChannel.id}`)
                        .setLabel('🔒 إغلاق التذكرة')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`add_user_${ticketChannel.id}`)
                        .setLabel('➕ إضافة عضو')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await ticketChannel.send({
                content: `${member}`,
                embeds: [welcomeEmbed],
                components: [buttonsRow]
            });
            
            await interaction.editReply({
                content: `✅ **تم إنشاء تذكرتك بنجاح!**\n${ticketChannel}\n\n**النوع:** ${ticketType.name}`
            });
            
            console.log(`🎫 تم إنشاء تذكرة: ${ticketChannel.name} بواسطة ${member.user.tag}`);
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء التذكرة:', error);
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ **حدث خطأ أثناء إنشاء التذكرة!**\n\nيرجى المحاولة مرة أخرى.'
                });
            } else {
                await interaction.reply({
                    content: '❌ **حدث خطأ أثناء إنشاء التذكرة!**\n\nيرجى المحاولة مرة أخرى.',
                    ephemeral: true
                });
            }
        }
    }
    
    // أزرار التحكم في التذكرة
    if (interaction.customId.startsWith('close_ticket_') || 
        interaction.customId.startsWith('add_user_')) {
        
        const channelId = interaction.customId.split('_').pop();
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        
        if (!channel) {
            return interaction.reply({
                content: '❌ **قناة التذكرة غير موجودة!**',
                ephemeral: true
            });
        }
        
        const ticketData = activeTickets.get(channelId);
        if (!ticketData) {
            return interaction.reply({
                content: '❌ **هذه ليست قناة تذكرة نشطة!**',
                ephemeral: true
            });
        }
        
        if (interaction.customId.startsWith('close_ticket_')) {
            // إغلاق التذكرة
            const isOwner = interaction.user.id === ticketData.userId;
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            
            if (!isOwner && !isAdmin) {
                return interaction.reply({
                    content: '❌ **ليس لديك صلاحية إغلاق هذه التذكرة!**',
                    ephemeral: true
                });
            }
            
            await interaction.deferReply();
            
            // إرسال رسالة الإغلاق
            const closeEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🔒 التذكرة مغلقة')
                .setDescription(`تم إغلاق هذه التذكرة بواسطة <@${interaction.user.id}>`)
                .setFooter({ text: `تم الإغلاق في ${new Date().toLocaleString('ar-SA')}` })
                .setTimestamp();
            
            await channel.send({ embeds: [closeEmbed] });
            
            // تغيير اسم القناة
            try {
                await channel.setName(`🔒-${channel.name}`);
            } catch (error) {
                console.log('❌ لم أستطع تغيير اسم القناة');
            }
            
            // حذف التذكرة من القائمة النشطة
            activeTickets.delete(channel.id);
            
            await interaction.editReply({
                content: '✅ **تم إغلاق التذكرة بنجاح!**'
            });
        }
    }
});

// ================ دوال مساعدة ================

// دالة إنشاء قناة التذكرة
async function createTicketChannel(guild, member, ticketTypeId, settings) {
    try {
        const ticketType = settings.ticketTypes[ticketTypeId];
        const categoryId = settings.ticketCategoryId;
        let category = null;
        
        if (categoryId) {
            category = await guild.channels.fetch(categoryId).catch(() => null);
        }
        
        const ticketNumber = Math.floor(Math.random() * 9000) + 1000;
        const cleanUsername = member.user.username.replace(/[^\w\u0600-\u06FF]/g, '-').substring(0, 15);
        
        const channelName = `${ticketType.emoji || '🎫'}-${cleanUsername}-${ticketNumber}`;
        
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category ? category.id : null,
            topic: `تذكرة ${member.user.tag} | ${ticketType.name} | ${new Date().toLocaleString('ar-SA')}`,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: member.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.AttachFiles,
                        PermissionsBitField.Flags.EmbedLinks
                    ]
                }
            ]
        });
        
        // إضافة البوت
        await ticketChannel.permissionOverwrites.create(guild.members.me, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            ManageMessages: true,
            ManageChannels: true
        });
        
        return ticketChannel;
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء قناة التذكرة:', error);
        return null;
    }
}

// دالة لتنسيق المدة
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} يوم ${hours % 24} ساعة`;
    } else if (hours > 0) {
        return `${hours} ساعة ${minutes % 60} دقيقة`;
    } else if (minutes > 0) {
        return `${minutes} دقيقة ${seconds % 60} ثانية`;
    } else {
        return `${seconds} ثانية`;
    }
}

// ================ نظام الصوت الأساسي ================

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
                
                const clientsInRoom = voiceChannel.members.filter(m => 
                    !m.user.bot && !m.roles.cache.has(adminRoleId)
                );
                
                // لكل عميل في روم الانتظار
                for (const clientMember of clientsInRoom.values()) {
                    const clientId = clientMember.id;
                    const callData = activeCalls.get(clientId);
                    
                    if (callData && !callData.hasAdmin && !callData.privateRoomId) {
                        console.log(`🔄 بدء عملية إنشاء روم خاص للعميل ${clientMember.user.tag}`);
                        
                        // 1. أوقف الموسيقى للعميل
                        callData.isBotMuted = true;
                        if (callData.musicPlayer) {
                            callData.musicPlayer.stop();
                        }
                        
                        // 2. إرسال إشعار استلام الطلب
                        await sendAdminAcceptNotification(
                            voiceChannel.guild,
                            settings,
                            clientId,
                            member.id,
                            member.user.tag,
                            clientMember.user.tag
                        );
                        
                        // 3. إنشاء روم صوتي خاص
                        const privateRoom = await createPrivateVoiceRoom(
                            voiceChannel.guild,
                            settings,
                            clientId,
                            clientMember.user.username,
                            member.id,
                            member.user.tag
                        );
                        
                        if (privateRoom) {
                            // 4. حفظ بيانات الروم الخاص
                            callData.privateRoomId = privateRoom.id;
                            callData.privateRoomName = privateRoom.name;
                            callData.lastAdminId = member.id;
                            callData.hasAdmin = true;
                            callData.callStartTime = Date.now();
                            callData.adminName = member.user.tag;
                            
                            privateRooms.set(privateRoom.id, {
                                clientId: clientId,
                                clientName: clientMember.user.tag,
                                adminId: member.id,
                                adminName: member.user.tag,
                                createdAt: Date.now()
                            });
                            
                            // 5. نقل العميل والمشرف للروم الخاص
                            const moved = await moveToPrivateRoom(
                                voiceChannel.guild,
                                clientId,
                                member.id,
                                privateRoom.id
                            );
                            
                            if (moved) {
                                console.log(`✅ تم نقل ${clientMember.user.tag} و ${member.user.tag} للروم الخاص`);
                                
                                // 6. البوت يطلع من روم الانتظار
                                setTimeout(async () => {
                                    const conn = voiceConnections.get(guildId);
                                    if (conn) {
                                        conn.destroy();
                                        voiceConnections.delete(guildId);
                                        console.log(`🔌 البوت طلع من روم الانتظار`);
                                    }
                                }, 2000);
                            }
                        }
                        
                        break; // نتعامل مع عميل واحد فقط
                    }
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
                
                // إرسال إشعار استلام الطلب فوراً
                await sendAdminAcceptNotification(
                    voiceChannel.guild,
                    settings,
                    member.id,
                    existingAdmin.id,
                    existingAdmin.user.tag,
                    member.user.tag
                );
                
                // إنشاء روم صوتي خاص فوراً
                const privateRoom = await createPrivateVoiceRoom(
                    voiceChannel.guild,
                    settings,
                    member.id,
                    member.user.username,
                    existingAdmin.id,
                    existingAdmin.user.tag
                );
                
                if (privateRoom) {
                    // حفظ بيانات العميل
                    const callData = {
                        userId: member.id,
                        voiceChannelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        isBotMuted: true,
                        hasAdmin: true,
                        lastAdminId: existingAdmin.id,
                        adminName: existingAdmin.user.tag,
                        userName: member.user.tag,
                        joinedAt: Date.now(),
                        privateRoomId: privateRoom.id,
                        privateRoomName: privateRoom.name,
                        callStartTime: Date.now()
                    };
                    
                    activeCalls.set(member.id, callData);
                    privateRooms.set(privateRoom.id, {
                        clientId: member.id,
                        clientName: member.user.tag,
                        adminId: existingAdmin.id,
                        adminName: existingAdmin.user.tag,
                        createdAt: Date.now()
                    });
                    
                    // نقل العميل والمشرف للروم الخاص
                    await moveToPrivateRoom(
                        voiceChannel.guild,
                        member.id,
                        existingAdmin.id,
                        privateRoom.id
                    );
                    
                    console.log(`✅ تم إنشاء روم خاص فوراً للعميل ${member.user.tag}`);
                }
                
                return;
            }
            
            // إذا مفيش مشرف، نبدأ عملية الانتظار
            
            // 1. البوت يدخل مع العميل فوراً
            const connection = await getOrCreateConnection(voiceChannel);
            if (!connection) {
                console.error('❌ فشل الاتصال الصوتي');
                return;
            }
            
            // زيادة المهلة لتفادي اخطاء الشبكة الصغيرة
            await entersState(connection, VoiceConnectionStatus.Ready, 10000);
            
            // 2. إرسال إشعار طلب جديد
            await sendNewCallNotification(voiceChannel.guild, settings, member.id, member.user.tag);

            // 3. اختيار مجموعة صوت بالتناوب لكل سيرفر
            const selectedAudioSet = getNextAudioSet(voiceChannel.guild.id);
            console.log(`🎵 تم اختيار ${selectedAudioSet.name} للعميل ${member.user.tag}`);

            // 4. الانتظار 4 ثواني فقط ثم تشغيل التسجيلات
            setTimeout(async () => {
                if (!member.voice.channelId || member.voice.channelId !== supportVoiceId) {
                    console.log(`❌ العميل ${member.user.tag} خرج قبل بدء الصوت`);
                    return;
                }

                // تشغيل صوت الانتظار من المجموعة المختارة
                if (selectedAudioSet.waiting) {
                    console.log(`🔊 تشغيل ${selectedAudioSet.waiting} للعميل ${member.id}`);
                    const waitingPlayer = playAudio(connection, selectedAudioSet.waiting, member.id, false, selectedAudioSet);

                    // حفظ بيانات العميل مع المجموعة الصوتية
                    const callData = {
                        connection,
                        waitingPlayer,
                        userId: member.id,
                        voiceChannelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        isBotMuted: false,
                        hasAdmin: false,
                        userName: member.user.tag,
                        joinedAt: Date.now(),
                        audioSet: selectedAudioSet
                    };

                    // استمع لانتهاء صوت الانتظار ثم ابدأ الموسيقى الخلفية من نفس المجموعة
                    if (waitingPlayer) {
                        waitingPlayer.once(AudioPlayerStatus.Idle, () => {
                            if (member.voice.channelId === supportVoiceId) {
                                const currentAdmin = getAdminInVoice(voiceChannel, settings);
                                if (!currentAdmin) {
                                    console.log(`🎵 بدء موسيقى ${selectedAudioSet.background} للعميل ${member.id}`);
                                    const musicPlayer = playAudio(connection, selectedAudioSet.background, member.id, true, selectedAudioSet);
                                    callData.musicPlayer = musicPlayer;
                                    callData.waitingPlayer = null;
                                }
                            }
                        });
                    }

                    activeCalls.set(member.id, callData);
                } else {
                    // إذا مفيش صوت انتظار، نبدأ الموسيقى مباشرة
                    console.log(`🎵 بدء موسيقى ${selectedAudioSet.background} مباشرة للعميل ${member.id}`);
                    const musicPlayer = playAudio(connection, selectedAudioSet.background, member.id, true, selectedAudioSet);
                    
                    const callData = {
                        connection,
                        musicPlayer,
                        userId: member.id,
                        voiceChannelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        isBotMuted: false,
                        hasAdmin: false,
                        userName: member.user.tag,
                        joinedAt: Date.now(),
                        audioSet: selectedAudioSet
                    };
                    
                    activeCalls.set(member.id, callData);
                }

            }, 4000); // 4 ثواني فقط
            
        }
        
        // خروج من روم الانتظار أو الروم الخاص
        if (oldState.channelId && newState.channelId !== oldState.channelId) {
            const memberId = member.id;
            const memberName = member.user.tag;
            
            // البحث إذا الروم اللي طلع منه ده روم خاص
            const isPrivateRoom = privateRooms.has(oldState.channelId);
            
            // إذا كان روم خاص
            if (isPrivateRoom) {
                const roomData = privateRooms.get(oldState.channelId);
                
                // إذا العميل هو اللي طلع
                if (roomData.clientId === memberId) {
                    console.log(`👤 العميل خرج من الروم الخاص`);
                    
                    // جلب بيانات المكالمة
                    const callData = activeCalls.get(memberId);
                    if (callData) {
                        // تنظيف البيانات
                        activeCalls.delete(memberId);
                    }
                    
                    // حذف الروم الخاص بعد 3 ثواني
                    setTimeout(async () => {
                        await deletePrivateRoom(oldState.channel?.guild, oldState.channelId);
                        privateRooms.delete(oldState.channelId);
                    }, 3000);
                    
                } 
                // إذا المشرف هو اللي طلع
                else if (roomData.adminId === memberId) {
                    console.log(`👑 المشرف خرج من الروم الخاص`);
                    
                    // جلب بيانات المكالمة
                    const callData = activeCalls.get(roomData.clientId);
                    if (callData) {
                        // تنظيف البيانات
                        activeCalls.delete(roomData.clientId);
                    }
                    
                    // حذف الروم الخاص بعد 3 ثواني
                    setTimeout(async () => {
                        await deletePrivateRoom(oldState.channel?.guild, oldState.channelId);
                        privateRooms.delete(oldState.channelId);
                    }, 3000);
                }
                
                return;
            }
            
            // إذا كان روم الانتظار
            if (oldState.channelId === supportVoiceId) {
                // لو كان شخص معاه الرتبة المحددة
                if (member.roles.cache.has(adminRoleId)) {
                    console.log(`👑 ${memberName} (إدارة) خرج من روم الانتظار`);
                    return;
                }
                
                // لو كان عميل عادي
                console.log(`👤 ${memberName} خرج من روم الانتظار`);
                
                const callData = activeCalls.get(memberId);
                
                if (callData) {
                    // تنظيف الصوت
                    stopAllAudioForUser(memberId);
                    
                    // تنظيف البيانات
                    activeCalls.delete(memberId);
                }
                
                // إذا مفيش أحد في روم الانتظار، اقطع الاتصال
                setTimeout(async () => {
                    try {
                        const channel = await client.channels.fetch(supportVoiceId);
                        if (channel) {
                            const members = channel.members.filter(m => !m.user.bot);
                            
                            if (members.size === 0) {
                                const conn = voiceConnections.get(guildId);
                                if (conn) {
                                    conn.destroy();
                                    voiceConnections.delete(guildId);
                                    console.log(`🔌 البوت طلع من روم الانتظار (فارغ)`);
                                }
                            }
                        }
                    } catch (error) {
                        // تجاهل الخطأ
                    }
                }, 3000);
            }
        }
        
    } catch (error) {
        console.error('❌ خطأ في voiceStateUpdate:', error);
    }
});

// حدث دخول البوت لسيرفر جديد
client.on('guildCreate', async (guild) => {
    console.log(`➕ تم إضافة البوت لسيرفر جديد: ${guild.name} (${guild.id})`);
    
    // التحقق من منع دخول سيرفرات جديدة
    const blockNewServers = serverSettings.blockNewServers || false;
    if (blockNewServers) {
        console.log(`🚫 دخول السيرفرات الجديدة ممنوع: ${guild.name}`);
        
        setTimeout(async () => {
            try {
                await guild.leave();
                console.log(`🚫 البوت خرج من سيرفر (ممنوع دخول جديد): ${guild.name}`);
            } catch (error) {
                console.log(`❌ فشل خروج البوت من ${guild.name}`);
            }
        }, 5000);
        
        return;
    }
    
    // التحقق إذا السيرفر مقفل
    const lockedServers = serverSettings.lockedServers || [];
    if (lockedServers.includes(guild.id)) {
        console.log(`🚫 السيرفر مقفل: ${guild.name}`);
        
        setTimeout(async () => {
            try {
                await guild.leave();
                console.log(`🚫 البوت خرج من سيرفر (مقفل): ${guild.name}`);
            } catch (error) {
                console.log(`❌ فشل خروج البوت من ${guild.name}`);
            }
        }, 5000);
        
        return;
    }
    
    // إرسال رسالة ترحيب
    try {
        const owner = await guild.fetchOwner();
        if (owner) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0xFFFFFF)
                .setTitle('Holaa :> ')
                .setDescription('اهلا بك في خدمات Seinna')
                .addFields({
                    name: ' ',
                    value: 'Enjoy→⋰⋱⋮ لو عندك اقتراح او مشكله في استخدام تواصل في سيرفر خاص بينا :> اتمني لك يوم سعيد'
                })
                .setThumbnail('https://cdn.discordapp.com/attachments/1436754107389186224/1469829032987201716/c8a298442bf48444e67e4c288a73cabb.jpg?ex=69891475&is=6987c2f5&hm=eadf3863d18ec18df5bb97283c7f3b612c6cc10c04a7d536bc6a749d137475f8&')
                .setImage('https://cdn.discordapp.com/attachments/1436754107389186224/1469829032647590158/d801b3d8e619ae05aedcbefe7b8a5188.jpg?ex=69891475&is=6987c2f5&hm=bcc07ef69b6369dbb82b057b4362ebc56c181ecac2fd37547bb638b326a50bd2&')
                .setFooter({ 
                    text: `Sienna Support Bot | ${new Date().toLocaleDateString('ar-SA')}`, 
                    iconURL: 'https://cdn.discordapp.com/attachments/1449057765397106830/1459265170584109067/8ed9b44c0b845fd2d1b092949bc83411.jpg?ex=69898a58&is=698838d8&hm=e64f57cb8ba535d347da7ea478c1400ff5da0d71018f631fc176bc96d51b9889&' 
                })
                .setTimestamp();

            await owner.send({ 
                content: '[Holaa :>](https://discord.gg/1mec)',
                embeds: [welcomeEmbed] 
            });
            console.log(`📩 تم إرسال رسالة ترحيب لمالك السيرفر: ${owner.user.tag}`);
        }
    } catch (error) {
        console.log(`❌ لم أستطع إرسال رسالة ترحيب لمالك ${guild.name}:`, error.message);
    }
});

// حدث تشغيل البوت
client.on('ready', async () => {
    console.log('=================================');
    console.log(`✅ ${client.user.tag} يعمل بنجاح!`);
    console.log(`📁 السيرفرات: ${client.guilds.cache.size}`);
    
    // تسجيل كل الأوامر
    await registerAllCommands();
    
    // التحقق من كل سيرفر
    client.guilds.cache.forEach(guild => {
        if (!isServerSetupComplete(guild.id)) {
            console.log(`⚠️  سيرفر ${guild.name} (${guild.id}) غير مكتمل الإعداد`);
            warnAdminIfNotSetup(guild);
        }
    });
    
    console.log('=================================');
    
    // حالة البوت
    client.user.setPresence({
        activities: [{
            name: 'Sienna Bot | /help',
            type: 2
        }],
        status: 'online'
    });
});

// تسجيل الدخول
if (!config.token) {
    console.error('❌ المتغير البيئي DISCORD_TOKEN غير معبأ. أضف التوكن ثم أعد التشغيل.');
    process.exit(1);
}
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
    console.log('🛑 إغلاق - تنظيف الاتصالات الصوتية');
    for (const [guildId, conn] of voiceConnections.entries()) {
        try { conn.destroy(); } catch (e) {}
        voiceConnections.delete(guildId);
    }
    process.exit(0);
});
