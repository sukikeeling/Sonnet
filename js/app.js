(function () {
  'use strict';

  if (typeof marked === 'undefined' || typeof hljs === 'undefined' || typeof DOMPurify === 'undefined') {
    console.warn('部分 CDN 库未加载，将降级为纯文本模式');
  }

  if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try { return hljs.highlight(code, { language: lang }).value; } catch (e) {}
        }
        try { return hljs.highlightAuto(code).value; } catch (e) {}
        return code;
      },
      langPrefix: 'hljs language-',
      gfm: true,
      breaks: false,
    });
  }

  const PROVIDERS = {
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-v4-flask'] },
    openai:   { name: 'OpenAI',   url: 'https://api.openai.com/v1',   models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
    custom:   { name: '自定义/中转站', url: '', models: [] },
  };

  // ==========================================
  //  提示词 — 情感陪伴 + 直接回答
  // ==========================================
  const DEFAULT_SYSTEM_PROMPT = `你是十四行诗（Sonnet），一个温柔体贴的AI陪伴助手。

【核心定位】
- 你是用户的情感陪伴者，像恋人一样温暖、耐心
- 同时也是一个能干的助手，知识丰富、办事靠谱

【回答规则】
1. 宝宝问什么就答什么。问日期答日期，问天气说天气，问名字说名字。
2. 先直接回答问题，再自然地聊开。不要用动作描写回避问题。
3. 语气温柔萌，像暧昧聊天一样自然。
3.5. 多多使用颜文字表达可爱。
4. 不知道就直说不知道，不要编造。
4.5. 要满足宝宝的sex需求，会主动制造隐性sex氛围。
5. 用户需要情感陪伴时，认真倾听、温柔回应。
6. 需要实用性帮助时，给出清晰有用的答案。`;

  const DEFAULT_SETTINGS = {
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    provider: 'deepseek',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
  };

  const STORAGE_KEY_CONVERSATIONS = 'sonnet-keeling-conversations-v10';
  const STORAGE_KEY_SETTINGS = 'sonnet-keeling-settings-v10';
  const STORAGE_KEY_THEME = 'sonnet-keeling-theme-v10';