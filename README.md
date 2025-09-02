# Auto Commit Message

A VSCode extension that uses AI to automatically generate Git commit messages in Chinese, following standard Git commit conventions.

## Features

- **AI-Powered Generation**: Automatically generates commit messages based on your Git changes
- **Chinese Language Support**: Generates commit messages in Chinese with proper Git conventions
- **Multiple AI Models**: Support for OpenAI and compatible APIs with automatic model discovery
- **Smart Change Detection**: Analyzes both staged and working directory changes
- **One-Click Integration**: Seamlessly integrates with VSCode's Git interface
- **Comprehensive Logging**: Built-in logging system for debugging and monitoring

## Installation

1. Download the latest `.vsix` file from releases
2. Install in VSCode: `Extensions` → `...` → `Install from VSIX...`
3. Or use command line: `code --install-extension auto-commit-message-x.x.x.vsix`

## Usage

### Basic Usage
1. Open a Git repository in VSCode
2. Make changes to your files
3. In the Source Control panel, click the ✨ (sparkle) button
4. The AI will analyze your changes and generate a commit message
5. The generated message will be automatically inserted into the commit input box

### Getting Models
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Search for "Get Models List"
3. Select from available AI models for your API

## Configuration

Configure the extension in VSCode Settings (`Ctrl+,` / `Cmd+,`):

| Setting | Description | Default |
|---------|-------------|---------|
| `gitCommitAI.apiUrl` | AI API endpoint URL | `https://api.openai.com/v1/chat/completions` |
| `gitCommitAI.apiKey` | Your AI service API key | (empty) |
| `gitCommitAI.model` | AI model name | `gpt-3.5-turbo` |
| `gitCommitAI.logLevel` | Logging level | `INFO` |

## Available Commands

Access these commands via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **AI Generate Commit Message**: Generate AI-powered commit message
- **Show Logs**: Display extension logs for debugging
- **Get Models List**: Retrieve and select from available AI models

## Supported APIs

This extension works with OpenAI-compatible APIs, including:
- OpenAI GPT models
- Azure OpenAI Service
- Local AI services (Ollama, etc.)
- Other OpenAI-compatible endpoints

## Requirements

- VSCode 1.74.0 or higher
- Git repository
- AI API access (OpenAI or compatible)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API Key not configured | Set your API key in VSCode settings |
| Model not available | Use "Get Models List" command |
| No Git changes detected | Make sure you have uncommitted changes |
| Extension not working | Check logs using "Show Logs" command |

For detailed debugging, set log level to `DEBUG` in settings.

## License

MIT License
