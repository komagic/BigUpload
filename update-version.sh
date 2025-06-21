#!/bin/bash

# BigUpload 版本管理脚本

set -e  # 遇到错误立即退出

echo "🔢 BigUpload 版本管理脚本"
echo "========================"

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

# 获取当前版本
get_current_version() {
    local package_file=$1
    if [ -f "$package_file" ]; then
        grep '"version"' "$package_file" | head -n 1 | sed 's/.*"version": "\([^"]*\)".*/\1/'
    else
        echo "0.0.0"
    fi
}

# 获取当前Python版本
get_python_version() {
    local setup_file=$1
    if [ -f "$setup_file" ]; then
        grep 'version=' "$setup_file" | head -n 1 | sed 's/.*version="\([^"]*\)".*/\1/'
    else
        echo "0.0.0"
    fi
}

# 获取当前Java版本
get_java_version() {
    local pom_file=$1
    if [ -f "$pom_file" ]; then
        grep '<version>' "$pom_file" | head -n 1 | sed 's/.*<version>\([^<]*\)<\/version>.*/\1/'
    else
        echo "0.0.0"
    fi
}

# 显示当前版本
echo ""
log_info "当前版本信息："
echo "----------------------------------------"

# 根包版本
ROOT_VERSION=$(get_current_version "package.json")
echo "🏠 根项目: $ROOT_VERSION"

# 共享包版本
SHARED_VERSION=$(get_current_version "packages/shared/package.json")
echo "📦 Shared: $SHARED_VERSION"

# 前端包版本
FRONTEND_VERSION=$(get_current_version "packages/frontend/package.json")
echo "🎨 Frontend: $FRONTEND_VERSION"

# Node.js后端版本
NODE_VERSION=$(get_current_version "packages/backend/node/package.json")
echo "🟢 Node.js: $NODE_VERSION"

# Python后端版本
PYTHON_VERSION=$(get_python_version "packages/backend/python/setup.py")
echo "🐍 Python: $PYTHON_VERSION"

# Java后端版本
JAVA_VERSION=$(get_java_version "packages/backend/java/pom.xml")
echo "☕ Java: $JAVA_VERSION"

echo ""

# 询问新版本
echo "🤔 请选择版本更新类型："
echo "   1) patch  - 补丁版本 (1.0.0 -> 1.0.1)"
echo "   2) minor  - 次要版本 (1.0.0 -> 1.1.0)"
echo "   3) major  - 主要版本 (1.0.0 -> 2.0.0)"
echo "   4) custom - 自定义版本"
echo ""
read -p "请输入选择 (1-4): " version_choice

# 计算新版本
case $version_choice in
    1)
        # Patch版本
        IFS='.' read -ra VERSION_PARTS <<< "$ROOT_VERSION"
        NEW_VERSION="${VERSION_PARTS[0]}.${VERSION_PARTS[1]}.$((VERSION_PARTS[2] + 1))"
        UPDATE_TYPE="patch"
        ;;
    2)
        # Minor版本
        IFS='.' read -ra VERSION_PARTS <<< "$ROOT_VERSION"
        NEW_VERSION="${VERSION_PARTS[0]}.$((VERSION_PARTS[1] + 1)).0"
        UPDATE_TYPE="minor"
        ;;
    3)
        # Major版本
        IFS='.' read -ra VERSION_PARTS <<< "$ROOT_VERSION"
        NEW_VERSION="$((VERSION_PARTS[0] + 1)).0.0"
        UPDATE_TYPE="major"
        ;;
    4)
        # 自定义版本
        read -p "请输入新版本号 (例: 1.2.3): " NEW_VERSION
        UPDATE_TYPE="custom"
        
        # 验证版本格式
        if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            log_error "版本格式无效，请使用 x.y.z 格式"
            exit 1
        fi
        ;;
    *)
        log_error "无效选择，退出"
        exit 1
        ;;
esac

log_info "新版本: $NEW_VERSION ($UPDATE_TYPE)"
echo ""

# 确认更新
read -p "🤔 确认更新所有包到版本 $NEW_VERSION? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    log_warning "取消更新"
    exit 0
fi

echo ""
log_info "开始更新版本..."

# 更新函数
update_package_json() {
    local file=$1
    local backup_file="${file}.backup"
    
    if [ -f "$file" ]; then
        # 创建备份
        cp "$file" "$backup_file"
        
        # 更新版本
        sed -i.tmp "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$file"
        rm "${file}.tmp" 2>/dev/null || true
        
        log_success "已更新: $file"
    else
        log_warning "文件不存在: $file"
    fi
}

update_setup_py() {
    local file=$1
    local backup_file="${file}.backup"
    
    if [ -f "$file" ]; then
        # 创建备份
        cp "$file" "$backup_file"
        
        # 更新版本
        sed -i.tmp "s/version=\"[^\"]*\"/version=\"$NEW_VERSION\"/" "$file"
        rm "${file}.tmp" 2>/dev/null || true
        
        log_success "已更新: $file"
    else
        log_warning "文件不存在: $file"
    fi
}

update_pom_xml() {
    local file=$1
    local backup_file="${file}.backup"
    
    if [ -f "$file" ]; then
        # 创建备份
        cp "$file" "$backup_file"
        
        # 更新版本（只更新第一个version标签，即项目本身的版本）
        sed -i.tmp "0,/<version>/{s/<version>[^<]*<\/version>/<version>$NEW_VERSION<\/version>/}" "$file"
        rm "${file}.tmp" 2>/dev/null || true
        
        log_success "已更新: $file"
    else
        log_warning "文件不存在: $file"
    fi
}

# 更新所有包的版本
echo "📦 更新包版本..."

# 更新根包
update_package_json "package.json"

# 更新共享包
update_package_json "packages/shared/package.json"

# 更新前端包
update_package_json "packages/frontend/package.json"

# 更新Node.js后端包
update_package_json "packages/backend/node/package.json"

# 更新Python后端包
update_setup_py "packages/backend/python/setup.py"

# 更新Java后端包
update_pom_xml "packages/backend/java/pom.xml"

# 更新演示应用版本（可选）
if [ -f "apps/demo-react/package.json" ]; then
    update_package_json "apps/demo-react/package.json"
fi

if [ -f "apps/demo-java/pom.xml" ]; then
    update_pom_xml "apps/demo-java/pom.xml"
fi

echo ""
log_success "🎉 版本更新完成！"

# 显示更新后的版本
echo ""
log_info "更新后的版本信息："
echo "----------------------------------------"
echo "🏠 根项目: $(get_current_version 'package.json')"
echo "📦 Shared: $(get_current_version 'packages/shared/package.json')"
echo "🎨 Frontend: $(get_current_version 'packages/frontend/package.json')"
echo "🟢 Node.js: $(get_current_version 'packages/backend/node/package.json')"
echo "🐍 Python: $(get_python_version 'packages/backend/python/setup.py')"
echo "☕ Java: $(get_java_version 'packages/backend/java/pom.xml')"

echo ""
log_info "📋 后续步骤："
echo "   1. 检查更新是否正确"
echo "   2. 运行构建测试: ./build-and-publish-all.sh"
echo "   3. 提交版本更新: git add . && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "   4. 创建版本标签: git tag v$NEW_VERSION"
echo "   5. 推送更改: git push && git push --tags"

echo ""
log_warning "💡 如果需要回滚，备份文件位于各包目录的 *.backup 文件" 