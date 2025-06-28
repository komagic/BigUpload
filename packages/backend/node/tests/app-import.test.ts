// 测试应用导入
describe("App Import Test", () => {
  it("should be able to import the app", async () => {
    // 设置环境变量
    process.env.NODE_ENV = "test";
    process.env.PORT = "3001";

    let app: any;

    try {
      // 尝试直接导入
      const appModule = await import("../src/app");
      app = appModule.default || appModule;
      console.log("App imported successfully, type:", typeof app);
    } catch (error) {
      console.error("Failed to import app:", error);
      throw error;
    }

    expect(app).toBeDefined();
    expect(typeof app).toBe("object");
    // Express 应用应该有 listen 方法
    expect(typeof app.listen).toBe("function");
  });
});
