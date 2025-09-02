"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const cp = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(cp.exec);
// Log level enumeration
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
// Logger manager class
class Logger {
    constructor(name) {
        this.outputChannel = vscode.window.createOutputChannel(name);
        this.logLevel = this.getConfiguredLogLevel();
    }
    getConfiguredLogLevel() {
        const config = vscode.workspace.getConfiguration('gitCommitAI');
        const level = config.get('logLevel', 'INFO');
        return LogLevel[level] ?? LogLevel.INFO;
    }
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }
    log(level, levelName, message, ...args) {
        if (level < this.logLevel) {
            return;
        }
        const formattedMessage = this.formatMessage(levelName, message);
        this.outputChannel.appendLine(formattedMessage);
        if (args.length > 0) {
            this.outputChannel.appendLine(`Details: ${JSON.stringify(args, null, 2)}`);
        }
        // Also output to console in development mode
        if (level >= LogLevel.ERROR) {
            console.error(formattedMessage, ...args);
        }
        else if (level >= LogLevel.WARN) {
            console.warn(formattedMessage, ...args);
        }
        else {
            console.log(formattedMessage, ...args);
        }
    }
    debug(message, ...args) {
        this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
    }
    info(message, ...args) {
        this.log(LogLevel.INFO, 'INFO', message, ...args);
    }
    warn(message, ...args) {
        this.log(LogLevel.WARN, 'WARN', message, ...args);
    }
    error(message, ...args) {
        this.log(LogLevel.ERROR, 'ERROR', message, ...args);
    }
    show() {
        this.outputChannel.show();
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
// Global logger instance
let logger;
function activate(context) {
    // Initialize logger
    logger = new Logger('Git Commit AI');
    logger.info('Git Commit AI extension is now active!');
    // Register show logs command
    const showLogsDisposable = vscode.commands.registerCommand('gitCommitButton.showLogs', () => {
        logger.show();
    });
    // Register fetch models command
    const fetchModelsDisposable = vscode.commands.registerCommand('gitCommitButton.fetchModels', async () => {
        try {
            logger.info('Starting to fetch model list');
            await fetchAndUpdateModels();
            logger.info('Model list fetch completed');
        }
        catch (error) {
            logger.error('Error occurred while fetching model list', error);
            vscode.window.showErrorMessage(`Error fetching model list: ${error}`);
        }
    });
    // Register generate commit message command
    const generateDisposable = vscode.commands.registerCommand('gitCommitButton.generateCommitMessage', async () => {
        try {
            logger.info('Starting to generate commit message');
            await generateCommitMessage();
            logger.info('Commit message generation completed');
        }
        catch (error) {
            logger.error('Error occurred while generating commit message', error);
            vscode.window.showErrorMessage(`Error generating commit message: ${error}`);
        }
    });
    context.subscriptions.push(generateDisposable, showLogsDisposable, fetchModelsDisposable, logger);
}
exports.activate = activate;
async function generateCommitMessage() {
    logger.debug('Starting commit message generation process');
    // Get current workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        logger.warn('No workspace is open');
        vscode.window.showErrorMessage('No workspace is open');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    logger.debug('Workspace path', { workspaceRoot });
    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating commit message...",
        cancellable: false
    }, async (progress) => {
        try {
            // 1. Get Git changes
            logger.info('Step 1: Getting Git changes');
            progress.report({ increment: 25, message: "Getting Git changes..." });
            const gitDiff = await getGitDiff(workspaceRoot);
            if (!gitDiff.trim()) {
                logger.warn('No Git changes detected');
                vscode.window.showWarningMessage('No Git changes detected');
                return;
            }
            logger.debug('Git changes content length', { length: gitDiff.length });
            // 2. Call AI to generate commit message
            logger.info('Step 2: Calling AI to generate commit message');
            progress.report({ increment: 50, message: "AI generating commit message..." });
            const commitMessage = await callAI(gitDiff);
            logger.info('AI generated commit message', { commitMessage });
            // 3. Set to Git commit box
            logger.info('Step 3: Setting commit message to Git input box');
            progress.report({ increment: 75, message: "Setting commit message..." });
            await setCommitMessage(commitMessage);
            progress.report({ increment: 100, message: "Complete!" });
            logger.info('Commit message generation process completed');
            vscode.window.showInformationMessage('Commit message has been generated');
        }
        catch (error) {
            logger.error('Error occurred during commit message generation process', error);
            throw error;
        }
    });
}
async function getGitDiff(workspaceRoot) {
    try {
        logger.debug('Starting to get Git changes', { workspaceRoot });
        // Get staged changes
        logger.debug('Checking staged changes');
        const { stdout: stagedDiff } = await exec('git diff --cached', { cwd: workspaceRoot });
        // If no staged changes, get working directory changes
        if (!stagedDiff.trim()) {
            logger.debug('No staged changes, checking working directory changes');
            const { stdout: workingDiff } = await exec('git diff', { cwd: workspaceRoot });
            logger.debug('Working directory changes retrieval completed', { hasChanges: !!workingDiff.trim() });
            return workingDiff;
        }
        logger.debug('Staged changes retrieval completed', { hasChanges: !!stagedDiff.trim() });
        return stagedDiff;
    }
    catch (error) {
        logger.error('Error occurred while getting Git changes', error);
        throw new Error('Unable to get Git change information');
    }
}
function generatePromptForLanguage(language, gitDiff) {
    const prompts = {
        'English': `Please generate a concise and clear commit message based on the following Git changes. The commit message should:
1. Use standard Git commit format.
2. Be concise and clear.
3. Describe the main changes.
4. Use numbered format (1, 2, 3) when there are multiple modification points.

Git changes:
${gitDiff}

Please return only the commit message, without any other content:`,
        'Chinese': `请根据以下Git变更内容，生成一个简洁明了的提交信息。提交信息应该：
1. 使用中文标准规范的Git提交格式。
2. 提交信息应该简洁明了。
3. 描述主要变更内容。
4. 有多个点进行修改时，要使用1、2、3这样的格式。

Git变更内容：
${gitDiff}

请只返回提交信息，不要包含其他内容：`,
        'Japanese': `以下のGit変更内容に基づいて、簡潔で明確なコミットメッセージを生成してください。コミットメッセージは以下の条件を満たす必要があります：
1. 標準的なGitコミット形式を使用する。
2. 簡潔で明確である。
3. 主な変更内容を説明する。
4. 複数の修正点がある場合は、1、2、3の形式を使用する。

Git変更内容：
${gitDiff}

コミットメッセージのみを返してください。他の内容は含めないでください：`,
        'Korean': `다음 Git 변경 내용을 바탕으로 간결하고 명확한 커밋 메시지를 생성해주세요. 커밋 메시지는 다음 조건을 만족해야 합니다:
1. 표준 Git 커밋 형식을 사용한다.
2. 간결하고 명확하다.
3. 주요 변경 사항을 설명한다.
4. 여러 수정 사항이 있을 때는 1, 2, 3 형식을 사용한다.

Git 변경 내용:
${gitDiff}

커밋 메시지만 반환해주세요. 다른 내용은 포함하지 마세요:`,
        'French': `Veuillez générer un message de commit concis et clair basé sur les changements Git suivants. Le message de commit doit :
1. Utiliser le format de commit Git standard.
2. Être concis et clair.
3. Décrire les principales modifications.
4. Utiliser le format numéroté (1, 2, 3) lorsqu'il y a plusieurs points de modification.

Changements Git :
${gitDiff}

Veuillez retourner uniquement le message de commit, sans autre contenu :`,
        'German': `Bitte generieren Sie eine prägnante und klare Commit-Nachricht basierend auf den folgenden Git-Änderungen. Die Commit-Nachricht sollte:
1. Das Standard-Git-Commit-Format verwenden.
2. Prägnant und klar sein.
3. Die wichtigsten Änderungen beschreiben.
4. Das nummerierte Format (1, 2, 3) verwenden, wenn es mehrere Änderungspunkte gibt.

Git-Änderungen:
${gitDiff}

Bitte geben Sie nur die Commit-Nachricht zurück, ohne anderen Inhalt:`,
        'Spanish': `Por favor, genere un mensaje de commit conciso y claro basado en los siguientes cambios de Git. El mensaje de commit debe:
1. Usar el formato estándar de commit de Git.
2. Ser conciso y claro.
3. Describir los cambios principales.
4. Usar formato numerado (1, 2, 3) cuando hay múltiples puntos de modificación.

Cambios de Git:
${gitDiff}

Por favor, devuelva solo el mensaje de commit, sin otro contenido:`,
        'Portuguese': `Por favor, gere uma mensagem de commit concisa e clara baseada nas seguintes mudanças do Git. A mensagem de commit deve:
1. Usar o formato padrão de commit do Git.
2. Ser concisa e clara.
3. Descrever as principais mudanças.
4. Usar formato numerado (1, 2, 3) quando houver múltiplos pontos de modificação.

Mudanças do Git:
${gitDiff}

Por favor, retorne apenas a mensagem de commit, sem outro conteúdo:`,
        'Russian': `Пожалуйста, создайте краткое и понятное сообщение коммита на основе следующих изменений Git. Сообщение коммита должно:
1. Использовать стандартный формат коммита Git.
2. Быть кратким и понятным.
3. Описывать основные изменения.
4. Использовать нумерованный формат (1, 2, 3) при наличии нескольких точек изменения.

Изменения Git:
${gitDiff}

Пожалуйста, верните только сообщение коммита, без другого содержимого:`,
        'Italian': `Si prega di generare un messaggio di commit conciso e chiaro basato sui seguenti cambiamenti Git. Il messaggio di commit dovrebbe:
1. Utilizzare il formato di commit Git standard.
2. Essere conciso e chiaro.
3. Descrivere i cambiamenti principali.
4. Utilizzare il formato numerato (1, 2, 3) quando ci sono più punti di modifica.

Cambiamenti Git:
${gitDiff}

Si prega di restituire solo il messaggio di commit, senza altri contenuti:`
    };
    return prompts[language] || prompts['English'];
}
async function callAI(gitDiff) {
    logger.debug('Starting to call AI API');
    const config = vscode.workspace.getConfiguration('gitCommitAI');
    const apiUrl = config.get('apiUrl');
    const apiKey = config.get('apiKey');
    const model = config.get('model');
    const commitLanguage = config.get('commitLanguage', 'English');
    logger.debug('AI configuration information', {
        apiUrl,
        model,
        commitLanguage,
        hasApiKey: !!apiKey,
        gitDiffLength: gitDiff.length
    });
    if (!apiKey) {
        logger.error('AI API Key not configured');
        throw new Error('Please configure AI API Key in settings first');
    }
    const prompt = generatePromptForLanguage(commitLanguage, gitDiff);
    try {
        logger.info('Sending AI API request', { apiUrl, model });
        // Use Node.js built-in fetch (requires Node.js 18+)
        const response = await globalThis.fetch(apiUrl, {
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
        logger.debug('AI API response status', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        if (!response.ok) {
            const errorText = await response.text();
            logger.error('AI API request failed', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        logger.debug('AI API response data', { data });
        const commitMessage = data.choices?.[0]?.message?.content?.trim();
        if (!commitMessage) {
            logger.error('AI returned response format is incorrect', { data });
            throw new Error('AI returned response format is incorrect');
        }
        logger.info('AI generated commit message successfully', { commitMessage });
        return commitMessage;
    }
    catch (error) {
        logger.error('Error occurred while calling AI', error);
        throw new Error(`AI call failed: ${error}`);
    }
}
async function setCommitMessage(message) {
    try {
        logger.debug('Starting to set commit message to Git input box', { message });
        // Get Git extension
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        if (!gitExtension) {
            logger.error('Git extension not found');
            throw new Error('Git extension not found');
        }
        logger.debug('Git extension retrieved successfully');
        const git = gitExtension.getAPI(1);
        const repository = git.repositories[0];
        if (!repository) {
            logger.error('No Git repository found');
            throw new Error('No Git repository found');
        }
        logger.debug('Git repository retrieved successfully', { repositoryCount: git.repositories.length });
        // Set commit message
        repository.inputBox.value = message;
        logger.info('Commit message set successfully', { message });
    }
    catch (error) {
        logger.error('Error occurred while setting commit message', error);
        throw new Error('Unable to set commit message to Git input box');
    }
}
async function fetchAndUpdateModels() {
    logger.debug('Starting to fetch model list');
    const config = vscode.workspace.getConfiguration('gitCommitAI');
    const apiUrl = config.get('apiUrl');
    const apiKey = config.get('apiKey');
    if (!apiKey) {
        logger.error('API Key not configured, unable to fetch model list');
        throw new Error('Please configure AI API Key in settings first');
    }
    if (!apiUrl) {
        logger.error('API URL not configured, unable to fetch model list');
        throw new Error('Please configure AI API URL in settings first');
    }
    try {
        // Build model list API URL
        const modelsUrl = apiUrl.replace('/chat/completions', '/models').replace('/v1/chat/completions', '/v1/models');
        logger.debug('Requesting model list API', { modelsUrl });
        const response = await globalThis.fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        logger.debug('Model list API response status', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Model list API request failed', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`Failed to fetch model list: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        logger.debug('Model list API response data', { data });
        // Parse model list
        const models = data.data || data.models || [];
        if (!Array.isArray(models) || models.length === 0) {
            logger.warn('API returned empty model list or incorrect format', { data });
            throw new Error('API returned empty model list or incorrect format');
        }
        // Extract model names
        const modelNames = models.map((model) => model.id || model.name || model).filter(Boolean);
        logger.info('Retrieved model list', { modelNames, count: modelNames.length });
        // Show model selection dialog
        const selectedModel = await vscode.window.showQuickPick(modelNames, {
            placeHolder: 'Select an AI model',
            title: 'Available AI Model List'
        });
        if (selectedModel) {
            // Update configuration
            await config.update('model', selectedModel, vscode.ConfigurationTarget.Global);
            logger.info('Model updated', { selectedModel });
            vscode.window.showInformationMessage(`Model updated to: ${selectedModel}`);
        }
        else {
            logger.info('User cancelled model selection');
        }
    }
    catch (error) {
        logger.error('Error occurred while fetching model list', error);
        throw error;
    }
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map