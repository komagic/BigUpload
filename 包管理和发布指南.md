# 📦 BigUpload 包管理和发布指南

## 概述

BigUpload 项目包含多个可独立发布的包，支持发布到不同的包管理器：

- **NPM包** - Frontend、Shared、Node.js Backend
- **PyPI包** - Python Backend  
- **Maven包** - Java Backend

本指南详细说明如何构建、测试和发布这些包。

## 📋 包列表

| 包名 | 类型 | 发布到 | 描述 |
|------|------|--------|------|
| `@bigupload/shared` | NPM | npmjs.com | 共享工具和类型定义 |
| `@bigupload/frontend` | NPM | npmjs.com | React上传组件库 |
| `@bigupload/backend-node` | NPM | npmjs.com | Node.js后端实现 |
| `bigupload-fastapi` | Python | pypi.org | Python FastAPI后端 |
| `bigupload-spring-boot-starter` | Maven | maven.org | Java Spring Boot Starter |

## 🚀 快速开始

### 1. 版本管理

更新所有包的版本号：

```bash
# 统一更新版本（推荐）
./update-version.sh

# 选择版本类型：
# 1) patch  - 1.0.0 -> 1.0.1 (修复bug)
# 2) minor  - 1.0.0 -> 1.1.0 (新功能)  
# 3) major  - 1.0.0 -> 2.0.0 (破坏性更新)
# 4) custom - 自定义版本号
```

### 2. 一键构建发布

```bash
# 构建并发布所有包
./build-and-publish-all.sh

# 选择发布模式：
# 1) dev    - 仅构建，不发布
# 2) local  - 安装到本地包管理器
# 3) test   - 发布到测试环境
# 4) prod   - 发布到生产环境
```

## 📦 详细操作指南

### NPM 包管理

#### 前端组件包 (`@bigupload/frontend`)

```bash
cd packages/frontend

# 安装依赖
npm install

# 构建
npm run build

# 本地测试
npm pack

# 发布预检查
npm run publish:dry

# 发布到npm
npm run publish:npm
```

#### 共享包 (`@bigupload/shared`)

```bash
cd packages/shared

# 构建和发布
npm run build
npm run publish:npm
```

#### Node.js后端包 (`@bigupload/backend-node`)

```bash
cd packages/backend/node

# 开发服务器
npm run dev

# 构建和发布
npm run build
npm run publish:npm
```

### Python 包管理

#### FastAPI后端包 (`bigupload-fastapi`)

```bash
cd packages/backend/python

# 使用专用脚本（推荐）
./build_and_publish.sh

# 或手动操作：
# 安装构建工具
pip install build twine

# 构建包
python -m build

# 检查包
twine check dist/*

# 发布到测试PyPI
twine upload --repository testpypi dist/*

# 发布到正式PyPI
twine upload dist/*
```

### Maven 包管理

#### Spring Boot Starter (`bigupload-spring-boot-starter`)

```bash
cd packages/backend/java

# 使用专用脚本（推荐）
./build_and_publish.sh

# 或手动操作：
# 编译测试
mvn clean compile test

# 安装到本地仓库
mvn clean install

# 发布到Maven Central（需要配置）
mvn clean deploy -P release
```

## ⚙️ 发布前配置

### NPM 配置

1. **登录 NPM**：
```bash
npm login
```

2. **检查组织权限**：
确保有 `@bigupload` 组织的发布权限

3. **配置 .npmrc**（可选）：
```bash
# ~/.npmrc
registry=https://registry.npmjs.org/
@bigupload:registry=https://registry.npmjs.org/
```

### PyPI 配置

1. **创建账户**：
   - 正式环境: https://pypi.org/account/register/
   - 测试环境: https://test.pypi.org/account/register/

2. **配置 API Token**：
```bash
# ~/.pypirc
[distutils]
index-servers = pypi testpypi

[pypi]
username = __token__
password = pypi-YOUR_API_TOKEN

[testpypi]
repository = https://test.pypi.org/legacy/
username = __token__
password = pypi-YOUR_TEST_API_TOKEN
```

### Maven Central 配置

1. **注册 Sonatype 账户**：
   - https://issues.sonatype.org/

