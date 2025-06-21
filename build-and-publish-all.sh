#!/bin/bash

# BigUpload 一键构建和发布所有包的脚本

set -e  # 遇到错误立即退出

echo "🚀 BigUpload 一键构建和发布脚本"
echo "==============================="
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 询问发布模式
echo "🤔 请选择发布模式："
echo "   1) dev    - 仅构建，不发布（开发测试）"
echo "   2) local  - 构建并安装到本地（本地测试）"
echo "   3) test   - 发布到测试环境（npm/PyPI测试服务器）"
echo "   4) prod   - 发布到生产环境（正式发布）"
echo ""
read -p "请输入选择 (1-4): " mode_choice

case $mode_choice in
    1) MODE="dev" ;;
    2) MODE="local" ;;
    3) MODE="test" ;;
    4) MODE="prod" ;;
    *) 
        log_error "无效选择，退出"
        exit 1
        ;;
esac

log_info "选择的模式: $MODE"
echo ""

# 构建顺序（共享包优先）
PACKAGES=(
    "packages/shared"
    "packages/frontend" 
    "packages/backend/node"
    "packages/backend/python"
    "packages/backend/java"
)

# 构建计数器
TOTAL=${#PACKAGES[@]}
CURRENT=0
SUCCESS=0
FAILED=0

log_info "开始构建 $TOTAL 个包..."
echo ""

# 构建函数
build_package() {
    local package_dir=$1
    local package_name=$(basename $package_dir)
    
    CURRENT=$((CURRENT + 1))
    
    echo "========================================"
    log_info "[$CURRENT/$TOTAL] 构建包: $package_name"
    echo "========================================"
    
    if [ ! -d "$package_dir" ]; then
        log_error "目录不存在: $package_dir"
        FAILED=$((FAILED + 1))
        return 1
    fi
    
    cd "$package_dir"
    
    # 根据包类型执行不同的构建
    if [ -f "package.json" ]; then
        build_npm_package "$package_name"
    elif [ -f "setup.py" ]; then
        build_python_package "$package_name"
    elif [ -f "pom.xml" ]; then
        build_java_package "$package_name"
    else
        log_error "未识别的包类型: $package_name"
        FAILED=$((FAILED + 1))
        cd - > /dev/null
        return 1
    fi
    
    local result=$?
    cd - > /dev/null
    
    if [ $result -eq 0 ]; then
        log_success "构建成功: $package_name"
        SUCCESS=$((SUCCESS + 1))
    else
        log_error "构建失败: $package_name"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
}

# NPM包构建函数
build_npm_package() {
    local name=$1
    
    log_info "安装依赖..."
    npm install
    
    log_info "清理和构建..."
    npm run clean 2>/dev/null || true
    npm run build
    
    case $MODE in
        "dev")
            log_info "开发模式: 仅构建完成"
            ;;
        "local")
            log_info "本地模式: 安装到本地npm"
            npm pack
            ;;
        "test")
            log_info "测试模式: 发布到npm（dry-run）"
            npm run publish:dry
            ;;
        "prod")
            log_warning "生产模式: 发布到npm"
            read -p "确认发布 $name 到npm? (y/N): " confirm
            if [[ $confirm =~ ^[Yy]$ ]]; then
                npm run publish:npm
                log_success "已发布到npm"
            else
                log_warning "跳过发布"
            fi
            ;;
    esac
}

# Python包构建函数
build_python_package() {
    local name=$1
    
    case $MODE in
        "dev")
            log_info "开发模式: 检查安装"
            python setup.py check
            ;;
        "local")
            log_info "本地模式: 安装到本地pip"
            pip install -e .
            ;;
        "test"|"prod")
            log_info "使用专用构建脚本"
            chmod +x build_and_publish.sh
            if [ "$MODE" = "test" ]; then
                echo "test" | ./build_and_publish.sh
            else
                ./build_and_publish.sh
            fi
            ;;
    esac
}

# Java包构建函数
build_java_package() {
    local name=$1
    
    case $MODE in
        "dev")
            log_info "开发模式: 编译和测试"
            mvn clean compile test
            ;;
        "local")
            log_info "本地模式: 安装到本地Maven仓库"
            mvn clean install -DskipTests
            ;;
        "test")
            log_info "测试模式: 本地安装（Maven没有测试仓库）"
            mvn clean install -DskipTests
            ;;
        "prod")
            log_info "使用专用构建脚本"
            chmod +x build_and_publish.sh
            ./build_and_publish.sh
            ;;
    esac
}

# 执行构建
for package in "${PACKAGES[@]}"; do
    build_package "$package"
done

# 构建总结
echo "========================================"
echo "🎉 构建完成总结"
echo "========================================"
log_success "成功: $SUCCESS 个包"
if [ $FAILED -gt 0 ]; then
    log_error "失败: $FAILED 个包"
fi
echo "总计: $TOTAL 个包"
echo ""

if [ $FAILED -eq 0 ]; then
    log_success "🎊 所有包构建成功！"
    
    if [ "$MODE" = "prod" ]; then
        echo ""
        log_info "📋 发布后续工作："
        echo "   1. 检查npm包: https://www.npmjs.com/search?q=%40bigupload"
        echo "   2. 检查PyPI包: https://pypi.org/search/?q=bigupload-fastapi"
        echo "   3. 检查Maven包: https://search.maven.org/"
        echo "   4. 更新项目README和文档"
        echo "   5. 创建git tag标记版本"
    fi
else
    log_error "⚠️ 有 $FAILED 个包构建失败，请检查错误信息"
    exit 1
fi 