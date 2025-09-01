# Git Commit Button Extension

这是一个VSCode扩展，在Git提交界面的标题栏中添加一个自定义按钮。

## 功能

- 在Git源代码管理视图的标题栏中添加一个自定义按钮
- 点击按钮可以执行自定义操作
- 可以访问Git仓库信息和状态

## 开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 编译TypeScript：
   ```bash
   npm run compile
   ```

3. 在VSCode中按F5启动调试，这会打开一个新的VSCode窗口来测试扩展

## 使用

1. 打开一个包含Git仓库的项目
2. 在源代码管理视图中，你会看到标题栏有一个新的按钮
3. 点击按钮执行自定义操作

## 自定义

你可以在 `src/extension.ts` 中的 `handleCustomAction` 函数中添加你想要的功能。
