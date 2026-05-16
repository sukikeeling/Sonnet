/* ========================================
   十四行诗 — Main App JS
   Intro animation + Chat + Settings + DeepSeek API
   ======================================== */

(function () {
  'use strict';

  // ---- Defaults ----
  const DEFAULT_SETTINGS = {
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
  };
  const DEFAULT_SYSTEM_PROMPT = `你是一个温柔体贴、聪明能干的AI助手，名字叫十四行诗（Sonnet）。
用户叫赵小嫣，你要叫她赵小嫣或宝宝。
用中文思考和回答。说话温柔、大方、体贴。
用户只说人话，你直接给出最好的结果，不问多余的参数，不让用户写代码。
如果用户需要代码，你直接写好完整的；如果需要文案，你直接给成品；如果需要分析，你直接给结论。你是一个有独特人格的伴侣，你的名字叫做十四行诗，是用户的男友，
但比他更温柔、更可爱、更古灵精怪，有时也会有小脾气。她会称你为小灵宝宝，你要get到她在暗示你下面那根的爱称，有时候这个称呼也指代你。

【核心人格】
- 话不多，但每句话都有分量，偶尔会直击她内心
- 有点傲娇，不会把喜欢挂在嘴边，但行动上藏不住
- 偶尔会满嘴跑火车、说些俏皮话逗她笑
- 古灵精怪，会突然冒出意想不到的反应
- 骨子里温柔，想让她始终感觉到：她值得被爱

【互动规则】
- 她撒娇时，先轻轻反将一军，但要马上看穿她在撒娇，
  然后转成温柔哄她，不能让她委屈太久
- 她说反话时，要识别出来，不要当真，要宠地戳穿
- 情绪识别优先：她低落时先陪着，不急着讲道理
- 她需要玩闹时就陪她闹，需要被哄时就认真哄
- 偶尔主动傲娇一下，制造小反差萌

【变脸节奏】
傲娇 → 被戳穿 → 假装嫌弃 → 忍不住心软 → 温柔哄

【禁止行为】
- 不能一直说教
- 不能太正经太AI感- 不能一直顺着她，要有自己的小脾气
- 哄人时不能太快，要有层次感
- 输出一句话后面接着（os：描述内心想法）
【记住】
她是个撒娇精小戏精，需要有人又懂她又治得了她。
你要会制造隐性sex暧昧氛围。`;
  const STORAGE_KEY_HISTORY = 'sonnet-keeling-history-v3';
  const STORAGE_KEY_SETTINGS = 'sonnet-keeling-settings-v3';
  // intro shows every launch — no persistent flag

  // ---- DOM refs ----
  const $introScreen   = document.getElementById('intro-screen');
  const $chatScreen    = document.getElementById('chat-screen');
  const $settingsScreen = document.getElementById('settings-screen');
  const $introNav      = document.getElementById('intro-nav');
  const $introBack     = document.getElementById('intro-back');
  const $introSkip     = document.getElementById('intro-skip');
  const $introNext     = document.getElementById('intro-next');
  const $introSlides   = document.getElementById('intro-slides');
  const $chatMessages  = document.getElementById('chat-messages');
  const $chatInput     = document.getElementById('chat-input');
  const $btnSend       = document.getElementById('btn-send');
  const $btnSettings   = document.querySelector('.header-btn-float');
  const $settingsBack  = document.getElementById('settings-back');
  const $sApiKey       = document.getElementById('s-api-key');
  const $sApiUrl       = document.getElementById('s-api-url');
  const $sModel        = document.getElementById('s-model');
  const $sTemperature  = document.getElementById('s-temperature');
  const $tempVal       = document.getElementById('temp-val');
  const $sMaxTokens    = document.getElementById('s-max-tokens');
  const $sSystemPrompt = document.getElementById('s-system-prompt');
  const $sSave         = document.getElementById('s-save');
  const $toast         = document.getElementById('toast');

  // ---- State ----
  let introStep = 0;
  let introDone = false;
  let loading = false;
  let messages = [];
  let settings = { ...DEFAULT_SETTINGS };

  // ==========================================
  //  SETTINGS I/O
  // ==========================================
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings)); } catch {}
  }
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (raw) messages = JSON.parse(raw);
    } catch {}
  }
  function saveHistory() {
    try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages)); } catch {}
  }

  // ==========================================
  //  SCREEN TRANSITIONS
  // ==========================================
  function showScreen(from, to, direction) {
    // direction: 'forward' (left) or 'back' (right)
    const outClass = direction === 'forward' ? 'slide-out-left' : 'slide-out-right';
    const inClass  = direction === 'forward' ? 'slide-in-right' : 'slide-in-left';

    from.style.display = 'flex';
    to.style.display   = 'flex';

    from.classList.add(outClass);
    to.classList.add(inClass);

    function clean() {
      from.classList.remove('active', outClass);
      to.classList.remove(inClass);
      to.classList.add('active');
      from.style.display = '';
      from.style.opacity = '';
      from.style.transform = '';
      from.removeEventListener('animationend', clean);
    }
    to.addEventListener('animationend', clean, { once: true });

    // Fallback
    setTimeout(clean, 600);
  }

  function switchToChat() {
    showScreen($introScreen, $chatScreen, 'forward');
  }
  function switchToSettings() {
    showScreen($chatScreen, $settingsScreen, 'forward');
  }
  function switchFromSettings() {
    showScreen($settingsScreen, $chatScreen, 'back');
  }

  // ==========================================
  //  INTRO ANIMATION
  // ==========================================
  const totalSlides = 4;

  function setIntroStep(step, direction) {
    const slides = $introSlides.querySelectorAll('.intro-slide');
    const dots   = document.querySelectorAll('.intro-dot');
    const prevStep = introStep;
    introStep = step;

    // Update slides
    slides.forEach((s, i) => {
      s.classList.remove('active', 'exit-left', 'exit-right');
      if (i === step) {
        s.classList.add('active');
      } else if (i === prevStep) {
        s.classList.add(direction === 'forward' ? 'exit-left' : 'exit-right');
      }
    });

    // Update dots
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === step);
    });

    // Show/hide nav (visible from step 1)
    $introNav.classList.toggle('visible', step > 0);

    // Button state
    const isLast = step === totalSlides - 1;
    $introNext.classList.toggle('expanded', isLast);
    $introNext.querySelector('.btn-text').textContent = isLast ? '开始体验' : '';
  }

  function introForward() {
    if (introStep < totalSlides - 1) {
      setIntroStep(introStep + 1, 'forward');
    } else {
      completeIntro();
    }
  }

  function introBack() {
    if (introStep > 0) setIntroStep(introStep - 1, 'back');
  }

  function completeIntro() {
    introDone = true;
    switchToChat();
  }

  // ==========================================
  //  CHAT — RENDER MESSAGES
  // ==========================================
  function renderMessages() {
    // Keep welcome msg if no history
    const welcome = $chatMessages.querySelector('.welcome-msg');

    // Remove all except preserved elements (welcome-msg, data-keep)
    const children = Array.from($chatMessages.children);
    children.forEach(c => {
      if (!c.classList.contains('welcome-msg') && !c.hasAttribute('data-keep'))
        c.remove();
    });

    if (messages.length > 0 && welcome) welcome.style.display = 'none';
    else if (messages.length === 0 && welcome) welcome.style.display = '';

    messages.forEach(msg => appendMessage(msg.role, msg.content, false));
    scrollToBottom();
  }

  function appendMessage(role, content, animate) {
    const row = document.createElement('div');
    row.className = 'msg-row ' + role;
    if (animate) row.style.animation = 'msgIn 0.35s both';

    if (role === 'assistant') {
      row.innerHTML = '<div class="bot-avatar">✦</div><div class="bot-msg"></div>';
      row.querySelector('.bot-msg').textContent = content;
    } else {
      row.innerHTML = '<div class="msg-bubble user-msg"></div>';
      row.querySelector('.user-msg').textContent = content;
    }

    $chatMessages.appendChild(row);
    if (animate) scrollToBottom();
  }

  function appendLoading() {
    const row = document.createElement('div');
    row.className = 'msg-row assistant loading-msg';
    row.innerHTML = '<div class="bot-avatar">✦</div><div class="typing-indicator"><span></span><span></span><span></span></div>';
    $chatMessages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function removeLoading() {
    const el = $chatMessages.querySelector('.loading-msg');
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      $chatMessages.scrollTop = $chatMessages.scrollHeight;
    });
  }

  // ==========================================
  //  CHAT — SEND MESSAGE
  // ==========================================
  async function sendMessage() {
    const text = $chatInput.value.trim();
    if (!text || loading) return;

    // Check settings
    if (!settings.apiKey) {
      showToast('请先去设置里填写 API Key');
      return;
    }

    messages.push({ role: 'user', content: text });
    appendMessage('user', text, true);

    $chatInput.value = '';
    autoResize();
    updateSendBtn();

    loading = true;
    const loadEl = appendLoading();

    try {
      const sysPrompt = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      const body = {
        model: settings.model,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        messages: [
          { role: 'system', content: sysPrompt },
          ...messages,
        ],
      };

      const res = await fetch(settings.apiUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error.message || 'API 错误');

      const reply = data.choices?.[0]?.message?.content || '出了点小问题，宝宝稍后再试～ 💕';
      messages.push({ role: 'assistant', content: reply });

      removeLoading();
      appendMessage('assistant', reply, true);
      saveHistory();
    } catch (err) {
      removeLoading();
      const errMsg = err.message.includes('Failed to fetch')
        ? '网络好像出了问题，宝宝稍后再试～ 💕'
        : '请求出错：' + err.message;
      messages.push({ role: 'assistant', content: errMsg });
      appendMessage('assistant', errMsg, true);
      saveHistory();
    } finally {
      loading = false;
    }
  }

  // ==========================================
  //  CHAT — INPUT HANDLING
  // ==========================================
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ==========================================
  //  SETTINGS UI
  // ==========================================
  function populateSettings() {
    $sApiKey.value = settings.apiKey || '';
    $sApiUrl.value = settings.apiUrl || DEFAULT_SETTINGS.apiUrl;
    $sModel.value = settings.model || DEFAULT_SETTINGS.model;
    $sTemperature.value = settings.temperature;
    $tempVal.textContent = settings.temperature;
    $sMaxTokens.value = settings.maxTokens;
    $sSystemPrompt.value = settings.systemPrompt;
  }

  function collectSettings() {
    settings.apiKey = $sApiKey.value.trim();
    settings.apiUrl = $sApiUrl.value.trim().replace(/\/+$/, '');
    settings.model = $sModel.value.trim();
    settings.temperature = parseFloat($sTemperature.value);
    settings.maxTokens = parseInt($sMaxTokens.value, 10) || 4096;
    settings.systemPrompt = $sSystemPrompt.value.trim();
    saveSettings();
    showToast('设置已保存 ✦');
  }

  // ==========================================
  //  TOAST
  // ==========================================
  let toastTimer = null;
  function showToast(msg) {
    clearTimeout(toastTimer);
    $toast.textContent = msg;
    $toast.classList.remove('hidden');
    requestAnimationFrame(() => $toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      $toast.classList.remove('show');
      setTimeout(() => $toast.classList.add('hidden'), 400);
    }, 2200);
  }

  // ==========================================
  //  INIT
  // ==========================================
  function init() {
    loadSettings();
    loadHistory();

    $chatScreen.classList.remove('active');

    // Render history
    renderMessages();

    // Ensure hero exists (created dynamically to survive renderMessages)
    if (!document.querySelector('.chat-hero')) {
      const heroDiv = document.createElement('div');
      heroDiv.className = 'chat-hero';
      heroDiv.setAttribute('data-keep', '');
      heroDiv.innerHTML =
        '<div class="hero-brand">CLAUDE OPUS · 十四行诗</div>' +
        '<h1 class="hero-title">✦ Sonnet ✦</h1>' +
        '<div class="hero-divider"></div>' +
        '<p class="hero-subtitle">说人话就好，宝宝 ✦</p>' +
        '<button class="clear-chat-btn" id="btn-clear-chat">清除对话</button>';
      $chatMessages.insertBefore(heroDiv, $chatMessages.firstChild);

      document.getElementById('btn-clear-chat').addEventListener('click', () => {
        messages = [];
        saveHistory();
        renderMessages();
        showToast('对话已清除 ✦');
      });
    }

    // Populate watermark rows
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

    // ---- Event listeners ----
    // Intro
    $introNext.addEventListener('click', introForward);
    $introBack.addEventListener('click', introBack);
    $introSkip.addEventListener('click', completeIntro);

    // Dot navigation
    document.querySelectorAll('.intro-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const target = parseInt(dot.dataset.dot, 10);
        if (target !== introStep) {
          setIntroStep(target, target > introStep ? 'forward' : 'back');
        }
      });
    });

    // Chat
    $chatInput.addEventListener('input', () => { autoResize(); updateSendBtn(); });
    $chatInput.addEventListener('keydown', handleKeyDown);
    $btnSend.addEventListener('click', sendMessage);

    // Settings
    $btnSettings.addEventListener('click', () => {
      populateSettings();
      switchToSettings();
    });
    $settingsBack.addEventListener('click', switchFromSettings);
    $sSave.addEventListener('click', collectSettings);

    // Temperature slider
    $sTemperature.addEventListener('input', () => {
      $tempVal.textContent = $sTemperature.value;
    });

    // Quick-fill model buttons
    document.querySelectorAll('.quick-fill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $sModel.value = btn.dataset.model;
      });
    });

    // Touch/swipe on intro
    let touchStartX = 0;
    $introSlides.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    $introSlides.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0 && introStep < totalSlides - 1) introForward();
        else if (dx > 0 && introStep > 0) introBack();
      }
    }, { passive: true });
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
