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
  const uploadWallpaperBtn = document.getElementById('lj-upload-wallpaper-btn');
  const wallpaperInput = document.getElementById('lj-wallpaper-input');
  const wallpaperPreview = document.getElementById('lj-wallpaper-preview');
  const loveJournalBg = document.getElementById('love-journal-bg');
  const placeholderContent = document.getElementById('placeholder-content');
  const friendListContainer = document.getElementById('friend-list-container');
  const closeSelectionBtn = document.getElementById('close-selection-btn');
  const headerTitle = modal ? modal.querySelector('.header-title') : document.querySelector('.header-title');
  const characterAvatarDisplay = document.getElementById('character-avatar-display');
  const phoneBtn = document.getElementById('love-journal-phone-btn');
  const scheduleBtn = document.getElementById('love-journal-schedule-btn');
  const scheduleModal = document.getElementById('love-journal-schedule-modal');
  const closeScheduleBtn = document.getElementById('close-schedule-btn');
  const saveScheduleBtn = document.getElementById('save-schedule-btn');
  const scheduleNavItems = scheduleModal ? scheduleModal.querySelectorAll('.nav-item') : [];
  const scheduleContentMe = document.getElementById('schedule-content-me');
  const scheduleContentHer = document.getElementById('schedule-content-her');
  const scheduleCalendarView = document.getElementById('schedule-calendar-view');
  const scheduleHeaderTitle = document.getElementById('schedule-header-title');
  const calendarPrevMonth = document.getElementById('calendar-prev-month');
  const calendarNextMonth = document.getElementById('calendar-next-month');
  const calendarMonthYear = document.getElementById('calendar-month-year');
  const calendarGrid = document.getElementById('calendar-grid');
  
  let currentScheduleDate = new Date();
  let selectedScheduleDateStr = currentScheduleDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const generateMeScheduleBtn = document.getElementById('generate-me-schedule-btn');
  const updateMeScheduleBtn = document.getElementById('update-me-schedule-btn');
  const importMeScheduleBtn = document.getElementById('import-me-schedule-btn');
  const meScheduleDisplay = document.getElementById('me-schedule-display');
  const meScheduleLoading = document.getElementById('me-schedule-loading');

  const generateHerScheduleBtn = document.getElementById('generate-her-schedule-btn');
  const updateHerScheduleBtn = document.getElementById('update-her-schedule-btn');
  const importHerScheduleBtn = document.getElementById('import-her-schedule-btn');
  const settingMeScheduleBtn = document.getElementById('setting-me-schedule-btn');
  const settingHerScheduleBtn = document.getElementById('setting-her-schedule-btn');
  const scheduleWbModal = document.getElementById('schedule-wb-modal');
  const closeScheduleWbModal = document.getElementById('close-schedule-wb-modal');
  const scheduleWbList = document.getElementById('schedule-wb-list');

  const herScheduleDisplay = document.getElementById('her-schedule-display');
  const herScheduleLoading = document.getElementById('her-schedule-loading');
  const calendarContainer = document.getElementById('calendar-container');

  let currentScheduleTab = 'me';
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
        if (typeof isMediaRef !== 'undefined' && isMediaRef(savedWallpaper)) {
          mediaResolveRef(savedWallpaper).then(url => {
            if (url) {
              loveJournalBg.style.backgroundImage = `url('${url}')`;
              if (placeholderContent) placeholderContent.style.display = 'none';
            }
          });
        } else {
          loveJournalBg.style.backgroundImage = `url('${savedWallpaper}')`;
          if (placeholderContent) placeholderContent.style.display = 'none';
        }
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
    const persona = largeStore.get('chat_persona_' + currentChatId, '');
    const longMemory = largeStore.get('chat_long_memory_' + currentChatId, '');
    const summary = largeStore.get('chat_summary_' + currentChatId, '');
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
    const now = new Date();
    const timeText = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateText = now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
    const smallEl = document.getElementById('phone-home-time-small');
    const clockEl = document.getElementById('phone-home-hero-clock');
    const dateEl = document.getElementById('phone-home-hero-date');
    if (smallEl) smallEl.textContent = timeText;
    if (clockEl) clockEl.textContent = timeText;
    if (dateEl) dateEl.textContent = dateText;
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
    const phoneLineScreen = document.getElementById('phone-line-screen');
    const phoneChatDetail = document.getElementById('phone-chat-detail');
    if (phoneLineScreen) phoneLineScreen.classList.remove('active');
    if (phoneChatDetail) phoneChatDetail.classList.remove('active');
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
        if (typeof isMediaRef !== 'undefined' && isMediaRef(currentSavedWallpaper)) {
          mediaResolveRef(currentSavedWallpaper).then(url => {
            if (url) {
              wallpaperPreview.style.backgroundImage = `url('${url}')`;
              wallpaperPreview.style.display = 'block';
            }
          });
        } else {
          wallpaperPreview.style.backgroundImage = `url('${currentSavedWallpaper}')`;
          wallpaperPreview.style.display = 'block';
        }
      } else {
        wallpaperPreview.style.display = 'none';
        wallpaperPreview.style.backgroundImage = '';
      }
      tempWallpaper = null;
    });
  }
  if (phoneBtn) phoneBtn.addEventListener('click', openPhoneLock);
  
  function renderSchedule(scheduleDataStr, type, displayEl) {
    if (!displayEl) return;
    displayEl.innerHTML = '';
    
    if (!scheduleDataStr) {
      displayEl.innerHTML = '<div style="text-align: center; color: #86868b; margin-top: 50px;">暂无日常，点击上方按钮生成。</div>';
      return;
    }

    let scheduleData = [];
    try {
      scheduleData = JSON.parse(scheduleDataStr);
    } catch (e) {
      // 兼容旧格式或非 JSON 格式
      displayEl.innerHTML = `<div style="white-space: pre-wrap; padding: 10px;">${scheduleDataStr}</div>`;
      return;
    }

    if (!Array.isArray(scheduleData) || scheduleData.length === 0) {
      displayEl.innerHTML = '<div style="text-align: center; color: #86868b; margin-top: 50px;">暂无日常数据。</div>';
      return;
    }

    const timeline = document.createElement('div');
    timeline.className = 'schedule-timeline';

    // Add Date Header at the top of the timeline
    const dateHeader = document.createElement('div');
    dateHeader.className = 'schedule-date-header';
    const parts = selectedScheduleDateStr.split('-');
    if (parts.length === 3) {
      dateHeader.textContent = `${parts[1]}月${parts[2]}日`;
    } else {
      dateHeader.textContent = selectedScheduleDateStr;
    }
    timeline.appendChild(dateHeader);

    scheduleData.forEach((item, index) => {
      const node = document.createElement('div');
      node.className = 'schedule-node';
      
      const noteContent = item.note || '';
      const userNoteContent = item.userNote || '';
      const replyNoteContent = item.replyNote || '';

      let html = `
        <div class="schedule-dot"></div>
        <div class="schedule-content">
          <div class="schedule-time">${item.time || '全天'}</div>
          <div class="schedule-title">${item.title || '无标题'}</div>
          <div class="schedule-desc">${item.desc || ''}</div>
      `;

      // 1. Initial Role Note
      // Only show the empty placeholder for role note if there is NO noteContent yet
      // BUT if it's the very first generation (no notes at all), we hide userNote and replyNote entirely
      if (noteContent || userNoteContent || replyNoteContent) {
        html += `<div class="schedule-note ${noteContent ? '' : 'empty-note'}" contenteditable="true" data-index="${index}">${noteContent}</div>`;
        html += `<div class="schedule-note user-note ${userNoteContent ? '' : 'empty-note'}" contenteditable="true" data-index="${index}">${userNoteContent}</div>`;
      }
      // If everything is completely empty, we don't show ANY note placeholders
      // They will appear after the first "Update Progress" adds the role note.

      // 3. Reply Note (Role's reply to User Note)
      if (replyNoteContent) {
        html += `
          <div class="schedule-note reply-note" data-index="${index}">${replyNoteContent}</div>
        `;
      }

      html += `</div>`;
      node.innerHTML = html;

      // 监听角色批注编辑
      const noteEl = node.querySelector('.schedule-note:not(.user-note):not(.reply-note)');
      if (noteEl) {
        noteEl.addEventListener('blur', () => {
          const newNote = noteEl.textContent.trim() === '点击添加批注...' ? '' : noteEl.textContent.trim();
          scheduleData[index].note = newNote;
          if (newNote) {
              noteEl.classList.remove('empty-note');
          } else {
              noteEl.classList.add('empty-note');
              noteEl.innerHTML = '';
          }
          largeStore.put(`love_journal_${type}_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, JSON.stringify(scheduleData));
        });
        
        noteEl.addEventListener('focus', () => {
          if (noteEl.classList.contains('empty-note')) {
              noteEl.innerHTML = '';
          }
        });
      }

      // 监听用户批注编辑
      const userNoteEl = node.querySelector('.schedule-note.user-note');
      if (userNoteEl) {
        userNoteEl.addEventListener('blur', () => {
          const newNote = userNoteEl.textContent.trim() === '点击添加用户批注...' ? '' : userNoteEl.textContent.trim();
          scheduleData[index].userNote = newNote;
          if (newNote) {
              userNoteEl.classList.remove('empty-note');
          } else {
              userNoteEl.classList.add('empty-note');
              userNoteEl.innerHTML = '';
          }
          largeStore.put(`love_journal_${type}_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, JSON.stringify(scheduleData));
        });
        
        userNoteEl.addEventListener('focus', () => {
          if (userNoteEl.classList.contains('empty-note')) {
              userNoteEl.innerHTML = '';
          }
        });
      }

      timeline.appendChild(node);
    });

    displayEl.appendChild(timeline);
  }

  function renderCalendar() {
    if (!calendarGrid || !calendarMonthYear || !currentChatId) return;

    const year = currentScheduleDate.getFullYear();
    const month = currentScheduleDate.getMonth();
    
    calendarMonthYear.textContent = `${year}年${month + 1}月`;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    // Fill empty days
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'calendar-day empty';
      calendarGrid.appendChild(emptyDay);
    }

    // Fill days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = i;
      
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
        dayEl.classList.add('today');
      }

      // Check if schedule exists for this day
      const keyPrefix = currentScheduleTab === 'me' ? 'love_journal_me_schedule_' : 'love_journal_her_schedule_';
      const savedData = largeStore.get(`${keyPrefix}${currentChatId}_${dateStr}`, '');
      if (savedData) {
        dayEl.classList.add('has-schedule');
      }

      dayEl.addEventListener('click', () => {
        selectedScheduleDateStr = dateStr;
        scheduleCalendarView.style.display = 'none';
        if (currentScheduleTab === 'me') {
          scheduleContentMe.style.display = 'block';
        } else {
          scheduleContentHer.style.display = 'block';
        }
        
        if (scheduleHeaderTitle) {
          scheduleHeaderTitle.textContent = `${year}年${month + 1}月${i}日 日程`;
        }
        if (saveScheduleBtn) saveScheduleBtn.style.display = 'block';

        const tempKeyPrefix = currentScheduleTab === 'me' ? 'love_journal_me_schedule_temp_' : 'love_journal_her_schedule_temp_';
        
        // Use temp schedule if exists, otherwise fallback to saved schedule, and finally to empty
        let scheduleToRender = largeStore.get(`${tempKeyPrefix}${currentChatId}_${selectedScheduleDateStr}`, null);
        if (scheduleToRender === null) {
          scheduleToRender = largeStore.get(`${keyPrefix}${currentChatId}_${selectedScheduleDateStr}`, '');
          // Init temp with saved so we can edit
          largeStore.put(`${tempKeyPrefix}${currentChatId}_${selectedScheduleDateStr}`, scheduleToRender);
        }
        
        if (currentScheduleTab === 'me') {
          renderSchedule(scheduleToRender, 'me', meScheduleDisplay);
        } else {
          renderSchedule(scheduleToRender, 'her', herScheduleDisplay);
        }
      });

      calendarGrid.appendChild(dayEl);
    }
  }

  if (calendarPrevMonth) {
    calendarPrevMonth.addEventListener('click', () => {
      currentScheduleDate.setMonth(currentScheduleDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (calendarNextMonth) {
    calendarNextMonth.addEventListener('click', () => {
      currentScheduleDate.setMonth(currentScheduleDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (scheduleBtn && scheduleModal) {
    scheduleBtn.addEventListener('click', () => {
      if (!currentChatId) {
        alert('请先选择一个恋爱对象');
        return;
      }
      
      // 重置状态
      if (scheduleHeaderTitle) scheduleHeaderTitle.textContent = '日程日历';
      if (scheduleCalendarView) scheduleCalendarView.style.display = 'block';
      if (scheduleContentMe) scheduleContentMe.style.display = 'none';
      if (scheduleContentHer) scheduleContentHer.style.display = 'none';
      if (saveScheduleBtn) saveScheduleBtn.style.display = 'none';
      
      currentScheduleDate = new Date();
      renderCalendar();
      scheduleModal.classList.add('active');
    });
  }
  if (closeScheduleBtn && scheduleModal) {
    closeScheduleBtn.addEventListener('click', () => {
      // 如果在详情页，则返回日历；如果在日历页，则关闭弹窗
      if (scheduleContentMe.style.display === 'block' || scheduleContentHer.style.display === 'block') {
        if (scheduleHeaderTitle) scheduleHeaderTitle.textContent = '日程日历';
        if (scheduleCalendarView) scheduleCalendarView.style.display = 'block';
        if (scheduleContentMe) scheduleContentMe.style.display = 'none';
        if (scheduleContentHer) scheduleContentHer.style.display = 'none';
        if (saveScheduleBtn) saveScheduleBtn.style.display = 'none';
        renderCalendar();
      } else {
        scheduleModal.classList.remove('active');
      }
    });
  }

  function openScheduleWbModal() {
    if (!currentChatId) return;
    scheduleWbModal.classList.add('active');
    scheduleWbList.innerHTML = '';
    
    const allWorldbooks = largeStore.get('worldbook_items', []);
    const selectedWbs = largeStore.get('love_journal_wbs_' + currentChatId, []);
    
    if (allWorldbooks.length === 0) {
      scheduleWbList.innerHTML = '<div style="text-align: center; color: #86868b;">系统内暂无世界书</div>';
      return;
    }
    
    allWorldbooks.forEach(wb => {
      const item = document.createElement('div');
      item.className = 'api-preset-item';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.marginBottom = '10px';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.marginRight = '10px';
      checkbox.checked = selectedWbs.includes(wb.id);
      
      checkbox.addEventListener('change', () => {
        let currentSelected = largeStore.get('love_journal_wbs_' + currentChatId, []);
        if (checkbox.checked) {
          if (!currentSelected.includes(wb.id)) currentSelected.push(wb.id);
        } else {
          currentSelected = currentSelected.filter(id => id !== wb.id);
        }
        largeStore.put('love_journal_wbs_' + currentChatId, currentSelected);
      });
      
      const nameEl = document.createElement('span');
      nameEl.textContent = wb.name || '未命名世界书';
      
      item.appendChild(checkbox);
      item.appendChild(nameEl);
      scheduleWbList.appendChild(item);
    });
  }

  if (settingMeScheduleBtn) {
    settingMeScheduleBtn.addEventListener('click', openScheduleWbModal);
  }
  if (settingHerScheduleBtn) {
    settingHerScheduleBtn.addEventListener('click', openScheduleWbModal);
  }
  if (closeScheduleWbModal) {
    closeScheduleWbModal.addEventListener('click', () => {
      scheduleWbModal.classList.remove('active');
    });
  }

  if (generateMeScheduleBtn) {
    generateMeScheduleBtn.addEventListener('click', async () => {
      if (!currentChatId) return;
      
      generateMeScheduleBtn.disabled = true;
      if (meScheduleLoading) {
        const meta = JSON.parse(localStorage.getItem('chat_meta_' + currentChatId) || '{}');
        const myName = meta.remark || meta.realName || '我';
        const selectedWbs = largeStore.get('love_journal_wbs_' + currentChatId, []);
        if (selectedWbs.length > 0) {
          meScheduleLoading.textContent = `正在根据人设和记忆、已选择的世界书生成【${myName}】日程规划...`;
        } else {
          meScheduleLoading.textContent = `正在根据人设和记忆生成【${myName}】日程规划...`;
        }
        meScheduleLoading.style.display = 'block';
      }
      if (meScheduleDisplay) meScheduleDisplay.innerHTML = '';

      try {
        const scheduleStr = await generateSchedule(currentChatId, 'generate', '', 'me');
        largeStore.put(`love_journal_me_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, scheduleStr);
        renderSchedule(scheduleStr, 'me', meScheduleDisplay);
      } catch (e) {
        alert('生成失败: ' + (e?.message || e));
        if (meScheduleDisplay) meScheduleDisplay.innerHTML = '<div style="text-align: center; color: #ff9f0a; margin-top: 50px;">生成失败，请重试。</div>';
      } finally {
        generateMeScheduleBtn.disabled = false;
        if (meScheduleLoading) meScheduleLoading.style.display = 'none';
      }
    });
  }

  if (updateMeScheduleBtn) {
    updateMeScheduleBtn.addEventListener('click', async () => {
      if (!currentChatId) return;
      
      const currentSchedule = largeStore.get(`love_journal_me_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, '');
      if (!currentSchedule) {
        alert('请先生成日程规划，然后再更新进度。');
        return;
      }
      
      updateMeScheduleBtn.disabled = true;
      if (meScheduleLoading) {
        meScheduleLoading.textContent = '正在结合当前时间与上下文更新进度...';
        meScheduleLoading.style.display = 'block';
      }

      try {
        const scheduleStr = await generateSchedule(currentChatId, 'update', currentSchedule, 'me');
        largeStore.put(`love_journal_me_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, scheduleStr);
        renderSchedule(scheduleStr, 'me', meScheduleDisplay);
      } catch (e) {
        alert('更新失败: ' + (e?.message || e));
      } finally {
        updateMeScheduleBtn.disabled = false;
        if (meScheduleLoading) meScheduleLoading.style.display = 'none';
      }
    });
  }

  if (importMeScheduleBtn) {
    importMeScheduleBtn.addEventListener('click', () => {
      if (!currentChatId) return;
      const tempSchedule = largeStore.get(`love_journal_me_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, '');
      if (!tempSchedule) {
        alert('请先生成日常');
        return;
      }
      largeStore.put(`love_journal_me_schedule_${currentChatId}_${selectedScheduleDateStr}`, tempSchedule);
      
      const selectedWbs = largeStore.get('love_journal_wbs_' + currentChatId, []);
      const allWbs = largeStore.get('worldbook_items', []);
      const wbContext = allWbs.filter(w => selectedWbs.includes(w.id)).map(w => `${w.name || ''}: ${w.content || ''}`).join('\n');
      
      largeStore.put('love_journal_imported_schedule_' + currentChatId, tempSchedule);
      largeStore.put('love_journal_imported_wbs_' + currentChatId, wbContext);
      
      alert('导入成功！已注入AI回复记忆中。');
    });
  }

  if (generateHerScheduleBtn) {
    generateHerScheduleBtn.addEventListener('click', async () => {
      if (!currentChatId) return;
      
      generateHerScheduleBtn.disabled = true;
      if (herScheduleLoading) {
        const userName = String(localStorage.getItem('chat_user_realname_' + currentChatId) || localStorage.getItem('chat_user_remark_' + currentChatId) || '用户').trim() || '用户';
        const selectedWbs = largeStore.get('love_journal_wbs_' + currentChatId, []);
        if (selectedWbs.length > 0) {
          herScheduleLoading.textContent = `正在根据人设和记忆、已选择的世界书生成【${userName}】日程规划...`;
        } else {
          herScheduleLoading.textContent = `正在根据人设和记忆生成【${userName}】日程规划...`;
        }
        herScheduleLoading.style.display = 'block';
      }
      if (herScheduleDisplay) herScheduleDisplay.innerHTML = '';

      try {
        const scheduleStr = await generateSchedule(currentChatId, 'generate', '', 'her');
        largeStore.put(`love_journal_her_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, scheduleStr);
        renderSchedule(scheduleStr, 'her', herScheduleDisplay);
      } catch (e) {
        alert('生成失败: ' + (e?.message || e));
        if (herScheduleDisplay) herScheduleDisplay.innerHTML = '<div style="text-align: center; color: #ff9f0a; margin-top: 50px;">生成失败，请重试。</div>';
      } finally {
        generateHerScheduleBtn.disabled = false;
        if (herScheduleLoading) herScheduleLoading.style.display = 'none';
      }
    });
  }

  if (updateHerScheduleBtn) {
    updateHerScheduleBtn.addEventListener('click', async () => {
      if (!currentChatId) return;
      
      const currentSchedule = largeStore.get(`love_journal_her_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, '');
      if (!currentSchedule) {
        alert('请先生成日程规划，然后再更新进度。');
        return;
      }
      
      updateHerScheduleBtn.disabled = true;
      if (herScheduleLoading) {
        herScheduleLoading.textContent = '正在结合当前时间与上下文更新进度...';
        herScheduleLoading.style.display = 'block';
      }

      try {
        const scheduleStr = await generateSchedule(currentChatId, 'update', currentSchedule, 'her');
        largeStore.put(`love_journal_her_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, scheduleStr);
        renderSchedule(scheduleStr, 'her', herScheduleDisplay);
      } catch (e) {
        alert('更新失败: ' + (e?.message || e));
      } finally {
        updateHerScheduleBtn.disabled = false;
        if (herScheduleLoading) herScheduleLoading.style.display = 'none';
      }
    });
  }

  if (importHerScheduleBtn) {
    importHerScheduleBtn.addEventListener('click', () => {
      if (!currentChatId) return;
      const tempSchedule = largeStore.get(`love_journal_her_schedule_temp_${currentChatId}_${selectedScheduleDateStr}`, '');
      if (!tempSchedule) {
        alert('请先生成日常');
        return;
      }
      largeStore.put(`love_journal_her_schedule_${currentChatId}_${selectedScheduleDateStr}`, tempSchedule);
      
      const selectedWbs = largeStore.get('love_journal_wbs_' + currentChatId, []);
      const allWbs = largeStore.get('worldbook_items', []);
      const wbContext = allWbs.filter(w => selectedWbs.includes(w.id)).map(w => `${w.name || ''}: ${w.content || ''}`).join('\n');
      
      largeStore.put('love_journal_imported_her_schedule_' + currentChatId, tempSchedule);
      largeStore.put('love_journal_imported_her_wbs_' + currentChatId, wbContext);
      
      alert('导入成功！已注入AI回复记忆中。');
    });
  }

  async function generateSchedule(chatId, mode = 'generate', currentScheduleStr = '', type = 'me') {
    const apiUrl = localStorage.getItem('api_url');
    const apiKey = localStorage.getItem('api_key');
    const modelName = localStorage.getItem('model_name') || 'gpt-3.5-turbo';
    const globalTemperatureRaw = parseFloat(localStorage.getItem('temperature') || '0.7');
    const globalTemperature = Number.isFinite(globalTemperatureRaw) ? globalTemperatureRaw : 0.7;

    if (!apiUrl || !apiKey) throw new Error('请先在设置中配置 API URL 和 Key');

    const persona = largeStore.get('chat_persona_' + chatId, '');
    const worldbookIds = largeStore.get('love_journal_wbs_' + chatId, []);
    const allWorldbooks = largeStore.get('worldbook_items', []);
    const boundWorldbooks = allWorldbooks.filter(wb => worldbookIds.includes(wb.id));
    const wbContext = boundWorldbooks.map(wb => `${wb.name || ''}: ${wb.content || ''}`).join('\n');

    const meta = JSON.parse(localStorage.getItem('chat_meta_' + chatId) || '{}');
    const myName = meta.remark || meta.realName || '我';
    const userName = String(localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || '用户').trim() || '用户';
    
    const history = largeStore.get('chat_history_' + chatId, []).slice(-10);
    const recentHistory = history
      .map(m => `${m.role === 'user' ? userName : myName}: ${m.content}`)
      .join('\n');
      
    const currentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const targetPerson = type === 'me' ? myName : userName;

    let prompt = '';
    
    if (mode === 'generate') {
        const wbPromptPart = wbContext ? `和世界书设定` : ``;
        const wbContextPart = wbContext ? `\n世界书背景：\n${wbContext}\n` : ``;

        prompt = `你是${myName}。请根据你的人设${wbPromptPart}，为【${targetPerson}】生成今天一整天的详细日程规划（就像早上刚醒来时写在备忘录上的待办清单）。
人设：
${persona || '无'}
${wbContextPart}
最近和${userName}的聊天记录：
${recentHistory || '无'}

要求：
1. 这是一个**纯粹客观的行程计划表**，详细列出今天从早到晚不同时间段的活动安排。
2. 绝对**不要**生成你对这些事情的感想、情绪，也**不要**写成日记或对聊天记录的总结。
3. 结合聊天记录中提到的待办事项（如果有），自然地穿插进符合【${targetPerson}】身份的日常工作、生活安排中。
4. 必须只返回一个 JSON 数组，不需要任何多余的解释。每个元素代表一个日程节点，包含以下字段：
   - "time": 时间段描述（如 "08:00 - 09:30" 或 "上午"）
   - "title": 具体的任务名称（如 "前往行草工作室"、"商业项目编曲"）
   - "desc": 该任务的具体执行细节规划（如 "准备整理编曲的音轨，与谢哥核对项目需求"），必须是客观陈述计划，绝对不要带个人感情或疲惫感。
   - "note": 必须为空字符串 ""。
   - "userNote": 必须为空字符串 ""。
   - "replyNote": 必须为空字符串 ""。
`;
    } else if (mode === 'update') {
        prompt = `你是${myName}。以下是【${targetPerson}】今天的原有日程规划：
${currentScheduleStr}

最近和${userName}的聊天记录：
${recentHistory || '无'}

现在的时间是：${currentTime}。

请你更新这个日程规划。
要求：
1. 保持原有的日程节点基本结构和时间顺序不变。
2. 对于时间在 ${currentTime} **之前**或**当前正在进行**的日程节点：
   - 如果原有的 "note"（批注）字段为空，请根据你的【人设】和【最近聊天记录】，补充角色在执行该日程时的真实感受或吐槽到 "note" 字段中，以第一人称“我”的口吻来写，展现陪伴感和情绪。
   - **如果原有的 "note" 字段已经有内容，绝对不要修改它，原样保留。**
3. 如果原有节点中有用户的批注（"userNote" 字段不为空），请你在 "replyNote" 字段中，以第一人称“我”的口吻，对用户的批注进行回复。如果没有用户批注，"replyNote" 保持为空字符串 ""。**如果 "replyNote" 已经有内容，不要覆盖，可以继续追加或保持原样。**
4. 对于时间在 ${currentTime} **之后**（还没发生）的日程节点，"note" 字段必须保持为空字符串 ""。
5. 必须只返回一个 JSON 数组，不需要任何多余的解释。字段要求同上："time", "title", "desc", "note", 并且包含原有的 "userNote"（如有）以及新生成的 "replyNote"。
`;
    }

    const messages = [{ role: 'user', content: prompt }];
    
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
    
    try {
      JSON.parse(content);
    } catch (e) {
      throw new Error('生成格式错误，不是有效的JSON');
    }
    
    return content;
  }

  if (saveScheduleBtn && scheduleModal) {
    saveScheduleBtn.addEventListener('click', () => {
      if (!currentChatId) return;
      const keyPrefix = currentScheduleTab === 'me' ? 'love_journal_me_schedule_' : 'love_journal_her_schedule_';
      const tempKeyPrefix = currentScheduleTab === 'me' ? 'love_journal_me_schedule_temp_' : 'love_journal_her_schedule_temp_';
      const tempSchedule = largeStore.get(`${tempKeyPrefix}${currentChatId}_${selectedScheduleDateStr}`, '');
      if (tempSchedule) {
        largeStore.put(`${keyPrefix}${currentChatId}_${selectedScheduleDateStr}`, tempSchedule);
        alert('日常与批注保存成功！');
      }
      
      // Go back to calendar
      if (scheduleHeaderTitle) scheduleHeaderTitle.textContent = '日程日历';
      if (scheduleCalendarView) scheduleCalendarView.style.display = 'block';
      if (scheduleContentMe) scheduleContentMe.style.display = 'none';
      if (scheduleContentHer) scheduleContentHer.style.display = 'none';
      if (saveScheduleBtn) saveScheduleBtn.style.display = 'none';
      renderCalendar();
    });
  }

  if (scheduleNavItems.length > 0) {
    scheduleNavItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        
        scheduleNavItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        currentScheduleTab = tab;

        // Reset to calendar view when switching tabs
        if (scheduleCalendarView) scheduleCalendarView.style.display = 'block';
        if (scheduleContentMe) scheduleContentMe.style.display = 'none';
        if (scheduleContentHer) scheduleContentHer.style.display = 'none';
        if (saveScheduleBtn) saveScheduleBtn.style.display = 'none';
        if (scheduleHeaderTitle) scheduleHeaderTitle.textContent = '日程日历';

        if (tab === 'me') {
          calendarContainer.classList.remove('theme-pink');
          calendarContainer.classList.add('theme-blue');
        } else if (tab === 'her') {
          calendarContainer.classList.remove('theme-blue');
          calendarContainer.classList.add('theme-pink');
        }
        renderCalendar();
      });
    });
  }

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
    saveSettingsBtn.addEventListener('click', async () => {
      if (tempWallpaper && currentChatId) {
        if (typeof mediaSaveFromDataUrl !== 'undefined') {
          try {
            const ref = await mediaSaveFromDataUrl('love_journal_wallpaper_' + currentChatId, tempWallpaper);
            localStorage.setItem('love_journal_wallpaper_' + currentChatId, ref);
          } catch(e) {}
        } else {
          localStorage.setItem('love_journal_wallpaper_' + currentChatId, tempWallpaper);
        }
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
    return largeStore.get('love_journal_line_chats_' + chatId, []);
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
      const contentHtml = String(msg.content || '').replace(/\n/g, '<br>');
      row.innerHTML = `<div class="line-bubble">${contentHtml}</div>`;
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
    const persona = largeStore.get('chat_persona_' + chatId, '');
    const worldbookIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
    const allWorldbooks = largeStore.get('worldbook_items', []);
    const boundWorldbooks = allWorldbooks.filter(wb => worldbookIds.includes(wb.id));
    const deathTokens = /(去世|已故|逝世|死亡|不在世|病故|过世|离世|驾鹤西去)/i;
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
      .map(wb => ({
        name: String(wb.name || '').trim(),
        category: String(wb.category || '未分类').trim(),
        summary: String(wb.content || '').replace(/\s+/g, ' ').trim().slice(0, 50)
      }))
      .filter(wb => wb.name)
      .slice(0, 10);
     const meta = JSON.parse(localStorage.getItem('chat_meta_' + chatId) || '{}');
    const myName = meta.remark || meta.realName || '我';
    const userName = String(localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || '用户').trim() || '用户';
        const history = largeStore.get('chat_history_' + chatId, []).slice(-8);
    const recentHistory = history
      .map(m => `${m.role === 'user' ? userName : myName}: ${m.content}`)
      .join('\n');
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
       const candidateRelationText = npcCandidates.length > 0
      ? npcCandidates.map(wb => `${wb.name}（${wb.category}）：${wb.summary || '无'}`).join('\n')
      : '无';
                   const prompt = `你是${myName}。
现在生成“${myName}手机里”的 LINE 聊天记录。
me就是${myName}，不是${userName}。
人设：
${persona || '无'}
常联系的人：
${candidateRelationText}
最近和${userName}的近况参考：
${recentHistory || '无'}
生成5组聊天。
5组聊天分配给不同联系人。
每组6-10句。
要像真的手机聊天，不要像编故事。
要符合${myName}的人设、联系人关系和最近状态。
和${userName}的近况只作为背景参考，不要把5组都写成和${userName}有关的延伸。
可以有敷衍、试探、嘴硬、停顿、话说一半。
summary像聊天列表预览。
只返回JSON数组。

输出格式：
[
  {"targetName":"名字","summary":"","messages":[{"role":"me","content":"..."},{"role":"other","content":"..."}]},
  {"targetName":"名字","summary":"","messages":[...]},
  {"targetName":"名字","summary":"","messages":[...]},
  {"targetName":"名字","summary":"","messages":[...]},
  {"targetName":"名字","summary":"","messages":[...}]}
]`;

    const messages = [
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
    console.log('LINE raw results:', results);
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
    largeStore.put('love_journal_line_chats_' + chatId, newChats.slice(0, 5));
  }
});
