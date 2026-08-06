# Sonnet · 十四行诗

> 一个温柔体贴的 AI 陪伴助手

基于 Web 技术构建的 AI 聊天应用，支持多模型、多主题、多对话管理。

## 特性

- ✨ 流式 SSE 响应，AI 回复实时逐字输出
- 🎨 10 种可切换主题（玫瑰金 + 星云紫蓝/紫外光/VERCEL + 6 款国风传统色）
- 🌙 深色/浅色模式一键切换
- 💬 多对话管理（创建/切换/搜索/删除/导出）
- 📝 Markdown 渲染 + 代码语法高亮
- 🎯 缓存优化（prefix-preservation 策略，最大化 KV-cache 命中率）
- 🌠 开屏流星雨 + 点击星星绽放
- 📱 刘海屏适配
- 🔄 重新生成、编辑、复制消息

## 构建

`ash
# 安装依赖
npm install

# 同步 Capacitor
npx cap sync android

# 构建 APK
cd android
./gradlew assembleRelease
`

## 贡献者

- [sukikeeling](https://github.com/sukikeeling) — 项目创建者
- Reasonix AI — 缓存优化、多主题系统、UI 美化、流星雨、性能优化

## 开源协议

MIT
