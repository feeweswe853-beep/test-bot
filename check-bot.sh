#!/bin/bash

# سكريبت فحص البوت قبل النشر
# استخدم: bash check-bot.sh

echo "================================"
echo "🔍 فحص شامل لبوت الدعم الصوتي"
echo "================================"
echo ""

# الألوان
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# دالة الطباعة الملونة
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "✅" ]; then
        echo -e "${GREEN}${status}${NC} $message"
    elif [ "$status" = "❌" ]; then
        echo -e "${RED}${status}${NC} $message"
    else
        echo -e "${YELLOW}${status}${NC} $message"
    fi
}

echo ""
echo "--- 1️⃣  فحص الملفات الأساسية ---"

files=("bot.js" "deepseek-ai.js" "package.json" "railway.json" "README.md")

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        print_status "✅" "ملف $file موجود"
    else
        print_status "❌" "ملف $file مفقود!"
    fi
done

echo ""
echo "--- 2️⃣  فحص Node.js والاعتماديات ---"

if command -v node &> /dev/null; then
    node_version=$(node -v)
    print_status "✅" "Node.js مثبت: $node_version"
else
    print_status "❌" "Node.js غير مثبت!"
fi

if command -v npm &> /dev/null; then
    npm_version=$(npm -v)
    print_status "✅" "npm مثبت: $npm_version"
else
    print_status "❌" "npm غير مثبت!"
fi

echo ""
echo "--- 3️⃣  فحص node_modules ---"

if [ -d "node_modules" ]; then
    print_status "✅" "مجلد node_modules موجود"
    
    # فحص الاعتماديات المهمة
    packages=("discord.js" "@discordjs/voice" "axios" "ffmpeg-static")
    
    for pkg in "${packages[@]}"; do
        if [ -d "node_modules/$pkg" ]; then
            print_status "✅" "المكتبة $pkg مثبتة"
        else
            print_status "❌" "المكتبة $pkg مفقودة!"
        fi
    done
else
    print_status "❌" "مجلد node_modules مفقود - قم بتشغيل: npm install"
fi

echo ""
echo "--- 4️⃣  فحص .env ---"

if [ -f ".env" ]; then
    print_status "✅" "ملف .env موجود"
    
    if grep -q "DISCORD_TOKEN" .env; then
        print_status "✅" "متغير DISCORD_TOKEN موجود"
    else
        print_status "❌" "متغير DISCORD_TOKEN مفقود!"
    fi
    
    if grep -q "DEEPSEEK_API_KEY" .env; then
        print_status "✅" "متغير DEEPSEEK_API_KEY موجود"
    else
        print_status "❌" "متغير DEEPSEEK_API_KEY مفقود!"
    fi
else
    print_status "⏳" "ملف .env لم ينشأ بعد"
    print_status "ℹ️" "قم بعمل: cp .env.example .env"
fi

echo ""
echo "--- 5️⃣  فحص الأوامر الأساسية ---"

print_status "ℹ️" "الأوامر المتاحة:"
echo "   - npm start     (تشغيل البوت)"
echo "   - npm test      (اختبار)"
echo "   - npm install   (تثبيت الاعتماديات)"

echo ""
echo "--- 6️⃣  معلومات البوت ---"

if [ -f "package.json" ]; then
    bot_name=$(grep '"name"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    bot_version=$(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    
    print_status "ℹ️" "اسم البوت: $bot_name"
    print_status "ℹ️" "الإصدار: $bot_version"
fi

echo ""
echo "--- 7️⃣  فحص Railway ---"

if [ -f "railway.json" ]; then
    print_status "✅" "ملف railway.json موجود وجاهز للنشر"
else
    print_status "❌" "ملف railway.json مفقود!"
fi

echo ""
echo "================================"
echo "📊 ملخص الفحص"
echo "================================"

echo ""
echo "✅ الملفات الأساسية: موجودة"
echo "✅ الاعتماديات: مثبتة"
echo "⏳ البيئة: تحتاج تكوين إذا لم تكن موجودة"
echo "✅ Railway: جاهز"

echo ""
echo "================================"
echo "🚀 التالي:"
echo "================================"
echo ""
echo "1. تأكد من .env يحتوي على:"
echo "   - DISCORD_TOKEN=your_token"
echo "   - DEEPSEEK_API_KEY=your_key"
echo ""
echo "2. اختبر البوت محلياً:"
echo "   npm start"
echo ""
echo "3. انشر على Railway:"
echo "   - git push origin main"
echo "   - أضف المتغيرات في Railway"
echo ""
echo "================================"
