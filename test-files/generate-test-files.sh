#!/bin/bash

# 显示颜色输出
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${GREEN}===== 生成FastUploader测试文件 =====${NC}"

# 生成10MB大文件
echo -e "${BLUE}1. 生成10MB测试文件 large.bin${NC}"
dd if=/dev/urandom of=large.bin bs=1M count=10

# 生成100MB大文件
echo -e "${BLUE}2. 生成100MB测试文件 xlarge.bin${NC}"
dd if=/dev/urandom of=xlarge.bin bs=1M count=100

echo -e "${GREEN}===== 测试文件生成完毕 =====${NC}"
echo -e "文件列表:"
ls -lh *.bin
