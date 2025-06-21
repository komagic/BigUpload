#!/bin/bash

echo "🛑 BigUpload - 停止所有后端服务"
echo "=================================="

# 停止服务的函数
stop_service() {
    SERVICE_NAME=$1
    PID_FILE=$2
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat $PID_FILE)
        if ps -p $PID > /dev/null 2>&1; then
            echo "🛑 停止 $SERVICE_NAME 服务 (PID: $PID)..."
            kill $PID
            sleep 3
            if ps -p $PID > /dev/null 2>&1; then
                echo "⚠️  强制停止 $SERVICE_NAME 服务..."
                kill -9 $PID
            fi
            echo "✅ $SERVICE_NAME 服务已停止"
        else
            echo "ℹ️  $SERVICE_NAME 服务未运行"
        fi
        rm -f $PID_FILE
    else
        echo "ℹ️  未找到 $SERVICE_NAME 的PID文件"
    fi
}

# 检查logs目录是否存在
if [ ! -d "logs" ]; then
    echo "ℹ️  没有找到日志目录，可能服务未启动"
    exit 0
fi

# 停止各个服务
stop_service "Node.js" "logs/node.pid"
stop_service "Python" "logs/python.pid"
stop_service "Java" "logs/java.pid"

# 额外查找并停止可能的进程
echo ""
echo "🔍 查找并停止相关进程..."

# 查找Node.js进程
NODE_PIDS=$(pgrep -f "packages/backend/node")
if [ ! -z "$NODE_PIDS" ]; then
    echo "🛑 停止额外的Node.js进程: $NODE_PIDS"
    kill $NODE_PIDS 2>/dev/null
fi

# 查找Python进程
PYTHON_PIDS=$(pgrep -f "packages/backend/python/main.py")
if [ ! -z "$PYTHON_PIDS" ]; then
    echo "🛑 停止额外的Python进程: $PYTHON_PIDS"
    kill $PYTHON_PIDS 2>/dev/null
fi

# 查找Java进程
JAVA_PIDS=$(pgrep -f "demo-java")
if [ ! -z "$JAVA_PIDS" ]; then
    echo "🛑 停止额外的Java进程: $JAVA_PIDS"
    kill $JAVA_PIDS 2>/dev/null
fi

echo ""
echo "✅ 所有BigUpload服务已停止"
echo ""
echo "📊 端口状态检查:"
lsof -i :3000 | grep LISTEN && echo "⚠️  端口3000仍被占用" || echo "✅ 端口3000已释放"
lsof -i :5000 | grep LISTEN && echo "⚠️  端口5000仍被占用" || echo "✅ 端口5000已释放"  
lsof -i :8080 | grep LISTEN && echo "⚠️  端口8080仍被占用" || echo "✅ 端口8080已释放"

echo ""
echo "🧹 清理临时文件..."
rm -f logs/*.pid
echo "✅ 清理完成" 