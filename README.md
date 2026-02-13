# Plan Manager

一个基于 Tauri + React + TypeScript 构建的跨平台计划管理桌面应用。

## 功能特性

- **项目管理** - 创建、编辑、跟踪项目生命周期（规划/进行中/已完成）
- **任务管理** - 支持子任务、优先级、工时估算与实际耗时跟踪
- **笔记系统** - 项目/任务关联的知识记录
- **每日打卡** - 心情、精力、专注时长记录与反思
- **数据统计** - 项目进度、任务完成率、时间线可视化
- **国际化** - 支持中文/英文切换
- **主题切换** - 支持亮色/暗色/跟随系统

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Tauri v2 + React 19 + TypeScript |
| 构建 | Vite 7 |
| UI | Ant Design + shadcn/ui + Tailwind CSS v4 |
| 图标 | Lucide React |
| 动画 | Motion |
| 状态管理 | Zustand (持久化存储) |
| 数据验证 | Zod |

## 项目结构

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

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 10
- Rust (Tauri 依赖)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri dev
```

### 构建发布

```bash
pnpm tauri build
```

## 数据存储

应用数据自动持久化到本地存储，存储键为 `plan-manager-workspace-v1`。

## IDE 推荐

- [VS Code](https://code.visualstudio.com/)
- [Tauri 插件](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 许可证

MIT
