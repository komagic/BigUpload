#!/bin/bash

echo "🚀 BigUpload - 启动 Node.js 和 Python 后端服务"
echo "================================================"
echo "ℹ️  Java/Maven 还在安装中，先测试这两个后端"
echo ""

# 创建日志目录
mkdir -p logs

# 启动Node.js后端 (端口: 3000)
echo "🟢 启动 Node.js 后端服务 (端口: 3000)..."
cd packages/backend/node
npm run dev > ../../../logs/node-server.log 2>&1 &
NODE_PID=$!
echo "✅ Node.js 服务已启动 (PID: $NODE_PID)"
cd ../../..

# 启动Python后端 (端口: 5000)
echo "🐍 启动 Python FastAPI 后端服务 (端口: 5000)..."
cd packages/backend/python
if [ ! -d ".venv" ]; then
    echo "🔧 创建 Python 虚拟环境..."
    uv venv > ../../../logs/python-venv.log 2>&1
    echo "📦 安装 Python 依赖..."
    source .venv/bin/activate && uv pip install -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt > ../../../logs/python-install.log 2>&1
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

source .venv/bin/activate && python3 main.py > ../../../logs/python-server.log 2>&1 &
PYTHON_PID=$!
echo "✅ Python 服务已启动 (PID: $PYTHON_PID)"
cd ../../..

# 保存PID到文件
echo $NODE_PID > logs/node.pid
echo $PYTHON_PID > logs/python.pid

echo ""
echo "🎉 Node.js 和 Python 服务启动完成！"
echo "====================================="
echo "📍 服务地址:"
echo "  Node.js:  http://localhost:3000"
echo "  Python:   http://localhost:5000"
echo ""
echo "🧪 测试页面:"
echo "  打开浏览器访问: file://$(pwd)/test-page.html"
echo "  或使用: python3 -m http.server 8000 然后访问 http://localhost:8000/test-page.html"
echo ""
echo "📋 查看日志:"
echo "  Node.js:  tail -f logs/node-server.log"
echo "  Python:   tail -f logs/python-server.log"
echo ""
echo "🛑 停止服务:"
echo "  kill $NODE_PID $PYTHON_PID"
echo ""
echo "⏳ Java 服务需要等待 Maven 安装完成后再启动"

# 等待服务启动
echo "等待服务启动... (10秒)"
sleep 10

# 健康检查
echo ""
echo "🏥 健康检查..."
curl -s http://localhost:3000/ > /dev/null && echo "✅ Node.js 服务运行正常" || echo "❌ Node.js 服务异常"
curl -s http://localhost:5000/api/upload/health > /dev/null && echo "✅ Python 服务运行正常" || echo "❌ Python 服务异常"

echo ""
echo "🚀 可以开始测试 Node.js 和 Python 后端了！"
echo "在测试页面中选择对应的后端进行测试" 