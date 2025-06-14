FastUploader测试说明
====================

本目录包含测试FastUploader功能的测试文件。

测试步骤：

1. 运行构建脚本：
   ```
   ./build-demo.sh
   ```

2. 运行测试环境：
   ```
   ./test-demo.sh
   ```

3. 在浏览器中打开React示例应用：
   http://localhost:3001

4. 使用界面上传本目录中的文件，测试以下功能：

   - 基本上传功能（使用small.txt）
   - 大文件分片上传（使用large.bin）
   - 暂停/继续功能
   - 断点续传功能（上传过程中刷新页面）
   - 秒传功能（再次上传相同文件）

测试文件说明：
- small.txt - 小文件测试
- large.bin - 大文件测试（通过生成脚本创建）

生成测试文件：
可使用 generate-test-files.sh 脚本生成测试文件。 