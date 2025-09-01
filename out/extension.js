"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    console.log('Git Commit Button extension is now active!');
    // 注册自定义命令
    let disposable = vscode.commands.registerCommand('gitCommitButton.customAction', () => {
        // 显示信息消息
        vscode.window.showInformationMessage('自定义按钮被点击了！');
        // 这里可以添加你想要的功能
        // 例如：自动填充提交信息、打开特定文件、执行特定操作等
        handleCustomAction();
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
async function handleCustomAction() {
    // 获取当前工作区
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('没有打开的工作区');
        return;
    }
    // 获取Git扩展
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    if (!gitExtension) {
        vscode.window.showErrorMessage('Git扩展未找到');
        return;
    }
    const git = gitExtension.getAPI(1);
    const repository = git.repositories[0];
    if (!repository) {
        vscode.window.showErrorMessage('没有找到Git仓库');
        return;
    }
    // 示例：显示当前分支信息
    const branch = repository.state.HEAD?.name || 'unknown';
    vscode.window.showInformationMessage(`当前分支: ${branch}`);
    // 示例：可以在这里添加更多功能
    // - 自动生成提交信息
    // - 检查代码规范
    // - 运行测试
    // - 等等...
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map