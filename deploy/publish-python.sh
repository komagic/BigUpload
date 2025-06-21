#!/bin/bash

echo "📦 发布Python后端包 (bigupload-fastapi)"

MODE=${1:-prod}
PACKAGE_DIR="../packages/backend/python"

# 检查目录存在
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "❌ 目录不存在: $PACKAGE_DIR"
    exit 1
fi

cd "$PACKAGE_DIR"

# 检查 setup.py 或 pyproject.toml
if [ ! -f "setup.py" ] && [ ! -f "pyproject.toml" ]; then
    echo "❌ setup.py 或 pyproject.toml 不存在"
    exit 1
fi

echo "📂 当前目录: $(pwd)"

# 激活虚拟环境
if [ -d ".venv" ]; then
    echo "🔧 激活虚拟环境..."
    source .venv/bin/activate
else
    echo "⚠️ 虚拟环境不存在，创建新的虚拟环境..."
    python3 -m venv .venv
    source .venv/bin/activate
fi

# 确保pip可用
echo "🔧 确保pip可用..."
if ! command -v pip &>/dev/null; then
    echo "安装pip..."
    python -m ensurepip --upgrade
fi

# 清理旧的构建文件
echo "🧹 清理旧构建文件..."
rm -rf build/ dist/ *.egg-info/

# 安装构建依赖
echo "📥 安装构建依赖..."
if ! python -m pip install build twine; then
    echo "❌ 构建依赖安装失败"
    exit 1
fi

# 构建包
echo "🔨 构建包..."
if ! python -m build; then
    echo "❌ 构建失败"
    exit 1
fi

# 检查包
echo "🔍 检查包..."
if ! python -m twine check dist/*; then
    echo "❌ 包检查失败"
    exit 1
fi

# 发布
echo "🚀 发布包..."
if [ "$MODE" = "test" ]; then
    # 发布到测试PyPI
    echo "发布到测试PyPI..."
    if ! python -m twine upload --repository testpypi dist/*; then
        echo "❌ 测试发布失败"
        exit 1
    fi
else
    # 发布到正式PyPI
    echo "发布到正式PyPI..."
    if ! python -m twine upload dist/*; then
        echo "❌ 发布失败"
        exit 1
    fi
fi

echo "✅ Python后端包发布完成"
cd - >/dev/null