2. **配置 GPG 签名**：
```bash
# 生成GPG密钥
gpg --gen-key

# 上传公钥
gpg --keyserver keyserver.ubuntu.com --send-keys YOUR_KEY_ID
```

3. **配置 Maven settings.xml**：
```xml
<!-- ~/.m2/settings.xml -->
<servers>
  <server>
    <id>ossrh</id>
    <username>YOUR_SONATYPE_USERNAME</username>
    <password>YOUR_SONATYPE_PASSWORD</password>
  </server>
</servers>
```

## 🧪 测试已发布的包

### 测试 NPM 包

```bash
# 创建测试项目
mkdir test-bigupload && cd test-bigupload
npm init -y

# 安装包
npm install @bigupload/frontend @bigupload/shared @bigupload/backend-node

# 测试导入
node -e "console.log(require('@bigupload/frontend'))"
```

### 测试 Python 包

```bash
# 创建虚拟环境
python -m venv test-env
source test-env/bin/activate  # Windows: test-env\Scripts\activate

# 安装包
pip install bigupload-fastapi

# 测试导入
python -c "import bigupload_fastapi; print('Success!')"
```

### 测试 Java 包

```bash
# 创建测试Maven项目
mvn archetype:generate -DgroupId=com.test -DartifactId=test-bigupload

# 添加依赖到 pom.xml
<dependency>
    <groupId>com.bigupload</groupId>
    <artifactId>bigupload-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>

# 编译测试
mvn compile
```

## 📊 版本策略

### 语义化版本 (Semantic Versioning)

- **MAJOR.MINOR.PATCH** (例: 2.1.3)
- **MAJOR**: 不兼容的API更改
- **MINOR**: 向后兼容的功能添加
- **PATCH**: 向后兼容的bug修复

### 发布周期

- **Patch**: 每周或按需（bug修复）
- **Minor**: 每月（新功能）
- **Major**: 每季度或年度（重大更新）

## 🔧 故障排除

### 常见错误

1. **NPM 发布失败**：
   ```bash
   # 检查包名是否已存在
   npm view @bigupload/frontend
   
   # 检查登录状态
   npm whoami
   ```

2. **Python 包上传失败**：
   ```bash
   # 检查包名
   pip search bigupload-fastapi
   
   # 验证token
   twine check dist/*
   ```

3. **Maven 部署失败**：
   ```bash
   # 检查GPG配置
   gpg --list-keys
   
   # 验证settings.xml
   mvn help:effective-settings
   ```

### 回滚操作

```bash
# 回滚版本更新（使用备份文件）
find . -name "*.backup" -exec sh -c 'mv "$1" "${1%.backup}"' _ {} \;

# 撤销NPM发布（24小时内）
npm unpublish @bigupload/frontend@1.0.1

# 注意：PyPI和Maven Central不支持删除已发布的版本
```

## 📈 发布后检查

### 验证发布状态

1. **NPM包**：
   - https://www.npmjs.com/search?q=%40bigupload
   - `npm view @bigupload/frontend`

2. **PyPI包**：
   - https://pypi.org/search/?q=bigupload-fastapi
   - `pip show bigupload-fastapi`

3. **Maven包**：
   - https://search.maven.org/
   - https://central.sonatype.com/

### 更新文档

- [ ] 更新项目 README.md
- [ ] 更新 CHANGELOG.md
- [ ] 更新在线文档
- [ ] 通知用户升级

## 🔄 CI/CD 集成

### GitHub Actions 示例

```yaml
# .github/workflows/publish.yml
name: Publish Packages

on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: ./build-and-publish-all.sh
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - run: |
          cd packages/backend/python
          pip install build twine
          python -m build
          twine upload dist/*
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
```

## 📚 相关链接

- [NPM发布指南](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [PyPI发布指南](https://packaging.python.org/en/latest/tutorials/packaging-projects/)
- [Maven Central发布指南](https://central.sonatype.org/publish/publish-guide/)
- [语义化版本规范](https://semver.org/lang/zh-CN/)

---

**💡 提示**: 首次发布建议先在测试环境验证，确认无误后再发布到生产环境。 