#!/bin/bash

echo "🔍 检查 Java 和 Maven 安装状态"
echo "================================"

# 检查 Homebrew 安装进程
echo "📋 检查 Homebrew 安装进程..."
BREW_PROCESSES=$(pgrep -f "brew install")
if [ ! -z "$BREW_PROCESSES" ]; then
    echo "🔄 Homebrew 安装进程正在运行 (PID: $BREW_PROCESSES)"
    echo "   请等待安装完成..."
else
    echo "✅ 没有 Homebrew 安装进程在运行"
fi

echo ""

# 检查 Java 安装状态
echo "☕ 检查 Java 安装状态..."
if command -v java &>/dev/null; then
    echo "✅ Java 已安装:"
    java --version

    # 检查 JAVA_HOME
    if [ -z "$JAVA_HOME" ]; then
        echo "⚠️  JAVA_HOME 未设置"
        # 尝试找到 Java 安装路径
        JAVA_PATH=$(brew --prefix openjdk@11 2>/dev/null)
        if [ ! -z "$JAVA_PATH" ]; then
            echo "💡 建议设置 JAVA_HOME："
            echo "   export JAVA_HOME=$JAVA_PATH"
            echo "   echo 'export JAVA_HOME=$JAVA_PATH' >> ~/.zshrc"
        fi
    else
        echo "✅ JAVA_HOME: $JAVA_HOME"
    fi
else
    echo "❌ Java 未安装或未在 PATH 中"

    # 检查 Homebrew 中是否有 Java
    if brew list | grep -q openjdk; then
        echo "🔧 Java 已通过 Homebrew 安装，但可能需要链接："
        echo "   sudo ln -sfn $(brew --prefix)/opt/openjdk/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk.jdk"
        echo "   或者设置 PATH："
        echo "   echo 'export PATH=\"$(brew --prefix)/opt/openjdk/bin:\$PATH\"' >> ~/.zshrc"
    else
        echo "⏳ Java 还在安装中..."
    fi
fi

echo ""

# 检查 Maven 安装状态
echo "📦 检查 Maven 安装状态..."
if command -v mvn &>/dev/null; then
    echo "✅ Maven 已安装:"
    mvn --version
else
    echo "❌ Maven 未安装或未在 PATH 中"

    # 检查 Homebrew 中是否有 Maven
    if brew list | grep -q maven; then
        echo "🔧 Maven 已通过 Homebrew 安装，但可能需要重新加载 shell"
        echo "   尝试运行: source ~/.zshrc"
    else
        echo "⏳ Maven 还在安装中..."
        echo "💡 可以尝试手动安装: brew install maven"
    fi
fi

echo ""

# 提供下一步建议
echo "🚀 下一步建议:"
if command -v java &>/dev/null && command -v mvn &>/dev/null; then
    echo "✅ Java 和 Maven 都已安装，可以启动完整服务："
    echo "   ./start-all-servers.sh"
else
    echo "⏳ 等待安装完成，或者先测试其他后端："
    echo "   ./start-node-python.sh"
    echo ""
    echo "🔄 继续检查安装状态："
    echo "   ./check-maven.sh"
fi
