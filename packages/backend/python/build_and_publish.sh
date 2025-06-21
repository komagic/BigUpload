#!/bin/bash

# BigUpload FastAPI 包构建和发布脚本

set -e  # 遇到错误立即退出

echo "🚀 开始构建和发布 bigupload-fastapi 包"
echo "============================================="

# 检查当前目录
if [ ! -f "setup.py" ]; then
    echo "❌ 错误: 请在 packages/backend/python 目录中运行此脚本"
    exit 1
fi

# 检查必要的工具
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ 错误: 未找到 $1，请先安装"
        echo "   pip install $2"
        exit 1
    fi
}

echo "🔍 检查构建工具..."
check_tool python setuptools
check_tool twine twine

# 清理之前的构建
echo "🧹 清理旧的构建文件..."
rm -rf build/ dist/ *.egg-info/ __pycache__/ .pytest_cache/
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# 检查代码格式
if command -v black &> /dev/null; then
    echo "🎨 格式化代码..."
    black src/ --check || {
        echo "⚠️ 代码格式不符合要求，自动格式化..."
        black src/
    }
fi

# 运行测试（如果存在）
if [ -d "tests" ] && [ -n "$(ls -A tests)" ]; then
    echo "🧪 运行测试..."
    python -m pytest tests/ -v
fi

# 构建包
echo "📦 构建Python包..."
python setup.py sdist bdist_wheel

# 检查包
echo "🔍 检查包质量..."
twine check dist/*

# 显示包信息
echo "📋 包信息："
ls -la dist/
echo ""

# 询问是否发布
read -p "🤔 是否要发布到PyPI? (输入 'yes' 确认，'test' 发布到测试服务器，其他键取消): " confirm

case $confirm in
    yes|YES|Y|y)
        echo "🚀 发布到PyPI..."
        twine upload dist/*
        echo "✅ 成功发布到PyPI!"
        ;;
    test|TEST)
        echo "🧪 发布到测试PyPI..."
        twine upload --repository testpypi dist/*
        echo "✅ 成功发布到测试PyPI!"
        echo "📝 测试安装命令:"
        echo "   pip install -i https://test.pypi.org/simple/ bigupload-fastapi"
        ;;
    *)
        echo "📦 构建完成，未发布"
        echo "💡 手动发布命令:"
        echo "   twine upload dist/*  # 发布到PyPI"
        echo "   twine upload --repository testpypi dist/*  # 发布到测试PyPI"
        ;;
esac

echo ""
echo "🎉 完成!" 