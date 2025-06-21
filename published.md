# 📦 BigUpload 包发布指南

## 📋 包列表

| 包名                            | 类型  | 发布到    | 位置                       |
| ------------------------------- | ----- | --------- | -------------------------- |
| `@bigupload/frontend`           | NPM   | npmjs.com | `packages/frontend/`       |
| `@bigupload/shared`             | NPM   | npmjs.com | `packages/shared/`         |
| `@bigupload/node-backend`       | NPM   | npmjs.com | `packages/backend/node/`   |
| `bigupload-fastapi`             | PyPI  | pypi.org  | `packages/backend/python/` |
| `bigupload-spring-boot-starter` | Maven | maven.org | `packages/backend/java/`   |

## 🚀 一键发布

### 发布所有包

```bash
# 发布所有包到生产环境
./publish-all.sh

# 发布到测试环境
./publish-all.sh test
```

### 单独发布

```bash
# 发布共享包
./publish-shared.sh

# 发布前端包
./publish-frontend.sh

# 发布Node.js后端
./publish-node.sh

# 发布Python后端
./publish-python.sh

# 发布Java后端
./publish-java.sh
```

## ⚙️ 发布前准备

### NPM 配置

```bash
npm login
npm whoami  # 验证登录
```

### PyPI 配置

```bash
# 安装 twine
pip install twine

# 配置 token (可选)
echo "export TWINE_USERNAME=__token__" >> ~/.bashrc
echo "export TWINE_PASSWORD=your-pypi-token" >> ~/.bashrc
```

### Maven 配置

```bash
# 确保已配置 ~/.m2/settings.xml
# GPG 密钥已设置
gpg --list-keys
```

## 🧪 测试安装

### 测试 NPM 包

```bash
npm install @bigupload/shared
npm install @bigupload/frontend
npm install @bigupload/node-backend
```

### 测试 Python 包

```bash
pip install bigupload-fastapi
```

### 测试 Java 包

```xml
<dependency>
    <groupId>com.bigupload</groupId>
    <artifactId>bigupload-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

## 📊 版本管理

更新版本号：

```bash
# 共享包
cd packages/shared && npm version patch

# 前端包
cd packages/frontend && npm version patch

# Node.js 后端
cd packages/backend/node && npm version patch

# Python 后端
cd packages/backend/python && python setup.py --version

# Java 后端
cd packages/backend/java && mvn versions:set -DnewVersion=1.0.1
```

---

**💡 提示**: 首次发布建议先发布到测试环境验证。
