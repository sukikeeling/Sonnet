/* ========================================
   十四行诗 — Main App JS v12
   缓存优化 + 界面美化
   ======================================== */

(function () {
  'use strict';

  if (typeof marked === 'undefined' || typeof hljs === 'undefined' || typeof DOMPurify === 'undefined') {
    console.warn('部分 CDN 库未加载，将降级为纯文本模式');
  }

  if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
    // 禁用 strikethrough（~~text~~），防止 AI 回答中的波浪线被渲染为删除线
    marked.use({ renderer: { del: ({ text }) => '~~' + text + '~~' } });

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
      breaks: true,
    });
  }

  const PROVIDERS = {
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', models: ['deepseek-v4-flash'] },
    custom:   { name: '自定义/中转站', url: '', models: [] },
  };

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

  // 存储限制
  const MAX_MESSAGES_PER_CONV = 50;
  const MAX_CONVERSATIONS = 20;
  let saveTimer = null;

  const DEFAULT_SETTINGS = {
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
    temperature: 0.8,
    maxTokens: 4096,
    systemPrompt: '',
  };

  const STORAGE_KEY_CONVERSATIONS = 'sonnet-keeling-conversations-v11';
  const STORAGE_KEY_SETTINGS = 'sonnet-keeling-settings-v11';
  const STORAGE_KEY_THEME = 'sonnet-keeling-theme-v11';
  const STORAGE_KEY_COLOR_STYLE = 'sonnet-keeling-color-v12';

  const $introScreen    = document.getElementById('intro-screen');
  const $appLayout      = document.getElementById('app-layout');
  const $chatScreen     = document.getElementById('chat-screen');
  const $settingsScreen = document.getElementById('settings-screen');
  const $introNav       = document.getElementById('intro-nav');
  const $introBack      = document.getElementById('intro-back');
  const $introSkip      = document.getElementById('intro-skip');
  const $introNext      = document.getElementById('intro-next');
  const $introSlides    = document.getElementById('intro-slides');
  const $chatMessages   = document.getElementById('chat-messages');
  const $chatInput      = document.getElementById('chat-input');
  const $btnSend        = document.getElementById('btn-send');
  const $btnSettings    = document.getElementById('btn-settings');
  const $settingsBack   = document.getElementById('settings-back');
  const $sApiKey        = document.getElementById('s-api-key');
  const $sApiUrl        = document.getElementById('s-api-url');
  const $sModel         = document.getElementById('s-model');
  const $sProvider      = document.getElementById('s-provider');
  const $sTemperature   = document.getElementById('s-temperature');
  const $tempVal        = document.getElementById('temp-val');
  const $sMaxTokens     = document.getElementById('s-max-tokens');
  const $sSystemPrompt  = document.getElementById('s-system-prompt');
  const $sSave          = document.getElementById('s-save');
  const $toast          = document.getElementById('toast');
  const $sidebar        = document.getElementById('sidebar');
  const $sidebarToggle  = document.getElementById('sidebar-toggle');
  const $sidebarOpen    = document.getElementById('sidebar-open');
  const $sidebarNewChat = document.getElementById('sidebar-new-chat');
  const $sidebarConvList = document.getElementById('sidebar-conv-list');
  const $sidebarSearch  = document.getElementById('sidebar-search-input');
  const $sidebarExport  = document.getElementById('sidebar-export');
  const $sidebarTheme   = document.getElementById('sidebar-theme');
  const $themeSelector  = document.getElementById('theme-selector');
  const $themeCurrent  = document.getElementById('theme-current');
  const $themePanel    = document.getElementById('theme-panel');
  const $themeOptions  = $themePanel ? $themePanel.querySelectorAll('.theme-option') : [];
  const $themeIcon     = $themeCurrent ? $themeCurrent.querySelector('.theme-current-icon') : null;
  const $themeLabel    = $themeCurrent ? $themeCurrent.querySelector('.theme-current-label') : null;
  const $topbarTitle    = document.getElementById('topbar-title');
  const $streamStatus   = document.getElementById('stream-status');
  const $streamStop     = document.getElementById('stream-stop');
  const $tokenCount     = document.getElementById('token-count');
  const $charCount      = document.getElementById('char-count');
  const $scrollBtn      = document.getElementById('scroll-bottom-btn');
  const $btnClearChat   = document.getElementById('btn-clear-chat');

  let introStep = 0;
  let introDone = false;
  let loading = false;
  let streamAbort = null;
  let settings = { ...DEFAULT_SETTINGS };
  let conversations = [];
  let currentConvId = null;
  let theme = 'light';
  let colorStyle = 'rose';

  function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function getCurrentConv() { return conversations.find(c => c.id === currentConvId) || null; }

  function createConversation(title) {
    const conv = { id: generateId(), title: title || '新对话', messages: [], createdAt: new Date().toISOString() };
    conversations.unshift(conv); currentConvId = conv.id; saveConversations(); return conv;
  }

  function switchConversation(id) {
    if (id === currentConvId) return;
    currentConvId = id; renderConversation(); renderSidebar();
  }

  function deleteConversation(id) {
    const idx = conversations.findIndex(c => c.id === id);
    if (idx === -1) return;
    conversations.splice(idx, 1);
    if (currentConvId === id) currentConvId = conversations.length > 0 ? conversations[0].id : null;
    saveConversations(); renderConversation(); renderSidebar();
  }

  function getConversationTitle(messages) {
    if (messages.length === 0) return '新对话';
    const first = messages.find(m => m.role === 'user');
    if (!first) return '新对话';
    const text = first.content.slice(0, 30);
    return text + (first.content.length > 30 ? '...' : '');
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) { const saved = JSON.parse(raw); settings = { ...DEFAULT_SETTINGS, ...saved }; }
    } catch { settings = { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings() { try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings)); } catch {} }

  function loadConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
      if (raw) { conversations = JSON.parse(raw); if (conversations.length > 0) currentConvId = conversations[0].id; }
    } catch {}
    if (!conversations || conversations.length === 0) createConversation('新对话');
  }
  function saveConversations() {
    try {
      pruneConversations();
      // 防抖：2秒内多次调用只保存一次
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations));
        saveTimer = null;
      }, 2000);
    } catch {}
  }

  // 裁剪对话：限制消息数和对话数
  function pruneConversations() {
    conversations.forEach(c => {
      if (c.messages.length > MAX_MESSAGES_PER_CONV) {
        c.messages = c.messages.slice(-MAX_MESSAGES_PER_CONV);
      }
    });
    if (conversations.length > MAX_CONVERSATIONS) {
      conversations = conversations.slice(0, MAX_CONVERSATIONS);
    }
  }

  function loadTheme() {
    try { const saved = localStorage.getItem(STORAGE_KEY_THEME); if (saved === 'dark' || saved === 'light') theme = saved; } catch {}
    try { const saved = localStorage.getItem(STORAGE_KEY_COLOR_STYLE); if (saved) colorStyle = saved; } catch {}
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-color-style', colorStyle);
    updateThemeUI();
  }
  function saveTheme() { try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch {} try { localStorage.setItem(STORAGE_KEY_COLOR_STYLE, colorStyle); } catch {} }

  function switchToChat() { $introScreen.classList.add('hidden'); $appLayout.classList.add('visible'); }
  // 页面关闭前保存主题
  window.addEventListener('beforeunload', function() { saveTheme(); });
  function switchToSettings() { populateSettings(); $settingsScreen.classList.add('active'); }
  function switchFromSettings() { $settingsScreen.classList.remove('active'); }

  const totalSlides = 4;

  function setIntroStep(step, direction) {
    const slides = $introSlides.querySelectorAll('.intro-slide');
    const dots = document.querySelectorAll('.intro-dot');
    const prevStep = introStep; introStep = step;
    slides.forEach((s, i) => {
      s.classList.remove('active', 'exit-left', 'exit-right');
      if (i === step) s.classList.add('active');
      else if (i === prevStep) s.classList.add(direction === 'forward' ? 'exit-left' : 'exit-right');
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === step));
    $introNav.classList.toggle('visible', step > 0);
    const isLast = step === totalSlides - 1;
    $introNext.classList.toggle('expanded', isLast);
    $introNext.querySelector('.btn-text').textContent = isLast ? '开始体验' : '';
  }

  function introForward() { if (introStep < totalSlides - 1) setIntroStep(introStep + 1, 'forward'); else completeIntro(); }
  function introBack() { if (introStep > 0) setIntroStep(introStep - 1, 'back'); }
  function completeIntro() { introDone = true; switchToChat(); }

  function renderConversation() {
    const conv = getCurrentConv();
    const children = Array.from($chatMessages.children);
    children.forEach(c => { if (!c.classList.contains('welcome-msg') && !c.hasAttribute('data-keep')) c.remove(); });
    const welcome = $chatMessages.querySelector('.welcome-msg');
    if (!conv || conv.messages.length === 0) {
      if (welcome) welcome.style.display = '';
      if ($topbarTitle) $topbarTitle.textContent = '十四行诗';
      const heroTitle = $chatMessages.querySelector('.hero-title');
      if (heroTitle) heroTitle.textContent = '✦ Sonnet ✦';
      return;
    }
    if (welcome) welcome.style.display = 'none';
    if ($topbarTitle) $topbarTitle.textContent = conv.title || '十四行诗';
    const heroTitle = $chatMessages.querySelector('.hero-title');
    if (heroTitle) heroTitle.textContent = '✦ ' + conv.title + ' ✦';
    conv.messages.forEach(msg => appendMessage(msg.role, msg.content, false, msg.time, msg.model));
    scrollToBottom();
  }

  function renderSidebar() {
    const query = ($sidebarSearch ? $sidebarSearch.value : '').toLowerCase();
    let list = conversations;
    if (query) list = conversations.filter(c => c.title.toLowerCase().includes(query));
    $sidebarConvList.innerHTML = list.map(c => {
      const active = c.id === currentConvId ? 'active' : '';
      const date = new Date(c.createdAt);
      const dateStr = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      return `<div class="sidebar-conv-item ${active}" data-id="${c.id}">
        <span class="conv-title">${escapeHtml(c.title)}</span>
        <span class="conv-date">${dateStr}</span>
        <button class="conv-del" data-id="${c.id}">✕</button></div>`;
    }).join('');
    $sidebarConvList.querySelectorAll('.sidebar-conv-item').forEach(el => {
      el.addEventListener('click', (e) => { if (e.target.classList.contains('conv-del')) return; switchConversation(el.dataset.id); });
    });
    $sidebarConvList.querySelectorAll('.conv-del').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); pendingDeleteId = btn.dataset.id; openConfirmModal(); });
    });
  }

  function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

  // 🎨 情绪颜色渲染 — 扫描 AI 文字，给关键词加颜色
  const EMOTION_RULES = [
    // 生气/强烈/重点 → 红色
    { re: /(生气|愤怒|可恶|不行|必须|绝对|滚|烦|讨厌|恶心|受不了|气死|忍不了|太离谱|疯了|搞什么)/gi, cls: 'emotion-red' },
    // 暧昧/可爱/撒娇 → 粉色（含颜文字、波浪号、爱心）
    { re: /(宝宝|宝贝|亲爱|想你了|喜欢你|爱你|么么|抱抱|亲亲|好想你|小可爱|小笨蛋|傻瓜|坏蛋|讨厌啦|人家|萌萌|ฅ|•|◡|≧|∇|≦|ω|♡|❤|💕|💗|💖|~{2,})/gi, cls: 'emotion-pink' },
    // 忧伤/孤独/低落 → 蓝色
    { re: /(难过|伤心|寂寞|孤独|失落|悲伤|泪|哭|心痛|心碎|抑郁|绝望|想哭|好累|好难|受不了|空虚)/gi, cls: 'emotion-blue' },
    // 开心/鼓励/积极 → 绿色
    { re: /(开心|高兴|棒|加油|太好了|厉害|优秀|完美|牛逼|赞|好棒|很棒|很不错|了不起|恭喜|快乐|幸福|超棒|喜欢|满意)/gi, cls: 'emotion-green' },
    // 惊讶/好奇/疑问 → 紫色
    { re: /(真的吗|哇|天哪|不会吧|不可能|难以置信|好奇|好神奇|奇怪|什么|为什么|怎么办|真的假的|惊讶|震惊|吓到)/gi, cls: 'emotion-purple' },
  ];

  function applyEmotionColors(html) {
    // 只在 bot 消息的文本内容上应用，跳过代码块和已上色的元素
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const walker = document.createTreeWalker(temp, 4 /* NodeFilter.SHOW_TEXT */, {
      acceptNode: (node) => {
        // 跳过代码块内的文本
        let p = node.parentElement;
        while (p) {
          if (p.tagName === 'PRE' || p.tagName === 'CODE' || p.classList.contains('emotion-red') ||
              p.classList.contains('emotion-pink') || p.classList.contains('emotion-blue') ||
              p.classList.contains('emotion-green') || p.classList.contains('emotion-purple') ||
              p.classList.contains('model-badge')) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);
    const changes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      let text = node.textContent;
      let newHtml = text;
      for (const rule of EMOTION_RULES) {
        newHtml = newHtml.replace(rule.re, (match) => `<span class="${rule.cls}">${match}</span>`);
      }
      if (newHtml !== text) {
        changes.push({ node, html: newHtml });
      }
    }
    // 从后往前替换，避免 DOM 失效
    for (let i = changes.length - 1; i >= 0; i--) {
      const span = document.createElement('span');
      span.innerHTML = changes[i].html;
      changes[i].node.parentNode.replaceChild(span, changes[i].node);
    }
    return temp.innerHTML;
  }

  function appendMessage(role, content, animate, time, modelName) {
    const row = document.createElement('div');
    row.className = 'msg-row ' + role;
    if (animate) row.style.animation = 'msgIn 0.35s both';

    if (role === 'assistant') {
      row.innerHTML = '<div class="bot-avatar">✦</div><div class="bot-msg"></div>';
      const msgEl = row.querySelector('.bot-msg');
      if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        const html = marked.parse(content || '');
        msgEl.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
        if (typeof applyEmotionColors === 'function') msgEl.innerHTML = applyEmotionColors(msgEl.innerHTML);
        msgEl.querySelectorAll('pre code').forEach(block => { if (typeof hljs !== 'undefined') hljs.highlightElement(block); });
      } else { msgEl.textContent = content || ''; }
      const badge = document.createElement('div');
      badge.className = 'model-badge';
      badge.textContent = modelName || settings.model || 'AI';
      msgEl.appendChild(badge);
    } else {
      row.innerHTML = '<div class="msg-bubble user-msg"></div>';
      row.querySelector('.user-msg').textContent = content;
    }

    const timeStr = time || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const timeEl = document.createElement('div');
    timeEl.className = 'msg-time';
    timeEl.textContent = timeStr;
    row.appendChild(timeEl);

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    if (role === 'assistant') {
      actions.innerHTML = '<button class="msg-copy" title="复制">📋</button><button class="msg-regenerate" title="重新生成">🔄</button>';
    } else {
      actions.innerHTML = '<button class="msg-copy" title="复制">📋</button><button class="msg-edit" title="编辑">✏️</button><button class="msg-del" title="删除">🗑️</button>';
    }
    row.appendChild(actions);

    actions.querySelector('.msg-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(content).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
    });
    actions.querySelector('.msg-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const conv = getCurrentConv(); if (!conv) return;
      const idx = conv.messages.findIndex(m => m.role === role && m.content === content);
      if (idx === -1) return;
      const newContent = prompt('编辑消息：', content);
      if (newContent !== null && newContent.trim()) { conv.messages[idx].content = newContent.trim(); saveConversations(); renderConversation(); }
    });
    actions.querySelector('.msg-del')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      if (btn.dataset.confirm !== 'true') {
        btn.dataset.confirm = 'true';
        btn.textContent = '✓ 确认？';
        btn.classList.add('del-confirm');
        setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = '🗑️'; btn.classList.remove('del-confirm'); }, 3000);
        return;
      }
      const conv = getCurrentConv(); if (!conv) return;
      const idx = conv.messages.findIndex(m => m.role === role && m.content === content);
      if (idx === -1) return;
      conv.messages.splice(idx, 1); saveConversations(); renderConversation();
    });
    actions.querySelector('.msg-regenerate')?.addEventListener('click', (e) => {
      e.stopPropagation();
      regenerateLastMessage();
    });

    $chatMessages.appendChild(row);
    if (animate) scrollToBottom();
    updateCharCount();
  }

  function regenerateLastMessage() {
    const conv = getCurrentConv();
    if (!conv || conv.messages.length < 2) return;
    const last = conv.messages[conv.messages.length - 1];
    if (last.role !== 'assistant') return;
    conv.messages.pop();
    saveConversations(); renderConversation();
    const lastUser = conv.messages[conv.messages.length - 1];
    if (lastUser && lastUser.role === 'user') {
      $chatInput.value = lastUser.content;
      autoResize(); updateSendBtn();
      sendMessage();
    }
  }

  function appendLoading() {
    const row = document.createElement('div');
    row.className = 'msg-row assistant loading-msg';
    row.innerHTML = '<div class="bot-avatar">✦</div><div class="typing-indicator"><span></span><span></span><span></span></div>';
    $chatMessages.appendChild(row); scrollToBottom(); return row;
  }
  function removeLoading() { const el = $chatMessages.querySelector('.loading-msg'); if (el) el.remove(); }
  function scrollToBottom() { requestAnimationFrame(() => { $chatMessages.scrollTo({ top: $chatMessages.scrollHeight, behavior: "smooth" }); }); }

  // ==========================================
  //  CACHE-AWARE MESSAGE BUILDER
  //  借鉴 Reasonix prefix-preservation 策略：
  //  - 保持 system prompt 和早期对话不变（KV-cache 前缀）
  //  - 时间上下文注入到最后一条用户消息（不影响缓存前缀）
  //  - 超长对话压缩中间轮次，保留头尾
  // ==========================================
  function buildCacheAwareMessages(sysPrompt, allMessages) {
    var MAX_PREFIX_PAIRS = 4;   // 保留前 N 轮作为缓存前缀
    var MAX_SUFFIX_PAIRS = 4;   // 保留后 N 轮作为近期上下文
    var COMPACT_THRESHOLD = 20; // 超过此消息数触发压缩

    // 1. 始终以 system prompt 开头（稳定缓存前缀）
    var result = [{ role: 'system', content: sysPrompt }];

    // 2. 提取 role+content，移除 time/model 等展示字段
    var history = allMessages.map(function(m) { return { role: m.role, content: m.content }; });
    if (history.length === 0) return result;

    // 3. 超长对话压缩中间轮次，保留缓存前缀
    if (history.length > COMPACT_THRESHOLD) {
      var prefixCount = MAX_PREFIX_PAIRS * 2;
      var suffixCount = MAX_SUFFIX_PAIRS * 2;
      var prefix = history.slice(0, prefixCount);
      var suffix = history.slice(-suffixCount);
      var middle = history.slice(prefixCount, -suffixCount);
      var middlePairs = Math.ceil(middle.length / 2);

      result.push.apply(result, prefix);
      result.push({ role: 'system', content: '📌 前情提要：中间 ' + middlePairs + ' 轮对话已压缩' });
      result.push.apply(result, suffix);
    } else {
      result.push.apply(result, history);
    }

    return result;
  }

  //  STREAMING
  // ==========================================
  async function sendMessage() {
    const text = $chatInput.value.trim();
    if (!text || loading) return;

    let conv = getCurrentConv();
    if (!conv) conv = createConversation(getConversationTitle([{ role: 'user', content: text }]));
    else if (conv.messages.length === 0) conv.title = getConversationTitle([{ role: 'user', content: text }]);

    if (!settings.apiKey) { showToast('请先去设置里填写 API Key'); return; }

    let apiUrl = settings.apiUrl.replace(/\/+$/, '');
    if (!apiUrl) { showToast('请先在设置里配置 API 地址'); return; }

    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    conv.messages.push({ role: 'user', content: text, time: now });
    appendMessage('user', text, true, now);

    $chatInput.value = ''; autoResize(); updateSendBtn();
    saveConversations(); renderSidebar();

    loading = true;
    const loadEl = appendLoading();

    const streamRow = document.createElement('div');
    streamRow.className = 'msg-row assistant';
    streamRow.innerHTML = '<div class="bot-avatar">✦</div><div class="bot-msg stream-msg"></div>';
    const streamMsgEl = streamRow.querySelector('.bot-msg');

    $streamStatus.classList.remove('hidden');
    streamAbort = new AbortController();

    const fullUrl = apiUrl.endsWith('/chat/completions') ? apiUrl : apiUrl + '/chat/completions';

    try {
      const sysPrompt = (settings.systemPrompt && settings.systemPrompt.trim()) ? settings.systemPrompt.trim() : DEFAULT_SYSTEM_PROMPT;

      const nowDate = new Date();

      const body = {
        model: settings.model, max_tokens: settings.maxTokens, temperature: settings.temperature, stream: true,
        messages: buildCacheAwareMessages(sysPrompt, conv.messages),
      };
      const res = await fetch(fullUrl, {
        signal: AbortSignal.timeout(30000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
        body: JSON.stringify(body),
        signal: streamAbort.signal,
      });

      if (!res.ok) {
        let errMsg = 'HTTP ' + res.status;
        try { const errData = await res.json(); errMsg = errData.error?.message || errMsg; } catch {}
        throw new Error(errMsg);
      }

      removeLoading();
      $chatMessages.appendChild(streamRow);
      scrollToBottom();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
                const html = marked.parse(fullContent);
                streamMsgEl.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
                if (typeof applyEmotionColors === 'function') streamMsgEl.innerHTML = applyEmotionColors(streamMsgEl.innerHTML);
                streamMsgEl.querySelectorAll('pre code').forEach(block => { if (typeof hljs !== 'undefined') hljs.highlightElement(block); });
              } else { streamMsgEl.textContent = fullContent; }
              scrollToBottom();
            }
          } catch (e) {}
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data !== '[DONE]') {
            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
                  const html = marked.parse(fullContent);
                  streamMsgEl.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
                  if (typeof applyEmotionColors === 'function') streamMsgEl.innerHTML = applyEmotionColors(streamMsgEl.innerHTML);
                  streamMsgEl.querySelectorAll('pre code').forEach(block => { if (typeof hljs !== 'undefined') hljs.highlightElement(block); });
                } else { streamMsgEl.textContent = fullContent; }
              }
            } catch (e) {}
          }
        }
      }

      const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      conv.messages.push({ role: 'assistant', content: fullContent, time: replyTime, model: settings.model });
      if (conv.messages.length <= 2) conv.title = getConversationTitle(conv.messages);
      saveConversations(); renderSidebar(); updateTokenCount();

    } catch (err) {
      removeLoading();
      if (streamRow.parentNode) streamRow.remove();

      conv.messages.pop();
      saveConversations();
      renderConversation();

      if (err.name === 'AbortError') {
        if (streamMsgEl.textContent.trim()) {
          fullContent = streamMsgEl.textContent;
          const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          conv.messages.push({ role: 'assistant', content: fullContent, time: replyTime, model: settings.model });
          saveConversations(); renderSidebar();
          $chatMessages.appendChild(streamRow);
          showToast('已停止 ✦'); return;
        }
        showToast('已停止');
      } else if (err.message.includes('Failed to fetch')) {
        showToast('网络连接失败，请检查 API 地址和网络');
      } else {
        showToast('请求失败：' + err.message);
      }
    } finally {
      loading = false; streamAbort = null;
      $streamStatus.classList.add('hidden');
      updateSendBtn();
    }
  }

  function stopStreaming() { if (streamAbort) streamAbort.abort(); }

  // 安全网：切后台回来/页面恢复时如果 loading 卡死，自动重置
  function resetLoading() {
    if (loading) {
      loading = false;
      streamAbort = null;
      $streamStatus.classList.add('hidden');
      updateSendBtn();
      removeLoading();
    }
  }
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') resetLoading();
  });
  window.addEventListener('pageshow', resetLoading);

  function updateTokenCount() {
    const conv = getCurrentConv();
    if (!conv) { $tokenCount.textContent = '0'; return; }
    const totalChars = conv.messages.reduce((sum, m) => sum + m.content.length, 0);
    $tokenCount.textContent = Math.round(totalChars / 4);
  }

  function updateCharCount() { if ($charCount) $charCount.textContent = $chatInput.value.length; }

  function autoResize() {
    const ta = $chatInput;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  function updateSendBtn() {
    const hasText = $chatInput.value.trim().length > 0;
    $btnSend.disabled = !hasText || loading;
    $btnSend.classList.toggle('ready', hasText && !loading);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function applyPreset(providerKey, model, url) { $sProvider.value = providerKey; $sModel.value = model; $sApiUrl.value = url; }
  function onProviderChange() { const key = $sProvider.value; const p = PROVIDERS[key]; if (p && key !== 'custom') $sApiUrl.value = p.url; }

  function populateSettings() {
    $sApiKey.value = settings.apiKey || '';
    $sProvider.value = settings.provider || 'deepseek';
    $sApiUrl.value = settings.apiUrl || DEFAULT_SETTINGS.apiUrl;
    $sModel.value = settings.model || DEFAULT_SETTINGS.model;
    $sTemperature.value = settings.temperature;
    $tempVal.textContent = settings.temperature;
    $sMaxTokens.value = settings.maxTokens;
    $sSystemPrompt.value = (settings.systemPrompt && settings.systemPrompt.trim()) ? settings.systemPrompt : DEFAULT_SYSTEM_PROMPT;
  }

  function collectSettings() {
    settings.apiKey = $sApiKey.value.trim();
    settings.provider = $sProvider.value;
    settings.apiUrl = $sApiUrl.value.trim().replace(/\/+$/, '');
    settings.model = $sModel.value.trim();
    settings.temperature = parseFloat($sTemperature.value);
    settings.maxTokens = parseInt($sMaxTokens.value, 10) || 4096;
    settings.systemPrompt = $sSystemPrompt.value.trim() || '';
    saveSettings(); showToast('设置已保存 ✦');
  }

  function exportConversation() {
    const conv = getCurrentConv();
    if (!conv || conv.messages.length === 0) { showToast('没有可导出的对话'); return; }
    let md = '# ' + conv.title + '\n\n';
    conv.messages.forEach(m => {
      if (m.role === 'user') md += '**你**\n' + m.content + '\n\n';
      else md += '**十四行诗**\n' + m.content + '\n\n';
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = conv.title + '.md'; a.click();
    URL.revokeObjectURL(url); showToast('已导出为 Markdown ✦');
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(); updateThemeUI();
    showToast(theme === 'dark' ? '已切换为暗色模式 🌙' : '已切换为浅色模式 ☀️');
  }

  function updateThemeUI() {
    if ($sidebarTheme) $sidebarTheme.textContent = theme === 'dark' ? '☀️ 浅色' : '🌙 暗色';
    // 更新嵌入式主题选择器
    if ($themeOptions && $themeOptions.length > 0) {
      const selected = Array.from($themeOptions).find(o => o.dataset.color === colorStyle);
      if (selected) {
        $themeOptions.forEach(o => o.classList.remove('active'));
        selected.classList.add('active');
        if ($themeIcon) $themeIcon.textContent = selected.textContent.trim().charAt(0);
        if ($themeLabel) $themeLabel.textContent = selected.textContent.trim().substring(2);
      }
    }
  }

  let toastTimer = null;
  function showToast(msg) {
    clearTimeout(toastTimer);
    $toast.textContent = msg; $toast.classList.remove('hidden');
    requestAnimationFrame(() => $toast.classList.add('show'));
    toastTimer = setTimeout(() => { $toast.classList.remove('show'); setTimeout(() => $toast.classList.add('hidden'), 400); }, 3000);
  }


  // ==========================================
  //  星星点击绽放
  // ==========================================
  function createStarBurst(x, y) {
    var stars = ['✦', '✧', '✦', '✧', '✦'];
    var colors = ['rgba(212,160,192,0.8)', 'rgba(232,180,192,0.7)', 'rgba(200,160,220,0.7)', 'rgba(180,140,200,0.6)'];
    
    // 中心大星星
    var main = document.createElement('div');
    main.className = 'star-burst';
    main.textContent = '✦';
    main.style.left = (x - 20) + 'px';
    main.style.top = (y - 20) + 'px';
    main.style.fontSize = '40px';
    main.style.color = colors[Math.floor(Math.random() * colors.length)];
    document.body.appendChild(main);
    setTimeout(function() { main.remove(); }, 800);
    
    // 散射小星星粒子
    for (var i = 0; i < 12; i++) {
      (function(idx) {
        var p = document.createElement('div');
        p.className = 'star-particle';
        p.textContent = stars[idx % stars.length];
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.color = colors[Math.floor(Math.random() * colors.length)];
        var angle = (idx / 12) * Math.PI * 2;
        var dist = 40 + Math.random() * 60;
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;
        p.style.animation = 'particleFly 1s cubic-bezier(0.2,0,0.6,1) forwards';
        p.style.setProperty('--dx', dx + 'px');
        p.style.setProperty('--dy', dy + 'px');
        p.style.transform = 'translate(0,0)';
        p.style.animation = 'none';
        document.body.appendChild(p);
        
        // Force animation with JS
        var tx = dx, ty = dy;
        var start = performance.now();
        function animate(now) {
          var t = Math.min((now - start) / 1000, 1);
          var ease = 1 - Math.pow(1 - t, 3);
          var cx = tx * ease;
          var cy = ty * ease - 40 * ease * ease;
          var opacity = 1 - ease;
          p.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
          p.style.opacity = opacity;
          if (t < 1) requestAnimationFrame(animate);
          else p.remove();
        }
        setTimeout(function() { requestAnimationFrame(animate); }, Math.random() * 50);
      })(i);
    }
  }

  function init() {
    try { loadSettings(); } catch(e) { console.warn('loadSettings failed:', e); }
    try { loadConversations(); } catch(e) { console.warn('loadConversations failed:', e); }
    try { loadTheme(); } catch(e) { console.warn('loadTheme failed:', e); }
    renderConversation(); renderSidebar(); updateTokenCount(); updateCharCount();
    // 默认收起侧边栏，开屏结束后直接显示主界面
    $sidebar.classList.add('collapsed');

    const watermarkEl = document.querySelector('.chat-watermark');
    if (watermarkEl) {
      const unit = 'ฅ( ̳• ◡ • ̳)ฅ keeling  ✦  ';
      const rowText = unit.repeat(20);
      for (let i = 0; i < 16; i++) {
        const row = document.createElement('div');
        row.className = 'watermark-row';
        row.textContent = rowText;
        watermarkEl.appendChild(row);
      }
    }

    $introNext.addEventListener('click', introForward);
    $introSlides.addEventListener('click', function(e) { createStarBurst(e.clientX, e.clientY); });
    $introBack.addEventListener('click', introBack);
    $introSkip.addEventListener('click', completeIntro);
    document.querySelectorAll('.intro-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const target = parseInt(dot.dataset.dot, 10);
        if (target !== introStep) setIntroStep(target, target > introStep ? 'forward' : 'back');
      });
    });

    $chatInput.addEventListener('input', () => { autoResize(); updateSendBtn(); updateCharCount(); });
    $chatInput.addEventListener('keydown', handleKeyDown);
    $btnSend.addEventListener('click', sendMessage);
    $btnClearChat.addEventListener('click', () => {
      const conv = getCurrentConv();
      if (conv) { conv.messages = []; saveConversations(); renderConversation(); updateTokenCount(); showToast('对话已清除 ✦'); }
    });

    $streamStop.addEventListener('click', stopStreaming);

    $btnSettings.addEventListener('click', () => { switchToSettings(); });
    $settingsBack.addEventListener('click', switchFromSettings);
    document.getElementById('settings-screen').addEventListener('click', function(e) { createStarBurst(e.clientX, e.clientY); });
    $sSave.addEventListener('click', collectSettings);
    $sTemperature.addEventListener('input', () => { $tempVal.textContent = $sTemperature.value; });
    $sProvider.addEventListener('change', onProviderChange);
    document.querySelectorAll('.quick-fill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyPreset(btn.dataset.provider, btn.dataset.model, btn.dataset.url);
        onProviderChange();
        showToast('已切换至 ' + btn.textContent.trim());
      });
    });

    $sidebarToggle.addEventListener('click', () => { $sidebar.classList.add('collapsed'); });
    $sidebarOpen.addEventListener('click', () => { $sidebar.classList.remove('collapsed'); });
    $sidebarNewChat.addEventListener('click', () => { createConversation('新对话'); renderConversation(); renderSidebar(); showToast('已创建新对话 ✦'); });
    $sidebarSearch.addEventListener('input', renderSidebar);
    $sidebarExport.addEventListener('click', exportConversation);
    $sidebarTheme.addEventListener('click', toggleTheme);
    // 嵌入式主题选择器事件
    if ($themeCurrent) {
      $themeCurrent.addEventListener('click', function(e) {
        e.stopPropagation();
        $themeSelector.classList.toggle('open');
        $themeCurrent.setAttribute('aria-expanded', $themeSelector.classList.contains('open'));
      });
    }
    if ($themeOptions && $themeOptions.length > 0) {
      $themeOptions.forEach(function(opt) {
        opt.addEventListener('click', function() {
          const newColor = this.dataset.color;
          if (newColor === colorStyle) { closeThemePanel(); return; }
          colorStyle = newColor;
          document.documentElement.setAttribute('data-color-style', colorStyle);
          saveTheme();
          updateThemeUI();
          showToast('已切换至 ' + this.textContent.trim());
          closeThemePanel();
        });
      });
    }
    // 点击外部关闭主题面板
    document.addEventListener('click', function(e) {
      if ($themeSelector && !$themeSelector.contains(e.target)) {
        closeThemePanel();
      }
    });
    function closeThemePanel() {
      if ($themeSelector) {
        $themeSelector.classList.remove('open');
        if ($themeCurrent) $themeCurrent.setAttribute('aria-expanded', 'false');
      }
    }

    $chatMessages.addEventListener('scroll', () => {
      const threshold = 200;
      const isNearBottom = $chatMessages.scrollHeight - $chatMessages.scrollTop - $chatMessages.clientHeight < threshold;
      $scrollBtn.classList.toggle('hidden', isNearBottom);
    });
    $scrollBtn.addEventListener('click', () => { scrollToBottom(); $scrollBtn.classList.add('hidden'); });
    $chatMessages.addEventListener('click', function(e) { if (e.target.closest('.star-click')) return; createStarBurst(e.clientX, e.clientY); });

    let touchStartX = 0;
    $introSlides.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    $introSlides.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0 && introStep < totalSlides - 1) introForward();
        else if (dx > 0 && introStep > 0) introBack();
      }
    }, { passive: true });

    // Android 返回键联动 — 导航栈管理（参考 ChatGPT-Next-Web 的 back handler 模式）
    const navStack = [];
    const NAV = { SETTINGS: 'settings', SIDEBAR: 'sidebar', INTRO: 'intro' };

    // 在各导航入口 push 状态
    const origSwitchToSettings = switchToSettings;
    switchToSettings = function() {
      navStack.push(NAV.SETTINGS);
      window.history.pushState({ screen: NAV.SETTINGS }, '');
      origSwitchToSettings.call(this);
    };
    const origSwitchFromSettings = switchFromSettings;
    switchFromSettings = function() {
      if (navStack.length > 0 && navStack[navStack.length - 1] === NAV.SETTINGS) navStack.pop();
      origSwitchFromSettings.call(this);
    };

    // 侧栏打开/关闭
    const origSidebarOpen = $sidebarOpen.click;
    $sidebarOpen.addEventListener('click', () => {
      navStack.push(NAV.SIDEBAR);
      window.history.pushState({ screen: NAV.SIDEBAR }, '');
    }, true);
    const origSidebarToggle = $sidebarToggle.click;
    $sidebarToggle.addEventListener('click', () => {
      if (navStack.length > 0 && navStack[navStack.length - 1] === NAV.SIDEBAR) navStack.pop();
    }, true);

    window.addEventListener('popstate', (e) => {
      handleBackButton();
    });
    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      handleBackButton();
    }, false);

    function handleBackButton() {
      if (navStack.length > 0) {
        const screen = navStack.pop();
        if (screen === NAV.SETTINGS) {
          switchFromSettings();
        } else if (screen === NAV.SIDEBAR) {
          $sidebar.classList.add('collapsed');
        } else if (screen === NAV.INTRO) {
          if (introStep > 0) introBack();
          else completeIntro();
        }
        // 让 history 状态同步
        if (window.history.state) window.history.back();
        return;
      }
      // 引导页处理（没有导航栈时）
      if (!$introScreen.classList.contains('hidden')) {
        if (introStep > 0) { introBack(); return; }
        else { completeIntro(); return; }
      }
      // 默认：退出应用
    }
  }
  // 安全网：页面加载后强制启用按钮
  setTimeout(function() {
    if (loading) {
      loading = false;
      streamAbort = null;
    }
    updateSendBtn();
    if (document.getElementById('btn-send') && document.getElementById('chat-input')) {
      document.getElementById('btn-send').disabled = false;
    }
  }, 1000);
  // 定期检查，防止 loading 卡死
  setInterval(function() {
    if (loading) {
      loading = false;
      streamAbort = null;
      removeLoading();
      updateSendBtn();
    }
  }, 5000);


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

