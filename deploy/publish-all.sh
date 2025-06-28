#!/bin/bash

echo "🚀 BigUpload - 发布所有包"
echo "=========================="

# 获取发布模式参数
MODE=${1:-prod}

if [ "$MODE" = "test" ]; then
    echo "📋 发布模式: 测试环境"
else
    echo "📋 发布模式: 生产环境"
fi

echo ""

# 检查必要工具
check_tool() {
    if ! command -v $1 &>/dev/null; then
        echo "❌ $1 未安装，请先安装"
        exit 1
    fi
}

echo "🔍 检查发布工具..."
check_tool "npm"
check_tool "python3"
check_tool "mvn"

# 检查登录状态
echo ""
echo "🔐 检查登录状态..."

# 检查 NPM 登录 (生产模式才需要)
if [ "$MODE" != "test" ]; then
    if ! npm whoami &>/dev/null; then
        echo "❌ 请先登录 NPM: npm login"
        exit 1
    fi
    echo "✅ NPM 已登录: $(npm whoami)"
else
    echo "ℹ️  测试模式，跳过 NPM 登录检查"
fi

# 检查工作目录 - 现在从 deploy 目录运行，需要检查上级目录
if [ ! -f "../package.json" ] && [ ! -f "../README.md" ]; then
    echo "❌ 请确保在项目根目录下的 deploy 文件夹中运行此脚本"
    exit 1
fi

echo ""
echo "📦 开始发布包..."

# 发布计数
SUCCESS_COUNT=0
TOTAL_COUNT=5

# 发布共享包（先发布，因为其他包可能依赖它）
echo ""
echo "1️⃣ 发布共享包..."
if ./publish-shared.sh $MODE; then
    echo "✅ 共享包发布成功"
    ((SUCCESS_COUNT++))
else
    echo "❌ 共享包发布失败"
fi

# 发布前端包
echo ""
echo "2️⃣ 发布前端包..."
if ./publish-frontend.sh $MODE; then
    echo "✅ 前端包发布成功"
    ((SUCCESS_COUNT++))
else
    echo "❌ 前端包发布失败"
fi

# 发布Node.js后端包
echo ""
echo "3️⃣ 发布Node.js后端包..."
if ./publish-node.sh $MODE; then
    echo "✅ Node.js后端包发布成功"
    ((SUCCESS_COUNT++))
else
    echo "❌ Node.js后端包发布失败"
fi

# 发布Python后端包
echo ""
echo "4️⃣ 发布Python后端包..."
if ./publish-python.sh $MODE; then
    echo "✅ Python后端包发布成功"
    ((SUCCESS_COUNT++))
else
    echo "❌ Python后端包发布失败"
fi

# 发布Java后端包
echo ""
echo "5️⃣ 发布Java后端包..."
if ./publish-java.sh $MODE; then
    echo "✅ Java后端包发布成功"
    ((SUCCESS_COUNT++))
else
    echo "❌ Java后端包发布失败"
fi

echo ""
echo "📊 发布结果统计:"
echo "=========================="
echo "✅ 成功: $SUCCESS_COUNT/$TOTAL_COUNT"
echo "❌ 失败: $((TOTAL_COUNT - SUCCESS_COUNT))/$TOTAL_COUNT"

if [ $SUCCESS_COUNT -eq $TOTAL_COUNT ]; then
    echo ""
    echo "🎉 所有包发布成功！"
    echo ""
    echo "📍 验证安装:"
    echo "  npm install bigupload-shared"
    echo "  npm install bigupload-frontend"
    echo "  npm install bigupload-backend-node"
    echo "  pip install bigupload-fastapi"
    echo ""
    echo "📚 更新文档:"
    echo "  - 更新 README.md 版本信息"
    echo "  - 更新 CHANGELOG.md"
    echo "  - 通知用户升级"
else
    echo ""
    echo "⚠️  部分包发布失败，请检查错误信息"
    exit 1
fi
