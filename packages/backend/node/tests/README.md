# BigUpload Node.js Backend Tests

## 测试概览

这个测试套件为 BigUpload Node.js 后端提供了全面的测试覆盖，包括：

### 🧪 测试类型

1. **功能测试** (`app.test.ts`)
   - API 端点测试
   - 文件上传和下载
   - 分片上传和合并
   - 错误处理
   - 集成测试

2. **性能测试** (`performance.test.ts`)
   - 并发上传测试
   - 大文件处理
   - 内存和资源管理
   - 速率限制测试

3. **工具类** (`test-utils.ts`)
   - 测试数据生成器
   - 文件验证工具
   - 性能跟踪器
   - 清理工具

## 🚀 运行测试

### 安装依赖

```bash
npm install
```

### 运行所有测试

```bash
npm test
```

### 运行测试并监视变化

```bash
npm run test:watch
```

### 生成测试覆盖率报告

```bash
npm run test:coverage
```

### CI/CD 模式运行

```bash
npm run test:ci
```

## 📊 测试覆盖的功能

### API 端点测试

- `GET /` - 基本信息
- `GET /health` - 健康检查
- `POST /verify` - 文件验证（秒传功能）
- `POST /upload-chunk` - 分片上传
- `POST /merge-chunks` - 分片合并
- `GET /status/:fileId` - 上传状态查询
- `POST /cleanup` - 清理过期文件
- `GET /files/:filename` - 文件服务

### 上传流程测试

1. **文件验证阶段**
   - 新文件检测
   - 已存在文件检测（秒传）
   - 未完成上传检测

2. **分片上传阶段**
   - 单个分片上传
   - 多个分片并发上传
   - 分片参数验证
   - 上传进度跟踪

3. **文件合并阶段**
   - 完整分片合并
   - 部分分片缺失处理
   - 文件哈希验证
   - 合并后文件验证

### 错误处理测试

- 参数缺失或错误
- 文件不存在
- 分片缺失
- 文件系统错误
- 并发限制

### 性能测试

- 并发上传处理
- 大文件处理能力
- 内存使用优化
- 资源清理

## 🔧 测试配置

测试使用独立的配置：

- **端口**: 3001 (避免与开发服务器冲突)
- **上传目录**: `test-uploads/` (临时测试目录)
- **超时时间**: 30秒 (可在配置中调整)

## 📁 测试文件结构

```
tests/
├── setup.ts              # 测试环境设置
├── app.test.ts           # 主要功能测试
├── performance.test.ts   # 性能测试
├── test-utils.ts         # 测试工具类
└── README.md            # 测试说明文档
```

## 🛠️ 测试工具

### TestFileGenerator

生成各种类型的测试文件：

```typescript
// 生成小测试文件
const smallFile = TestFileGenerator.generateTestFile({
  content: 'test content',
  chunkSize: 10
});

// 生成大文件
const largeFile = TestFileGenerator.generateLargeTestFile(10); // 10MB

// 生成模式文件
const patternFile = TestFileGenerator.generatePatternTestFile('ABC', 100);
```

### TestDataValidator

验证文件和数据：

```typescript
// 验证合并后的文件内容
const isValid = await TestDataValidator.validateMergedFile(
  filePath, 
  expectedContent
);

// 验证文件哈希
const hashValid = await TestDataValidator.validateFileHash(
  filePath, 
  expectedHash
);
```

### PerformanceTracker

跟踪测试性能：

```typescript
const tracker = new PerformanceTracker();
tracker.mark('upload_start');
// ... 执行上传
tracker.mark('upload_end');
const report = tracker.getReport();
```

## 🧪 编写新测试

### 基本测试结构

```typescript
describe('New Feature Tests', () => {
  it('should handle new feature correctly', async () => {
    // 准备测试数据
    const testData = TestFileGenerator.generateTestFile();
    
    // 执行测试
    const response = await request(app)
      .post('/new-endpoint')
      .send(testData)
      .expect(200);
    
    // 验证结果
    expect(response.body.success).toBe(true);
  });
});
```

### 性能测试示例

```typescript
it('should handle performance requirement', async () => {
  const tracker = new PerformanceTracker();
  
  tracker.mark('start');
  // ... 执行操作
  tracker.mark('end');
  
  const elapsed = tracker.getElapsedTime('end');
  expect(elapsed).toBeLessThan(5000); // 5秒内完成
}, 10000); // 10秒超时
```

## 🐛 调试测试

### 查看详细日志

```bash
DEBUG=bigupload:* npm test
```

### 单独运行特定测试

```bash
npx jest --testNamePattern="should upload chunk successfully"
```

### 运行特定测试文件

```bash
npx jest app.test.ts
```

## 📈 持续集成

测试套件适合在 CI/CD 环境中运行：

```yaml
# GitHub Actions 示例
- name: Run tests
  run: npm run test:ci
  
- name: Upload coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

## 💡 最佳实践

1. **独立性**: 每个测试都应该独立运行
2. **清理**: 使用 `afterEach` 清理测试数据
3. **超时**: 为长时间运行的测试设置适当的超时
4. **断言**: 使用有意义的断言和错误消息
5. **数据**: 使用工具类生成测试数据，避免硬编码

## 🤝 贡献指南

添加新测试时请：

1. 遵循现有的测试模式
2. 使用提供的测试工具
3. 添加适当的清理逻辑
4. 更新测试文档
5. 确保测试具有描述性的名称

## 📞 支持

如果您在运行测试时遇到问题，请检查：

1. Node.js 版本兼容性
2. 依赖是否正确安装
3. 文件权限设置
4. 端口是否被占用

更多信息请参考项目主 README 文档。 