// ✨ 动态生成开屏星星粒子
(function initStarParticles() {
  const container = document.querySelector('.intro-stars');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const span = document.createElement('span');
    const size = Math.random() * 2.5 + 1.5;
    span.style.cssText = `left: ${Math.random() * 100}%; top: ${Math.random() * 100}%; width: ${size}px; height: ${size}px; animation-delay: ${Math.random() * 5}s; animation-duration: ${3 + Math.random() * 4}s;`;
    container.appendChild(span);
  }
})();


// 流星雨生成（多颗同时）
(function initShootingStars() {
  var container = document.querySelector('.intro-stars');
  if (!container) return;
  function createShootingStar(isBig) {
    var star = document.createElement('div');
    star.className = 'shooting-star' + (isBig ? ' big' : '');
    star.style.left = (40 + Math.random() * 60) + '%';
    star.style.top = (Math.random() * 40) + '%';
    var dur = (0.8 + Math.random() * 1.2);
    star.style.setProperty('--dur', dur + 's');
    star.style.animationDelay = (Math.random() * 0.3) + 's';
    container.appendChild(star);
    setTimeout(function() { if (star.parentNode) star.remove(); }, (dur + 0.5) * 1000);
  }
  // 初始爆发：同时生成 5-8 颗
  var count = 5 + Math.floor(Math.random() * 4);
  for (var i = 0; i < count; i++) {
    setTimeout(function() { createShootingStar(Math.random() < 0.2); }, i * 100 + Math.random() * 200);
  }
  // 持续生成：每 0.5-1.5 秒一颗
  function scheduleNext() {
    setTimeout(function() {
      // 有时一次生成 2-3 颗
      var batch = 1 + Math.floor(Math.random() * 2);
      for (var i = 0; i < batch; i++) {
        setTimeout(function() { createShootingStar(Math.random() < 0.15); }, i * 80);
      }
      scheduleNext();
    }, 500 + Math.random() * 1000);
  }
  scheduleNext();
})();

