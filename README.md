# Sonnet · 十四行诗 ✦

> 一个温柔体贴的 AI 陪伴助手，基于 Web 技术构建的 AI 聊天应用

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://sukikeeling.github.io/Sonnet/)
[![Build APK](https://github.com/sukikeeling/Sonnet/actions/workflows/build-apk.yml/badge.svg)](https://github.com/sukikeeling/Sonnet/actions/workflows/build-apk.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ 特性

| 特性 | 说明 |
|------|------|
| **流式 SSE 响应** | AI 回复实时逐字输出，支持随时停止 |
| **多模型支持** | DeepSeek / OpenAI / 自定义中转站，一键切换 |
| **多对话管理** | 创建/切换/搜索/删除/导出对话 |
| **Markdown 渲染** | 完整 Markdown + 代码语法高亮（190+ 语言） |
| **10 种主题** | 玫瑰金/星云紫蓝/紫外光/VERCEL + 6 款国风传统色 |
| **深色/浅色模式** | 一键切换，各主题独立暗色方案 |
| **消息操作** | 复制/编辑/删除/重新生成 |
| **导出** | 对话导出为 Markdown 文件 |
| **日记系统** | 每日对话自动归档，Bento Grid 便签墙 |
| **开屏动画** | 流星雨 + 点击星星绽放 |
| **刘海屏适配** | 全平台 safe-area 适配 |

## 🖼️ 截图

| 浅色模式 | 暗色模式 |
|----------|----------|
| _截图待添加_ | _截图待添加_ |

## 🚀 快速开始

### Web 版（GitHub Pages）

直接访问：**[https://sukikeeling.github.io/Sonnet/](https://sukikeeling.github.io/Sonnet/)**

### Android APK

从 [Releases](https://github.com/sukikeeling/Sonnet/releases) 页面下载最新 APK，或使用 GitHub Actions 自动构建。

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/sukikeeling/Sonnet.git
cd Sonnet

# 安装依赖
npm install

# 启动本地开发（需要任意 HTTP 服务器）
npx serve .
```

### 构建 Android APK

```bash
# 安装依赖
npm install

# 同步 Capacitor
npx cap sync android

# 构建 Release APK
cd android
./gradlew assembleRelease
```

APK 生成在 `android/app/build/outputs/apk/release/app-release.apk`

## 📱 使用指南

### 配置 API

1. 点击右上角 ⚙ 进入设置
2. 输入 API Key
3. 选择服务商（DeepSeek / 自定义中转站）
4. 选择模型
5. 保存设置

### 切换主题

- 侧边栏底部主题选择器：10 种配色可选
- 侧边栏底部 🌙 按钮：切换深色/浅色模式

### 对话管理

- 侧边栏列出所有对话
- 搜索框可快速筛选
- 鼠标悬停对话可删除
- 导出按钮可下载 Markdown

## 🏗️ 项目结构

```
Sonnet/
├── index.html          # 主页面（GitHub Pages 入口）
├── css/style.css       # 样式表
├── js/app.js           # 主应用逻辑
├── www/                # Capacitor 构建目录
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── capacitor.config.json
├── package.json
├── .github/
│   └── workflows/
│       └── build-apk.yml  # GitHub Actions 自动构建 APK
└── README.md
```

## ⚙️ 技术栈

| 技术 | 用途 |
|------|------|
| HTML/CSS/JS | 纯静态前端，无框架依赖 |
| [marked.js](https://marked.js.org/) | Markdown 渲染 |
| [highlight.js](https://highlightjs.org/) | 代码语法高亮 |
| [DOMPurify](https://github.com/cure53/DOMPurify) | XSS 防护 |
| [Capacitor](https://capacitorjs.com/) | 跨平台打包（Android APK） |
| GitHub Actions | CI/CD 自动构建 |
| GitHub Pages | Web 版本托管 |

## 📜 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v27 | 2026-08-08 | 流式修复 + 导出优化 + 水印稳定性 |
| v24 | 2026-08-08 | 修复导出无文件 + 侧边栏遮罩 |
| v23 | 2026-08-08 | 侧边栏遮罩 + 水印减四行 |
| v22 | 2026-08-08 | 水印深浅模式区分透明度 |
| v13 | 2026-08-07 | 最终版：按钮设计系统 + 洒金动画 |
| v5 | 2026-08-07 | 重构基座：marked.js + highlight.js + DOMPurify |
| v1 | 2026-08-07 | 初始版本 |

## 🤝 贡献者

- [sukikeeling](https://github.com/sukikeeling) — 项目创建者
- [Claude](https://anthropic.com/claude) — 项目启发者
- [DeepSeek](https://deepseek.com) — 智力支持（大脑）
- [Reasonix](https://reasonix.ai) — 编码执行（身体）
- 感谢 **小米** 百亿 Token 支持
- 感谢 **阿里百炼** 学生 300 元优惠券

## 📄 开源协议

MIT — 详见 [LICENSE](LICENSE)