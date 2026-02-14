# Plan Manager

[中文](#中文) | [English](#english)

---

<a name="english"></a>

## English

A cross-platform planning management desktop application built with Tauri + React + TypeScript.

### Features

- **Project Management** - Create, edit, and track project lifecycle (planning/active/completed)
- **Task Management** - Support for subtasks, priorities, time estimation and actual time tracking
- **Notes System** - Knowledge records associated with projects/tasks
- **Daily Check-in** - Mood, energy, focus hours tracking and reflection
- **Data Statistics** - Project progress, task completion rate, timeline visualization
- **Pomodoro Timer** - Focus timer with customizable work/break intervals
- **AI Assistant** - Local Ollama-powered chat assistant
- **Internationalization** - Support for Chinese/English switching
- **Theme Switching** - Support for light/dark/system themes

### Tech Stack

| Category         | Technology                               |
| ---------------- | ---------------------------------------- |
| Framework        | Tauri v2 + React 19 + TypeScript         |
| Build            | Vite 7                                   |
| UI               | Ant Design + shadcn/ui + Tailwind CSS v4 |
| Icons            | Lucide React                             |
| Animation        | Motion                                   |
| State Management | Zustand (persistent storage)             |
| Data Validation  | Zod                                      |

### Project Structure

```
src/
├── domain/          # Business entities and validation contracts (no React dependencies)
│   ├── models.ts    # Data models and Zod Schema
│   └── i18n.ts      # Internationalization config
├── application/     # Use case layer, pure business logic
│   └── metrics.ts   # Statistics calculation
├── store/           # State management and persistence
│   └── workspaceStore.ts
├── components/      # UI components
│   └── ui/          # shadcn/ui components
└── App.tsx          # View composition and interaction
```

### Quick Start

#### Requirements

- Node.js >= 18
- pnpm >= 10
- Rust (Tauri dependency)

#### Install Dependencies

```bash
pnpm install
```

#### Development Mode

```bash
pnpm tauri dev
```

#### Build for Release

```bash
pnpm tauri build
```

### Data Storage

Application data is automatically persisted to local storage with the key `plan-manager-workspace-v1`.

### Recommended IDE

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### License

MIT

---

<a name="中文"></a>

## 中文

一个基于 Tauri + React + TypeScript 构建的跨平台计划管理桌面应用。

### 功能特性

- **项目管理** - 创建、编辑、跟踪项目生命周期（规划/进行中/已完成）
- **任务管理** - 支持子任务、优先级、工时估算与实际耗时跟踪
- **笔记系统** - 项目/任务关联的知识记录
- **每日打卡** - 心情、精力、专注时长记录与反思
- **数据统计** - 项目进度、任务完成率、时间线可视化
- **番茄钟** - 可自定义工作/休息时长的专注计时器
- **AI 助手** - 基于本地 Ollama 的智能对话助手
- **国际化** - 支持中文/英文切换
- **主题切换** - 支持亮色/暗色/跟随系统

### 技术栈

| 类别     | 技术                                     |
| -------- | ---------------------------------------- |
| 框架     | Tauri v2 + React 19 + TypeScript         |
| 构建     | Vite 7                                   |
| UI       | Ant Design + shadcn/ui + Tailwind CSS v4 |
| 图标     | Lucide React                             |
| 动画     | Motion                                   |
| 状态管理 | Zustand (持久化存储)                     |
| 数据验证 | Zod                                      |

### 项目结构

```
src/
├── domain/          # 业务实体与验证契约 (无 React 依赖)
│   ├── models.ts    # 数据模型与 Zod Schema
│   └── i18n.ts      # 国际化配置
├── application/     # 用例层，纯业务逻辑
│   └── metrics.ts   # 统计计算
├── store/           # 状态管理与持久化
│   └── workspaceStore.ts
├── components/      # UI 组件
│   └── ui/          # shadcn/ui 组件
└── App.tsx          # 视图组合与交互
```

### 快速开始

#### 环境要求

- Node.js >= 18
- pnpm >= 10
- Rust (Tauri 依赖)

#### 安装依赖

```bash
pnpm install
```

#### 开发模式

```bash
pnpm tauri dev
```

#### 构建发布

```bash
pnpm tauri build
```

### 数据存储

应用数据自动持久化到本地存储，存储键为 `plan-manager-workspace-v1`。

### IDE 推荐

- [VS Code](https://code.visualstudio.com/)
- [Tauri 插件](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### 许可证

MIT
