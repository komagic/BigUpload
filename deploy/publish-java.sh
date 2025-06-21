#!/bin/bash

echo "📦 发布Java后端包 (bigupload-spring-boot-starter)"

MODE=${1:-prod}
PACKAGE_DIR="../packages/backend/java"

# 检查目录存在
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "❌ 目录不存在: $PACKAGE_DIR"
    exit 1
fi

cd "$PACKAGE_DIR"

# 检查 pom.xml
if [ ! -f "pom.xml" ]; then
    echo "❌ pom.xml 不存在"
    exit 1
fi

echo "📂 当前目录: $(pwd)"

# 清理
echo "🧹 清理项目..."
if ! mvn clean; then
    echo "❌ 清理失败"
    exit 1
fi

# 编译和测试
echo "🔨 编译和测试..."
if ! mvn compile test; then
    echo "❌ 编译或测试失败"
    exit 1
fi

# 打包
echo "📦 打包..."
if ! mvn package -DskipTests; then
    echo "❌ 打包失败"
    exit 1
fi

# 发布
echo "🚀 发布包..."
if [ "$MODE" = "test" ]; then
    # 安装到本地仓库（测试）
    echo "安装到本地Maven仓库..."
    if ! mvn install; then
        echo "❌ 本地安装失败"
        exit 1
    fi
    echo "💡 包已安装到本地Maven仓库: ~/.m2/repository/"
else
    # 发布到Maven Central（需要配置）
    echo "发布到Maven Central..."
    if ! mvn deploy -P release; then
        echo "❌ 发布失败"
        echo "💡 请确保已配置："
        echo "   - ~/.m2/settings.xml (服务器认证)"
        echo "   - GPG密钥签名"
        echo "   - pom.xml中的release profile"
        exit 1
    fi
fi

echo "✅ Java后端包发布完成"
cd - > /dev/null 