// ✨ 星星彩蛋
    const starLeft = document.getElementById('star-left');
    const starRight = document.getElementById('star-right');
    if (starLeft) {
      starLeft.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.remove('sparkle');
        void this.offsetWidth;
        this.classList.add('sparkle');
        for (var i = 0; i < 12; i++) {
          setTimeout(function(idx) {
            var angle = (idx / 12) * Math.PI * 2;
            var dist = 40 + Math.random() * 60;
            createStarBurst(e.clientX + Math.cos(angle) * dist, e.clientY + Math.sin(angle) * dist);
          }, i * 40, i);
        }
        showToast('✧ 星雨绽放 ✧');
      });
    }
    if (starRight) {
      starRight.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.remove('sparkle');
        void this.offsetWidth;
        this.classList.add('sparkle');
        var msgs = ['💕 宝宝最好啦', '✨ 今天也要开心', '🌟 你是最棒的', '💫 加油哦', '🌈 每天都美好'];
        var msg = msgs[Math.floor(Math.random() * msgs.length)];
        showToast(msg);
        createStarBurst(e.clientX, e.clientY);
        setTimeout(function() { createStarBurst(e.clientX - 20, e.clientY - 20); }, 100);
        setTimeout(function() { createStarBurst(e.clientX + 20, e.clientY + 20); }, 200);
      });
    }
  // ==========================================
  //  删除确认灵动弹窗（十四行诗风格挽留）
  // ==========================================
  let pendingDeleteId = null;
  const $confirmOverlay = document.getElementById('confirm-overlay');
  const $confirmMsg = document.getElementById('confirm-msg');

  function openConfirmModal() {
    if (!$confirmOverlay) return;
    const msgs = [
      '这一页诗笺将化作流萤散入夜风……<br>你确定要亲手合上它吗？',
      '字里行间的温柔，删去便再无归处。<br>这一章，真的要作别吗？',
      '诗未写完，墨迹未干。<br>且再想一想，可好？',
    ];
    $confirmMsg.innerHTML = msgs[Math.floor(Math.random() * msgs.length)];
    $confirmOverlay.classList.add('show');
  }
  function closeConfirmModal() {
    if (!$confirmOverlay) return;
    $confirmOverlay.classList.remove('show');
    setTimeout(() => { $confirmOverlay.classList.remove('show'); pendingDeleteId = null; }, 300);

  }
  document.getElementById('confirm-cancel')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    if (pendingDeleteId) deleteConversation(pendingDeleteId);
    closeConfirmModal();
  });
  $confirmOverlay?.addEventListener('click', (e) => { if (e.target === $confirmOverlay) closeConfirmModal(); });

  // ==========================================
  //  自定义服务商下拉（灵动风格）
  // ==========================================
  const $providerCs = document.getElementById('provider-cs');
  const $providerLabel = $providerCs ? $providerCs.querySelector('.cs-label') : null;

  function syncProviderLabel() {
    if (!$providerCs) return;
    const key = $sProvider.value;
    const opt = $providerCs.querySelector(`.cs-option[data-value="${key}"]`);
    $providerLabel.textContent = opt ? opt.textContent.trim() : $sProvider.value;
    const $dot = $providerCs.querySelector('.cs-trigger .cs-dot');
    if ($dot) { $dot.className = opt ? opt.querySelector('.cs-dot').className : 'cs-dot cs-dot-deepseek'; }
    $providerCs.querySelectorAll('.cs-option').forEach(o => o.classList.toggle('active', o.dataset.value === key));
  }
  if ($providerCs) {
    $providerCs.querySelector('.cs-trigger').addEventListener('click', (e) => {
      e.stopPropagation();
      $providerCs.classList.toggle('open');
    });
    $providerCs.querySelectorAll('.cs-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        $sProvider.value = opt.dataset.value;
        $providerCs.classList.remove('open');
        onProviderChange();
        syncProviderLabel();
      });
    });
    document.addEventListener('click', () => $providerCs.classList.remove('open'));
  }
  // 初始化时同步一次（含从 localStorage 恢复的服务商）
  if ($providerCs) syncProviderLabel();
  // applyPreset 快捷按钮填充后也要同步
  const _origApplyPreset = applyPreset;
  applyPreset = function(providerKey, model, url) {
    _origApplyPreset(providerKey, model, url);
    if ($providerCs) { syncProviderLabel(); }
  };

})();














