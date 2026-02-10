
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ملف الإعدادات المنفصل للتذاكر
const TICKET_SETTINGS_FILE = 'ticket-settings.json';

// ================ نظام التخزين ================

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
            // إعدادات النظام الأساسية
            enabled: true,
            ticketChannelId: null,
            ticketCategoryId: null,
            ticketLogsChannelId: null,
            maxTicketsPerUser: 3,
            
            // أنواع التذاكر المخصصة
            ticketTypes: {
                'tech_support': {
                    id: 'tech_support',
                    name: 'الدعم الفني',
                    emoji: '🛠️',
                    color: '#3498db',
                    description: 'مشاكل تقنية واستفسارات فنية',
                    maxActive: 5,
                    enabled: true,
                    buttonStyle: 1, // Primary
                    welcomeMessage: 'مرحباً! فريق الدعم الفني سيساعدك قريباً.',
                    pingRoles: [], // الرتب اللي يتم منشنها
                    requiredRoles: [] // الرتب المطلوبة لفتح هذا النوع
                },
                'report': {
                    id: 'report',
                    name: 'بلاغ أو شكوى',
                    emoji: '🚨',
                    color: '#e74c3c',
                    description: 'الإبلاغ عن مخالفات أو مشاكل',
                    maxActive: 3,
                    enabled: true,
                    buttonStyle: 4, // Danger
                    welcomeMessage: 'تم استلام بلاغك، سنتخذ الإجراء اللازم.',
                    pingRoles: [],
                    requiredRoles: []
                }
            },
            
            // واجهة إنشاء التذاكر
            creationInterface: {
                type: 'select_menu', // select_menu أو buttons
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
            
            // إعدادات رسالة الترحيب
            welcomeMessage: {
                title: '{ticket_type} تذكرة جديدة',
                titleFont: 'default', // يمكن التوسع لأنواع فونت
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
            
            // أزرار التحكم في التذكرة
            controlButtons: {
                // أزرار أساسية
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
                
                // أزرار الاستدعاء
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
            
            // إعدادات الإغلاق
            closeSettings: {
                autoCloseAfter: 24, // ساعة
                deleteAfterClose: false,
                deleteDelay: 10, // دقائق
                closeMessage: 'تم إغلاق التذكرة بواسطة {closer}',
                closeColor: '#e74c3c',
                sendTranscript: true,
                notifyUser: true
            },
            
            // الأدوار والإذونات
            roles: {
                adminRoles: [], // رتب الإدارة
                supportRoles: [], // رتب الدعم
                allowedRoles: [], // الرتب المسموح لها بفتح تذاكر
                blacklistedRoles: [] // الرتب الممنوعة
            },
            
            // القوالب المخصصة
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

// تخزين البيانات النشطة
const activeTickets = new Map(); // التذاكر النشطة
const ticketCooldown = new Map(); // منع التكرار
const designSessions = new Map(); // جلسات التصميم

// ================ نظام التصميم (Design Studio) ================

// دالة لإنشاء جلسة تصميم
function createDesignSession(guildId, userId, section) {
    const key = `${guildId}_${userId}`;
    if (!designSessions.has(key)) {
        designSessions.set(key, {
            currentSection: section,
            changes: {},
            previewData: null
        });
    } else {
        const session = designSessions.get(key);
        session.currentSection = section;
        session.changes = {};
    }
    return designSessions.get(key);
}

// دالة لحفظ تغيير في الجلسة
function saveDesignChange(guildId, userId, path, value) {
    const key = `${guildId}_${userId}`;
    if (!designSessions.has(key)) {
        createDesignSession(guildId, userId, 'main');
    }
    const session = designSessions.get(key);
    
    // تقسيم المسار إلى أجزاء
    const parts = path.split('.');
    let current = session.changes;
    
    // إنشاء الكائنات المتداخلة
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    
    // تعيين القيمة النهائية
    current[parts[parts.length - 1]] = value;
    return session;
}

// دالة لتطبيق التغييرات على الإعدادات
function applyDesignChanges(guildId, userId) {
    const key = `${guildId}_${userId}`;
    if (!designSessions.has(key)) return false;
    
    const session = designSessions.get(key);
    const settings = getTicketSettings(guildId);
    const allSettings = loadTicketSettings();
    
    // دالة مساعدة لتطبيق التغييرات بشكل متداخل
    function applyChanges(target, changes) {
        for (const [key, value] of Object.entries(changes)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                if (!target[key]) target[key] = {};
                applyChanges(target[key], value);
            } else {
                target[key] = value;
            }
        }
    }
    
    applyChanges(settings, session.changes);
    allSettings[guildId] = settings;
    
    // حفظ الإعدادات
    if (saveTicketSettings(allSettings)) {
        designSessions.delete(key);
        return true;
    }
    return false;
}

// ================ نظام إنشاء الواجهات ================

// دالة لإنشاء واجهة إنشاء التذاكر
function buildCreationInterface(settings) {
    const interfaceSettings = settings.creationInterface;
    const ticketTypes = Object.values(settings.ticketTypes).filter(t => t.enabled);
    
    const embed = new EmbedBuilder()
        .setColor(parseInt(interfaceSettings.color.replace('#', ''), 16) || 0x9b59b6);
    
    if (interfaceSettings.title) {
        embed.setTitle(interfaceSettings.title);
    }
    
    if (interfaceSettings.description) {
        embed.setDescription(interfaceSettings.description);
    }
    
    // إضافة أنواع التذاكر كحقول إذا مفعل
    if (interfaceSettings.showTypesAsFields && ticketTypes.length > 0) {
        ticketTypes.forEach(type => {
            embed.addFields({
                name: `${type.emoji} ${type.name}`,
                value: type.description || 'لا يوجد وصف',
                inline: true
            });
        });
    }
    
    // إضافة الحقول المخصصة
    if (interfaceSettings.customFields && interfaceSettings.customFields.length > 0) {
        interfaceSettings.customFields.forEach(field => {
            if (field.name && field.value) {
                embed.addFields({
                    name: field.name,
                    value: field.value,
                    inline: field.inline || false
                });
            }
        });
    }
    
    if (interfaceSettings.thumbnail) {
        embed.setThumbnail(interfaceSettings.thumbnail);
    }
    
    if (interfaceSettings.image) {
        embed.setImage(interfaceSettings.image);
    }
    
    if (interfaceSettings.footer && interfaceSettings.footer.text) {
        embed.setFooter({
            text: interfaceSettings.footer.text,
            iconURL: interfaceSettings.footer.iconURL || null
        });
    }
    
    // بناء المكونات حسب نوع الواجهة
    const components = [];
    
    if (interfaceSettings.type === 'select_menu') {
        // قائمة اختيار أنواع التذاكر
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_ticket_type')
            .setPlaceholder('اختر نوع التذكرة...')
            .setMinValues(1)
            .setMaxValues(1);
        
        const options = ticketTypes.map(type => ({
            label: type.name.length > 25 ? type.name.substring(0, 22) + '...' : type.name,
            value: type.id,
            description: type.description ? (type.description.length > 50 ? type.description.substring(0, 47) + '...' : type.description) : undefined,
            emoji: type.emoji || undefined
        }));
        
        if (options.length > 0) {
            selectMenu.addOptions(options);
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    } else if (interfaceSettings.type === 'buttons') {
        // أزرار أنواع التذاكر
        const buttonsRow = new ActionRowBuilder();
        
        ticketTypes.slice(0, 5).forEach(type => { // ديسكورد بيسمح 5 أزرار في صف
            const buttonStyle = {
                1: ButtonStyle.Primary,
                2: ButtonStyle.Secondary,
                3: ButtonStyle.Success,
                4: ButtonStyle.Danger,
                5: ButtonStyle.Link
            }[type.buttonStyle] || ButtonStyle.Primary;
            
            const button = new ButtonBuilder()
                .setCustomId(`create_ticket_${type.id}`)
                .setLabel(type.name.length > 20 ? type.name.substring(0, 17) + '...' : type.name)
                .setStyle(buttonStyle);
            
            if (type.emoji) {
                button.setEmoji(type.emoji);
            }
            
            buttonsRow.addComponents(button);
        });
        
        if (buttonsRow.components.length > 0) {
            components.push(buttonsRow);
        }
        
        // صف ثاني إذا كان فيه أكثر من 5 أنواع
        if (ticketTypes.length > 5) {
            const secondRow = new ActionRowBuilder();
            ticketTypes.slice(5, 10).forEach(type => {
                const buttonStyle = {
                    1: ButtonStyle.Primary,
                    2: ButtonStyle.Secondary,
                    3: ButtonStyle.Success,
                    4: ButtonStyle.Danger,
                    5: ButtonStyle.Link
                }[type.buttonStyle] || ButtonStyle.Primary;
                
                const button = new ButtonBuilder()
                    .setCustomId(`create_ticket_${type.id}`)
                    .setLabel(type.name.length > 20 ? type.name.substring(0, 17) + '...' : type.name)
                    .setStyle(buttonStyle);
                
                if (type.emoji) {
                    button.setEmoji(type.emoji);
                }
                
                secondRow.addComponents(button);
            });
            
            if (secondRow.components.length > 0) {
                components.push(secondRow);
            }
        }
    }
    
    return { embed, components };
}

// دالة لبناء رسالة الترحيب في التذكرة
function buildWelcomeMessage(ticketData, settings) {
    const welcomeSettings = settings.welcomeMessage;
    const ticketType = settings.ticketTypes[ticketData.type];
    
    // استبدال المتغيرات في النصوص
    function replaceVariables(text) {
        if (!text) return '';
        return text
            .replace(/{user}/g, ticketData.userName)
            .replace(/{user_mention}/g, `<@${ticketData.userId}>`)
            .replace(/{ticket_type}/g, ticketType?.name || 'تذكرة')
            .replace(/{ticket_number}/g, ticketData.number)
            .replace(/{ticket_color}/g, ticketType?.color || '#3498db')
            .replace(/{timestamp}/g, `<t:${Math.floor(Date.now()/1000)}:F>`)
            .replace(/{channel}/g, `<#${ticketData.channelId}>`);
    }
    
    const embed = new EmbedBuilder();
    
    // العنوان
    if (welcomeSettings.title) {
        embed.setTitle(replaceVariables(welcomeSettings.title));
    }
    
    // اللون
    if (welcomeSettings.color) {
        const color = welcomeSettings.color === '{ticket_color}' 
            ? (ticketType?.color || '#3498db')
            : welcomeSettings.color;
        embed.setColor(parseInt(color.replace('#', ''), 16));
    }
    
    // الوصف
    if (welcomeSettings.description) {
        embed.setDescription(replaceVariables(welcomeSettings.description));
    }
    
    // الحقول الأساسية
    if (welcomeSettings.fields && welcomeSettings.fields.length > 0) {
        const fields = welcomeSettings.fields.map(field => ({
            name: replaceVariables(field.name),
            value: replaceVariables(field.value),
            inline: field.inline || false
        }));
        embed.addFields(fields);
    }
    
    // الحقول الإضافية
    if (welcomeSettings.additionalFields && welcomeSettings.additionalFields.length > 0) {
        welcomeSettings.additionalFields.forEach(field => {
            if (field.name && field.value) {
                embed.addFields({
                    name: replaceVariables(field.name),
                    value: replaceVariables(field.value),
                    inline: field.inline || false
                });
            }
        });
    }
    
    // الصور
    if (welcomeSettings.thumbnail) {
        embed.setThumbnail(replaceVariables(welcomeSettings.thumbnail));
    }
    
    if (welcomeSettings.image) {
        embed.setImage(replaceVariables(welcomeSettings.image));
    }
    
    // الفوتر
    if (welcomeSettings.footer && welcomeSettings.footer.text) {
        embed.setFooter({
            text: replaceVariables(welcomeSettings.footer.text),
            iconURL: welcomeSettings.footer.iconURL ? replaceVariables(welcomeSettings.footer.iconURL) : null
        });
    }
    
    // الطابع الزمني
    if (welcomeSettings.timestamp) {
        embed.setTimestamp();
    }
    
    return embed;
}

// دالة لبناء أزرار التحكم في التذكرة
function buildControlButtons(ticketData, settings) {
    const controlSettings = settings.controlButtons;
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;
    
    // فرز الأزرار حسب الترتيب
    const buttons = Object.entries(controlSettings)
        .filter(([key, config]) => config.enabled && config.position)
        .sort((a, b) => a[1].position - b[1].position);
    
    for (const [buttonId, config] of buttons) {
        // تخطي قائمة الاستدعاء (هتتعامل معاها بعدين)
        if (buttonId === 'pingMenu') continue;
        
        const buttonStyle = ButtonStyle[config.style] || ButtonStyle.Secondary;
        const button = new ButtonBuilder()
            .setCustomId(`${buttonId}_${ticketData.channelId}`)
            .setLabel(config.label)
            .setStyle(buttonStyle);
        
        if (config.emoji) {
            button.setEmoji(config.emoji);
        }
        
        currentRow.addComponents(button);
        buttonCount++;
        
        // كل 5 أزرار نبدأ صف جديد
        if (buttonCount === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
    }
    
    // إضافة الصف الأخير إذا كان فيه أزرار
    if (buttonCount > 0) {
        rows.push(currentRow);
    }
    
    // إضافة قائمة الاستدعاء إذا مفعلة
    if (controlSettings.pingMenu.enabled) {
        const pingMenu = new StringSelectMenuBuilder()
            .setCustomId(`ping_menu_${ticketData.channelId}`)
            .setPlaceholder(controlSettings.pingMenu.label)
            .setMinValues(1)
            .setMaxValues(1);
        
        if (controlSettings.pingMenu.emoji) {
            pingMenu.setEmoji(controlSettings.pingMenu.emoji);
        }
        
        const options = controlSettings.pingMenu.options.map(option => ({
            label: option.label.length > 25 ? option.label.substring(0, 22) + '...' : option.label,
            value: option.value,
            description: option.description ? (option.description.length > 50 ? option.description.substring(0, 47) + '...' : option.description) : undefined,
            emoji: option.emoji || undefined
        }));
        
        if (options.length > 0) {
            pingMenu.addOptions(options);
            rows.push(new ActionRowBuilder().addComponents(pingMenu));
        }
    }
    
    return rows;
}

// ================ النظام الأساسي ================

module.exports = (client) => {
    console.log('🎨 نظام تذاكر PRO جاهز!');
    
    // ================ أوامر التصميم ================
    
    const designCommands = [
        {
            name: 'ticket-design',
            description: '🎨 تصميم نظام التذاكر',
            options: [
                {
                    name: 'panel',
                    description: 'لوحة تحكم التصميم الرئيسية',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'types',
                    description: 'إدارة أنواع التذاكر',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'action',
                            description: 'الإجراء المطلوب',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'إنشاء نوع جديد', value: 'create' },
                                { name: 'تعديل نوع', value: 'edit' },
                                { name: 'حذف نوع', value: 'delete' },
                                { name: 'قائمة الأنواع', value: 'list' },
                                { name: 'تفعيل/تعطيل', value: 'toggle' }
                            ]
                        },
                        {
                            name: 'id',
                            description: 'معرف النوع',
                            type: 3, // STRING
                            required: false
                        }
                    ]
                },
                {
                    name: 'interface',
                    description: 'تصميم واجهة الإنشاء',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'element',
                            description: 'العنصر المراد تعديله',
                            type: 3, // STRING
                            required: true,
                            choices: [
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
                            ]
                        },
                        {
                            name: 'value',
                            description: 'القيمة الجديدة',
                            type: 3, // STRING
                            required: false
                        },
                        {
                            name: 'value2',
                            description: 'القيمة الثانية',
                            type: 3, // STRING
                            required: false
                        }
                    ]
                },
                {
                    name: 'welcome',
                    description: 'تصميم رسالة الترحيب',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'element',
                            description: 'العنصر المراد تعديله',
                            type: 3, // STRING
                            required: true,
                            choices: [
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
                            ]
                        },
                        {
                            name: 'value',
                            description: 'القيمة الجديدة',
                            type: 3, // STRING
                            required: false
                        },
                        {
                            name: 'value2',
                            description: 'القيمة الثانية',
                            type: 3, // STRING
                            required: false
                        }
                    ]
                },
                {
                    name: 'buttons',
                    description: 'تصميم أزرار التحكم',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'button',
                            description: 'الزر المراد تعديله',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'إغلاق التذكرة', value: 'close' },
                                { name: 'إضافة عضو', value: 'addUser' },
                                { name: 'تغيير الاسم', value: 'rename' },
                                { name: 'حفظ المحادثة', value: 'transcript' },
                                { name: 'إعادة التحميل', value: 'reset' },
                                { name: 'قائمة الاستدعاء', value: 'pingMenu' }
                            ]
                        },
                        {
                            name: 'property',
                            description: 'الخاصية المراد تعديلها',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'النص', value: 'label' },
                                { name: 'الإيموجي', value: 'emoji' },
                                { name: 'النمط', value: 'style' },
                                { name: 'التفعيل', value: 'enabled' },
                                { name: 'الترتيب', value: 'position' }
                            ]
                        },
                        {
                            name: 'value',
                            description: 'القيمة الجديدة',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'preview',
                    description: 'معاينة التصميم',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'section',
                            description: 'القسم المراد معاينته',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'واجهة الإنشاء', value: 'interface' },
                                { name: 'رسالة الترحيب', value: 'welcome' },
                                { name: 'أزرار التحكم', value: 'buttons' }
                            ]
                        }
                    ]
                },
                {
                    name: 'save',
                    description: 'حفظ التصميم',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'reset-design',
                    description: 'إعادة تعيين التصميم',
                    type: 1 // SUB_COMMAND
                }
            ]
        },
        {
            name: 'ticket-send',
            description: 'إرسال واجهة التذاكر',
            options: [
                {
                    name: 'channel',
                    description: 'القناة المراد الإرسال فيها',
                    type: 7, // CHANNEL
                    channel_types: [0], // GUILD_TEXT
                    required: true
                }
            ]
        }
    ];
    
    // ================ معالجة الأوامر ================
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isCommand()) return;
        
        const { commandName, options, guild, member, user } = interaction;
        
        // التحقق من الصلاحيات
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: '❌ **ليس لديك صلاحية استخدام أوامر التصميم!**',
                ephemeral: true
            });
        }
        
        // أمر لوحة تحكم التصميم
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
                        value: `\`/ticket-design buttons\`\n**الأزرار:** ${Object.values(settings.controlButtons).filter(b => b.enabled).length}\n**القوائم:** ${settings.controlButtons.pingMenu.enabled ? '✅' : '❌'}`,
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
        
        // أمر إدارة أنواع التذاكر
        if (commandName === 'ticket-design' && options.getSubcommand() === 'types') {
            const action = options.getString('action');
            const typeId = options.getString('id');
            const settings = getTicketSettings(guild.id);
            
            switch (action) {
                case 'create':
                    // عرض modal لإنشاء نوع جديد
                    const createModal = new ModalBuilder()
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
                    
                    const descriptionInput = new TextInputBuilder()
                        .setCustomId('type_description')
                        .setLabel('الوصف')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('وصف مختصر للنوع')
                        .setRequired(false);
                    
                    const maxInput = new TextInputBuilder()
                        .setCustomId('type_max')
                        .setLabel('الحد الأقصى للتذاكر النشطة')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('5')
                        .setValue('5')
                        .setRequired(true);
                    
                    const firstRow = new ActionRowBuilder().addComponents(nameInput);
                    const secondRow = new ActionRowBuilder().addComponents(emojiInput);
                    const thirdRow = new ActionRowBuilder().addComponents(colorInput);
                    const fourthRow = new ActionRowBuilder().addComponents(descriptionInput);
                    const fifthRow = new ActionRowBuilder().addComponents(maxInput);
                    
                    createModal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
                    
                    return await interaction.showModal(createModal);
                    
                case 'list':
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
                    
                default:
                    return interaction.reply({
                        content: '⏳ **جاري التطوير...**\nهذا الخيار سيكون متاحاً قريباً!',
                        ephemeral: true
                    });
            }
        }
        
        // أمر تصميم واجهة الإنشاء
        if (commandName === 'ticket-design' && options.getSubcommand() === 'interface') {
            const element = options.getString('element');
            const value = options.getString('value');
            const value2 = options.getString('value2');
            
            const session = createDesignSession(guild.id, user.id, 'interface');
            
            switch (element) {
                case 'type':
                    if (!value || (value !== 'select_menu' && value !== 'buttons')) {
                        return interaction.reply({
                            content: '❌ **قيمة غير صالحة!**\nالقيم المسموحة: `select_menu` أو `buttons`',
                            ephemeral: true
                        });
                    }
                    saveDesignChange(guild.id, user.id, 'creationInterface.type', value);
                    return interaction.reply({
                        content: `✅ **تم تغيير نوع الواجهة إلى:** ${value === 'select_menu' ? 'قائمة اختيار' : 'أزرار'}`,
                        ephemeral: true
                    });
                    
                case 'title':
                    saveDesignChange(guild.id, user.id, 'creationInterface.title', value || '🎫 نظام التذاكر');
                    return interaction.reply({
                        content: `✅ **تم تحديث العنوان:**\n${value || '🎫 نظام التذاكر'}`,
                        ephemeral: true
                    });
                    
                case 'description':
                    saveDesignChange(guild.id, user.id, 'creationInterface.description', value || 'اختر نوع التذكرة المناسب لك');
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
                    saveDesignChange(guild.id, user.id, 'creationInterface.color', value || '#9b59b6');
                    return interaction.reply({
                        content: `✅ **تم تحديث اللون إلى:** \`${value || '#9b59b6'}\``,
                        ephemeral: true
                    });
                    
                case 'show_fields':
                    const showFields = value === 'true';
                    saveDesignChange(guild.id, user.id, 'creationInterface.showTypesAsFields', showFields);
                    return interaction.reply({
                        content: `✅ **تم ${showFields ? 'تفعيل' : 'تعطيل'} عرض الأنواع كحقول**`,
                        ephemeral: true
                    });
                    
                default:
                    return interaction.reply({
                        content: '⏳ **جاري التطوير...**\nهذا الخيار سيكون متاحاً قريباً!',
                        ephemeral: true
                    });
            }
        }
        
        // أمر معاينة التصميم
        if (commandName === 'ticket-design' && options.getSubcommand() === 'preview') {
            const section = options.getString('section');
            const settings = getTicketSettings(guild.id);
            const session = designSessions.get(`${guild.id}_${user.id}`);
            
            // دمج التغييرات المؤقتة مع الإعدادات الحالية
            let previewSettings = JSON.parse(JSON.stringify(settings));
            if (session && session.changes) {
                // تطبيق التغييرات المؤقتة
                function applyPreviewChanges(target, changes) {
                    for (const [key, value] of Object.entries(changes)) {
                        if (value && typeof value === 'object' && !Array.isArray(value)) {
                            if (!target[key]) target[key] = {};
                            applyPreviewChanges(target[key], value);
                        } else {
                            target[key] = value;
                        }
                    }
                }
                applyPreviewChanges(previewSettings, session.changes);
            }
            
            switch (section) {
                case 'interface':
                    const { embed, components } = buildCreationInterface(previewSettings);
                    return interaction.reply({
                        content: '👁️ **معاينة واجهة الإنشاء:**',
                        embeds: [embed],
                        components: components,
                        ephemeral: true
                    });
                    
                case 'welcome':
                    // بيانات تذكرة وهمية للمعاينة
                    const mockTicket = {
                        userId: user.id,
                        userName: user.username,
                        type: 'tech_support',
                        number: '0001',
                        channelId: interaction.channelId
                    };
                    
                    const welcomeEmbed = buildWelcomeMessage(mockTicket, previewSettings);
                    return interaction.reply({
                        content: '👁️ **معاينة رسالة الترحيب:**',
                        embeds: [welcomeEmbed],
                        ephemeral: true
                    });
                    
                case 'buttons':
                    // بيانات تذكرة وهمية
                    const mockTicket2 = {
                        userId: user.id,
                        userName: user.username,
                        type: 'tech_support',
                        number: '0001',
                        channelId: interaction.channelId
                    };
                    
                    const buttonRows = buildControlButtons(mockTicket2, previewSettings);
                    const previewEmbed = new EmbedBuilder()
                        .setColor(0x3498db)
                        .setTitle('👁️ معاينة أزرار التحكم')
                        .setDescription('**أزرار التحكم في التذكرة:**')
                        .addFields(
                            { name: '🔒 إغلاق', value: 'إغلاق التذكرة', inline: true },
                            { name: '➕ إضافة', value: 'إضافة عضو', inline: true },
                            { name: '✏️ تغيير الاسم', value: 'تغيير اسم التذكرة', inline: true },
                            { name: '📄 حفظ', value: 'حفظ نسخة المحادثة', inline: true },
                            { name: '🔄 إعادة', value: 'إعادة تحميل القائمة', inline: true },
                            { name: '📢 استدعاء', value: 'قائمة الاستدعاءات', inline: true }
                        )
                        .setFooter({ text: 'هذه معاينة - الأزرار لن تعمل' });
                    
                    return interaction.reply({
                        embeds: [previewEmbed],
                        components: buttonRows,
                        ephemeral: true
                    });
            }
        }
        
        // أمر حفظ التصميم
        if (commandName === 'ticket-design' && options.getSubcommand() === 'save') {
            const saved = applyDesignChanges(guild.id, user.id);
            
            if (saved) {
                return interaction.reply({
                    content: '✅ **تم حفظ التصميم بنجاح!**\n\nيمكنك الآن استخدام `/ticket-send` لإرسال الواجهة.',
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: '❌ **لم يتم حفظ أي تغييرات!**\n\nقم بإجراء بعض التعديلات أولاً.',
                    ephemeral: true
                });
            }
        }
        
        // أمر إرسال الواجهة
        if (commandName === 'ticket-send') {
            const channel = options.getChannel('channel');
            
            if (channel.type !== ChannelType.GuildText) {
                return interaction.reply({
                    content: '❌ **يجب اختيار قناة نصية!**',
                    ephemeral: true
                });
            }
            
            const settings = getTicketSettings(guild.id);
            
            // التحقق من إعداد القناة
            if (!settings.ticketChannelId) {
                // حفظ القناة كقناة التذاكر الرسمية
                saveDesignChange(guild.id, user.id, 'ticketChannelId', channel.id);
                applyDesignChanges(guild.id, user.id);
            }
            
            // بناء الواجهة
            const { embed, components } = buildCreationInterface(settings);
            
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
    });
    
    // ================ معالجة الـ Modals ================
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        
        // إنشاء نوع تذكرة جديد
        if (interaction.customId === 'create_ticket_type') {
            try {
                const name = interaction.fields.getTextInputValue('type_name');
                const emoji = interaction.fields.getTextInputValue('type_emoji') || '';
                const color = interaction.fields.getTextInputValue('type_color');
                const description = interaction.fields.getTextInputValue('type_description') || '';
                const maxActive = parseInt(interaction.fields.getTextInputValue('type_max')) || 5;
                
                // التحقق من صحة اللون
                if (!/^#[0-9A-F]{6}$/i.test(color)) {
                    return interaction.reply({
                        content: '❌ **تنسيق اللون غير صحيح!**\nاستخدم hex code مثل: `#3498db`',
                        ephemeral: true
                    });
                }
                
                // إنشاء معرف فريد
                const typeId = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 20);
                
                const settings = getTicketSettings(interaction.guild.id);
                const allSettings = loadTicketSettings();
                
                // التحقق إذا النوع موجود بالفعل
                if (settings.ticketTypes[typeId]) {
                    return interaction.reply({
                        content: `❌ **النوع \`${typeId}\` موجود بالفعل!**`,
                        ephemeral: true
                    });
                }
                
                // إنشاء النوع الجديد
                settings.ticketTypes[typeId] = {
                    id: typeId,
                    name: name,
                    emoji: emoji,
                    color: color,
                    description: description,
                    maxActive: maxActive,
                    enabled: true,
                    buttonStyle: 1, // Primary
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
                        { name: 'الحد الأقصى', value: `${maxActive} تذاكر`, inline: true },
                        { name: 'الوصف', value: description || 'لا يوجد وصف', inline: false }
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
            await handleCreateTicket(interaction);
        }
        
        // أزرار التحكم في التذكرة
        if (interaction.customId.startsWith('close_ticket_') ||
            interaction.customId.startsWith('add_user_') ||
            interaction.customId.startsWith('rename_ticket_') ||
            interaction.customId.startsWith('save_transcript_') ||
            interaction.customId.startsWith('reset_menu_') ||
            interaction.customId.startsWith('ping_menu_')) {
            
            await handleControlButton(interaction);
        }
    });
    
    // دالة معالجة إنشاء التذكرة
    async function handleCreateTicket(interaction) {
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
            } else {
                return interaction.reply({
                    content: '❌ **نوع التذكرة غير محدد!**',
                    ephemeral: true
                });
            }
            
            // التحقق من وجود النوع
            const ticketType = settings.ticketTypes[ticketTypeId];
            if (!ticketType || !ticketType.enabled) {
                return interaction.reply({
                    content: '❌ **نوع التذكرة غير متاح!**',
                    ephemeral: true
                });
            }
            
            // التحقق من عدد تذاكر المستخدم
            const userTickets = Array.from(activeTickets.values()).filter(
                t => t.userId === member.id && t.guildId === guild.id && t.type === ticketTypeId
            );
            
            if (userTickets.length >= ticketType.maxActive) {
                return interaction.reply({
                    content: `❌ **لقد وصلت للحد الأقصى للتذاكر النشطة من نوع ${ticketType.name}!**\n\nالحد: ${ticketType.maxActive} تذاكر`,
                    ephemeral: true
                });
            }
            
            // التحقق من الرتب المطلوبة
            if (ticketType.requiredRoles && ticketType.requiredRoles.length > 0) {
                const hasRequiredRole = ticketType.requiredRoles.some(roleId => 
                    member.roles.cache.has(roleId)
                );
                if (!hasRequiredRole) {
                    return interaction.reply({
                        content: `❌ **ليس لديك الرتب المطلوبة لفتح تذكرة ${ticketType.name}!**`,
                        ephemeral: true
                    });
                }
            }
            
            // التحقق من الرتب المحظورة
            if (settings.roles.blacklistedRoles && settings.roles.blacklistedRoles.length > 0) {
                const hasBlacklistedRole = settings.roles.blacklistedRoles.some(roleId => 
                    member.roles.cache.has(roleId)
                );
                if (hasBlacklistedRole) {
                    return interaction.reply({
                        content: '❌ **رتبتك محظورة من فتح التذاكر!**',
                        ephemeral: true
                    });
                }
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
            const welcomeEmbed = buildWelcomeMessage(ticketData, settings);
            const controlButtons = buildControlButtons(ticketData, settings);
            
            // بناء محتوى الرسالة
            let messageContent = `${member}`;
            
            // إضافة المنشن للرتب إذا محدد
            if (ticketType.pingRoles && ticketType.pingRoles.length > 0) {
                messageContent += ' ' + ticketType.pingRoles.map(roleId => `<@&${roleId}>`).join(' ');
            }
            
            // إضافة رتب الإدارة إذا محدد
            if (settings.roles.adminRoles && settings.roles.adminRoles.length > 0) {
                messageContent += ' ' + settings.roles.adminRoles.map(roleId => `<@&${roleId}>`).join(' ');
            }
            
            await ticketChannel.send({
                content: messageContent,
                embeds: [welcomeEmbed],
                components: controlButtons
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
            
            // إضافة رتب الإدارة
            if (settings.roles.adminRoles && settings.roles.adminRoles.length > 0) {
                for (const roleId of settings.roles.adminRoles) {
                    try {
                        const role = await guild.roles.fetch(roleId);
                        if (role) {
                            await ticketChannel.permissionOverwrites.create(role, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true,
                                ManageMessages: true,
                                ManageChannels: true
                            });
                        }
                    } catch (error) {
                        console.log(`❌ لم أستطع إضافة رتبة ${roleId} للتذكرة`);
                    }
                }
            }
            
            // إضافة رتب الدعم
            if (settings.roles.supportRoles && settings.roles.supportRoles.length > 0) {
                for (const roleId of settings.roles.supportRoles) {
                    try {
                        const role = await guild.roles.fetch(roleId);
                        if (role) {
                            await ticketChannel.permissionOverwrites.create(role, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            });
                        }
                    } catch (error) {
                        console.log(`❌ لم أستطع إضافة رتبة دعم ${roleId} للتذكرة`);
                    }
                }
            }
            
            // إضافة البوت
            await ticketChannel.permissionOverwrites.create(guild.members.me, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true,
                ManageRoles: true
            });
            
            return ticketChannel;
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء قناة التذكرة:', error);
            return null;
        }
    }
    
    // دالة معالجة أزرار التحكم
    async function handleControlButton(interaction) {
        try {
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
            
            const settings = getTicketSettings(interaction.guild.id);
            
            // تحديد نوع الزر
            const buttonType = interaction.customId.split('_')[0];
            
            switch (buttonType) {
                case 'close':
                    await handleCloseTicket(interaction, channel, ticketData, settings);
                    break;
                    
                case 'add':
                    if (interaction.customId.startsWith('add_user_')) {
                        await handleAddUser(interaction, channel, ticketData, settings);
                    }
                    break;
                    
                case 'rename':
                    if (interaction.customId.startsWith('rename_ticket_')) {
                        await handleRenameTicket(interaction, channel, ticketData, settings);
                    }
                    break;
                    
                case 'save':
                    if (interaction.customId.startsWith('save_transcript_')) {
                        await handleSaveTranscript(interaction, channel, ticketData, settings);
                    }
                    break;
                    
                case 'reset':
                    if (interaction.customId.startsWith('reset_menu_')) {
                        await handleResetMenu(interaction, channel, ticketData, settings);
                    }
                    break;
                    
                case 'ping':
                    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ping_menu_')) {
                        await handlePingMenu(interaction, channel, ticketData, settings);
                    }
                    break;
            }
            
        } catch (error) {
            console.error('❌ خطأ في معالجة زر التحكم:', error);
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ **حدث خطأ أثناء معالجة الطلب!**'
                });
            } else {
                await interaction.reply({
                    content: '❌ **حدث خطأ أثناء معالجة الطلب!**',
                    ephemeral: true
                });
            }
        }
    }
    
    // دالة معالجة إغلاق التذكرة
    async function handleCloseTicket(interaction, channel, ticketData, settings) {
        // التحقق من الصلاحيات
        const isOwner = interaction.user.id === ticketData.userId;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = settings.roles.adminRoles?.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );
        
        if (!isOwner && !isAdmin && !hasAdminRole) {
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
            .addFields(
                { name: '👤 مقدم الطلب', value: `<@${ticketData.userId}>`, inline: true },
                { name: '📌 نوع التذكرة', value: ticketData.typeName, inline: true },
                { name: '🕐 مدة التذكرة', value: formatDuration(Date.now() - ticketData.createdAt), inline: true }
            )
            .setFooter({ text: `تم الإغلاق في ${new Date().toLocaleString('ar-SA')}` })
            .setTimestamp();
        
        await channel.send({ embeds: [closeEmbed] });
        
        // إزالة صلاحيات المستخدم
        try {
            await channel.permissionOverwrites.edit(ticketData.userId, {
                ViewChannel: false,
                SendMessages: false
            });
        } catch (error) {
            console.log('❌ لم أستطع تحديث صلاحيات المستخدم');
        }
        
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
    
    // دالة معالجة إضافة عضو
    async function handleAddUser(interaction, channel, ticketData, settings) {
        // التحقق من الصلاحيات
        const isOwner = interaction.user.id === ticketData.userId;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = settings.roles.adminRoles?.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );
        
        if (!isOwner && !isAdmin && !hasAdminRole) {
            return interaction.reply({
                content: '❌ **فقط صاحب التذكرة أو فريق الإدارة يمكنهم إضافة أعضاء!**',
                ephemeral: true
            });
        }
        
        // إنشاء modal لإدخال معرف العضو
        const modal = new ModalBuilder()
            .setCustomId(`add_user_modal_${channel.id}`)
            .setTitle('إضافة عضو للتذكرة');
        
        const userIdInput = new TextInputBuilder()
            .setCustomId('user_to_add')
            .setLabel('معرف العضو المراد إضافته')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('أدخل ID العضو أو قم بمنشنه @')
            .setRequired(true);
        
        const actionRow = new ActionRowBuilder().addComponents(userIdInput);
        modal.addComponents(actionRow);
        
        await interaction.showModal(modal);
    }
    
    // دالة معالجة تغيير الاسم
    async function handleRenameTicket(interaction, channel, ticketData, settings) {
        // التحقق من الصلاحيات
        const isOwner = interaction.user.id === ticketData.userId;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = settings.roles.adminRoles?.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );
        
        if (!isOwner && !isAdmin && !hasAdminRole) {
            return interaction.reply({
                content: '❌ **فقط صاحب التذكرة أو فريق الإدارة يمكنهم تغيير الاسم!**',
                ephemeral: true
            });
        }
        
        // إنشاء modal لتغيير الاسم
        const modal = new ModalBuilder()
            .setCustomId(`rename_ticket_modal_${channel.id}`)
            .setTitle('تغيير اسم التذكرة');
        
        const newNameInput = new TextInputBuilder()
            .setCustomId('new_ticket_name')
            .setLabel('الاسم الجديد للتذكرة')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('أدخل الاسم الجديد (بدون إيموجيات)')
            .setRequired(true);
        
        const actionRow = new ActionRowBuilder().addComponents(newNameInput);
        modal.addComponents(actionRow);
        
        await interaction.showModal(modal);
    }
    
    // دالة معالجة حفظ النسخة
    async function handleSaveTranscript(interaction, channel, ticketData, settings) {
        // التحقق من الصلاحيات
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = settings.roles.adminRoles?.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );
        
        if (!isAdmin && !hasAdminRole) {
            return interaction.reply({
                content: '❌ **فقط فريق الإدارة يمكنه حفظ نسخة المحادثة!**',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            
            let transcript = `# نسخة محادثة التذكرة\n`;
            transcript += `## ${channel.name}\n`;
            transcript += `### المستخدم: ${ticketData.userName} (${ticketData.userId})\n`;
            transcript += `### النوع: ${ticketData.typeName}\n`;
            transcript += `### التاريخ: ${new Date().toLocaleString('ar-SA')}\n`;
            transcript += `### المحفوظ بواسطة: ${interaction.user.tag}\n\n`;
            transcript += '---\n\n';
            
            messages.reverse().forEach(msg => {
                transcript += `**[${msg.author.tag} - ${msg.createdAt.toLocaleString('ar-SA')}]**\n`;
                transcript += `${msg.content}\n`;
                if (msg.attachments.size > 0) {
                    transcript += `*مرفقات: ${msg.attachments.map(a => a.url).join(', ')}*\n`;
                }
                transcript += `\n`;
            });
            
            const fileName = `transcript-${channel.name}-${Date.now()}.txt`;
            const filePath = path.join(__dirname, fileName);
            
            fs.writeFileSync(filePath, transcript, 'utf8');
            
            await interaction.editReply({
                content: '✅ **تم حفظ نسخة المحادثة!**',
                files: [{
                    attachment: filePath,
                    name: fileName
                }]
            });
            
            // حذف الملف المؤقت
            setTimeout(() => {
                try {
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.log('❌ لم أستطع حذف الملف المؤقت:', error);
                }
            }, 5000);
            
        } catch (error) {
            console.error('❌ خطأ في حفظ النسخة:', error);
            await interaction.editReply({
                content: '❌ **حدث خطأ أثناء حفظ نسخة المحادثة!**'
            });
        }
    }
    
    // دالة معالجة إعادة تحميل القائمة
    async function handleResetMenu(interaction, channel, ticketData, settings) {
        // التحقق من الصلاحيات
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = settings.roles.adminRoles?.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );
        
        if (!isAdmin && !hasAdminRole) {
            return interaction.reply({
                content: '❌ **فقط فريق الإدارة يمكنه إعادة تحميل القائمة!**',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        // إعادة بناء أزرار التحكم
        const controlButtons = buildControlButtons(ticketData, settings);
        
        // البحث عن رسالة الترحيب الأصلية
        const messages = await channel.messages.fetch({ limit: 10 });
        const welcomeMessage = messages.find(msg => 
            msg.embeds.length > 0 && 
            msg.embeds[0].title && 
            msg.embeds[0].title.includes('تذكرة')
        );
        
        if (welcomeMessage) {
            try {
                const embed = EmbedBuilder.from(welcomeMessage.embeds[0]);
                await welcomeMessage.edit({
                    embeds: [embed],
                    components: controlButtons
                });
                
                await interaction.editReply({
                    content: '✅ **تم إعادة تحميل قائمة التحكم بنجاح!**'
                });
            } catch (error) {
                await interaction.editReply({
                    content: '❌ **فشل إعادة تحميل القائمة!**'
                });
            }
        } else {
            await interaction.editReply({
                content: '❌ **لم أستطع العثور على رسالة الترحيب!**'
            });
        }
    }
    
    // دالة معالجة قائمة الاستدعاء
    async function handlePingMenu(interaction, channel, ticketData, settings) {
        const selectedOption = interaction.values[0];
        
        await interaction.deferReply({ ephemeral: true });
        
        let pingMessage = '';
        let success = false;
        
        switch (selectedOption) {
            case 'ping_dm':
                // محاولة إرسال رسالة في الخاص
                try {
                    const user = await interaction.guild.members.fetch(ticketData.userId);
                    if (user) {
                        await user.send(`📢 **إشعار من تذكرتك:**\nتم استدعاؤك في تذكرتك ${channel} بواسطة <@${interaction.user.id}>`);
                        pingMessage = '✅ **تم إرسال إشعار في الخاص للمستخدم!**';
                        success = true;
                    }
                } catch (error) {
                    pingMessage = '❌ **لم أستطع إرسال رسالة في الخاص!**\nالمستخدم قد يكون مغلق الخاص.';
                }
                break;
                
            case 'ping_server':
                // منشن في قناة التذاكر
                if (settings.ticketChannelId) {
                    const ticketChannel = await interaction.guild.channels.fetch(settings.ticketChannelId).catch(() => null);
                    if (ticketChannel) {
                        await ticketChannel.send(`📢 **إشعار تذكرة:**\nتم استدعاء <@${ticketData.userId}> في تذكرته ${channel} بواسطة <@${interaction.user.id}>`);
                        pingMessage = '✅ **تم إرسال إشعار في قناة التذاكر!**';
                        success = true;
                    }
                } else {
                    pingMessage = '❌ **لم يتم تحديد قناة التذاكر!**';
                }
                break;
                
            case 'ping_admin':
                // استدعاء فريق الإدارة
                if (settings.roles.adminRoles && settings.roles.adminRoles.length > 0) {
                    const mentions = settings.roles.adminRoles.map(roleId => `<@&${roleId}>`).join(' ');
                    await channel.send(`📢 **استدعاء فريق الإدارة:**\n${mentions}\nبواسطة: <@${interaction.user.id}>`);
                    pingMessage = '✅ **تم استدعاء فريق الإدارة!**';
                    success = true;
                } else {
                    pingMessage = '❌ **لم يتم تحديد رتب الإدارة!**';
                }
                break;
                
            case 'ping_support':
                // استدعاء فريق الدعم
                if (settings.roles.supportRoles && settings.roles.supportRoles.length > 0) {
                    const mentions = settings.roles.supportRoles.map(roleId => `<@&${roleId}>`).join(' ');
                    await channel.send(`📢 **استدعاء فريق الدعم:**\n${mentions}\nبواسطة: <@${interaction.user.id}>`);
                    pingMessage = '✅ **تم استدعاء فريق الدعم!**';
                    success = true;
                } else {
                    pingMessage = '❌ **لم يتم تحديد رتب الدعم!**';
                }
                break;
                
            case 'ping_owner':
                // استدعاء مالك السيرفر
                try {
                    const owner = await interaction.guild.fetchOwner();
                    if (owner) {
                        await channel.send(`📢 **استدعاء مالك السيرفر:**\n<@${owner.id}>\nبواسطة: <@${interaction.user.id}>`);
                        pingMessage = '✅ **تم استدعاء مالك السيرفر!**';
                        success = true;
                    }
                } catch (error) {
                    pingMessage = '❌ **لم أستطع العثور على مالك السيرفر!**';
                }
                break;
        }
        
        if (success) {
            // إرسال تأكيد في التذكرة
            const pingEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📢 تم الاستدعاء')
                .setDescription(`تم تنفيذ الاستدعاء بنجاح بواسطة <@${interaction.user.id}>`)
                .addFields({
                    name: 'النوع',
                    value: interaction.message.components[interaction.message.components.length - 1]
                        .components[0].options.find(opt => opt.value === selectedOption)?.label || 'غير معروف'
                })
                .setTimestamp();
            
            await channel.send({ embeds: [pingEmbed] });
        }
        
        await interaction.editReply({
            content: pingMessage
        });
    }
    
    // معالجة الـ Modals الإضافية
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        
        // إضافة عضو
        if (interaction.customId.startsWith('add_user_modal_')) {
            const channelId = interaction.customId.replace('add_user_modal_', '');
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            
            if (!channel) {
                return interaction.reply({
                    content: '❌ **قناة التذكرة غير موجودة!**',
                    ephemeral: true
                });
            }
            
            const userId = interaction.fields.getTextInputValue('user_to_add').replace(/[<@!>]/g, '');
            
            try {
                const member = await interaction.guild.members.fetch(userId);
                
                // إضافة العضو للتذكرة
                await channel.permissionOverwrites.create(member, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });
                
                await interaction.reply({
                    content: `✅ **تمت إضافة ${member} للتذكرة بنجاح!**`,
                    ephemeral: true
                });
                
                // إشعار في التذكرة
                const notifyEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('➕ عضو جديد')
                    .setDescription(`تمت إضافة ${member} إلى التذكرة بواسطة <@${interaction.user.id}>`)
                    .setTimestamp();
                
                await channel.send({ embeds: [notifyEmbed] });
                
            } catch (error) {
                console.error('❌ خطأ في إضافة العضو:', error);
                await interaction.reply({
                    content: '❌ **حدث خطأ أثناء إضافة العضو!**\nتأكد من صحة ID العضو.',
                    ephemeral: true
                });
            }
        }
        
        // تغيير اسم التذكرة
        if (interaction.customId.startsWith('rename_ticket_modal_')) {
            const channelId = interaction.customId.replace('rename_ticket_modal_', '');
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            
            if (!channel) {
                return interaction.reply({
                    content: '❌ **قناة التذكرة غير موجودة!**',
                    ephemeral: true
                });
            }
            
            const newName = interaction.fields.getTextInputValue('new_ticket_name');
            
            try {
                // الحفاظ على الإيموجي الأول إذا موجود
                const currentName = channel.name;
                const hasEmoji = /^[^\w]/.test(currentName);
                const finalName = hasEmoji ? currentName.charAt(0) + newName : newName;
                
                await channel.setName(finalName.substring(0, 100));
                
                await interaction.reply({
                    content: `✅ **تم تغيير اسم التذكرة إلى:** \`${finalName}\``,
                    ephemeral: true
                });
                
                // إشعار في التذكرة
                const notifyEmbed = new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setTitle('✏️ تغيير الاسم')
                    .setDescription(`تم تغيير اسم التذكرة إلى **${finalName}** بواسطة <@${interaction.user.id}>`)
                    .setTimestamp();
                
                await channel.send({ embeds: [notifyEmbed] });
                
            } catch (error) {
                console.error('❌ خطأ في تغيير الاسم:', error);
                await interaction.reply({
                    content: '❌ **حدث خطأ أثناء تغيير الاسم!**\nقد يكون الاسم غير صالح.',
                    ephemeral: true
                });
            }
        }
    });
    
    // ================ دوال مساعدة ================
    
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
    
    // تنظيف البيانات المؤقتة
    setInterval(() => {
        const now = Date.now();
        
        // تنظيف الكولدون
        for (const [key, time] of ticketCooldown.entries()) {
            if (time < now) {
                ticketCooldown.delete(key);
            }
        }
        
        // تنظيف جلسات التصميم القديمة (أكثر من ساعة)
        for (const [key, session] of designSessions.entries()) {
            if (session.lastActivity && (now - session.lastActivity) > 3600000) {
                designSessions.delete(key);
            }
        }
    }, 60000); // كل دقيقة
};

// تصدير الدوال المساعدة للاستخدام الخارجي
module.exports.loadTicketSettings = loadTicketSettings;
module.exports.saveTicketSettings = saveTicketSettings;
module.exports.getTicketSettings = getTicketSettings;
module.exports.activeTickets = activeTickets;
