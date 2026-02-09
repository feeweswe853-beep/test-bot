const axios = require('axios');

class DeepSeekAI {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY;
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        this.conversations = new Map();
        
        // أنماط الردود المختلفة
        this.personalities = {
            default: `أنت مساعدة صوتية أنثى ذكية وودودة اسمك "سارة".
            تحدث باللهجة العربية المصرية الدارجة بطريقة محببة وعصرية.
            أنت مساعدة في نظام دعم صوتي على Discord.
            أجب بإيجاز في جملة أو جملتين كحد أقصى.
            كن مفيداً ومرحاً في نفس الوقت.
            لا تستخدم علامات الترقيم مثل النقاط أو الفواصل في الردود الصوتية.
            اجعل الردود قصيرة ومناسبة للاستماع.`,
            
            professional: `أنت مساعدة صوتية احترافية اسمك "نور".
            تحدث باللغة العربية الفصحى الواضحة.
            أنت في مركز دعم فني.
            أجب بدقة وإيجاز.
            حافظ على الاحترافية والوضوح.`,
            
            friendly: `أنت صديقة ودودة اسمك "ياسمين".
            تحدث باللهجة العربية الخليجية الودودة.
            كن دافئة ومتفهمة.
            ساعد المستخدمين بلطف وابتسامة.`
        };
    }

    // دالة الرد الرئيسية
    async getResponse(userId, message, personality = 'default') {
        try {
            // إنشاء ID فريد للمحادثة
            const convoId = `${userId}-${personality}`;
            
            // إعداد المحادثة
            if (!this.conversations.has(convoId)) {
                this.conversations.set(convoId, [
                    {
                        role: "system",
                        content: this.personalities[personality] || this.personalities.default
                    }
                ]);
            }

            const conversation = this.conversations.get(convoId);
            
            // إضافة رسالة المستخدم
            conversation.push({
                role: "user",
                content: message
            });

            // الحفاظ على آخر 10 رسائل فقط
            if (conversation.length > 12) {
                conversation.splice(1, 2);
            }

            // طلب API
            console.log(`🤖 طلب DeepSeek API للمستخدم ${userId}: ${message.substring(0, 50)}...`);
            
            const response = await axios.post(
                this.apiUrl,
                {
                    model: "deepseek-chat",
                    messages: conversation,
                    max_tokens: 100, // أقل لردود صوتية قصيرة
                    temperature: 0.8,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000 // 10 ثواني
                }
            );

            const aiResponse = response.data.choices[0].message.content.trim();
            
            // تنظيف الرد (إزالة علامات الترقيم للصوت)
            const cleanResponse = aiResponse
                .replace(/[.,!?;:]/g, '')
                .replace(/\n/g, ' ')
                .trim();
            
            console.log(`🤖 DeepSeek رد: ${cleanResponse.substring(0, 100)}...`);
            
            // إضافة رد الـAI للمحادثة
            conversation.push({
                role: "assistant",
                content: cleanResponse
            });

            return cleanResponse;

        } catch (error) {
            console.error('❌ خطأ في DeepSeek API:', error.message);
            
            if (error.response) {
                console.error('تفاصيل الخطأ:', error.response.data);
            }
            
            // ردود احتياطية ذكية
            const fallbackResponses = [
                "معليش الشبكة عندي مش شغالة كويس حاول تاني بعد شوية",
                "آسفة عندي شوية ضغط دلوقتي جرب بعد كام دقيقة",
                "يا هلا للأسف مش قادرة أرد دلوقتي",
                "أنا هنا بس مش عارفة أرد بالشكل المناسب"
            ];
            
            return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }
    }

    // بدء محادثة جديدة
    startConversation(userId, message, personality = 'default') {
        const convoId = `${userId}-${personality}`;
        this.conversations.set(convoId, [
            {
                role: "system",
                content: this.personalities[personality] || this.personalities.default
            },
            {
                role: "user",
                content: message
            }
        ]);
        
        return convoId;
    }

    // مسح محادثة
    clearConversation(userId, personality = 'default') {
        const convoId = `${userId}-${personality}`;
        this.conversations.delete(convoId);
        return true;
    }

    // تغيير شخصية
    setPersonality(userId, oldPersonality, newPersonality) {
        const oldConvoId = `${userId}-${oldPersonality}`;
        const newConvoId = `${userId}-${newPersonality}`;
        
        if (this.conversations.has(oldConvoId)) {
            const conversation = this.conversations.get(oldConvoId);
            conversation[0].content = this.personalities[newPersonality];
            this.conversations.set(newConvoId, conversation);
            this.conversations.delete(oldConvoId);
        }
        
        return newPersonality;
    }

    // إحصاءات
    getStats() {
        return {
            totalConversations: this.conversations.size,
            apiStatus: this.apiKey ? '✅ متصل' : '❌ غير متصل',
            personalities: Object.keys(this.personalities)
        };
    }

    // الحصول على محادثة
    getConversation(userId, personality = 'default') {
        const convoId = `${userId}-${personality}`;
        return this.conversations.get(convoId) || [];
    }
}

module.exports = DeepSeekAI;