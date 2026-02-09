const axios = require('axios');

class GroqAI {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.GROQ_API_KEY;
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.conversations = new Map();
        
        this.personalities = {
            default: {
                name: 'سارة',
                systemPrompt: `أنت سارة، مساعدة عربية مصرية ودودة وذكية في نظام دعم.
تحدثي باللهجة المصرية الدارجة بطريقة محببة وعصرية.
أجيبي بإيجاز في جملة أو جملتين كحد أقصى.
كوني مفيدة ومرحة في نفس الوقت.
لا تستخدمي علامات ترقيم كثيرة في الردود.`
            },
            professional: {
                name: 'نور',
                systemPrompt: `أنت نور، مساعدة احترافية في مركز دعم فني.
تحدثي باللغة العربية الفصحى الواضحة.
أجيبي بدقة وإيجاز.
حافظي على الاحترافية والوضوح.`
            },
            friendly: {
                name: 'ياسمين',
                systemPrompt: `أنت ياسمين، صديقة ودودة خليجية.
تحدثي باللهجة العربية الخليجية الودودة.
كوني دافئة ومتفهمة.
ساعدي المستخدمين بلطف وابتسامة.`
            }
        };
    }

    async getResponse(userId, message, personality = 'default') {
        try {
            const config = this.personalities[personality] || this.personalities.default;
            const convoId = `${userId}-${personality}`;
            
            // إعداد المحادثة
            if (!this.conversations.has(convoId)) {
                this.conversations.set(convoId, []);
            }

            const conversation = this.conversations.get(convoId);
            
            // إضافة رسالة المستخدم
            conversation.push({
                role: "user",
                content: message
            });

            // الحفاظ على آخر 10 رسائل
            if (conversation.length > 20) {
                conversation.splice(0, 2);
            }

            console.log(`🤖 طلب Groq AI (${config.name}) للمستخدم ${userId}: ${message.substring(0, 50)}...`);
            
            const response = await axios.post(
                this.apiUrl,
                {
                    model: "mixtral-8x7b-32768", // نموذج قوي ومجاني
                    messages: [
                        {
                            role: "system",
                            content: config.systemPrompt
                        },
                        ...conversation
                    ],
                    max_tokens: 150,
                    temperature: 0.8,
                    top_p: 0.9
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            const aiResponse = response.data.choices[0].message.content.trim();
            
            // تنظيف الرد (إزالة علامات ترقيم للصوت)
            const cleanResponse = aiResponse
                .replace(/[.,!?;:]/g, '')
                .replace(/\n/g, ' ')
                .trim();
            
            console.log(`🤖 ${config.name} ردت: ${cleanResponse.substring(0, 100)}...`);
            
            // إضافة رد الـ AI للمحادثة
            conversation.push({
                role: "assistant",
                content: cleanResponse
            });

            return cleanResponse;

        } catch (error) {
            console.error('❌ خطأ في Groq AI:', error.message);
            
            if (error.response) {
                console.error('تفاصيل الخطأ:', error.response.data);
            }
            
            // ردود احتياطية ذكية
            const fallbackResponses = [
                "أنا هنا بس عندي مشكلة صغيرة في الاتصال",
                "معذرة في مشكلة تقنية، حاول بعد شوية",
                "آسفة ما قدرت أرد دلوقتي",
                "يا هلا لكن الاتصال مش تمام"
            ];
            
            return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }
    }

    startConversation(userId, message, personality = 'default') {
        const convoId = `${userId}-${personality}`;
        this.conversations.set(convoId, [
            {
                role: "user",
                content: message
            }
        ]);
        return convoId;
    }

    clearConversation(userId, personality = 'default') {
        const convoId = `${userId}-${personality}`;
        this.conversations.delete(convoId);
        return true;
    }

    setPersonality(userId, oldPersonality, newPersonality) {
        const oldConvoId = `${userId}-${oldPersonality}`;
        const newConvoId = `${userId}-${newPersonality}`;
        
        if (this.conversations.has(oldConvoId)) {
            const conversation = this.conversations.get(oldConvoId);
            this.conversations.set(newConvoId, conversation);
            this.conversations.delete(oldConvoId);
        }
        
        return newPersonality;
    }

    getStats() {
        return {
            totalConversations: this.conversations.size,
            apiStatus: this.apiKey ? '✅ متصل' : '❌ غير متصل',
            provider: '🔥 Groq AI (مجاني للأبد)',
            rateLimit: '50,000 requests/يوم'
        };
    }

    getConversation(userId, personality = 'default') {
        const convoId = `${userId}-${personality}`;
        return this.conversations.get(convoId) || [];
    }
}

module.exports = GroqAI;
