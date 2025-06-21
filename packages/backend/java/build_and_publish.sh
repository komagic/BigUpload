#!/bin/bash

# BigUpload Spring Boot Starter 构建和发布脚本

set -e  # 遇到错误立即退出

echo "🚀 开始构建和发布 BigUpload Spring Boot Starter"
echo "==============================================="

# 检查当前目录
if [ ! -f "pom.xml" ]; then
    echo "❌ 错误: 请在 packages/backend/java 目录中运行此脚本"
    exit 1
fi

# 检查必要的工具
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ 错误: 未找到 $1，请先安装"
        exit 1
    fi
}

echo "🔍 检查构建工具..."
check_tool mvn
check_tool java

# 显示Java和Maven版本
echo "☕ Java版本: $(java -version 2>&1 | head -n 1)"
echo "📦 Maven版本: $(mvn -version | head -n 1)"

# 清理之前的构建
echo "🧹 清理旧的构建文件..."
mvn clean

# 编译和测试
echo "🔨 编译项目..."
mvn compile

echo "🧪 运行测试..."
mvn test

# 打包
echo "📦 打包项目..."
mvn package -DskipTests

# 安装到本地仓库
echo "📁 安装到本地Maven仓库..."
mvn install -DskipTests

# 显示构建信息
echo "📋 构建信息："
ls -la target/
echo ""

# 询问是否发布
read -p "🤔 是否要发布到Maven仓库? (输入 'local' 仅本地安装，'central' 发布到Maven Central，其他键取消): " confirm

case $confirm in
    local|LOCAL)
        echo "📁 已安装到本地Maven仓库"
        echo "✅ 其他项目可以通过以下方式使用:"
        echo "   <dependency>"
        echo "       <groupId>com.bigupload</groupId>"
        echo "       <artifactId>bigupload-spring-boot-starter</artifactId>"
        echo "       <version>1.0.0</version>"
        echo "   </dependency>"
        ;;
    central|CENTRAL)
        echo "🚀 准备发布到Maven Central..."
        echo "⚠️ 注意: 发布到Maven Central需要配置GPG签名和Sonatype账户"
        echo ""
        
        # 检查是否配置了发布相关设置
        if ! grep -q "distributionManagement" pom.xml; then
            echo "❌ 错误: pom.xml中缺少distributionManagement配置"
            echo "💡 请先配置Maven Central发布设置"
            exit 1
        fi
        
        # 生成sources和javadoc
        echo "📚 生成源码和文档..."
        mvn source:jar javadoc:jar
        
        # 签名和发布
        echo "🔐 签名并发布..."
        mvn deploy -P release
        echo "✅ 发布完成！请到Sonatype OSSRH检查发布状态"
        ;;
    *)
        echo "📦 构建完成，未发布"
        echo "💡 手动发布命令:"
        echo "   mvn install          # 安装到本地仓库"
        echo "   mvn deploy -P release # 发布到Maven Central"
        ;;
esac

echo ""
echo "🎉 完成!" 