#!/bin/bash

# BigUpload 三服务器上传测试演示启动脚本

echo "🚀 启动 BigUpload 三服务器上传测试演示"
echo "========================================"

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: Node.js 版本需要 18+，当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js 版本检查通过: $(node -v)"

# 检查是否在项目根目录
if [ ! -f "package.json" ] || [ ! -d "apps/demo-react" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 安装根依赖
echo "📦 检查根项目依赖..."
if [ ! -d "node_modules" ]; then
    echo "📦 安装根项目依赖..."
    npm install
fi

# 安装前端应用依赖
echo "📦 检查前端应用依赖..."
cd apps/demo-react
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端应用依赖..."
    npm install
fi

# 检查端口占用
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  端口 $port 已被占用 ($service)"
        return 1
    else
        echo "✅ 端口 $port 可用 ($service)"
        return 0
    fi
}

echo ""
echo "🔍 检查服务器端口..."
check_port 3000 "Node.js"
check_port 5000 "Python" 
check_port 8080 "Java"
check_port 5173 "React Dev Server"

echo ""
echo "💡 提示："
echo "   1. 请先启动后端服务器："
echo "      ./start-all-servers.sh"
echo "   2. 或者分别启动："
echo "      - Node.js: cd packages/backend/node && npm run dev"
echo "      - Python: cd packages/backend/python && python main.py"
echo "      - Java: cd apps/demo-java && mvn spring-boot:run"
echo ""

# 启动前端开发服务器
echo "🚀 启动前端开发服务器..."
echo "📱 访问地址: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止服务器"

npm run dev 