import * as fs from "fs-extra";
import * as path from "path";

// 简单的测试来验证测试环境
describe("Simple Tests", () => {
  it("should be able to run tests", () => {
    expect(true).toBe(true);
  });

  it("should be able to use fs-extra", async () => {
    const testDir = path.resolve(__dirname, "../test-temp");
    await fs.ensureDir(testDir);
    const exists = await fs.pathExists(testDir);
    expect(exists).toBe(true);
    await fs.remove(testDir);
  });

  it("should be able to create buffers", () => {
    const buffer = Buffer.from("test content");
    expect(buffer.toString()).toBe("test content");
  });

  it("should be able to use crypto for hashing", () => {
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256");
    hash.update("test content");
    const result = hash.digest("hex");
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });
});
