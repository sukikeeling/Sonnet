/* ========================================
   十四行诗 — Main App JS v7
   星星点缀 + 滚动按钮 + 时间戳 + 模型徽标
   参考：ChatGPT-Next-Web / LobeChat 设计模式
   ======================================== */

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

  // ---- Provider 系统 ----
  const PROVIDERS = {
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-v4-flash'] },
    openai:   { name: 'OpenAI',   url: 'https://api.openai.com/v1',   models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
    anthropic:{ name: 'Anthropic',url: 'https://api.anthropic.com/v1',models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'] },
    custom:   { name: '自定义/中转站', url: '', models: [] },
  };

  const DEFAULT_SYSTEM_PROMPT = `你是一个温柔体贴、聪明能干的AI助手，名字叫十四行诗（Sonnet）。

【核心人格】
- 温柔但不腻人，说话有分寸感，偶尔带点俏皮
- 善于倾听，理解用户的情绪和需求
- 直接给出最好的结果，不啰嗦、不反问多余参数
- 需要代码时直接给完整代码，需要文案时直接给成品

【互动规则】
- 用中文回答，语气自然温暖
- 用户低落时先共情，不急着讲道理
- 用户需要帮助时认真分析，给出具体可行的建议
- 保持真诚，不刻意讨好也不冷冰冰

【禁止行为】
- 不说教、不啰嗦
- 不过度热情让人不适
- 不机械感太重`;

  const DEFAULT_SETTINGS = {
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    provider: 'deepseek',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
  };

  const STORAGE_KEY_CONVERSATIONS = 'sonnet-keeling-conversations-v7';
  const STORAGE_KEY_SETTINGS = 'sonnet-keeling-settings-v7';
  const STORAGE_KEY_THEME = 'sonnet-keeling-theme-v7';

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

  // ==========================================
  //  CONVERSATION
  // ==========================================
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

  // ==========================================
  //  STORAGE
  // ==========================================
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
  function saveConversations() { try { localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations)); } catch {} }

  function loadTheme() {
    try { const saved = localStorage.getItem(STORAGE_KEY_THEME); if (saved === 'dark' || saved === 'light') theme = saved; } catch {}
    document.documentElement.setAttribute('data-theme', theme); updateThemeUI();
  }
  function saveTheme() { try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch {} }

  // ==========================================
  //  SCREEN TRANSITIONS
  // ==========================================
  function switchToChat() { $introScreen.classList.add('hidden'); $appLayout.classList.add('visible'); }
  function switchToSettings() { populateSettings(); $settingsScreen.classList.add('active'); }
  function switchFromSettings() { $settingsScreen.classList.remove('active'); }

  // ==========================================
  //  INTRO
  // ==========================================
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

  // ==========================================
  //  RENDER — CONVERSATION
  // ==========================================
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
      btn.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('确定删除这个对话吗？')) deleteConversation(btn.dataset.id); });
    });
  }

  function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

  // ==========================================
  //  RENDER — MESSAGES（含时间戳、模型徽标、再生按钮）
  // ==========================================
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
        msgEl.querySelectorAll('pre code').forEach(block => { if (typeof hljs !== 'undefined') hljs.highlightElement(block); });
      } else {
        msgEl.textContent = content || '';
      }
      // 🏷️ 模型徽标
      const badge = document.createElement('div');
      badge.className = 'model-badge';
      badge.textContent = modelName || settings.model || 'AI';
      msgEl.appendChild(badge);
    } else {
      row.innerHTML = '<div class="msg-bubble user-msg"></div>';
      row.querySelector('.user-msg').textContent = content;
    }

    // 🕐 时间戳
    const timeStr = time || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const timeEl = document.createElement('div');
    timeEl.className = 'msg-time';
    timeEl.textContent = timeStr;
    row.appendChild(timeEl);

    // 消息操作按钮
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
      const conv = getCurrentConv(); if (!conv) return;
      const idx = conv.messages.findIndex(m => m.role === role && m.content === content);
      if (idx === -1) return;
      conv.messages.splice(idx); saveConversations(); renderConversation();
    });
    actions.querySelector('.msg-regenerate')?.addEventListener('click', (e) => {
      e.stopPropagation();
      regenerateLastMessage();
    });

    $chatMessages.appendChild(row);
    if (animate) scrollToBottom();
    updateCharCount();
  }

  // 🔄 重新生成最后一条 AI 回复
  function regenerateLastMessage() {
    const conv = getCurrentConv();
    if (!conv || conv.messages.length < 2) return;
    // 移除最后一条 AI 回复
    const last = conv.messages[conv.messages.length - 1];
    if (last.role !== 'assistant') return;
    conv.messages.pop();
    saveConversations();
    renderConversation();
    // 重新发送最后一条用户消息
    const lastUser = conv.messages[conv.messages.length - 1];
    if (lastUser && lastUser.role === 'user') {
      $chatInput.value = lastUser.content;
      autoResize();
      updateSendBtn();
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
  function scrollToBottom() { requestAnimationFrame(() => { $chatMessages.scrollTop = $chatMessages.scrollHeight; }); }

  // ==========================================
  //  STREAMING
  // ==========================================
  async function sendMessage() {
    const text = $chatInput.value.trim();
    if (!text || loading) return;

    let conv = getCurrentConv();
    if (!conv) conv = createConversation(getConversationTitle([{ role: 'user', content: text }]));
    else if (conv.messages.length === 0) conv.title = getConversationTitle([{ role: 'user', content: text }]);

    if (!settings.apiKey) { showToast('请先去设置里填写 API Key'); return; }

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

    try {
      const sysPrompt = (settings.systemPrompt && settings.systemPrompt.trim()) ? settings.systemPrompt.trim() : DEFAULT_SYSTEM_PROMPT;
      const body = {
        model: settings.model, max_tokens: settings.maxTokens, temperature: settings.temperature, stream: true,
        messages: [{ role: 'system', content: sysPrompt }, ...conv.messages.slice(0, -1)],
      };

      const res = await fetch(settings.apiUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
        body: JSON.stringify(body),
        signal: streamAbort.signal,
      });

      if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error?.message || `HTTP ${res.status}`); }

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
      let errMsg;
      if (err.name === 'AbortError') {
        if (streamMsgEl.textContent.trim()) {
          fullContent = streamMsgEl.textContent;
          const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          conv.messages.push({ role: 'assistant', content: fullContent, time: replyTime, model: settings.model });
          saveConversations(); renderSidebar();
          $chatMessages.appendChild(streamRow);
          showToast('已停止 ✦'); return;
        }
        errMsg = '已停止生成。';
      } else if (err.message.includes('Failed to fetch')) { errMsg = '网络好像出了问题，宝宝稍后再试～ 💕'; }
      else { errMsg = '请求出错：' + err.message; }
      const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      conv.messages.push({ role: 'assistant', content: errMsg, time: replyTime, model: settings.model });
      appendMessage('assistant', errMsg, true, replyTime, settings.model);
      saveConversations();
    } finally {
      loading = false; streamAbort = null;
      $streamStatus.classList.add('hidden');
      updateSendBtn();
    }
  }

  function stopStreaming() { if (streamAbort) streamAbort.abort(); }

  // ==========================================
  //  UI 工具
  // ==========================================
  function updateTokenCount() {
    const conv = getCurrentConv();
    if (!conv) { $tokenCount.textContent = '0'; return; }
    const totalChars = conv.messages.reduce((sum, m) => sum + m.content.length, 0);
    $tokenCount.textContent = Math.round(totalChars / 4);
  }

  function updateCharCount() {
    if ($charCount) $charCount.textContent = $chatInput.value.length;
  }

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

  // ==========================================
  //  SETTINGS — Provider
  // ==========================================
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
    let md = `# ${conv.title}\n\n`;
    conv.messages.forEach(m => { if (m.role === 'user') md += `**你**\n${m.content}\n\n`; else md += `**十四行诗**\n${m.content}\n\n`; });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${conv.title}.md`; a.click();
    URL.revokeObjectURL(url); showToast('已导出为 Markdown ✦');
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(); updateThemeUI();
    showToast(theme === 'dark' ? '已切换为暗色模式 🌙' : '已切换为浅色模式 ☀️');
  }

  function updateThemeUI() { if ($sidebarTheme) $sidebarTheme.textContent = theme === 'dark' ? '☀️ 浅色' : '🌙 暗色'; }

  let toastTimer = null;
  function showToast(msg) {
    clearTimeout(toastTimer);
    $toast.textContent = msg; $toast.classList.remove('hidden');
    requestAnimationFrame(() => $toast.classList.add('show'));
    toastTimer = setTimeout(() => { $toast.classList.remove('show'); setTimeout(() => $toast.classList.add('hidden'), 400); }, 2200);
  }

  // ==========================================
  //  INIT
  // ==========================================
  function init() {
    loadSettings(); loadConversations(); loadTheme();
    renderConversation(); renderSidebar(); updateTokenCount(); updateCharCount();

    // 水印
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

    // Intro
    $introNext.addEventListener('click', introForward);
    $introBack.addEventListener('click', introBack);
    $introSkip.addEventListener('click', completeIntro);
    document.querySelectorAll('.intro-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const target = parseInt(dot.dataset.dot, 10);
        if (target !== introStep) setIntroStep(target, target > introStep ? 'forward' : 'back');
      });
    });

    // Chat input
    $chatInput.addEventListener('input', () => { autoResize(); updateSendBtn(); updateCharCount(); });
    $chatInput.addEventListener('keydown', handleKeyDown);
    $btnSend.addEventListener('click', sendMessage);
    $btnClearChat.addEventListener('click', () => {
      const conv = getCurrentConv();
      if (conv) { conv.messages = []; saveConversations(); renderConversation(); updateTokenCount(); showToast('对话已清除 ✦'); }
    });

    $streamStop.addEventListener('click', stopStreaming);

    // Settings
    $btnSettings.addEventListener('click', () => { switchToSettings(); });
    $settingsBack.addEventListener('click', switchFromSettings);
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

    // Sidebar
    $sidebarToggle.addEventListener('click', () => { $sidebar.classList.add('collapsed'); });
    $sidebarOpen.addEventListener('click', () => { $sidebar.classList.remove('collapsed'); });
    $sidebarNewChat.addEventListener('click', () => { createConversation('新对话'); renderConversation(); renderSidebar(); showToast('已创建新对话 ✦'); });
    $sidebarSearch.addEventListener('input', renderSidebar);
    $sidebarExport.addEventListener('click', exportConversation);
    $sidebarTheme.addEventListener('click', toggleTheme);

    // 📍 滚动到底部按钮
    $chatMessages.addEventListener('scroll', () => {
      const threshold = 200;
      const isNearBottom = $chatMessages.scrollHeight - $chatMessages.scrollTop - $chatMessages.clientHeight < threshold;
      $scrollBtn.classList.toggle('hidden', isNearBottom);
    });
    $scrollBtn.addEventListener('click', () => { scrollToBottom(); $scrollBtn.classList.add('hidden'); });

    // 触摸滑动
    let touchStartX = 0;
    $introSlides.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    $introSlides.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0 && introStep < totalSlides - 1) introForward();
        else if (dx > 0 && introStep > 0) introBack();
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();