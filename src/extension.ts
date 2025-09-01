import * as vscode from 'vscode';
import * as cp from 'child_process';
import { promisify } from 'util';

const exec = promisify(cp.exec);

// 日志级别枚举
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

// 日志管理器类
class Logger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel;

    constructor(name: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
        this.logLevel = this.getConfiguredLogLevel();
    }

    private getConfiguredLogLevel(): LogLevel {
        const config = vscode.workspace.getConfiguration('gitCommitAI');
        const level = config.get<string>('logLevel', 'INFO');
        return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    private log(level: LogLevel, levelName: string, message: string, ...args: any[]) {
        if (level < this.logLevel) {
            return;
        }

        const formattedMessage = this.formatMessage(levelName, message);
        this.outputChannel.appendLine(formattedMessage);

        if (args.length > 0) {
            this.outputChannel.appendLine(`详细信息: ${JSON.stringify(args, null, 2)}`);
        }

        // 在开发模式下也输出到控制台
        if (level >= LogLevel.ERROR) {
            console.error(formattedMessage, ...args);
        } else if (level >= LogLevel.WARN) {
            console.warn(formattedMessage, ...args);
        } else {
            console.log(formattedMessage, ...args);
        }
    }

    debug(message: string, ...args: any[]) {
        this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
    }

    info(message: string, ...args: any[]) {
        this.log(LogLevel.INFO, 'INFO', message, ...args);
    }

    warn(message: string, ...args: any[]) {
        this.log(LogLevel.WARN, 'WARN', message, ...args);
    }

    error(message: string, ...args: any[]) {
        this.log(LogLevel.ERROR, 'ERROR', message, ...args);
    }

    show() {
        this.outputChannel.show();
    }

    dispose() {
        this.outputChannel.dispose();
    }
}

// 全局日志实例
let logger: Logger;

export function activate(context: vscode.ExtensionContext) {
    // 初始化日志器
    logger = new Logger('Git Commit AI');
    logger.info('Git Commit AI extension is now active!');

    // 注册显示日志命令
    const showLogsDisposable = vscode.commands.registerCommand('gitCommitButton.showLogs', () => {
        logger.show();
    });

    // 注册获取模型列表命令
    const fetchModelsDisposable = vscode.commands.registerCommand('gitCommitButton.fetchModels', async () => {
        try {
            logger.info('开始获取模型列表');
            await fetchAndUpdateModels();
            logger.info('模型列表获取完成');
        } catch (error) {
            logger.error('获取模型列表时出错', error);
            vscode.window.showErrorMessage(`获取模型列表时出错: ${error}`);
        }
    });

    // 注册生成提交信息命令
    const generateDisposable = vscode.commands.registerCommand('gitCommitButton.generateCommitMessage', async () => {
        try {
            logger.info('开始生成提交信息');
            await generateCommitMessage();
            logger.info('提交信息生成完成');
        } catch (error) {
            logger.error('生成提交信息时出错', error);
            vscode.window.showErrorMessage(`生成提交信息时出错: ${error}`);
        }
    });

    context.subscriptions.push(generateDisposable, showLogsDisposable, fetchModelsDisposable, logger);
}

async function generateCommitMessage() {
    logger.debug('开始生成提交信息流程');

    // 获取当前工作区
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        logger.warn('没有打开的工作区');
        vscode.window.showErrorMessage('没有打开的工作区');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    logger.debug('工作区路径', { workspaceRoot });

    // 显示进度
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在生成提交信息...",
        cancellable: false
    }, async (progress) => {
        try {
            // 1. 获取Git变更
            logger.info('步骤1: 获取Git变更');
            progress.report({ increment: 25, message: "获取Git变更..." });
            const gitDiff = await getGitDiff(workspaceRoot);

            if (!gitDiff.trim()) {
                logger.warn('没有检测到Git变更');
                vscode.window.showWarningMessage('没有检测到Git变更');
                return;
            }

            logger.debug('Git变更内容长度', { length: gitDiff.length });

            // 2. 调用AI生成提交信息
            logger.info('步骤2: 调用AI生成提交信息');
            progress.report({ increment: 50, message: "AI生成提交信息..." });
            const commitMessage = await callAI(gitDiff);

            logger.info('AI生成的提交信息', { commitMessage });

            // 3. 设置到Git提交框
            logger.info('步骤3: 设置提交信息到Git输入框');
            progress.report({ increment: 75, message: "设置提交信息..." });
            await setCommitMessage(commitMessage);

            progress.report({ increment: 100, message: "完成!" });
            logger.info('提交信息生成流程完成');
            vscode.window.showInformationMessage('提交信息已生成');

        } catch (error) {
            logger.error('生成提交信息流程中发生错误', error);
            throw error;
        }
    });
}

