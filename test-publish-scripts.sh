#!/bin/bash

echo "🧪 测试发布脚本"
echo "=================="

# 测试脚本是否存在和可执行
scripts=(
    "publish-all.sh"
    "publish-shared.sh"
    "publish-frontend.sh"
    "publish-node.sh"
    "publish-python.sh"
    "publish-java.sh"
)

echo "📋 检查脚本文件..."
for script in "${scripts[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            echo "✅ $script - 存在且可执行"
        else
            echo "⚠️  $script - 存在但不可执行"
        fi
    else
        echo "❌ $script - 不存在"
    fi
done

echo ""
echo "📂 检查目录结构..."
dirs=(
    "packages/shared"
    "packages/frontend"
    "packages/backend/node"
    "packages/backend/python"
    "packages/backend/java"
)

for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir - 存在"
    else
        echo "❌ $dir - 不存在"
    fi
done

echo ""
echo "🔧 检查必要工具..."
tools=("npm" "python3" "pip" "twine" "mvn")

for tool in "${tools[@]}"; do
    if command -v "$tool" &>/dev/null; then
        echo "✅ $tool - 已安装"
    else
        echo "❌ $tool - 未安装"
    fi
done

echo ""
echo "🎯 运行测试发布（dry-run）..."
echo "运行: ./publish-all.sh test"
echo "这将执行测试模式的发布流程"
echo ""
echo "⚠️  注意: 实际发布前请确保："
echo "  - NPM 已登录: npm login"
echo "  - PyPI 已配置: twine配置"
echo "  - Maven 已配置: settings.xml" 