# BigUpload 发布脚本

这个文件夹包含了 BigUpload 项目的所有发布脚本。
```bash
# 进入deploy文件夹
cd deploy

# 测试模式发布所有包
./publish-all.sh test

# 生产模式发布所有包（需要先npm login）
./publish-all.sh prod
```

## 脚本列表

- `publish-all.sh` - 主发布脚本，用于发布所有包
- `publish-shared.sh` - 发布共享包 (@bigupload/shared)
- `publish-frontend.sh` - 发布前端包 (@bigupload/frontend)
- `publish-node.sh` - 发布 Node.js 后端包 (@bigupload/node-backend)
- `publish-python.sh` - 发布 Python 后端包 (bigupload-fastapi)
- `publish-java.sh` - 发布 Java 后端包 (bigupload-spring-boot-starter)

## 使用方法

### 发布所有包

```bash
# 在项目根目录运行
cd deploy
./publish-all.sh [prod|test]
```

### 发布单个包

```bash
# 在项目根目录运行
cd deploy
./publish-shared.sh [prod|test]
./publish-frontend.sh [prod|test]
./publish-node.sh [prod|test]
./publish-python.sh [prod|test]
./publish-java.sh [prod|test]
```

## 发布模式

- `prod` (默认): 发布到生产环境
  - NPM: npmjs.com
  - PyPI: pypi.org
  - Maven: Maven Central
- `test`: 发布到测试环境
  - NPM: 使用 `--dry-run`
  - PyPI: 发布到 TestPyPI
  - Maven: 安装到本地仓库

## 前置条件

### 工具要求
- Node.js 和 npm
- Python 3 和 pip
- Maven (for Java packages)
- twine (for Python packages)

### 认证要求
- NPM: 需要先登录 `npm login`
- PyPI: 需要配置 `~/.pypirc` 或使用 API token
- Maven: 需要配置 `~/.m2/settings.xml`

## 注意事项

1. 脚本必须在项目根目录下的 `deploy` 文件夹中运行
2. 发布前请确保版本号已正确更新
3. 建议先使用 `test` 模式进行测试
4. 共享包会优先发布，因为其他包可能依赖它

## 修复记录

- ✅ 修复了 Python 环境管理问题，使用虚拟环境和 `python -m pip`
- ✅ 修复了工具命令路径（pip3 而非 pip）
- ✅ 测试模式下跳过 NPM 登录检查
- ✅ 所有脚本路径已调整为从 deploy 文件夹运行

## 常见问题

### Python 发布失败
- 确保项目中有 `.venv` 虚拟环境
- 脚本会自动创建虚拟环境并安装依赖

### NPM 登录问题
- 生产模式需要先运行 `npm login`
- 测试模式会自动跳过登录检查

### 前端包构建失败
- 请先修复 TypeScript 编译错误
- 检查类型定义是否正确 