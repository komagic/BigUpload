#!/bin/bash

# BigUpload Java Backend 启动脚本

set -e  # 遇到错误立即退出

echo "🚀 启动 BigUpload Java Backend"
echo "================================"

# 检查当前目录
if [ ! -f "pom.xml" ]; then
    echo "❌ 错误: 请在 packages/backend/java 目录中运行此脚本"
    exit 1
fi

# 检查Java是否安装
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java，请先安装 JDK 8+"
    exit 1
fi

# 检查Maven是否安装
if ! command -v mvn &> /dev/null; then
    echo "❌ 错误: 未找到 Maven，请先安装 Maven"
    exit 1
fi

echo "☕ Java版本: $(java -version 2>&1 | head -n 1)"
echo "📦 Maven版本: $(mvn -version | head -n 1)"

# 确保上传目录存在
mkdir -p uploads/temp

# 编译并运行
echo "🔨 编译项目..."
mvn compile -q

echo "🚀 启动应用..."
echo "访问地址: http://localhost:8080/api/upload/health"
echo "================================"

# 运行应用
mvn spring-boot:run 