#!/bin/bash

echo "🚀 BigUpload - 启动所有后端服务"
echo "=================================="

# 检查依赖
check_dependency() {
    if ! command -v $1 &>/dev/null; then
        echo "❌ $1 未安装，请先安装 $1"
        exit 1
    fi
}

echo "📋 检查依赖..."
check_dependency "node"
check_dependency "python3"
check_dependency "uv"
check_dependency "java"
check_dependency "mvn"

# 创建日志目录
mkdir -p logs

# 启动Node.js后端 (端口: 3000)
echo ""
echo "🟢 启动 Node.js 后端服务 (端口: 3000)..."
cd packages/backend/node
npm install >../../../logs/node-install.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Node.js 依赖安装成功"
    npm run dev >../../../logs/node-server.log 2>&1 &
    NODE_PID=$!
    echo "✅ Node.js 服务已启动 (PID: $NODE_PID)"
else
    echo "❌ Node.js 依赖安装失败，请查看 logs/node-install.log"
fi
cd ../../..

# 启动Python后端 (端口: 5000)
echo ""
echo "🐍 启动 Python FastAPI 后端服务 (端口: 5000)..."
cd packages/backend/python
if [ ! -d ".venv" ]; then
    echo "🔧 创建 Python 虚拟环境..."
    uv venv >../../../logs/python-venv.log 2>&1
    echo "📦 安装 Python 依赖..."
    source .venv/bin/activate && uv pip install -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt >../../../logs/python-install.log 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Python 依赖安装成功"
    else
        echo "❌ Python 依赖安装失败，请查看 logs/python-install.log"
        cd ../../..
        return 1
    fi
else
    echo "✅ Python 虚拟环境已存在"
fi

source .venv/bin/activate && python3 main.py >../../../logs/python-server.log 2>&1 &
PYTHON_PID=$!
echo "✅ Python 服务已启动 (PID: $PYTHON_PID)"
cd ../../..

# 启动Java后端 (端口: 8080)
echo ""
echo "☕ 启动 Java Spring Boot 后端服务 (端口: 8080)..."
cd apps/demo-java
mvn compile >../../logs/java-compile.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Java 项目编译成功"
    mvn spring-boot:run >../../logs/java-server.log 2>&1 &
    JAVA_PID=$!
    echo "✅ Java 服务已启动 (PID: $JAVA_PID)"
else
    echo "❌ Java 项目编译失败，请查看 logs/java-compile.log"
fi
cd ../..

# 保存PID到文件
echo $NODE_PID >logs/node.pid
echo $PYTHON_PID >logs/python.pid
echo $JAVA_PID >logs/java.pid

echo ""
echo "🎉 所有服务启动完成！"
echo "=================================="
echo "📍 服务地址:"
echo "  Node.js:  http://localhost:3000"
echo "  Python:   http://localhost:5000"
echo "  Java:     http://localhost:8080"
echo ""
echo "🧪 测试页面:"
echo "  打开浏览器访问: file://$(pwd)/test-page.html"
echo "  或使用: python3 -m http.server 8000 然后访问 http://localhost:8000/test-page.html"
echo ""
echo "📋 查看日志:"
echo "  Node.js:  tail -f logs/node-server.log"
echo "  Python:   tail -f logs/python-server.log"
echo "  Java:     tail -f logs/java-server.log"
echo ""
echo "🛑 停止服务:"
echo "  运行: ./stop-all-servers.sh"
echo ""
echo "等待所有服务完全启动... (大约30秒)"

# 等待服务启动
sleep 30

# 健康检查
echo "🏥 健康检查..."
curl -s http://localhost:3000/ >/dev/null && echo "✅ Node.js 服务运行正常" || echo "❌ Node.js 服务异常"
curl -s http://localhost:5000/api/upload/health >/dev/null && echo "✅ Python 服务运行正常" || echo "❌ Python 服务异常"
curl -s http://localhost:8080/api/upload/health >/dev/null && echo "✅ Java 服务运行正常" || echo "❌ Java 服务异常"

echo ""
echo "🚀 BigUpload 已就绪！开始你的大文件上传测试吧！"
