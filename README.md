# OpenBot

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**OpenBot** 是基于 Agent Skills 与编码智能体（Coding Agent）的**一体化 AI 助手平台**，支持 CLI、WebSocket 网关与桌面端。通过可插拔技能（Skills）、浏览器自动化、代码执行与长期记忆，为开发与日常任务提供可扩展的 AI 工作流。

---

## 特性概览

| 能力 | 说明 |
|------|------|
| **技能架构** | 基于 Cursor Agent Skills 规范，支持多路径加载、本地安装与动态扩展 |
| **编码智能体** | 集成 [pi-coding-agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)，支持多轮工具调用与代码执行 |
| **浏览器自动化** | 内置 [agent-browser](https://www.npmjs.com/package/agent-browser)，可导航、填表、截图与数据抓取 |
| **长期记忆** | 向量存储（Vectra）+ 本地嵌入，支持经验总结与会话压缩（compaction） |
| **多端接入** | CLI、WebSocket 网关、Electron 桌面端，同一套 Agent 核心 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端 / 接入层                                  │
├─────────────────┬─────────────────────────────┬─────────────────────────────┤
│   CLI (openbot) │   WebSocket Gateway (JSON-RPC)  │   OpenBot Desktop (Electron)  │
│   Commander     │   ws, 端口 3000               │   Vue 3 + Pinia + Vite       │
└────────┬────────┴──────────────┬──────────────┴──────────────┬──────────────┘
         │                        │                             │
         │                        │  HTTP + Socket.io            │
         ▼                        ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Gateway Server (Node)                             │
│  • 静态资源 • 自动发现端口 • 子进程拉起 Desktop Server                        │
└────────────────────────────────────┬────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌─────────────────┐    ┌─────────────────────────────┐    ┌─────────────────────┐
│  Agent 核心      │    │  Desktop Backend (NestJS)   │    │  Memory / 向量存储   │
│  AgentManager   │    │  server-api/*               │    │  Vectra + 嵌入       │
│  pi-coding-agent│    │  Agents · Skills · Tasks    │    │  compaction 扩展     │
│  pi-ai 多模型   │    │  Auth · Users · Workspace   │    │  better-sqlite3      │
└────────┬────────┘    └─────────────────────────────┘    └─────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Tools: read/write/edit · bash · find/grep/ls · browser · install-skill ·   │
│         save-experience (写入记忆)                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **CLI**：直接调用 Agent 核心，单次提示或批量脚本。
- **Gateway**：对外提供 WebSocket（JSON-RPC），供 Web/移动端连接；内部负责起端口、拉 Nest 后端、路由请求。
- **Desktop**：Electron 包一层 Vue 前端 + 本地 Nest 后端，通过 Gateway 或直连后端与 Agent 通信；技能、会话、任务、工作区等由 Nest 模块管理。
- **Agent 核心**：统一由 `AgentManager` 管理会话、技能注入与工具注册；记忆与 compaction 作为扩展参与 system prompt 与经验写入。

---

## 各端技术栈

### CLI

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 20+ |
| 语言 | TypeScript 5.7 |
| 入口 | `openbot`（bin → `dist/cli.js`） |
| 框架 | Commander（子命令：`gateway`、`login`、`config`） |
| 配置 | `~/.openbot/agent`（API Key、模型、技能等） |

### WebSocket Gateway

| 类别 | 技术 |
|------|------|
| 协议 | JSON-RPC over WebSocket（`ws`） |
| 端口 | 默认 3000，可 `-p` 指定 |
| 职责 | 连接管理、消息路由、静态资源、拉 Nest 子进程 |
| 方法 | `connect`、`agent.chat`、`agent.cancel`、`subscribe_session`、`unsubscribe_session` 等 |

### Agent 核心

| 类别 | 技术 |
|------|------|
| 智能体 | @mariozechner/pi-coding-agent |
| 模型/Provider | @mariozechner/pi-ai（DeepSeek、DashScope、OpenAI 等） |
| 工具 | read/write/edit、bash、find/grep/ls、browser、install-skill、save-experience |
| 技能 | SKILL.md 规范，多路径加载，formatSkillsForPrompt 注入 system prompt |

### Desktop 后端（NestJS）

| 类别 | 技术 |
|------|------|
| 框架 | NestJS 10、Express、Socket.io |
| 前缀 | `server-api` |
| 模块 | Database · Agents · AgentConfig · Skills · Config · Auth · Users · Workspace · Tasks · Usage |
| 数据 | better-sqlite3（若使用本地库） |

### Desktop 前端（Electron + Vue）

| 类别 | 技术 |
|------|------|
| 壳子 | Electron 28 |
| 前端 | Vue 3、Vue Router、Pinia |
| 构建 | Vite 5 |
| 通信 | axios、socket.io-client |
| 视图 | Dashboard、Agents、AgentChat/AgentDetail、Sessions、Skills、Settings、Tasks、WorkResults、Workspace、Login |
| 国际化 | 自研 useI18n + locales (zh/en) |

### 记忆与向量

| 类别 | 技术 |
|------|------|
| 向量索引 | Vectra（LocalIndex） |
| 嵌入 | @xenova/transformers（本地模型） |
| 扩展 | compaction-extension（会话压缩、摘要入 prompt） |
| 持久化 | 与 agent 目录一致的 memory 目录、better-sqlite3（若用于元数据） |

### 内置技能

| 技能 | 说明 |
|------|------|
| find-skills | 发现与安装 Cursor/Agent 技能 |
| agent-browser | 浏览器自动化（Playwright/agent-browser CLI） |

---

## 快速开始

### 环境要求

- **Node.js** ≥ 20
- 可选：`OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY` 等（按所用 provider 配置）

### 安装与构建

```bash
npm install
npm run build
```

### CLI 使用

```bash
# 直接对话（使用默认 workspace 与技能）
openbot "总结一下当前有哪些技能"

# 指定技能路径
openbot -s ./skills "用 find-skills 搜一下 PDF 相关技能"

# 仅打印 system/user prompt，不调 LLM
openbot --dry-run --prompt "查北京天气"

# 指定模型与 provider
openbot --model deepseek-chat --provider deepseek "写一段 TypeScript 示例"
```

### 启动 WebSocket 网关

```bash
openbot gateway --port 3000
```

客户端通过 `ws://localhost:3000` 连接，使用 JSON-RPC 调用 `connect`、`agent.chat` 等。

### 启动桌面端

```bash
# 先构建核心（若未构建）
npm run build

# 开发模式（Vite 热更 + Electron）
npm run desktop:dev

# 仅安装桌面依赖
npm run desktop:install
```

---

## Gateway API 简述

- **请求**：`{ "type": "request", "id": "<id>", "method": "<method>", "params": { ... } }`
- **成功响应**：`{ "type": "response", "id": "<id>", "result": { ... } }`
- **错误响应**：`{ "type": "response", "id": "<id>", "error": { "message": "..." } }`
- **服务端事件**：如 `agent.chunk`（流式输出）、`agent.tool`（工具调用）等，格式为 `{ "type": "event", "event": "...", "payload": { ... } }`

常用方法：先 `connect` 建立会话，再通过 `agent.chat` 发送消息并接收流式/事件；`agent.cancel` 取消当前任务。

---

## 开发

```bash
# 单元/集成测试
npm test

# 仅 e2e
npm run test:e2e

# 记忆相关测试
npm run test:memory
```

---

## 许可证

MIT
