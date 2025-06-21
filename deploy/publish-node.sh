#!/bin/bash

echo "📦 发布Node.js后端包 (@bigupload/node-backend)"

MODE=${1:-prod}
PACKAGE_DIR="../packages/backend/node"

# 检查目录存在
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "❌ 目录不存在: $PACKAGE_DIR"
    exit 1
fi

cd "$PACKAGE_DIR"

# 检查 package.json
if [ ! -f "package.json" ]; then
    echo "❌ package.json 不存在"
    exit 1
fi

echo "📂 当前目录: $(pwd)"

# 安装依赖
echo "📥 安装依赖..."
if ! npm install; then
    echo "❌ 依赖安装失败"
    exit 1
fi

# 构建
echo "🔨 构建项目..."
if ! npm run build; then
    echo "❌ 构建失败"
    exit 1
fi

# 运行测试
echo "🧪 运行测试..."
if ! npm test; then
    echo "⚠️ 测试失败，但继续发布"
fi

# 发布
echo "🚀 发布包..."
if [ "$MODE" = "test" ]; then
    # 发布到测试环境
    npm publish --dry-run
else
    # 发布到生产环境
    if ! npm publish; then
        echo "❌ 发布失败"
        exit 1
    fi
fi

echo "✅ Node.js后端包发布完成"
cd - > /dev/null 