async function getGitDiff(workspaceRoot: string): Promise<string> {
    try {
        logger.debug('开始获取Git变更', { workspaceRoot });

        // 获取暂存区的变更
        logger.debug('检查暂存区变更');
        const { stdout: stagedDiff } = await exec('git diff --cached', { cwd: workspaceRoot });

        // 如果暂存区没有变更，获取工作区变更
        if (!stagedDiff.trim()) {
            logger.debug('暂存区无变更，检查工作区变更');
            const { stdout: workingDiff } = await exec('git diff', { cwd: workspaceRoot });
            logger.debug('工作区变更获取完成', { hasChanges: !!workingDiff.trim() });
            return workingDiff;
        }

        logger.debug('暂存区变更获取完成', { hasChanges: !!stagedDiff.trim() });
        return stagedDiff;
    } catch (error) {
        logger.error('获取Git变更时发生错误', error);
        throw new Error('无法获取Git变更信息');
    }
}

async function callAI(gitDiff: string): Promise<string> {
    logger.debug('开始调用AI API');

    const config = vscode.workspace.getConfiguration('gitCommitAI');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');
    const model = config.get<string>('model');

    logger.debug('AI配置信息', {
        apiUrl,
        model,
        hasApiKey: !!apiKey,
        gitDiffLength: gitDiff.length
    });

    if (!apiKey) {
        logger.error('AI API Key未配置');
        throw new Error('请先在设置中配置AI API Key');
    }

    const prompt = `请根据以下Git变更内容，生成一个简洁明了的提交信息。提交信息应该：
1. 使用中文标准规范的Git提交格式。
2. 提交信息应该简洁明了。
3. 描述主要变更内容。
4. 有多个点进行修改时，要使用123这样的格式.

Git变更内容：
${gitDiff}

请只返回提交信息，不要包含其他内容：`;

    try {
        logger.info('发送AI API请求', { apiUrl, model });

        // 使用Node.js内置的fetch (需要Node.js 18+)
        const response = await (globalThis as any).fetch(apiUrl!, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 100,
                temperature: 0.7
            })
        });

        logger.debug('AI API响应状态', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('AI API请求失败', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        logger.debug('AI API响应数据', { data });

        const commitMessage = data.choices?.[0]?.message?.content?.trim();

        if (!commitMessage) {
            logger.error('AI返回的响应格式不正确', { data });
            throw new Error('AI返回的响应格式不正确');
        }

        logger.info('AI生成提交信息成功', { commitMessage });
        return commitMessage;
    } catch (error) {
        logger.error('调用AI时发生错误', error);
        throw new Error(`AI调用失败: ${error}`);
    }
}

async function setCommitMessage(message: string) {
    try {
        logger.debug('开始设置提交信息到Git输入框', { message });

        // 获取Git扩展
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        if (!gitExtension) {
            logger.error('Git扩展未找到');
            throw new Error('Git扩展未找到');
        }

        logger.debug('Git扩展获取成功');
        const git = gitExtension.getAPI(1);
        const repository = git.repositories[0];

        if (!repository) {
            logger.error('没有找到Git仓库');
            throw new Error('没有找到Git仓库');
        }

        logger.debug('Git仓库获取成功', { repositoryCount: git.repositories.length });

        // 设置提交信息
        repository.inputBox.value = message;
        logger.info('提交信息设置成功', { message });
    } catch (error) {
        logger.error('设置提交信息时发生错误', error);
        throw new Error('无法设置提交信息到Git输入框');
    }
}

async function fetchAndUpdateModels() {
    logger.debug('开始获取模型列表');

    const config = vscode.workspace.getConfiguration('gitCommitAI');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');

    if (!apiKey) {
        logger.error('API Key未配置，无法获取模型列表');
        throw new Error('请先在设置中配置AI API Key');
    }

    if (!apiUrl) {
        logger.error('API URL未配置，无法获取模型列表');
        throw new Error('请先在设置中配置AI API URL');
    }

    try {
        // 构建模型列表API URL
        const modelsUrl = apiUrl.replace('/chat/completions', '/models').replace('/v1/chat/completions', '/v1/models');
        logger.debug('请求模型列表API', { modelsUrl });

        const response = await (globalThis as any).fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        logger.debug('模型列表API响应状态', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('获取模型列表API请求失败', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        logger.debug('模型列表API响应数据', { data });

        // 解析模型列表
        const models = data.data || data.models || [];
        if (!Array.isArray(models) || models.length === 0) {
            logger.warn('API返回的模型列表为空或格式不正确', { data });
            throw new Error('API返回的模型列表为空或格式不正确');
        }

        // 提取模型名称
        const modelNames = models.map((model: any) => model.id || model.name || model).filter(Boolean);
        logger.info('获取到的模型列表', { modelNames, count: modelNames.length });

        // 显示模型选择对话框
        const selectedModel = await vscode.window.showQuickPick(modelNames, {
            placeHolder: '选择一个AI模型',
            title: '可用的AI模型列表'
        });

        if (selectedModel) {
            // 更新配置
            await config.update('model', selectedModel, vscode.ConfigurationTarget.Global);
            logger.info('模型已更新', { selectedModel });
            vscode.window.showInformationMessage(`模型已更新为: ${selectedModel}`);
        } else {
            logger.info('用户取消了模型选择');
        }

    } catch (error) {
        logger.error('获取模型列表时发生错误', error);
        throw error;
    }
}

export function deactivate() {}
