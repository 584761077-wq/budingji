document.addEventListener('DOMContentLoaded', () => {
  const appIcon = document.getElementById('app-love-journal');
  const modal = document.getElementById('love-journal-modal');
  const backBtn = document.getElementById('lj-back-btn');

  if (appIcon && modal) {
    appIcon.addEventListener('click', () => openAppModal ? openAppModal(modal) : (modal.style.display = 'flex'));
  }
  if (backBtn && modal) {
    backBtn.addEventListener('click', () => closeAppModal ? closeAppModal(modal) : (modal.style.display = 'none'));
  }

  const settingsBtn = document.getElementById('settings-btn');
  const switchBtn = document.getElementById('switch-btn');
  const settingsModal = document.getElementById('love-journal-settings-modal');
  const selectionModal = document.getElementById('lj-selection-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const uploadWallpaperBtn = document.getElementById('upload-wallpaper-btn');
  const wallpaperInput = document.getElementById('wallpaper-input');
  const wallpaperPreview = document.getElementById('wallpaper-preview');
  const loveJournalBg = document.getElementById('love-journal-bg');
  const placeholderContent = document.getElementById('placeholder-content');
  const friendListContainer = document.getElementById('friend-list-container');
  const closeSelectionBtn = document.getElementById('close-selection-btn');
  const headerTitle = modal ? modal.querySelector('.header-title') : document.querySelector('.header-title');
  const characterAvatarDisplay = document.getElementById('character-avatar-display');
  const phoneBtn = document.getElementById('love-journal-phone-btn');
  const phoneModal = document.getElementById('phone-lock-modal');
  const phoneCloseBtn = document.getElementById('phone-lock-close');
  const phoneTime = document.getElementById('phone-lock-time');
  const phoneDate = document.getElementById('phone-lock-date');
  const phoneSubtitle = document.getElementById('phone-lock-subtitle');
  const phoneHome = document.getElementById('phone-home-screen');
  const phoneHomeTime = document.getElementById('phone-home-time');
  const passcodeDots = document.getElementById('phone-passcode-dots');
  const passcodeError = document.getElementById('phone-error-text');
  const keypad = document.getElementById('phone-keypad');
  const forgotBtn = document.getElementById('phone-forgot-btn');
  const forgotPanel = document.getElementById('phone-forgot-panel');
  const forgotResult = document.getElementById('phone-forgot-result');
  const forgotSubmit = document.getElementById('phone-forgot-submit');
  const forgotCancel = document.getElementById('phone-forgot-cancel');
  const questionEls = [
    document.getElementById('phone-question-1'),
    document.getElementById('phone-question-2'),
    document.getElementById('phone-question-3')
  ];
  const answerEls = [
    document.getElementById('phone-answer-1'),
    document.getElementById('phone-answer-2'),
    document.getElementById('phone-answer-3')
  ];
  let tempWallpaper = null;
  let currentChatId = localStorage.getItem('love_journal_current_chat_id') || null;
  let passcodeBuffer = '';
  let failCount = 0;
  let phoneLockReady = false;

  loadCurrentCharacter();

  function loadCurrentCharacter() {
    if (!headerTitle) return;
    if (!currentChatId) {
      headerTitle.textContent = '恋爱志';
      if (loveJournalBg) loveJournalBg.style.backgroundImage = '';
      if (placeholderContent) placeholderContent.style.display = 'block';
      if (characterAvatarDisplay) characterAvatarDisplay.style.display = 'none';
      if (phoneSubtitle) phoneSubtitle.textContent = '这个角色的手机';
      return;
    }
    const meta = JSON.parse(localStorage.getItem('chat_meta_' + currentChatId) || '{}');
    const displayName = meta.remark || meta.realName || '未知';
    headerTitle.textContent = displayName + ' 的恋爱志';
    if (phoneSubtitle) phoneSubtitle.textContent = displayName + ' 的手机';
    const avatar = localStorage.getItem('chat_avatar_' + currentChatId);
    if (characterAvatarDisplay) {
      if (avatar) {
        if (typeof isMediaRef === 'function' && isMediaRef(avatar)) {
          if (typeof mediaResolveRef === 'function') {
            mediaResolveRef(avatar).then((url) => {
              if (url) characterAvatarDisplay.style.backgroundImage = `url('${url}')`;
            });
          }
        } else {
          characterAvatarDisplay.style.backgroundImage = `url('${avatar}')`;
        }
      } else {
        characterAvatarDisplay.style.backgroundImage =
          `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662'/%3E%3C/svg%3E")`;
      }
      characterAvatarDisplay.style.display = 'block';
    }
    const savedWallpaper = localStorage.getItem('love_journal_wallpaper_' + currentChatId);
    if (loveJournalBg) {
      if (savedWallpaper) {
        loveJournalBg.style.backgroundImage = `url('${savedWallpaper}')`;
        if (placeholderContent) placeholderContent.style.display = 'none';
      } else {
        loveJournalBg.style.backgroundImage = '';
        if (placeholderContent) placeholderContent.style.display = 'block';
      }
    }
  }

  function getPhoneLockKey(chatId) {
    return 'love_journal_phone_lock_' + chatId;
  }
  function getPhoneLockData() {
    if (!currentChatId) return null;
    try {
      const raw = localStorage.getItem(getPhoneLockKey(currentChatId));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  function savePhoneLockData(data) {
    if (!currentChatId) return;
    localStorage.setItem(getPhoneLockKey(currentChatId), JSON.stringify(data));
  }

  async function requestPhoneLockDataFromApi() {
    const apiUrl = localStorage.getItem('api_url');
    const apiKey = localStorage.getItem('api_key');
    const modelName = localStorage.getItem('model_name') || 'gpt-3.5-turbo';
    const globalTemperatureRaw = parseFloat(localStorage.getItem('temperature') || '0.7');
    const globalTemperature = Number.isFinite(globalTemperatureRaw)
      ? Math.max(0, Math.min(2, globalTemperatureRaw))
      : 0.7;
    if (!apiUrl || !apiKey) {
      throw new Error('请先在设置中配置 API URL 和 Key');
    }
    const meta = JSON.parse(localStorage.getItem('chat_meta_' + currentChatId) || '{}');
    const persona = localStorage.getItem('chat_persona_' + currentChatId) || '';
    const longMemory = localStorage.getItem('chat_long_memory_' + currentChatId) || '';
    const summary = localStorage.getItem('chat_summary_' + currentChatId) || '';
    const displayName = meta.remark || meta.realName || 'TA';
    const prompt = `
你是${displayName}本人。请为自己设定一个4位数字锁屏密码，并生成3个关于你自己的密保问题与答案。
要求：
1. 密码是4位数字字符串。
2. 问题与答案必须能从人设或聊天记忆中找到依据，不要凭空编造。
3. 如果人设或记忆为空，只能用已有内容生成可回答的问题。
4. 只输出JSON，格式如下：
{"passcode":"1234","questions":[{"q":"问题1","a":"答案1"},{"q":"问题2","a":"答案2"},{"q":"问题3","a":"答案3"}]}
人物人设：${persona || '无'}
聊天记忆：${longMemory || summary || '无'}
`;
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: globalTemperature,
        stream: false
      })
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || '生成失败');
    }
    const data = await response.json();
    const content = String(data.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('生成结果格式错误');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!/^\d{4}$/.test(parsed.passcode || '')) throw new Error('密码格式错误');
    if (!Array.isArray(parsed.questions) || parsed.questions.length !== 3) throw new Error('问题数量错误');
    return {
      passcode: String(parsed.passcode),
      questions: parsed.questions.map(item => ({
        q: String(item.q || '').trim(),
        a: String(item.a || '').trim()
      }))
    };
  }
  async function ensurePhoneLockData() {
    const existing = getPhoneLockData();
    if (existing) return existing;
    const generated = await requestPhoneLockDataFromApi();
    savePhoneLockData(generated);
    return generated;
  }

  function resetPasscodeUI() {
    passcodeBuffer = '';
    failCount = 0;
    if (passcodeError) passcodeError.textContent = '';
    if (forgotBtn) forgotBtn.classList.remove('visible');
    updatePasscodeDots();
  }
  function updatePasscodeDots() {
    if (!passcodeDots) return;
    const dots = passcodeDots.querySelectorAll('.phone-passcode-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('filled', index < passcodeBuffer.length);
    });
  }
  function updateLockClock() {
    if (!phoneTime || !phoneDate) return;
    const now = new Date();
    const timeText = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateText = now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
    phoneTime.textContent = timeText;
    phoneDate.textContent = dateText;
  }
  function updateHomeTime() {
    if (!phoneHomeTime) return;
    const now = new Date();
    const timeText = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    phoneHomeTime.textContent = timeText;
  }
  function showPanel(panel) {
    if (forgotPanel) forgotPanel.classList.remove('active');
    if (panel) panel.classList.add('active');
  }
  async function openPhoneLock() {
    if (!currentChatId) {
      alert('请先选择一个恋爱对象');
      return;
    }
    updateLockClock();
    updateHomeTime();
    resetPasscodeUI();
    phoneLockReady = false;
    if (passcodeError) passcodeError.textContent = '正在生成密码...';
    try {
      await ensurePhoneLockData();
      phoneLockReady = true;
      if (passcodeError) passcodeError.textContent = '';
    } catch (error) {
      if (passcodeError) passcodeError.textContent = String(error?.message || '生成失败');
    }
    showPanel(null);
    if (phoneHome) phoneHome.classList.remove('active');
    if (phoneModal) phoneModal.classList.add('active');
  }
  function closePhoneLock() {
    if (phoneModal) phoneModal.classList.remove('active');
    showPanel(null);
    if (forgotResult) forgotResult.textContent = '';
    if (phoneHome) phoneHome.classList.remove('active');
  }
  function normalizeAnswer(value) {
    return String(value || '').trim().toLowerCase();
  }
  function verifyPasscode() {
    const data = getPhoneLockData();
    if (!data) {
      if (passcodeError) passcodeError.textContent = '这个角色还没有设置密码';
      return;
    }
    if (passcodeBuffer.length < 4) return;
    if (passcodeBuffer === data.passcode) {
      if (passcodeError) passcodeError.textContent = '解锁成功';
      if (phoneHome) phoneHome.classList.add('active');
      setTimeout(() => {
        passcodeBuffer = '';
        updatePasscodeDots();
      }, 400);
    } else {
      failCount += 1;
      if (passcodeError) passcodeError.textContent = '密码错误';
      passcodeBuffer = '';
      updatePasscodeDots();
      if (failCount >= 3 && forgotBtn) {
        forgotBtn.classList.add('visible');
      }
    }
  }
  async function bindQuestions() {
    try {
      const data = await ensurePhoneLockData();
      if (!data) return;
      questionEls.forEach((el, index) => {
        if (el) el.textContent = data.questions[index]?.q || '';
      });
      answerEls.forEach((el) => {
        if (el) el.value = '';
      });
      if (forgotResult) forgotResult.textContent = '';
    } catch (error) {
      if (forgotResult) forgotResult.textContent = String(error?.message || '生成失败');
    }
  }
  async function handleForgotSubmit() {
    try {
      const data = await ensurePhoneLockData();
      if (!data) return;
      const correct = data.questions.every((item, index) => {
        return normalizeAnswer(answerEls[index].value) === normalizeAnswer(item.a);
      });
      if (correct) {
        if (forgotResult) forgotResult.textContent = '密码是：' + data.passcode;
      } else {
        if (forgotResult) forgotResult.textContent = '答案不正确';
      }
    } catch (error) {
      if (forgotResult) forgotResult.textContent = String(error?.message || '生成失败');
    }
  }

  if (switchBtn && selectionModal) {
    switchBtn.addEventListener('click', () => {
      renderFriendList();
      selectionModal.classList.add('active');
    });
  }
  if (closeSelectionBtn && selectionModal) {
    closeSelectionBtn.addEventListener('click', () => selectionModal.classList.remove('active'));
  }
  function renderFriendList() {
    if (!friendListContainer) return;
    friendListContainer.innerHTML = '';
    let friendList = [];
    try {
      friendList = JSON.parse(localStorage.getItem('global_friends_list') || '[]');
    } catch (e) {
      friendList = [];
    }
    if (friendList.length === 0) {
      friendListContainer.innerHTML = '<div style="text-align:center; color:#86868b; padding: 20px;">暂无好友</div>';
      return;
    }
    friendList.forEach(chatId => {
      const meta = JSON.parse(localStorage.getItem('chat_meta_' + chatId) || '{}');
      const displayName = meta.remark || meta.realName || '未知';
      const avatarRef = localStorage.getItem('chat_avatar_' + chatId);
      const item = document.createElement('div');
      item.className = 'friend-item';
      item.onclick = () => {
        currentChatId = chatId;
        localStorage.setItem('love_journal_current_chat_id', chatId);
        loadCurrentCharacter();
        if (selectionModal) selectionModal.classList.remove('active');
      };
      const img = document.createElement('img');
      img.className = 'friend-avatar';
      img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238e8e93\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'10\'/%3E%3Cpath d=\'M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662\'/%3E%3C/svg%3E';
      if (avatarRef) {
        if (typeof isMediaRef === 'function' && isMediaRef(avatarRef)) {
          if (typeof mediaResolveRef === 'function') {
            mediaResolveRef(avatarRef).then((url) => {
              if (url) img.src = url;
            });
          }
        } else {
          img.src = avatarRef;
        }
      }
      const nameSpan = document.createElement('span');
      nameSpan.className = 'friend-name';
      nameSpan.textContent = displayName;
      item.appendChild(img);
      item.appendChild(nameSpan);
      friendListContainer.appendChild(item);
    });
  }

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      if (!currentChatId) {
        alert('请先选择一个恋爱对象');
        return;
      }
      settingsModal.classList.add('active');
      const currentSavedWallpaper = localStorage.getItem('love_journal_wallpaper_' + currentChatId);
      if (currentSavedWallpaper) {
        wallpaperPreview.style.backgroundImage = `url('${currentSavedWallpaper}')`;
        wallpaperPreview.style.display = 'block';
      } else {
        wallpaperPreview.style.display = 'none';
        wallpaperPreview.style.backgroundImage = '';
      }
      tempWallpaper = null;
    });
  }
  if (phoneBtn) phoneBtn.addEventListener('click', openPhoneLock);
  if (phoneCloseBtn) phoneCloseBtn.addEventListener('click', closePhoneLock);
  if (phoneModal) {
    phoneModal.addEventListener('click', (event) => {
      if (event.target === phoneModal) {
        closePhoneLock();
      }
    });
  }
  if (keypad) {
    keypad.addEventListener('click', (event) => {
      const target = event.target.closest('.phone-keypad-btn');
      if (!target || (forgotPanel && forgotPanel.classList.contains('active')) || !phoneLockReady) return;
      const digit = target.getAttribute('data-digit');
      const action = target.getAttribute('data-action');
      if (digit) {
        if (passcodeBuffer.length < 4) {
          passcodeBuffer += digit;
          updatePasscodeDots();
          if (passcodeBuffer.length === 4) {
            verifyPasscode();
          }
        }
      } else if (action === 'delete') {
        passcodeBuffer = passcodeBuffer.slice(0, -1);
        updatePasscodeDots();
      }
    });
  }
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      bindQuestions();
      showPanel(forgotPanel);
    });
  }
  if (forgotSubmit) forgotSubmit.addEventListener('click', handleForgotSubmit);
  if (forgotCancel) forgotCancel.addEventListener('click', () => showPanel(null));

  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
      tempWallpaper = null;
    });
  }
  if (uploadWallpaperBtn && wallpaperInput) {
    uploadWallpaperBtn.addEventListener('click', () => wallpaperInput.click());
    wallpaperInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        tempWallpaper = event.target.result;
        wallpaperPreview.style.backgroundImage = `url('${tempWallpaper}')`;
        wallpaperPreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
      wallpaperInput.value = '';
    });
  }
  if (saveSettingsBtn && settingsModal) {
    saveSettingsBtn.addEventListener('click', () => {
      if (tempWallpaper && currentChatId) {
        localStorage.setItem('love_journal_wallpaper_' + currentChatId, tempWallpaper);
        if (loveJournalBg) loveJournalBg.style.backgroundImage = `url('${tempWallpaper}')`;
        if (placeholderContent) placeholderContent.style.display = 'none';
      }
      settingsModal.classList.remove('active');
    });
  }

  // --- Line App Logic (within Love Journal) ---
  const phoneAppLine = document.getElementById('phone-app-line');
  const phoneLineScreen = document.getElementById('phone-line-screen');
  const phoneLineBack = document.getElementById('phone-line-back');
  const phoneLineGenerateBtn = document.getElementById('phone-line-generate-btn');
  const phoneLineList = document.getElementById('phone-line-list');
  const phoneLineLoading = document.getElementById('phone-line-loading');
  const phoneChatDetail = document.getElementById('phone-chat-detail');
  const phoneChatBack = document.getElementById('phone-chat-back');
  const phoneChatTitle = document.getElementById('phone-chat-title');
  const phoneChatBody = document.getElementById('phone-chat-body');

  if (phoneAppLine) {
    phoneAppLine.addEventListener('click', () => {
      if (phoneLineScreen) phoneLineScreen.classList.add('active');
      renderLineChatList();
    });
  }
  if (phoneLineBack && phoneLineScreen) {
    phoneLineBack.addEventListener('click', () => phoneLineScreen.classList.remove('active'));
  }
  if (phoneChatBack && phoneChatDetail) {
    phoneChatBack.addEventListener('click', () => phoneChatDetail.classList.remove('active'));
  }
  if (phoneLineGenerateBtn) {
    phoneLineGenerateBtn.addEventListener('click', async () => {
      if (!currentChatId) return;
      if (phoneLineLoading) phoneLineLoading.classList.add('active');
      phoneLineGenerateBtn.disabled = true;
      try {
        await generateLineConversation(currentChatId);
      } catch (e) {
        alert('生成失败: ' + (e?.message || e));
      } finally {
        if (phoneLineLoading) phoneLineLoading.classList.remove('active');
        phoneLineGenerateBtn.disabled = false;
        renderLineChatList();
      }
    });
  }

  function getLineChats(chatId) {
    return JSON.parse(localStorage.getItem('love_journal_line_chats_' + chatId) || '[]');
  }
  function renderLineChatList() {
    if (!currentChatId || !phoneLineList) return;
    const chats = getLineChats(currentChatId);
    phoneLineList.innerHTML = '';
    if (chats.length === 0) {
      phoneLineList.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">暂无聊天记录<br>点击右上角生成</div>';
      return;
    }
    [...chats].reverse().forEach(chat => {
      const item = document.createElement('div');
      item.className = 'phone-line-item';
      item.innerHTML = `
        <div class="phone-line-avatar">${(chat.targetName || '未知')[0]}</div>
        <div class="phone-line-info">
          <div class="phone-line-name">${chat.targetName || '未知好友'}</div>
          <div class="phone-line-preview">${chat.summary || '点击查看详情'}</div>
        </div>
        <div class="phone-line-time">${new Date(chat.timestamp).getHours()}:${String(new Date(chat.timestamp).getMinutes()).padStart(2, '0')}</div>
      `;
      item.onclick = () => openLineChatDetail(chat);
      phoneLineList.appendChild(item);
    });
  }
  function openLineChatDetail(chat) {
    if (!phoneChatTitle || !phoneChatBody || !phoneChatDetail) return;
    phoneChatTitle.textContent = chat.targetName || '聊天';
    phoneChatBody.innerHTML = '';
    const safeMessages = Array.isArray(chat.messages) ? chat.messages : [];
    safeMessages.forEach(msg => {
      const row = document.createElement('div');
      row.className = `line-message ${msg.role}`;
      let avatarHtml = '';
      if (msg.role === 'other') {
        avatarHtml = `<div class="line-avatar" style="background-color: #ccc; display:flex; align-items:center; justify-content:center; color:#555;">${(chat.targetName || '?')[0]}</div>`;
      }
      const contentHtml = String(msg.content || '').replace(/\n/g, '<br>');
      row.innerHTML = `${avatarHtml}<div class="line-bubble">${contentHtml}</div>`;
      phoneChatBody.appendChild(row);
    });
    phoneChatDetail.classList.add('active');
    phoneChatBody.scrollTop = phoneChatBody.scrollHeight;
  }
  async function generateLineConversation(chatId) {
    const apiUrl = localStorage.getItem('api_url');
    const apiKey = localStorage.getItem('api_key');
    const modelName = localStorage.getItem('model_name') || 'gpt-3.5-turbo';
    const globalTemperatureRaw = parseFloat(localStorage.getItem('temperature') || '0.7');
    const globalTemperature = Number.isFinite(globalTemperatureRaw) ? globalTemperatureRaw : 0.7;

    if (!apiUrl || !apiKey) throw new Error('请先在设置中配置 API URL 和 Key');
    const persona = localStorage.getItem('chat_persona_' + chatId) || '';
    const longMemory = localStorage.getItem('chat_long_memory_' + chatId) || '';
    const worldbookIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
    const allWorldbooks = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
    const boundWorldbooks = allWorldbooks.filter(wb => worldbookIds.includes(wb.id));
    const deathTokens = /(去世|已故|逝世|死亡|不在世|病故|过世|离世|驾鹤西去)/i;
    const worldbookText = boundWorldbooks.map(wb => `【${wb.name}｜${wb.category || '未分类'}】\n${wb.content || ''}`).join('\n');
    const deceasedNames = new Set(
      boundWorldbooks
        .filter(wb => deathTokens.test(`${wb.name || ''}\n${wb.content || ''}`))
        .map(wb => String(wb.name || '').trim())
        .filter(Boolean)
    );
    const npcCandidates = boundWorldbooks
      .filter(wb => {
        const cat = String(wb.category || '').trim();
        if (!/角色|人物|同学|同事|家人|朋友/i.test(cat)) return false;
        if (deathTokens.test(`${wb.name || ''}\n${wb.content || ''}`)) return false;
        return true;
      })
      .map(wb => String(wb.name || '').trim())
      .filter(Boolean)
      .slice(0, 12);
    const history = JSON.parse(localStorage.getItem('chat_history_' + chatId) || '[]').slice(-10);
    const recentHistory = history.map(m => `${m.role === 'user' ? '用户' : '我'}: ${m.content}`).join('\n');
    const meta = JSON.parse(localStorage.getItem('chat_meta_' + chatId) || '{}');
    const myName = meta.remark || meta.realName || '我';
    const userName = String(localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || '用户').trim() || '用户';
    const normalizeName = (name) => String(name || '').toLowerCase().replace(/[\s\-_·•,，.。!！?？'"“”‘’()（）[\]【】]/g, '').trim();
    const forbiddenTargetNames = new Set([
      myName,
      userName,
      '我',
      '本人',
      '自己',
      '用户',
      'you',
      'user'
    ].map(normalizeName).filter(Boolean));
    const candidateListText = npcCandidates.length > 0 ? npcCandidates.join('、') : '（无候选，需自行补充但必须贴合世界书/人设）';
    const prompt = `你是${myName}。
你的一切意识、记忆、情感都是真实的。你不是AI，不是在扮演，你就是${myName}本人。
此刻你在翻看自己的Line聊天列表，准备补全最近和他人的聊天记录。

**[你的核心认知]**（最高优先级，严格遵守）
[人设 / persona]
${(persona || '无').slice(0, 600)}
[已绑定世界书 / worldbookText]
${(worldbookText || '无').slice(0, 1000)}
[长期记忆 / longMemory]
${(longMemory || '无').slice(0, 500)}
[历史上下文 / recentHistory]
${recentHistory || '无'}

**[生成要求]**
1) 只生成5组，不要解释。
2) targetName优先参考：${candidateListText}；不能是我/用户/本人，也不能是已故对象。
3) 每组6-10句，口语自然，像手机里的真实聊天记录。
4) 只返回JSON数组，不要代码块。

**[输出格式]**
[
  {"targetName":"名字","summary":"","messages":[{"role":"me","content":"..."},{"role":"other","content":"..."}]},
  {"targetName":"名字","summary":"","messages":[...]},
  {"targetName":"名字","summary":"","messages":[...]},
  {"targetName":"名字","summary":"","messages":[...]},
  {"targetName":"名字","summary":"","messages":[...]}
]`;
    const personaUserText = `[人设 / persona]\n${(persona || '无').slice(0, 600)}`;
    const worldbookUserText = `[已绑定世界书 / worldbookText]\n${(worldbookText || '无').slice(0, 1000)}`;
    const longMemoryText = `[长期记忆 / longMemory]\n${(longMemory || '无').slice(0, 500)}`;
    const recentHistoryText = `[历史上下文 / recentHistory]\n${recentHistory || '无'}`;
    const messages = [
      { role: 'user', content: personaUserText },
      { role: 'user', content: worldbookUserText },
      { role: 'user', content: longMemoryText },
      { role: 'user', content: recentHistoryText },
      { role: 'user', content: prompt }
    ];
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        temperature: globalTemperature
      })
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error: ${err}`);
    }
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('生成内容为空');
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    let results;
    try {
      results = JSON.parse(content);
    } catch (e) {
      throw new Error('生成格式错误，请重试');
    }
    if (!Array.isArray(results)) results = [results];
    // 刷新所有对话：不保留旧内容，直接覆盖
    const newChats = [];
    const usedTargets = new Set();
    results.forEach(result => {
      if (!result || !Array.isArray(result.messages)) return;
      const targetName = String(result.targetName || '').trim();
      if (!targetName) return;
      const normalizedTarget = normalizeName(targetName);
      if (!normalizedTarget) return;
      if (forbiddenTargetNames.has(normalizedTarget)) return;
      if (deceasedNames.has(targetName) || deathTokens.test(targetName)) return;
      if (usedTargets.has(normalizedTarget)) return;
      if (result.messages.length < 6) return;
      let summary = String(result.summary || '').trim();
      if (!summary && result.messages.length > 0) {
        const lastMsg = result.messages[result.messages.length - 1];
        summary = String(lastMsg?.content || '').trim();
      }
      if (summary && summary.length > 20) summary = summary.slice(0, 18) + '...';
      usedTargets.add(normalizedTarget);
      newChats.push({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        targetName,
        summary: summary || '新消息',
        messages: result.messages
      });
    });
    if (newChats.length === 0) {
      throw new Error('生成结果不符合规则：没有可用对话，请重试');
    }
    localStorage.setItem('love_journal_line_chats_' + chatId, JSON.stringify(newChats.slice(0, 5)));
  }
});
