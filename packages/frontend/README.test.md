# useBigUpload Hook 测试文档

## 概述

本项目为 `useBigUpload` React Hook 提供了全面的单元测试和集成测试，确保代码质量和功能可靠性。

## 测试结构

```
src/hooks/__tests__/
├── useBigUpload.test.ts          # 基础单元测试
├── useBigUpload.integration.test.ts  # 集成测试
└── test-utils.ts                 # 测试工具函数
```

## 测试环境配置

### 依赖安装

首先需要安装测试相关依赖：

```bash
npm install --save-dev @testing-library/react-hooks @testing-library/jest-dom jest ts-jest jsdom @types/jest
```

### 配置文件

- `jest.config.js`: Jest 配置
- `src/setupTests.ts`: 测试环境设置
- `src/hooks/__tests__/test-utils.ts`: 测试工具函数

## 测试覆盖范围

### 基础单元测试 (useBigUpload.test.ts)

1. **Hook 初始化**
   - BigUploadEngine 正确初始化
   - 事件监听器注册
   - 初始状态验证

2. **文件添加功能**
   - 基本文件添加
   - 文件类型验证（扩展名、MIME类型、通配符）
   - 文件大小限制
   - 文件数量限制
   - 自动开始上传

3. **上传控制功能**
   - 开始上传（单个/全部）
   - 暂停上传
   - 继续上传
   - 取消上传

4. **文件管理功能**
   - 移除文件
   - 清空所有文件

5. **状态更新**
   - stateChange 事件响应
   - 上传状态计算

6. **进度计算**
   - 总体进度计算
   - 空文件列表处理

7. **错误处理**
   - 引擎未初始化错误
   - 文件添加失败

8. **事件监听器清理**
   - 组件卸载时的内存清理

### 集成测试 (useBigUpload.integration.test.ts)

1. **完整上传流程**
   - 从文件添加到上传完成的完整流程
   - 多文件并发上传

2. **错误处理和恢复**
   - 可重试错误处理
   - 不可重试错误处理

3. **暂停和恢复功能**
   - 上传暂停/恢复完整流程

4. **文件管理功能**
   - 动态添加和移除文件

5. **性能优化**
   - 大量文件处理性能测试

6. **边界情况**
   - 空文件列表处理
   - 重复文件ID处理

## 测试工具函数 (test-utils.ts)

提供了一系列辅助函数：

- `createMockFile()`: 创建Mock文件
- `createMockFileList()`: 创建Mock文件列表
- `createMockFileState()`: 创建Mock文件状态
- `createMockProgress()`: 创建Mock进度数据
- `MockEventEmitter`: 模拟事件系统

## 运行测试

### 基本命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test useBigUpload.test.ts

# 运行集成测试
npm test useBigUpload.integration.test.ts

# 生成覆盖率报告
npm test -- --coverage

# 监听模式
npm test -- --watch
```

### 高级选项

```bash
# 只运行特定的测试用例
npm test -- --testNamePattern="文件添加功能"

# 详细输出
npm test -- --verbose

# 更新快照
npm test -- --updateSnapshot
```

## 测试最佳实践

### 1. Mock 策略

- 对 `BigUploadEngine` 进行完整 Mock
- 使用 `MockEventEmitter` 模拟事件系统
- Mock Web APIs（File、FileList、crypto）

### 2. 测试隔离

- 每个测试前重置 Mock 状态
- 使用 `act()` 包装状态更新
- 清理事件监听器

### 3. 断言策略

- 验证函数调用参数
- 验证组件状态变化
- 验证事件触发

### 4. 边界测试

- 测试空值、null、undefined
- 测试极端数值
- 测试错误条件

## 测试覆盖率目标

目标测试覆盖率：

- **语句覆盖率**: > 95%
- **分支覆盖率**: > 90%
- **函数覆盖率**: > 95%
- **行覆盖率**: > 95%

## 常见问题

### 1. 测试运行缓慢

```bash
# 使用 --maxWorkers 限制并发
npm test -- --maxWorkers=4

# 只运行变更的测试
npm test -- --onlyChanged
```

### 2. Mock 问题

确保在 `setupTests.ts` 中正确配置了 Mock：

```typescript
// 检查 File 构造函数是否正确 Mock
expect(typeof File).toBe('function');

// 检查 crypto API 是否可用
expect(global.crypto.subtle).toBeDefined();
```

### 3. 异步测试问题

使用 `act()` 包装异步操作：

```typescript
await act(async () => {
  await result.current.addFiles(fileList);
});
```

## 持续集成

### GitHub Actions 配置示例

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage --watchAll=false
      - uses: codecov/codecov-action@v1
```

## 贡献指南

添加新测试时请遵循：

1. 为新功能添加对应测试
2. 保持测试的独立性
3. 使用描述性的测试名称
4. 添加必要的注释
5. 确保测试覆盖率不降低

## 性能基准

测试性能基准：

- 单个测试套件: < 5秒
- 完整测试运行: < 30秒
- 内存使用: < 512MB
- 100个文件状态更新: < 1秒 