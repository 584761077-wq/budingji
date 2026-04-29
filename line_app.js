function getLineUsersForWallet() {
    let users = [];
    try {
        users = JSON.parse(localStorage.getItem('line_home_users') || '[]');
    } catch (error) {
        users = [];
    }
    if (!Array.isArray(users)) return [];
    return users
        .map((item) => ({
            id: String(item?.id || '').trim(),
            name: String(item?.name || '').trim()
        }))
        .filter((item) => item.id && item.name);
}

function getCurrentLineUserForWallet() {
    const users = getLineUsersForWallet();
    if (!users.length) return null;
    const selectedId = String(localStorage.getItem('line_home_selected_user_id') || '').trim();
    return users.find((item) => item.id === selectedId) || users[0];
}

function normalizeWalletBills(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item === 'object').map((item) => ({
        id: String(item.id || `bill_${Date.now()}_${Math.random().toString(16).slice(2)}`),
        merchant: String(item.merchant || '').trim() || '账单',
        desc: String(item.desc || '').trim(),
        amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0,
        type: item.type === 'income' ? 'income' : 'expense',
        timestamp: Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : Date.now()
    }));
}

function normalizeLineWalletData(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const parsedBalance = Number(data.balance);
    return {
        balance: Number.isFinite(parsedBalance) ? Number(parsedBalance) : 0,
        mainCards: Array.isArray(data.mainCards) ? data.mainCards : [],
        familyCards: Array.isArray(data.familyCards) ? data.familyCards.filter((card) => card && card.source === 'real') : [],
        bills: normalizeWalletBills(data.bills)
    };
}

function readLineWalletByUserId(userId) {
    const key = `line_user_wallet_${String(userId || 'default').trim()}`;
    const raw = largeStore.get(key, null);
    if (!raw) return normalizeLineWalletData(null);
    if (typeof raw === 'string') {
        try {
            return normalizeLineWalletData(JSON.parse(raw));
        } catch (error) {
            return normalizeLineWalletData(null);
        }
    }
    return normalizeLineWalletData(raw);
}

function saveLineWalletByUserId(userId, wallet) {
    const key = `line_user_wallet_${String(userId || 'default').trim()}`;
    largeStore.put(key, normalizeLineWalletData(wallet));
}

function initChatSettingsLogic(chatRoomNameEl) {
    const settingsBtn = document.getElementById('chat-settings-btn');
    const modal = document.getElementById('chat-settings-modal');
    const closeBtn = document.getElementById('close-chat-settings');
    const saveBtn = document.getElementById('save-chat-settings');
    const clearChatBtn = document.getElementById('clear-chat-history-btn');
    const changeWallpaperBtn = document.getElementById('change-chat-wallpaper-btn');
    const chatWallpaperInput = document.getElementById('chat-wallpaper-input');

    const avatarWrapper = document.querySelector('.chat-profile-avatar-wrapper');
    const avatarInput = document.getElementById('chat-avatar-input');
    const avatarDisplay = document.getElementById('chat-settings-avatar');

    const realNameInput = document.getElementById('chat-settings-realname');
    const remarkInput = document.getElementById('chat-settings-remark');
    const personaInput = document.getElementById('chat-settings-persona');

    const userAvatarWrapper = document.querySelector('.chat-profile-avatar-wrapper.small-avatar');
    const userAvatarInput = document.getElementById('user-avatar-input');
    const userAvatarDisplay = document.getElementById('user-settings-avatar');

    const userRealNameInput = document.getElementById('user-settings-realname');
    const userRemarkInput = document.getElementById('user-settings-remark');
    const userPersonaInput = document.getElementById('user-settings-persona');
    const userPresetSelect = document.getElementById('chat-user-preset-select');
    const applyUserPresetBtn = document.getElementById('apply-chat-user-preset-btn');
    const lineUserStorageKey = 'line_home_users';
    const lineSelectedUserStorageKey = 'line_home_selected_user_id';

    const getDefaultUserAvatarSvg = () => '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    const escapePresetText = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getLineUserPresets = () => {
        const raw = JSON.parse(localStorage.getItem(lineUserStorageKey) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
            .map((item) => ({
                id: String(item?.id || '').trim(),
                name: String(item?.name || '').trim(),
                persona: String(item?.persona || ''),
                avatar: String(item?.avatar || '').trim()
            }))
            .filter((item) => item.id && item.name);
    };

    const renderUserPresetOptions = () => {
        if (!userPresetSelect) return;
        const presets = getLineUserPresets();
        const selectedId = String(localStorage.getItem(lineSelectedUserStorageKey) || '').trim();
        let optionsHtml = '<option value="">选择预设...</option>';
        presets.forEach((item) => {
            optionsHtml += `<option value="${escapePresetText(item.id)}">${escapePresetText(item.name)}</option>`;
        });
        userPresetSelect.innerHTML = optionsHtml;
        if (selectedId && presets.some((item) => item.id === selectedId)) {
            userPresetSelect.value = selectedId;
        } else if (presets.length > 0) {
            userPresetSelect.value = presets[0].id;
        }
    };

    const applyUserPresetById = (presetId) => {
        const id = String(presetId || '').trim();
        if (!id) return false;
        const presets = getLineUserPresets();
        const preset = presets.find((item) => item.id === id);
        if (!preset) return false;
        userRealNameInput.value = preset.name;
        userPersonaInput.value = preset.persona || '';
        if (preset.avatar) {
            userAvatarDisplay.innerHTML = `<img src="${preset.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            userAvatarDisplay.dataset.newAvatar = preset.avatar;
        } else {
            userAvatarDisplay.innerHTML = getDefaultUserAvatarSvg();
            delete userAvatarDisplay.dataset.newAvatar;
        }
        localStorage.setItem(lineSelectedUserStorageKey, preset.id);
        return true;
    };

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            if (!result) {
                reject(new Error('empty'));
                return;
            }
            resolve(result);
        };
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
    });

    const loadImageFromSrc = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('load failed'));
        img.src = src;
    });

    const prepareChatWallpaperSource = async (file) => {
        const dataUrl = await readFileAsDataUrl(file);
        const img = await loadImageFromSrc(dataUrl);
        const maxDim = 1920;
        const longest = Math.max(img.width, img.height);
        const scale = longest > 0 ? Math.min(1, maxDim / longest) : 1;
        if (scale >= 1) {
            return dataUrl;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return dataUrl;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resized = canvas.toDataURL('image/jpeg', 0.86);
        return resized || dataUrl;
    };

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || '';
            if (!chatId) return;
            const meta = getChatMeta(chatId);
            const remarkName = getChatRemark(chatId);
            const persona = largeStore.get('chat_persona_' + chatId, '');
            const avatarSrc = localStorage.getItem('chat_avatar_' + chatId);

            realNameInput.value = meta.realName || '';
            remarkInput.value = remarkName;
            personaInput.value = persona;

            if (avatarSrc) {
                if (isMediaRef(avatarSrc)) {
                    avatarDisplay.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
                    mediaResolveRef(avatarSrc).then((url) => {
                        if (url) avatarDisplay.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    });
                } else {
                    avatarDisplay.innerHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            } else {
                avatarDisplay.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }

            const userRealName = localStorage.getItem('chat_user_realname_' + chatId) || '';
            const userRemark = localStorage.getItem('chat_user_remark_' + chatId) || '';
            const userPersona = largeStore.get('chat_user_persona_' + chatId, '');
            const userAvatarSrc = localStorage.getItem('chat_user_avatar_' + chatId);

            userRealNameInput.value = userRealName;
            userRemarkInput.value = userRemark;
            userPersonaInput.value = userPersona;
            renderUserPresetOptions();

            if (userAvatarSrc) {
                if (isMediaRef(userAvatarSrc)) {
                    userAvatarDisplay.innerHTML = getDefaultUserAvatarSvg();
                    mediaResolveRef(userAvatarSrc).then((url) => {
                        if (url) userAvatarDisplay.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    });
                } else {
                    userAvatarDisplay.innerHTML = `<img src="${userAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            } else {
                userAvatarDisplay.innerHTML = getDefaultUserAvatarSvg();
            }

            delete avatarDisplay.dataset.newAvatar;
            delete userAvatarDisplay.dataset.newAvatar;
            avatarInput.value = '';
            userAvatarInput.value = '';
            renderSelectedWorldBooks(chatId);
            modal.classList.add('active');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            delete avatarDisplay.dataset.newAvatar;
            delete userAvatarDisplay.dataset.newAvatar;
            avatarInput.value = '';
            userAvatarInput.value = '';
            modal.classList.remove('active');
        });
    }

    if (applyUserPresetBtn && userPresetSelect) {
        applyUserPresetBtn.addEventListener('click', () => {
            const applied = applyUserPresetById(userPresetSelect.value);
            if (!applied) {
                alert('请先选择一个预设');
            }
        });
    }

    if (changeWallpaperBtn && chatWallpaperInput) {
        changeWallpaperBtn.addEventListener('click', () => {
            chatWallpaperInput.value = '';
            chatWallpaperInput.click();
        });

        chatWallpaperInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            let src = '';
            try {
                src = await prepareChatWallpaperSource(file);
            } catch (error) {
                src = URL.createObjectURL(file);
            }
            let stored = false;
            if (src && src.startsWith('data:')) {
                try {
                    const ref = await mediaSaveFromDataUrl(getChatWallpaperStorageKey(chatId), src);
                    localStorage.setItem(getChatWallpaperStorageKey(chatId), ref);
                    stored = true;
                } catch (error) {
                    console.error('[Wallpaper] Save error:', error);
                    alert('壁纸保存失败，可能是由于存储空间不足或数据库错误。');
                    stored = false;
                }
            }
            if (stored) {
                setTempChatWallpaper(chatId, '');
            } else {
                if (!src) {
                    alert('图片读取失败，请重试。');
                    return;
                }
                setTempChatWallpaper(chatId, src);
            }
            applyChatWallpaper(chatId);
            chatWallpaperInput.value = '';
        });
    }

    if (avatarWrapper && avatarInput) {
        avatarWrapper.addEventListener('click', () => {
            avatarInput.value = '';
            avatarInput.click();
        });

        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const src = event.target.result;
                    avatarDisplay.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    avatarDisplay.dataset.newAvatar = src;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (userAvatarWrapper && userAvatarInput) {
        userAvatarWrapper.addEventListener('click', () => {
            userAvatarInput.value = '';
            userAvatarInput.click();
        });

        userAvatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const src = event.target.result;
                    userAvatarDisplay.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    userAvatarDisplay.dataset.newAvatar = src;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            if (!chatId) return;
            const newRealName = realNameInput.value.trim();
            const newRemark = remarkInput.value.trim();
            const newPersona = personaInput.value.trim();

            if (!newRealName) {
                alert('真名不能为空');
                return;
            }

            setChatRemark(chatId, newRemark);
            setChatMeta(chatId, { realName: newRealName, remark: newRemark });

            if (newPersona) {
                largeStore.put('chat_persona_' + chatId, newPersona);
            } else {
                largeStore.remove('chat_persona_' + chatId);
            }

            let newAvatarSrc = null;
            if (avatarDisplay.dataset.newAvatar) {
                newAvatarSrc = avatarDisplay.dataset.newAvatar;
                try {
                    if (typeof newAvatarSrc === 'string' && newAvatarSrc.startsWith('data:')) {
                        const ref = await mediaSaveFromDataUrl('chat_avatar_' + chatId, newAvatarSrc);
                        localStorage.setItem('chat_avatar_' + chatId, ref);
                        const url = await mediaResolveRef(ref);
                        newAvatarSrc = url || newAvatarSrc;
                    } else {
                        localStorage.setItem('chat_avatar_' + chatId, newAvatarSrc);
                    }
                } catch (e) {
                    localStorage.setItem('chat_avatar_' + chatId, newAvatarSrc);
                }
                delete avatarDisplay.dataset.newAvatar;
            } else {
                newAvatarSrc = localStorage.getItem('chat_avatar_' + chatId);
                if (isMediaRef(newAvatarSrc)) {
                    newAvatarSrc = await mediaResolveRef(newAvatarSrc) || '';
                }
            }

            const newUserRealName = userRealNameInput.value.trim();
            const newUserRemark = userRemarkInput.value.trim();
            const newUserPersona = userPersonaInput.value.trim();

            if (newUserRealName) {
                localStorage.setItem('chat_user_realname_' + chatId, newUserRealName);
            } else {
                localStorage.removeItem('chat_user_realname_' + chatId);
            }
            if (newUserRemark) {
                localStorage.setItem('chat_user_remark_' + chatId, newUserRemark);
            } else {
                localStorage.removeItem('chat_user_remark_' + chatId);
            }
            if (newUserPersona) {
                largeStore.put('chat_user_persona_' + chatId, newUserPersona);
            } else {
                largeStore.remove('chat_user_persona_' + chatId);
            }

            let newUserAvatarSrc = null;
            if (userAvatarDisplay.dataset.newAvatar) {
                newUserAvatarSrc = userAvatarDisplay.dataset.newAvatar;
                try {
                    if (typeof newUserAvatarSrc === 'string' && newUserAvatarSrc.startsWith('data:')) {
                        const ref = await mediaSaveFromDataUrl('chat_user_avatar_' + chatId, newUserAvatarSrc);
                        localStorage.setItem('chat_user_avatar_' + chatId, ref);
                        const url = await mediaResolveRef(ref);
                        newUserAvatarSrc = url || newUserAvatarSrc;
                    } else {
                        localStorage.setItem('chat_user_avatar_' + chatId, newUserAvatarSrc);
                    }
                } catch (e) {
                    localStorage.setItem('chat_user_avatar_' + chatId, newUserAvatarSrc);
                }
                delete userAvatarDisplay.dataset.newAvatar;
            } else {
                newUserAvatarSrc = localStorage.getItem('chat_user_avatar_' + chatId);
                if (isMediaRef(newUserAvatarSrc)) {
                    newUserAvatarSrc = await mediaResolveRef(newUserAvatarSrc) || '';
                }
            }

            chatRoomNameEl.textContent = newRemark || newRealName;
            chatRoomNameEl.dataset.chatId = chatId;
            applyChatWallpaper(chatId);
            updateLists(chatId, newRealName, newRemark, newAvatarSrc);
            refreshChatUserAvatars(newUserAvatarSrc);

            saveGlobalData();
            avatarInput.value = '';
            userAvatarInput.value = '';
            modal.classList.remove('active');
        });
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const shouldClear = confirm('确定清空当前聊天的全部消息吗？\n清空后会移除短期聊天记录与当前上下文，但会保留长期记忆和角色资料。');
            if (!shouldClear) return;

            largeStore.remove('chat_history_' + chatId);
            localStorage.removeItem('chat_last_message_' + chatId);
            localStorage.removeItem(getSummaryCursorKey(chatId));
            localStorage.removeItem(getUnreadCountKey(chatId));

            if (typeof chatHistoryViewStates !== 'undefined' && chatHistoryViewStates[chatId]) {
                delete chatHistoryViewStates[chatId];
            }

            const chatContent = document.querySelector('.chat-room-content');
            if (chatContent) {
                chatContent.innerHTML = '';
            }

            refreshChatListPreviewFor(chatId);
        });
    }

    function refreshChatUserAvatars(avatarSrc) {
        if (!avatarSrc) return;
        const chatContent = document.querySelector('.chat-room-content');
        const rightRows = chatContent.querySelectorAll('.message-row.right .message-avatar');
        rightRows.forEach((div) => {
            div.innerHTML = `<img src="${avatarSrc}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        });
    }

    function updateLists(chatId, newRealName, newRemark, newAvatarSrc) {
        const displayName = newRemark || newRealName || getChatDisplayName(chatId) || getChatRealName(chatId) || chatId;

        const friendItems = document.querySelectorAll('#friends-list .group-subitem');
        friendItems.forEach((item) => {
            if (item.dataset.chatId === chatId) {
                const span = item.querySelector('span');
                span.textContent = displayName;
                if (newAvatarSrc) {
                    const avatarDiv = item.querySelector('.subitem-avatar');
                    avatarDiv.innerHTML = `<img src="${newAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            }
        });

        const chatItems = document.querySelectorAll('#line-chat-list .chat-list-item');
        chatItems.forEach((item) => {
            if (item.dataset.chatId === chatId) {
                const nameDiv = item.querySelector('.chat-item-name');
                nameDiv.textContent = displayName;
                if (newAvatarSrc) {
                    const avatarDiv = item.querySelector('.chat-item-avatar');
                    avatarDiv.innerHTML = `<img src="${newAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            }
        });
    }

    initWorldBookBindingLogic(chatRoomNameEl);
    initMemorySettingsLogic(chatRoomNameEl);
    initTimeSettingsLogic(chatRoomNameEl);
    initBackgroundSettingsLogic(chatRoomNameEl);
}

function updateChatListItemPreview(chatId, chatItem) {
    const chatListContainer = document.getElementById('line-chat-list');
    if (!chatListContainer) return;
    const selectorName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(chatId) : chatId;
    const item = chatItem || chatListContainer.querySelector(`.chat-list-item[data-chat-id="${selectorName}"]`);
    if (!item) return;
    const meta = getLatestChatMessageMeta(chatId);
    const preview = buildChatListPreviewFromMessage(meta.message);
    const msgEl = item.querySelector('.chat-item-msg');
    if (msgEl) {
        msgEl.textContent = preview || '点击开始聊天';
    }
    const timeEl = item.querySelector('.chat-item-time');
    if (timeEl) {
        if (meta.ts) {
            const d = new Date(meta.ts);
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            if (d.toDateString() === now.toDateString()) {
                timeEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } else if (d.toDateString() === yesterday.toDateString()) {
                timeEl.textContent = '昨天';
            } else if (d.getFullYear() === now.getFullYear()) {
                timeEl.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
            } else {
                timeEl.textContent = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
            }
        } else {
            timeEl.textContent = '';
        }
    }
    item.dataset.lastTs = String(meta.ts || 0);
}

function sortChatListByLastMessage() {
    const chatListContainer = document.getElementById('line-chat-list');
    if (!chatListContainer) return;
    const items = Array.from(chatListContainer.querySelectorAll('.chat-list-item'));
    if (items.length <= 1) return;
    const ranked = items.map((item, index) => {
        const ts = Number(item.dataset.lastTs || 0);
        return { item, ts: Number.isFinite(ts) ? ts : 0, index };
    });
    ranked.sort((a, b) => {
        if (a.ts !== b.ts) return b.ts - a.ts;
        return a.index - b.index;
    });
    ranked.forEach(({ item }) => chatListContainer.appendChild(item));
}

function refreshChatListPreviewFor(chatId) {
    updateChatListItemPreview(chatId);
    sortChatListByLastMessage();
    if (typeof saveGlobalData === 'function') {
        saveGlobalData();
    }
}

function refreshChatListPreviews() {
    const chatListContainer = document.getElementById('line-chat-list');
    if (!chatListContainer) return;
    chatListContainer.querySelectorAll('.chat-list-item').forEach((item) => {
        const chatId = item.dataset.chatId || '';
        if (!chatId) return;
        updateChatListItemPreview(chatId, item);
    });
    sortChatListByLastMessage();
    if (typeof saveGlobalData === 'function') {
        saveGlobalData();
    }
}

function renderUnreadBadge(item, unreadCount) {
    if (!item) return;
    let badge = item.querySelector('.chat-item-unread');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'chat-item-unread hidden';
        item.appendChild(badge);
    }
    if (unreadCount > 0) {
        badge.classList.remove('hidden');
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    } else {
        badge.classList.add('hidden');
        badge.textContent = '';
    }
}

function refreshAllUnreadBadges() {
    document.querySelectorAll('#line-chat-list .chat-list-item').forEach((item) => {
        const chatId = item.dataset.chatId || '';
        if (!chatId) return;
        renderUnreadBadge(item, getUnreadCount(chatId));
    });
}

function saveGlobalData() {
    const friendsList = [];
    document.querySelectorAll('#friends-list .group-subitem').forEach((item) => {
        const chatId = item.dataset.chatId || '';
        if (chatId) friendsList.push(chatId);
    });
    localStorage.setItem('global_friends_list', JSON.stringify(friendsList));

    const chatList = [];
    document.querySelectorAll('#line-chat-list .chat-list-item').forEach((item) => {
        const chatId = item.dataset.chatId || '';
        if (chatId) chatList.push(chatId);
    });
    localStorage.setItem('global_chat_list', JSON.stringify(chatList));
}

function initGlobalPersistence() {
    const placeholderFriends = new Set(['Alice', 'Bob']);

    const rawSavedFriends = JSON.parse(localStorage.getItem('global_friends_list'));
    const savedFriends = Array.isArray(rawSavedFriends)
        ? rawSavedFriends.filter((name) => !placeholderFriends.has(String(name || '').trim()))
        : rawSavedFriends;
    if (Array.isArray(rawSavedFriends) && JSON.stringify(rawSavedFriends) !== JSON.stringify(savedFriends)) {
        localStorage.setItem('global_friends_list', JSON.stringify(savedFriends));
    }
    const friendsListContainer = document.getElementById('friends-list');

    if (savedFriends && friendsListContainer) {
        friendsListContainer.innerHTML = '';
        savedFriends.forEach((chatId) => {
            const remark = getChatRemark(chatId);
            const realName = getChatRealName(chatId) || chatId;
            const avatarRef = localStorage.getItem('chat_avatar_' + chatId);
            const displayName = remark || realName;

            const item = document.createElement('div');
            item.className = 'group-subitem';
            item.dataset.chatId = chatId;

            let avatarHtml = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            if (avatarRef && !isMediaRef(avatarRef)) {
                avatarHtml = `<img src="${avatarRef}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            }

            item.innerHTML = `
                <div class="subitem-avatar">
                    ${avatarHtml}
                </div>
                <span>${displayName}</span>
            `;
            friendsListContainer.appendChild(item);
            if (avatarRef && isMediaRef(avatarRef)) {
                mediaResolveRef(avatarRef).then((url) => {
                    const avatarDiv = item.querySelector('.subitem-avatar');
                    if (avatarDiv && url) {
                        avatarDiv.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    }
                });
            }
        });
    } else if (friendsListContainer) {
        friendsListContainer.querySelectorAll('.group-subitem').forEach((item) => {
            const span = item.querySelector('span');
            const realName = span.textContent.trim();
            const chatId = createChatId();
            item.dataset.chatId = chatId;
            setChatMeta(chatId, { realName, remark: '' });
        });
        saveGlobalData();
    }

    const rawSavedChats = JSON.parse(localStorage.getItem('global_chat_list'));
    const savedChats = Array.isArray(rawSavedChats)
        ? rawSavedChats.filter((name) => !placeholderFriends.has(String(name || '').trim()))
        : rawSavedChats;
    if (Array.isArray(rawSavedChats) && JSON.stringify(rawSavedChats) !== JSON.stringify(savedChats)) {
        localStorage.setItem('global_chat_list', JSON.stringify(savedChats));
    }
    const chatListContainer = document.getElementById('line-chat-list');

    if (savedChats && chatListContainer) {
        const emptyPlaceholder = chatListContainer.querySelector('.empty-chat-placeholder');
        if (emptyPlaceholder) {
            emptyPlaceholder.style.display = savedChats.length > 0 ? 'none' : 'block';
        }

        if (savedChats.length > 0) {
            chatListContainer.innerHTML = '';
            savedChats.forEach((chatId) => {
                const remark = getChatRemark(chatId);
                const realName = getChatRealName(chatId) || chatId;
                const avatarRef = localStorage.getItem('chat_avatar_' + chatId);
                const displayName = remark || realName;

                const item = document.createElement('div');
                item.className = 'chat-list-item';
                item.dataset.chatId = chatId;
                const unreadCount = getUnreadCount(chatId);

                let avatarHtml = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
                if (avatarRef && !isMediaRef(avatarRef)) {
                    avatarHtml = `<img src="${avatarRef}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }

                item.innerHTML = `
                    <div class="chat-item-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="chat-item-info">
                        <div class="chat-item-header">
                            <div class="chat-item-name">${displayName}</div>
                            <div class="chat-item-time"></div>
                        </div>
                        <div class="chat-item-msg">点击开始聊天</div>
                    </div>
                    <div class="chat-item-unread ${unreadCount > 0 ? '' : 'hidden'}">${unreadCount > 99 ? '99+' : unreadCount}</div>
                `;
                chatListContainer.appendChild(item);
                if (avatarRef && isMediaRef(avatarRef)) {
                    mediaResolveRef(avatarRef).then((url) => {
                        const avatarDiv = item.querySelector('.chat-item-avatar');
                        if (avatarDiv && url) {
                            avatarDiv.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                        }
                    });
                }
            });
        }
    }

    refreshChatListPreviews();
    refreshAllUnreadBadges();
}

function initAddFriendLogic() {
    const addChatBtn = document.getElementById('add-chat-btn');
    const modal = document.getElementById('add-friend-modal');
    const closeBtn = document.getElementById('close-add-friend');
    const confirmBtn = document.getElementById('confirm-add-friend');
    const nameInput = document.getElementById('new-friend-name');
    const remarkInput = document.getElementById('new-friend-remark');

    const friendsList = document.getElementById('friends-list');
    const chatList = document.getElementById('line-chat-list');
    const emptyPlaceholder = document.querySelector('.empty-chat-placeholder');

    if (addChatBtn) {
        addChatBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            nameInput.value = '';
            remarkInput.value = '';
            nameInput.focus();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const remark = remarkInput.value.trim();

            if (!name) {
                alert('请输入名字');
                return;
            }

            const displayName = remark || name;
            const chatId = createChatId();
            setChatMeta(chatId, { realName: name, remark });
            if (remark) {
                localStorage.setItem('chat_remark_' + chatId, remark);
            }

            const friendItem = document.createElement('div');
            friendItem.className = 'group-subitem';
            friendItem.dataset.chatId = chatId;

            friendItem.innerHTML = `
                <div class="subitem-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                <span>${displayName}</span>
            `;
            if (friendsList) {
                friendsList.insertBefore(friendItem, friendsList.firstChild);
                const friendGroupItem = document.querySelector('.line-group-item[data-target="friends-list"]');
                if (friendGroupItem && !friendGroupItem.classList.contains('active')) {
                    friendGroupItem.click();
                }
            }

            if (emptyPlaceholder) {
                emptyPlaceholder.style.display = 'none';
            }

            const chatItem = document.createElement('div');
            chatItem.className = 'chat-list-item';
            chatItem.dataset.chatId = chatId;

            chatItem.innerHTML = `
                <div class="chat-item-avatar">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-header">
                        <div class="chat-item-name">${displayName}</div>
                        <div class="chat-item-time"></div>
                    </div>
                    <div class="chat-item-msg">开始聊天吧</div>
                </div>
                <div class="chat-item-unread hidden"></div>
            `;
            if (chatList) {
                chatList.insertBefore(chatItem, chatList.firstChild);
            }
            refreshChatListPreviewFor(chatId);
            saveGlobalData();
            modal.style.display = 'none';
        });
    }
}

function initChatAdvancedSettingsLogic(chatRoomNameEl) {
    const advSettingsBtn = document.getElementById('chat-advanced-settings-btn');
    const modal = document.getElementById('chat-advanced-settings-modal');
    const closeBtn = document.getElementById('close-chat-advanced-settings');
    const saveBtn = document.getElementById('save-chat-advanced-settings');

    const replyCountMinInput = document.getElementById('chat-settings-reply-min');
    const replyCountMaxInput = document.getElementById('chat-settings-reply-max');

    const bilingualToggle = document.getElementById('chat-bilingual-toggle');
    const bilingualOptionsDiv = document.getElementById('chat-bilingual-options');
    const bilingualStyleRadios = document.getElementsByName('bilingual_style');
    const bilingualStyleDesc = document.getElementById('bilingual-style-desc');

    if (!advSettingsBtn || !modal) return;

    const updateBilingualDesc = (style) => {
        if (!bilingualStyleDesc) return;
        if (style === 'inside') {
            bilingualStyleDesc.textContent = '气泡内：在一个气泡里，中间用细横线分隔开，上面是翻译前的话，下面是翻译，翻译的字会小一点，颜色浅一点。';
        } else {
            bilingualStyleDesc.textContent = '气泡外：点击气泡后，像微信翻译那样在气泡下方显示翻译。';
        }
    };

    const syncFromStorage = () => {
        const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;

        const replyCountConfig = JSON.parse(localStorage.getItem('chat_reply_count_' + chatId) || '{"min":"","max":""}');
        if (replyCountMinInput) replyCountMinInput.value = replyCountConfig.min || '';
        if (replyCountMaxInput) replyCountMaxInput.value = replyCountConfig.max || '';

        const bilingualEnabled = localStorage.getItem('chat_bilingual_' + chatId) === 'true';
        if (bilingualToggle) {
            bilingualToggle.checked = bilingualEnabled;
            bilingualOptionsDiv.style.display = bilingualEnabled ? 'block' : 'none';
        }

        const bilingualStyle = localStorage.getItem('chat_bilingual_style_' + chatId) || 'outside';
        if (bilingualStyleRadios) {
            for (const radio of bilingualStyleRadios) {
                if (radio.value === bilingualStyle) radio.checked = true;
            }
        }
        updateBilingualDesc(bilingualStyle);
    };

    advSettingsBtn.addEventListener('click', () => {
        syncFromStorage();
        openAppModal(modal);
    });

    if (bilingualToggle) {
        bilingualToggle.addEventListener('change', () => {
            bilingualOptionsDiv.style.display = bilingualToggle.checked ? 'block' : 'none';
        });
    }

    if (bilingualStyleRadios) {
        for (const radio of bilingualStyleRadios) {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    updateBilingualDesc(e.target.value);
                }
            });
        }
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;

            const minVal = replyCountMinInput ? replyCountMinInput.value.trim() : '';
            const maxVal = replyCountMaxInput ? replyCountMaxInput.value.trim() : '';
            if (minVal || maxVal) {
                localStorage.setItem('chat_reply_count_' + chatId, JSON.stringify({ min: minVal, max: maxVal }));
            } else {
                localStorage.removeItem('chat_reply_count_' + chatId);
            }

            if (bilingualToggle) {
                localStorage.setItem('chat_bilingual_' + chatId, bilingualToggle.checked ? 'true' : 'false');
            }

            if (bilingualStyleRadios) {
                let selectedStyle = 'outside';
                for (const radio of bilingualStyleRadios) {
                    if (radio.checked) selectedStyle = radio.value;
                }
                localStorage.setItem('chat_bilingual_style_' + chatId, selectedStyle);
            }

            closeAppModal(modal);
        });
    }
}

function initBackgroundSettingsLogic(chatRoomNameEl) {
    const bgSettingsBtn = document.getElementById('background-settings-btn');
    const modal = document.getElementById('background-settings-modal');
    const closeBtn = document.getElementById('close-background-settings');
    const saveBtn = document.getElementById('save-background-settings');
    const toggle = document.getElementById('background-activity-toggle');
    const optionsDiv = document.getElementById('background-activity-options');
    const intervalInput = document.getElementById('background-activity-interval');

    if (!bgSettingsBtn || !modal || !toggle || !intervalInput) return;

    const syncFromStorage = () => {
        const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
        const isEnabled = localStorage.getItem(getBackgroundActivityEnabledKey(chatId)) === 'true';
        toggle.checked = isEnabled;
        optionsDiv.style.display = isEnabled ? 'block' : 'none';

        const interval = localStorage.getItem(getBackgroundActivityIntervalKey(chatId));
        intervalInput.value = interval ? interval : '10';
    };

    bgSettingsBtn.addEventListener('click', () => {
        syncFromStorage();
        openAppModal(modal);
    });

    toggle.addEventListener('change', () => {
        optionsDiv.style.display = toggle.checked ? 'block' : 'none';
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            localStorage.setItem(getBackgroundActivityEnabledKey(chatId), toggle.checked ? 'true' : 'false');

            const intervalVal = parseInt(intervalInput.value, 10);
            if (!isNaN(intervalVal) && intervalVal > 0) {
                localStorage.setItem(getBackgroundActivityIntervalKey(chatId), String(intervalVal));
            } else {
                localStorage.setItem(getBackgroundActivityIntervalKey(chatId), '10');
            }

            if (toggle.checked) {
                localStorage.setItem(getBackgroundActivityLastTriggerKey(chatId), String(Date.now()));
            }

            closeAppModal(modal);
        });
    }
}

function initTimeSettingsLogic(chatRoomNameEl) {
    const timeSettingsBtn = document.getElementById('time-settings-btn');
    const modal = document.getElementById('time-settings-modal');
    const closeBtn = document.getElementById('close-time-settings');
    const saveBtn = document.getElementById('save-time-settings');
    const syncToggle = document.getElementById('time-sync-toggle');
    const timeZoneToggle = document.getElementById('time-zone-sync-toggle');
    const timeZoneBody = document.getElementById('time-zone-settings-body');
    const userCityInput = document.getElementById('user-city-input');
    const charCityInput = document.getElementById('char-city-input');
    const userTimeZoneSelect = document.getElementById('user-timezone-select');
    const charTimeZoneSelect = document.getElementById('char-timezone-select');
    const previewEl = document.getElementById('time-zone-preview');
    const weatherMapToggle = document.getElementById('weather-map-toggle');
    const weatherMapBody = document.getElementById('weather-map-settings-body');
    const userWeatherPlaceInput = document.getElementById('user-weather-place-input');
    const userWeatherRealInput = document.getElementById('user-weather-real-input');
    const charWeatherPlaceInput = document.getElementById('char-weather-place-input');
    const charWeatherRealInput = document.getElementById('char-weather-real-input');
    const weatherMapPreviewEl = document.getElementById('weather-map-preview');
    const weatherMapStatusEls = [
        document.getElementById('user-weather-map-status'),
        document.getElementById('char-weather-map-status')
    ];

    if (!timeSettingsBtn || !modal || !syncToggle) return;

    const allTimeZones = (() => {
        try {
            if (typeof Intl.supportedValuesOf === 'function') {
                return Intl.supportedValuesOf('timeZone');
            }
        } catch (_) {}
        return [
            'Asia/Shanghai',
            'Asia/Tokyo',
            'Asia/Seoul',
            'Asia/Singapore',
            'Europe/London',
            'Europe/Paris',
            'America/New_York',
            'America/Los_Angeles',
            'Australia/Sydney'
        ];
    })();

    const ensureTimeZoneSelectOptions = () => {
        if (!userTimeZoneSelect || !charTimeZoneSelect) return;
        if (userTimeZoneSelect.options.length > 0 && charTimeZoneSelect.options.length > 0) return;
        userTimeZoneSelect.innerHTML = '';
        charTimeZoneSelect.innerHTML = '';
        allTimeZones.forEach((tz) => {
            const safeTz = String(tz || '').trim();
            if (!safeTz) return;
            const userOpt = document.createElement('option');
            userOpt.value = safeTz;
            userOpt.textContent = safeTz;
            userTimeZoneSelect.appendChild(userOpt);

            const charOpt = document.createElement('option');
            charOpt.value = safeTz;
            charOpt.textContent = safeTz;
            charTimeZoneSelect.appendChild(charOpt);
        });
    };

    const getCurrentChatId = () => chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;

    const updateTimeZonePreview = () => {
        if (!timeZoneBody || !previewEl || !timeZoneToggle || !userTimeZoneSelect || !charTimeZoneSelect) return;
        timeZoneBody.style.display = timeZoneToggle.checked ? 'block' : 'none';
        if (!timeZoneToggle.checked) {
            previewEl.textContent = '开启后将显示双方当前时间与时差。';
            return;
        }

        const userZone = normalizeTimeZone(userTimeZoneSelect.value, getDefaultTimeZone());
        const charZone = normalizeTimeZone(charTimeZoneSelect.value, userZone);
        const now = new Date();
        const userTime = formatTimeInZone(userZone, now);
        const charTime = formatTimeInZone(charZone, now);
        const userOffset = getTimeZoneOffsetMinutes(userZone, now);
        const charOffset = getTimeZoneOffsetMinutes(charZone, now);
        const diffHours = (charOffset - userOffset) / 60;
        const userCity = String((userCityInput && userCityInput.value) || '').trim() || '我';
        const charCity = String((charCityInput && charCityInput.value) || '').trim() || 'TA';
        const diffLabel = `${diffHours >= 0 ? '+' : ''}${diffHours}h`;
        previewEl.textContent = `${userCity} ${userTime}（${userZone}）\n${charCity} ${charTime}（${charZone}）\n时差：${diffLabel}（TA-我）`;
    };

    const updateWeatherMapPreview = async () => {
        if (!weatherMapBody || !weatherMapPreviewEl || !weatherMapToggle) return;
        weatherMapBody.style.display = weatherMapToggle.checked ? 'block' : 'none';
        if (!weatherMapToggle.checked) {
            weatherMapPreviewEl.textContent = '开启后可为双方虚构地名映射真实地区天气。';
            weatherMapStatusEls.forEach((el) => { if (el) el.textContent = ''; });
            return;
        }
        const userPlace = String((userWeatherPlaceInput && userWeatherPlaceInput.value) || '').trim() || '我的虚构地名';
        const userReal = String((userWeatherRealInput && userWeatherRealInput.value) || '').trim();
        const charPlace = String((charWeatherPlaceInput && charWeatherPlaceInput.value) || '').trim() || 'TA 的虚构地名';
        const charReal = String((charWeatherRealInput && charWeatherRealInput.value) || '').trim();
        weatherMapPreviewEl.textContent = `${userPlace} → ${userReal || '真实地区'}\n${charPlace} → ${charReal || '真实地区'}`;
        const chatId = getCurrentChatId();
        const data = await buildWeatherMapComputedData(chatId);
        const render = (item, el) => {
            if (!el) return;
            el.textContent = item?.status ? `${item.place || ''}：${item.status}${item.geo ? `｜坐标 ${Number(item.geo.latitude).toFixed(2)}, ${Number(item.geo.longitude).toFixed(2)}` : ''}${item.weather ? `｜${item.weather.summary} ${item.weather.temperature}°C` : ''}` : '';
        };
        render(data.user, weatherMapStatusEls[0]);
        render(data.char, weatherMapStatusEls[1]);
    };

    const syncFromStorage = () => {
        const chatId = getCurrentChatId();
        syncToggle.checked = localStorage.getItem(getTimeSyncEnabledKey(chatId)) === 'true';
        if (!timeZoneToggle || !userTimeZoneSelect || !charTimeZoneSelect) return;
        ensureTimeZoneSelectOptions();
        const cfg = readTimeZoneConfig(chatId);
        timeZoneToggle.checked = cfg.enabled;
        if (userCityInput) userCityInput.value = cfg.userCity;
        if (charCityInput) charCityInput.value = cfg.charCity;
        userTimeZoneSelect.value = cfg.userTimeZone;
        charTimeZoneSelect.value = cfg.charTimeZone;
        updateTimeZonePreview();
        if (weatherMapToggle) {
            weatherMapToggle.checked = localStorage.getItem(getWeatherMapEnabledKey(chatId)) === 'true';
            if (userWeatherPlaceInput) userWeatherPlaceInput.value = localStorage.getItem(getUserWeatherPlaceKey(chatId)) || '';
            if (userWeatherRealInput) userWeatherRealInput.value = localStorage.getItem(getUserWeatherRealKey(chatId)) || '';
            if (charWeatherPlaceInput) charWeatherPlaceInput.value = localStorage.getItem(getCharWeatherPlaceKey(chatId)) || '';
            if (charWeatherRealInput) charWeatherRealInput.value = localStorage.getItem(getCharWeatherRealKey(chatId)) || '';
            updateWeatherMapPreview();
        }
    };

    timeSettingsBtn.addEventListener('click', () => {
        syncFromStorage();
        openAppModal(modal);
    });

    [timeZoneToggle, userCityInput, charCityInput, userTimeZoneSelect, charTimeZoneSelect]
        .filter(Boolean)
        .forEach((el) => {
            el.addEventListener('change', updateTimeZonePreview);
            el.addEventListener('input', updateTimeZonePreview);
        });

    [weatherMapToggle, userWeatherPlaceInput, userWeatherRealInput, charWeatherPlaceInput, charWeatherRealInput]
        .filter(Boolean)
        .forEach((el) => {
            el.addEventListener('change', updateWeatherMapPreview);
            el.addEventListener('input', updateWeatherMapPreview);
        });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const chatId = getCurrentChatId();
            localStorage.setItem(getTimeSyncEnabledKey(chatId), syncToggle.checked ? 'true' : 'false');
            if (timeZoneToggle && userTimeZoneSelect && charTimeZoneSelect) {
                localStorage.setItem(getTimeZoneSyncEnabledKey(chatId), timeZoneToggle.checked ? 'true' : 'false');
                localStorage.setItem(getUserTimeZoneKey(chatId), normalizeTimeZone(userTimeZoneSelect.value, getDefaultTimeZone()));
                localStorage.setItem(getCharTimeZoneKey(chatId), normalizeTimeZone(charTimeZoneSelect.value, getDefaultTimeZone()));
                localStorage.setItem(getUserCityKey(chatId), String((userCityInput && userCityInput.value) || '').trim());
                localStorage.setItem(getCharCityKey(chatId), String((charCityInput && charCityInput.value) || '').trim());
                updateChatTimeZoneIndicator(chatId);
            }
            if (weatherMapToggle) {
                localStorage.setItem(getWeatherMapEnabledKey(chatId), weatherMapToggle.checked ? 'true' : 'false');
                localStorage.setItem(getUserWeatherPlaceKey(chatId), String((userWeatherPlaceInput && userWeatherPlaceInput.value) || '').trim());
                localStorage.setItem(getUserWeatherRealKey(chatId), String((userWeatherRealInput && userWeatherRealInput.value) || '').trim());
                localStorage.setItem(getCharWeatherPlaceKey(chatId), String((charWeatherPlaceInput && charWeatherPlaceInput.value) || '').trim());
                localStorage.setItem(getCharWeatherRealKey(chatId), String((charWeatherRealInput && charWeatherRealInput.value) || '').trim());
            }
            closeAppModal(modal);
        });
    }
}

function initMemorySettingsLogic(chatRoomNameEl) {
    const memoryBtn = document.getElementById('memory-settings-btn');
    const modal = document.getElementById('memory-settings-modal');
    const memoryTokenBtn = document.getElementById('memory-token-settings-btn');
    const memoryTokenModal = document.getElementById('memory-token-settings-modal');
    const closeBtn = document.getElementById('close-memory-settings');
    const saveBtn = document.getElementById('save-memory-settings');
    const closeMemoryTokenBtn = document.getElementById('close-memory-token-settings');
    const saveMemoryTokenBtn = document.getElementById('save-memory-token-settings');
    const memoryTokenDistributionEl = document.getElementById('memory-token-distribution');
    const input = document.getElementById('memory-context-limit');
    const summaryInput = document.getElementById('memory-summary-limit');
    const autoSummaryToggle = document.getElementById('memory-auto-summary-toggle');
    const runSummaryBtn = document.getElementById('run-memory-summary-btn');
    const diaryListEl = document.getElementById('memory-diary-list');
    const diaryMessageCountEl = document.getElementById('memory-diary-message-count');
    const diaryDetailOverlay = document.getElementById('memory-diary-detail-overlay');
    const closeDiaryDetailBtn = document.getElementById('close-memory-diary-detail');
    const diaryEditBtn = document.getElementById('memory-diary-note-edit');
    const diaryDeleteBtn = document.getElementById('memory-diary-note-delete');
    const diaryDetailTitle = document.getElementById('memory-diary-detail-title');
    const diaryDetailView = document.getElementById('memory-diary-detail-view');
    const diaryDetailContent = document.getElementById('memory-diary-detail-content');
    let activeDiaryId = null;
    let isDiaryEditing = false;

    const formatTime = (ts) => {
        const d = new Date(ts);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${y}年${m}月${day}日 ${hh}:${mm}`;
    };

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const estimateTokens = (text) => {
        const raw = String(text || '');
        if (!raw.trim()) return 0;
        const chineseCharCount = (raw.match(/[\u4e00-\u9fff]/g) || []).length;
        const latinWordCount = (raw.match(/[a-zA-Z0-9_]+/g) || []).length;
        const punctuationCount = (raw.match(/[^\s\u4e00-\u9fff\w]/g) || []).length;
        return chineseCharCount + Math.ceil(latinWordCount * 1.3) + Math.ceil(punctuationCount * 0.3);
    };

    const countLocalImageTags = (content) => {
        return extractLocalImageSources(content).length;
    };

    const buildTokenStats = (chatId) => {
        const history = largeStore.get('chat_history_' + chatId, []);
        const safeHistory = Array.isArray(history) ? history : [];
        const personaText = largeStore.get('chat_persona_' + chatId, '');
        const longTermMemory = getMemoryDiaries(chatId).map((item) => String(item?.content || '').trim()).filter(Boolean).join('\n');
        const limit = Math.max(1, parseInt(localStorage.getItem('chat_context_limit_' + chatId) || '100', 10) || 100);
        const contextHistory = safeHistory.slice(Math.max(0, safeHistory.length - limit), safeHistory.length);
        const contextText = contextHistory.map((msg) => {
            const role = String(msg?.role || 'unknown').trim() || 'unknown';
            return `[${role}] ${normalizeMemoryMessageContent(msg?.content)}`;
        }).join('\n');

        const wbIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
        const allWbItems = largeStore.get('worldbook_items', []);
        const safeWbIds = Array.isArray(wbIds) ? wbIds : [];
        const safeWbItems = Array.isArray(allWbItems) ? allWbItems : [];
        const boundWorldbooks = safeWbIds.map((id) => safeWbItems.find((item) => String(item.id) === String(id))).filter(Boolean);
        const worldbookText = boundWorldbooks.map((item) => {
            const itemKeywords = item.keywords ? `关键词: ${item.keywords}` : '关键词: 无';
            return `- ${item.name}\n  分类: ${item.category || '未分类'}\n  ${itemKeywords}\n  内容: ${item.content || ''}`;
        }).join('\n');
        const diaryCount = getMemoryDiaries(chatId).length;

        let localImageCount = 0;
        const localImageText = safeHistory.map((msg) => {
            if (msg && msg.role === 'user') {
                const imageSources = extractLocalImageSources(msg.content);
                localImageCount += imageSources.length;
                return imageSources.length > 0 ? imageSources.map((src) => `[本地图片:${src}]`).join('\n') : '';
            }
            return '';
        }).filter(Boolean).join('\n');

        return [
            { key: 'persona', label: '人设TK', tokens: estimateTokens(personaText), count: personaText.trim() ? 1 : 0 },
            { key: 'worldbook', label: '已绑定的世界书TK', tokens: estimateTokens(worldbookText), count: boundWorldbooks.length },
            { key: 'context', label: '设置的上下文TK', tokens: estimateTokens(contextText), count: contextHistory.length },
            { key: 'diary', label: '总结的日记TK', tokens: estimateTokens(longTermMemory), count: diaryCount },
            { key: 'image', label: '本地图片TK', tokens: estimateTokens(localImageText), count: localImageCount }
        ];
    };

    const renderTokenDistribution = (chatId) => {
        if (!memoryTokenDistributionEl) return;
        const sections = buildTokenStats(chatId);
        const roleList = sections.filter((item) => item.tokens > 0 || item.count > 0);
        const totalTokens = sections.reduce((sum, item) => sum + item.tokens, 0);
        const totalMessages = sections.reduce((sum, item) => sum + item.count, 0);

        if (totalTokens === 0 && totalMessages === 0) {
            memoryTokenDistributionEl.innerHTML = '<div class="memory-token-empty">当前角色暂无聊天记录</div>';
            return;
        }

        memoryTokenDistributionEl.innerHTML = `
            <div class="memory-token-summary">
                <div class="memory-token-summary-item">
                    <span class="memory-token-summary-label">总Token估算</span>
                    <span class="memory-token-summary-value">${totalTokens}</span>
                </div>
                <div class="memory-token-summary-item">
                    <span class="memory-token-summary-label">总来源条目</span>
                    <span class="memory-token-summary-value">${totalMessages}</span>
                </div>
            </div>
            <div class="memory-token-role-list">
                ${roleList.map((item) => {
                    const ratio = totalTokens > 0 ? Math.round((item.tokens / totalTokens) * 1000) / 10 : 0;
                    return `
                        <div class="memory-token-role-item">
                            <div class="memory-token-role-header">
                                <span class="memory-token-role-name">${item.label}</span>
                                <span class="memory-token-role-ratio">${ratio}%</span>
                            </div>
                            <div class="memory-token-bar-track">
                                <div class="memory-token-bar-fill" style="width: ${Math.max(0, Math.min(ratio, 100))}%;"></div>
                            </div>
                            <div class="memory-token-role-meta">
                                <span>Token: ${item.tokens}</span>
                                <span>条目: ${item.count}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    const renderDiaryList = (chatId) => {
        if (!diaryListEl) return;
        if (diaryMessageCountEl) {
            const history = largeStore.get('chat_history_' + chatId, []);
            const count = Array.isArray(history) ? history.length : 0;
            diaryMessageCountEl.textContent = `消息 ${count} 条`;
        }
        const diaries = getMemoryDiaries(chatId).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        if (diaries.length === 0) {
            diaryListEl.innerHTML = '<div class="memory-diary-empty">暂无日记</div>';
            return;
        }

        diaryListEl.innerHTML = diaries.map((item) => `
            <button class="memory-diary-item" type="button" data-id="${item.id}">
                <span class="memory-diary-time">${formatTime(item.createdAt)}</span>
                <span class="memory-diary-preview">${escapeHtml((item.content || '').replace(/\s+/g, ' ').trim())}</span>
            </button>
        `).join('');
    };

    const openDiaryDetail = (chatId, diaryId) => {
        const diaries = getMemoryDiaries(chatId);
        const diary = diaries.find((item) => item.id === diaryId);
        if (!diary) return;
        activeDiaryId = diary.id;
        diaryDetailTitle.textContent = formatTime(diary.createdAt);
        const content = diary.content || '';
        if (diaryDetailView) {
            diaryDetailView.textContent = content;
        }
        diaryDetailContent.value = content;
        isDiaryEditing = false;
        if (diaryDetailView) diaryDetailView.style.display = 'block';
        if (diaryDetailContent) diaryDetailContent.style.display = 'none';
        if (diaryEditBtn) diaryEditBtn.textContent = '编辑';
        diaryDetailOverlay.style.display = 'flex';
    };

    const closeDiaryDetail = () => {
        diaryDetailOverlay.style.display = 'none';
        activeDiaryId = null;
        isDiaryEditing = false;
    };

    const setDiaryEditMode = (enabled) => {
        isDiaryEditing = enabled;
        if (diaryDetailView) diaryDetailView.style.display = enabled ? 'none' : 'block';
        if (diaryDetailContent) diaryDetailContent.style.display = enabled ? 'block' : 'none';
        if (diaryEditBtn) diaryEditBtn.textContent = enabled ? '保存' : '编辑';
        if (enabled && diaryDetailContent) {
            setTimeout(() => diaryDetailContent.focus(), 0);
        }
    };

    if (memoryBtn) {
        memoryBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const savedLimit = localStorage.getItem('chat_context_limit_' + chatId) || '100';
            const savedSummaryLimit = localStorage.getItem(getSummaryLimitKey(chatId)) || '30';
            const autoSummaryEnabled = localStorage.getItem(getAutoSummaryEnabledKey(chatId)) === 'true';
            input.value = savedLimit;
            summaryInput.value = savedSummaryLimit;
            if (autoSummaryToggle) {
                autoSummaryToggle.checked = autoSummaryEnabled;
            }
            ensureSummaryCursor(chatId);
            syncMemoryLongTerm(chatId);
            renderDiaryList(chatId);
            openAppModal(modal);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const rawLimit = input.value.trim();
            const normalizedLimit = Math.max(1, parseInt(rawLimit || '100', 10) || 100);
            localStorage.setItem('chat_context_limit_' + chatId, String(normalizedLimit));
            input.value = String(normalizedLimit);

            const normalizedSummaryLimit = normalizeMemorySummaryInput(summaryInput.value);
            localStorage.setItem(getSummaryLimitKey(chatId), String(normalizedSummaryLimit));
            summaryInput.value = String(normalizedSummaryLimit);
            if (autoSummaryToggle) {
                localStorage.setItem(getAutoSummaryEnabledKey(chatId), autoSummaryToggle.checked ? 'true' : 'false');
            }

            const originalText = saveBtn.textContent;
            saveBtn.textContent = '已存';
            saveBtn.style.backgroundColor = '#333';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.backgroundColor = '#000000';
                closeAppModal(modal);
            }, 500);
        });
    }

    if (memoryTokenBtn) {
        memoryTokenBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            renderTokenDistribution(chatId);
            openAppModal(memoryTokenModal);
        });
    }

    if (closeMemoryTokenBtn) {
        closeMemoryTokenBtn.addEventListener('click', () => {
            closeAppModal(memoryTokenModal);
        });
    }

    if (saveMemoryTokenBtn) {
        saveMemoryTokenBtn.addEventListener('click', () => {
            closeAppModal(memoryTokenModal);
        });
    }

    const manualSummaryModal = document.getElementById('manual-summary-modal');
    const closeManualSummaryBtn = document.getElementById('close-manual-summary');
    const startManualSummaryBtn = document.getElementById('start-manual-summary-btn');
    const manualSummaryInfo = document.getElementById('manual-summary-info');
    const manualSummaryStartInput = document.getElementById('manual-summary-start');
    const manualSummaryEndInput = document.getElementById('manual-summary-end');

    if (runSummaryBtn) {
        runSummaryBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const history = largeStore.get('chat_history_' + chatId, []);
            const cursor = ensureSummaryCursor(chatId);
            const total = history.length;

            if (manualSummaryInfo) {
                manualSummaryInfo.textContent = `共 ${total} 条消息，已总结至第 ${cursor} 条`;
            }

            const batchSize = normalizeMemorySummaryInput(summaryInput.value);
            const suggestStart = cursor + 1;
            const suggestEnd = Math.min(total, cursor + batchSize);

            if (manualSummaryStartInput) manualSummaryStartInput.value = suggestStart <= total ? suggestStart : (total > 0 ? total : 1);
            if (manualSummaryEndInput) manualSummaryEndInput.value = suggestEnd > 0 ? suggestEnd : batchSize;

            openAppModal(manualSummaryModal);
        });
    }

    if (closeManualSummaryBtn) {
        closeManualSummaryBtn.addEventListener('click', () => {
            closeAppModal(manualSummaryModal);
        });
    }

    if (startManualSummaryBtn) {
        startManualSummaryBtn.addEventListener('click', async () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const start = parseInt(manualSummaryStartInput.value, 10);
            const end = parseInt(manualSummaryEndInput.value, 10);

            if (isNaN(start) || isNaN(end)) {
                showApiErrorModal('请输入有效的数字');
                return;
            }

            const originalText = startManualSummaryBtn.textContent;
            startManualSummaryBtn.textContent = '总结中...';
            startManualSummaryBtn.disabled = true;

            try {
                await runRangeSummary(chatId, start, end);
                renderDiaryList(chatId);
                closeAppModal(manualSummaryModal);
            } catch (error) {
                showApiErrorModal(error.message || '总结失败');
            } finally {
                startManualSummaryBtn.textContent = originalText;
                startManualSummaryBtn.disabled = false;
            }
        });
    }

    if (diaryListEl) {
        diaryListEl.addEventListener('click', (e) => {
            const item = e.target.closest('.memory-diary-item');
            if (!item) return;
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            openDiaryDetail(chatId, item.dataset.id);
        });
    }

    if (closeDiaryDetailBtn) {
        closeDiaryDetailBtn.addEventListener('click', closeDiaryDetail);
    }

    if (diaryDetailOverlay) {
        diaryDetailOverlay.addEventListener('click', (e) => {
            if (e.target === diaryDetailOverlay) {
                closeDiaryDetail();
            }
        });
    }

    if (diaryEditBtn) {
        diaryEditBtn.addEventListener('click', () => {
            if (!activeDiaryId) return;
            if (!isDiaryEditing) {
                setDiaryEditMode(true);
                return;
            }
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const diaries = getMemoryDiaries(chatId);
            const idx = diaries.findIndex((item) => item.id === activeDiaryId);
            if (idx === -1) return;
            const nextContent = diaryDetailContent.value.trim();
            diaries[idx].content = nextContent;
            setMemoryDiaries(chatId, diaries);
            syncMemoryLongTerm(chatId);
            renderDiaryList(chatId);
            if (diaryDetailView) diaryDetailView.textContent = nextContent;
            setDiaryEditMode(false);
        });
    }

    if (diaryDeleteBtn) {
        diaryDeleteBtn.addEventListener('click', () => {
            if (!activeDiaryId) return;
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const diaries = getMemoryDiaries(chatId);
            const nextDiaries = diaries.filter((item) => item.id !== activeDiaryId);
            setMemoryDiaries(chatId, nextDiaries);
            syncMemoryLongTerm(chatId);
            renderDiaryList(chatId);
            closeDiaryDetail();
        });
    }
}

function initWorldBookBindingLogic(chatRoomNameEl) {
    const selector = document.getElementById('worldbook-selector');
    const modal = document.getElementById('worldbook-binding-modal');
    const closeBtn = document.getElementById('close-worldbook-binding');
    const saveBtn = document.getElementById('save-worldbook-binding');
    const listContainer = document.getElementById('worldbook-binding-list');
    let selectedIdSet = new Set();

    if (selector) {
        selector.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            renderBindingList(chatId);
            openAppModal(modal);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            const selectedIds = Array.from(selectedIdSet);

            localStorage.setItem('chat_worldbooks_' + chatId, JSON.stringify(selectedIds));
            renderSelectedWorldBooks(chatId);
            closeAppModal(modal);
        });
    }

    function renderBindingList(chatId) {
        const allItems = largeStore.get('worldbook_items', []);
        const selectedIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]')
            .map((id) => String(id));
        selectedIdSet = new Set(selectedIds);

        listContainer.innerHTML = '';

        if (allItems.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:20px;">暂无世界书条目</div>';
            return;
        }

        renderCategoryView(allItems);
    }

    function normalizeCategoryName(rawCategory) {
        const name = String(rawCategory || '').trim();
        return name || '未分类';
    }

    function renderCategoryView(allItems) {
        listContainer.innerHTML = '';

        const categoryMap = new Map();
        allItems.forEach((item) => {
            const category = normalizeCategoryName(item.category);
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category).push(item);
        });

        const storedCategories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]')
            .map((category) => String(category || '').trim())
            .filter(Boolean)
            .filter((category) => category !== '未分类');
        const categoryOrder = ['未分类', ...storedCategories];
        categoryMap.forEach((_, category) => {
            if (!categoryOrder.includes(category)) {
                categoryOrder.push(category);
            }
        });

        categoryOrder.forEach((category) => {
            const categoryItems = categoryMap.get(category) || [];
            if (categoryItems.length === 0) return;

            const selectedCount = categoryItems.filter((item) => selectedIdSet.has(String(item.id))).length;
            const categoryItem = document.createElement('button');
            categoryItem.type = 'button';
            categoryItem.className = 'binding-item binding-category-item';
            categoryItem.dataset.category = category;

            const infoWrap = document.createElement('div');
            infoWrap.className = 'binding-item-main';
            const nameEl = document.createElement('span');
            nameEl.className = 'binding-item-name';
            nameEl.textContent = category;
            const countEl = document.createElement('span');
            countEl.className = 'binding-item-count';
            countEl.textContent = selectedCount > 0
                ? `${selectedCount}/${categoryItems.length} 已选`
                : `${categoryItems.length} 条`;
            infoWrap.appendChild(nameEl);
            infoWrap.appendChild(countEl);

            const arrow = document.createElement('span');
            arrow.className = 'binding-item-arrow';
            arrow.textContent = '›';

            categoryItem.appendChild(infoWrap);
            categoryItem.appendChild(arrow);
            categoryItem.addEventListener('click', () => {
                renderCategoryItemsView(allItems, category);
            });
            listContainer.appendChild(categoryItem);
        });
    }

    function renderCategoryItemsView(allItems, category) {
        listContainer.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'binding-header';

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'binding-back-btn';
        backBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg> 返回`;
        backBtn.addEventListener('click', () => {
            renderCategoryView(allItems);
        });

        const title = document.createElement('div');
        title.className = 'binding-category-title';
        title.textContent = category;

        header.appendChild(backBtn);
        header.appendChild(title);
        listContainer.appendChild(header);

        const categoryItems = allItems.filter((item) => normalizeCategoryName(item.category) === category);
        if (categoryItems.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'binding-empty';
            empty.textContent = '该分类暂无世界书';
            listContainer.appendChild(empty);
            return;
        }

        categoryItems.forEach((item) => {
            const id = String(item.id);
            const div = document.createElement('button');
            div.type = 'button';
            div.className = `binding-item ${selectedIdSet.has(id) ? 'selected' : ''}`;
            div.dataset.id = id;

            const name = document.createElement('span');
            name.className = 'binding-item-name';
            name.textContent = String(item.name || '');

            const checkbox = document.createElement('div');
            checkbox.className = 'binding-checkbox';

            div.appendChild(name);
            div.appendChild(checkbox);
            div.addEventListener('click', () => {
                if (selectedIdSet.has(id)) {
                    selectedIdSet.delete(id);
                    div.classList.remove('selected');
                } else {
                    selectedIdSet.add(id);
                    div.classList.add('selected');
                }
            });

            listContainer.appendChild(div);
        });
    }
}

function renderSelectedWorldBooks(chatId) {
    const display = document.getElementById('selected-worldbooks-display');
    const placeholder = document.querySelector('.selector-placeholder');
    const selectedIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
    const allItems = largeStore.get('worldbook_items', []);

    if (display) display.innerHTML = '';

    if (selectedIds.length > 0) {
        if (placeholder) placeholder.style.display = 'none';
        selectedIds.forEach((id) => {
            const item = allItems.find((i) => i.id === id);
            if (item) {
                const tag = document.createElement('div');
                tag.className = 'selected-wb-tag';
                tag.textContent = item.name;
                if (display) display.appendChild(tag);
            }
        });
    } else {
        if (placeholder) placeholder.style.display = 'block';
    }
}

function getUnreadCountKey(chatId) {
    return `chat_unread_count_${chatId}`;
}

function getUnreadCount(chatId) {
    return parseInt(localStorage.getItem(getUnreadCountKey(chatId)) || '0', 10) || 0;
}

function setUnreadCount(chatId, count) {
    const normalized = Math.max(0, parseInt(String(count), 10) || 0);
    localStorage.setItem(getUnreadCountKey(chatId), String(normalized));
    return normalized;
}

function buildChatListPreviewFromMessage(msg) {
    if (!msg) return '';
    if (msg.voice) return '语音消息';
    const content = msg.content;
    if (typeof content !== 'string') return '';
    const temp = document.createElement('div');
    temp.innerHTML = content;
    temp.querySelectorAll('.camera-photo-placeholder').forEach((el) => {
        const text = String(el.dataset.photoText || '').trim();
        const token = `图片${text ? `:${text}` : ''}`;
        el.replaceWith(document.createTextNode(token));
    });
    const text = (temp.textContent || temp.innerText || '').trim();
    if (text) return text;
    if (content.includes('chat-inline-sticker')) return '贴图';
    if (content.includes('camera-photo-placeholder')) return '图片';
    if (/<img[^>]*src=["']data:image\/[^"']+["'][^>]*>/i.test(content)) return '图片';
    if (/<img[^>]*>/i.test(content)) return '图片';
    return '';
}

function getLatestChatMessageMeta(chatId) {
    const metaRaw = localStorage.getItem('chat_last_message_' + chatId);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw);
            return meta;
        } catch (e) {}
    }
    return { message: null, ts: 0 };
}

function increaseUnread(chatId) {
    const nextUnread = setUnreadCount(chatId, getUnreadCount(chatId) + 1);
    const row = document.querySelector(`#line-chat-list .chat-list-item[data-chat-id="${CSS.escape(chatId)}"]`);
    if (row) {
        renderUnreadBadge(row, nextUnread);
    } else {
        refreshAllUnreadBadges();
    }
}

function clearUnread(chatId) {
    setUnreadCount(chatId, 0);
    const row = document.querySelector(`#line-chat-list .chat-list-item[data-chat-id="${CSS.escape(chatId)}"]`);
    if (row) {
        renderUnreadBadge(row, 0);
    } else {
        refreshAllUnreadBadges();
    }
}

function initLineApp() {
    const appLine = document.getElementById('app-line');
    const lineModal = document.getElementById('line-modal');
    const lineUserRow = document.getElementById('line-user-row');
    const lineBackHomeBtn = document.getElementById('line-back-home-btn');
    const lineHomeUsername = document.getElementById('line-home-username');
    const lineHomeAvatar = document.getElementById('line-home-avatar');
    const lineUserSettingsModal = document.getElementById('line-user-settings-modal');
    const closeLineUserSettingsBtn = document.getElementById('close-line-user-settings');
    const saveLineUserSettingsBtn = document.getElementById('save-line-user-settings');
    const lineUserSettingsList = document.getElementById('line-user-settings-list');
    const openLineUserAddModalBtn = document.getElementById('open-line-user-add-modal');
    const lineUserAddOverlay = document.getElementById('line-user-add-overlay');
    const cancelLineUserAddBtn = document.getElementById('cancel-line-user-add');
    const confirmLineUserAddBtn = document.getElementById('confirm-line-user-add');
    const lineUserAddRealnameInput = document.getElementById('line-user-add-realname');
    const lineMoreWalletBtn = document.getElementById('line-more-wallet-btn');
    const lineUserWalletBackBtn = document.getElementById('line-user-wallet-back-btn');
    const lineUserWalletBalance = document.getElementById('line-user-wallet-balance');
    const lineUserWalletEditBalanceBtn = document.getElementById('line-user-wallet-edit-balance-btn');
    const lineUserWalletCardsGenerateBtn = document.getElementById('line-user-wallet-cards-generate-btn');
    const lineUserWalletCardsManageBtn = document.getElementById('line-user-wallet-cards-manage-btn');
    const lineUserWalletGiftBtn = document.getElementById('line-user-wallet-gift-btn');
    const lineUserWalletCardsBody = document.getElementById('line-user-wallet-cards-body');
    const lineUserWalletFamilyCardsBody = document.getElementById('line-user-wallet-family-cards-body');
    const lineUserWalletBillsBody = document.getElementById('line-user-wallet-bills-body');
    const lineWalletGiftOverlay = document.getElementById('line-wallet-gift-overlay');
    const lineWalletGiftClose = document.getElementById('line-wallet-gift-close');
    const lineWalletGiftCancel = document.getElementById('line-wallet-gift-cancel');
    const lineWalletGiftConfirm = document.getElementById('line-wallet-gift-confirm');
    const lineWalletGiftTarget = document.getElementById('line-wallet-gift-target');
    const lineWalletGiftAmount = document.getElementById('line-wallet-gift-amount');
    const lineWalletCardManageOverlay = document.getElementById('line-wallet-card-manage-overlay');
    const lineWalletCardManageClose = document.getElementById('line-wallet-card-manage-close');
    const lineWalletCardManageDone = document.getElementById('line-wallet-card-manage-done');
    const lineWalletCardManageList = document.getElementById('line-wallet-card-manage-list');
    const lineWalletBalanceEditOverlay = document.getElementById('line-wallet-balance-edit-overlay');
    const lineWalletBalanceEditClose = document.getElementById('line-wallet-balance-edit-close');
    const lineWalletBalanceEditCancel = document.getElementById('line-wallet-balance-edit-cancel');
    const lineWalletBalanceEditConfirm = document.getElementById('line-wallet-balance-edit-confirm');
    const lineWalletBalanceEditInput = document.getElementById('line-wallet-balance-edit-input');
    const friendProfileModal = document.getElementById('friend-profile-modal');
    const friendProfileAvatar = document.getElementById('friend-profile-avatar');
    const friendProfileName = document.getElementById('friend-profile-name');
    const friendProfileSignature = document.getElementById('friend-profile-signature');
    const friendProfileFeedBtn = document.getElementById('friend-profile-feed-btn');
    const friendProfileInfoBtn = document.getElementById('friend-profile-info-btn');
    const friendProfileDeleteBtn = document.getElementById('friend-profile-delete-btn');
    const friendFeedModal = document.getElementById('friend-feed-modal');
    const closeFriendFeedBtn = document.getElementById('close-friend-feed-btn');
    const friendFeedWallpaper = document.getElementById('friend-feed-wallpaper');
    const friendFeedWallpaperInput = document.getElementById('friend-feed-wallpaper-input');
    const friendFeedAvatar = document.getElementById('friend-feed-avatar');
    const friendDeleteConfirmModal = document.getElementById('friend-delete-confirm-modal');
    const friendDeleteConfirmText = document.getElementById('friend-delete-confirm-text');
    const closeFriendDeleteConfirmBtn = document.getElementById('close-friend-delete-confirm');
    const cancelFriendDeleteConfirmBtn = document.getElementById('cancel-friend-delete-confirm');
    const confirmFriendDeleteConfirmBtn = document.getElementById('confirm-friend-delete-confirm');
    const lineUserStorageKey = 'line_home_users';
    const lineSelectedUserStorageKey = 'line_home_selected_user_id';
    let lineUserDraft = [];
    let lineSelectedUserId = '';
    let activeFriendChatId = '';
    let lineWalletCurrentPageId = 'line-more-page';

    const getLineUsers = () => {
        const raw = JSON.parse(localStorage.getItem(lineUserStorageKey) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
            .map((item) => ({
                id: String(item?.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random())),
                name: String(item?.name || '').trim(),
                persona: String(item?.persona || ''),
                avatar: String(item?.avatar || '').trim()
            }))
            .filter((item) => item.name);
    };

    const setLineUsers = (users) => {
        localStorage.setItem(lineUserStorageKey, JSON.stringify(Array.isArray(users) ? users : []));
    };

    const getLineSelectedUserId = () => String(localStorage.getItem(lineSelectedUserStorageKey) || '').trim();

    const setLineSelectedUserId = (id) => {
        const normalized = String(id || '').trim();
        if (normalized) {
            localStorage.setItem(lineSelectedUserStorageKey, normalized);
        } else {
            localStorage.removeItem(lineSelectedUserStorageKey);
        }
    };

    const getDefaultAvatarSvg = (size = 26) => `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path>
        </svg>
    `;
    const defaultFriendAvatarHtml = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>';

    const readLineUserAvatarAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(`读取图片失败：${file?.name || '未命名图片'}`));
        reader.readAsDataURL(file);
    });

    const escapeLineUserInput = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escapeLineWalletText = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getCurrentLineUser = () => {
        const users = getLineUsers();
        const selectedId = lineSelectedUserId || getLineSelectedUserId();
        return users.find((item) => item.id === selectedId) || users[0] || null;
    };

    const getLineUserWalletKey = (userId) => `line_user_wallet_${String(userId || 'default').trim()}`;

    const normalizeLineUserWallet = (raw) => {
        const data = raw && typeof raw === 'object' ? raw : {};
        const parsedBalance = Number(data.balance);
        return {
            balance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
            mainCards: Array.isArray(data.mainCards) ? data.mainCards : [],
            familyCards: Array.isArray(data.familyCards) ? data.familyCards.filter((card) => card && card.source === 'real') : [],
            bills: Array.isArray(data.bills) ? data.bills : []
        };
    };

    const readLineUserWallet = (userId) => {
        const key = getLineUserWalletKey(userId);
        const raw = largeStore.get(key, null);
        if (!raw) return normalizeLineUserWallet(null);
        if (typeof raw === 'string') {
            try {
                return normalizeLineUserWallet(JSON.parse(raw));
            } catch (e) {
                return normalizeLineUserWallet(null);
            }
        }
        return normalizeLineUserWallet(raw);
    };

    const saveLineUserWallet = (userId, wallet) => {
        const key = getLineUserWalletKey(userId);
        largeStore.put(key, normalizeLineUserWallet(wallet));
    };

    const renderLineUserWallet = () => {
        if (!lineUserWalletBalance || !lineUserWalletCardsBody || !lineUserWalletFamilyCardsBody || !lineUserWalletBillsBody) return;
        const currentUser = getCurrentLineUser();
        if (!currentUser) {
            lineUserWalletBalance.textContent = '¥0.00';
            lineUserWalletCardsBody.innerHTML = '<div class="line-user-wallet-empty-tip">请先在 LINE 主页设置 User</div>';
            lineUserWalletFamilyCardsBody.innerHTML = '<div class="line-user-wallet-empty-tip">暂无亲属卡（赠送/收到后显示）</div>';
            lineUserWalletBillsBody.innerHTML = '<div class="line-user-wallet-empty-tip">暂无消费记录</div>';
            return;
        }
        const wallet = readLineUserWallet(currentUser.id);
        lineUserWalletBalance.textContent = `¥${Number(wallet.balance || 0).toFixed(2)}`;
        lineUserWalletCardsBody.innerHTML = '';
        lineUserWalletFamilyCardsBody.innerHTML = '';
        lineUserWalletBillsBody.innerHTML = '';

        if (!wallet.mainCards.length) {
            lineUserWalletCardsBody.innerHTML = '<div class="line-user-wallet-empty-tip">点击右上角小图标生成卡片</div>';
        } else if (wallet.mainCards.length > 3) {
            const stack = document.createElement('div');
            stack.className = 'line-user-wallet-card-stack';
            wallet.mainCards.slice(0, 3).forEach((card, idx) => {
                const cardEl = document.createElement('div');
                cardEl.className = `line-user-wallet-mini-card line-user-wallet-stack-layer-${idx + 1}` + (idx % 2 === 1 ? ' light' : '');
                cardEl.innerHTML = `
                    <div class="line-user-wallet-card-peek">${escapeLineWalletText(card.name || '银行卡')} · ${escapeLineWalletText(card.last4 || '0000')}</div>
                    <div class="line-user-wallet-card-name">${escapeLineWalletText(card.name || '银行卡')}</div>
                    <div class="line-user-wallet-card-no">**** ${escapeLineWalletText(card.last4 || '0000')}</div>
                `;
                stack.appendChild(cardEl);
            });
            lineUserWalletCardsBody.appendChild(stack);
            const more = document.createElement('div');
            more.className = 'line-user-wallet-stack-more';
            more.textContent = `已收纳 ${wallet.mainCards.length} 张卡`;
            lineUserWalletCardsBody.appendChild(more);
        } else {
            wallet.mainCards.forEach((card, idx) => {
                const cardEl = document.createElement('div');
                cardEl.className = 'line-user-wallet-mini-card' + (idx % 2 === 1 ? ' light' : '');
                cardEl.innerHTML = `
                    <div class="line-user-wallet-card-name">${escapeLineWalletText(card.name || '银行卡')}</div>
                    <div class="line-user-wallet-card-no">**** ${escapeLineWalletText(card.last4 || '0000')}</div>
                `;
                lineUserWalletCardsBody.appendChild(cardEl);
            });
        }

        if (!wallet.familyCards.length) {
            lineUserWalletFamilyCardsBody.innerHTML = '<div class="line-user-wallet-empty-tip">暂无亲属卡（赠送/收到后显示）</div>';
        } else {
            wallet.familyCards.forEach((card) => {
                const row = document.createElement('div');
                row.className = 'line-user-wallet-family-item';
                row.innerHTML = `
                    <div style="font-size:12px;font-weight:700;">${escapeLineWalletText(card.name || '亲属卡')}</div>
                    <div style="font-size:11px;color:#666a72;margin-top:2px;">${escapeLineWalletText(card.meta || '')}</div>
                `;
                lineUserWalletFamilyCardsBody.appendChild(row);
            });
        }

        if (!wallet.mainCards.length) {
            lineUserWalletBillsBody.innerHTML = '<div class="line-user-wallet-empty-tip">未生成银行卡/信用卡，暂不可消费</div>';
        } else if (!wallet.bills.length) {
            lineUserWalletBillsBody.innerHTML = '<div class="line-user-wallet-empty-tip">暂无消费记录</div>';
        } else {
            wallet.bills.forEach((bill) => {
                const row = document.createElement('div');
                row.className = 'line-user-wallet-bill-item';
                const isIncome = bill.type === 'income';
                const symbol = isIncome ? '+' : '-';
                row.innerHTML = `
                    <div style="min-width:0;">
                        <div style="font-size:13px;font-weight:600;">${escapeLineWalletText(bill.merchant || '消费')}</div>
                        <div style="font-size:11px;color:#666a72;margin-top:2px;">${escapeLineWalletText(bill.desc || '')}</div>
                    </div>
                    <div style="font-size:13px;font-weight:700;white-space:nowrap;">${symbol}¥${Number(bill.amount || 0).toFixed(2)}</div>
                `;
                lineUserWalletBillsBody.appendChild(row);
            });
        }
    };

    const generateLineUserWalletCardsFallback = (user) => {
        const name = String(user?.name || 'User').trim() || 'User';
        const seed = Math.abs(name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
        const tail = String(seed % 10000).padStart(4, '0');
        const count = 1 + (seed % 4);
        const presetNames = ['信用卡', '储蓄卡', '旅行卡', '日常卡', '联名卡'];
        const cards = [];
        for (let i = 0; i < count; i += 1) {
            const last4 = String((Number(tail) + 1733 * (i + 1)) % 10000).padStart(4, '0');
            cards.push({
                name: `${name}${presetNames[i % presetNames.length]}`,
                last4
            });
        }
        return cards;
    };

    const generateLineUserWalletCardsByPersona = async (user) => {
        const apiUrl = localStorage.getItem('api_url');
        const apiKey = localStorage.getItem('api_key');
        const modelName = localStorage.getItem('model_name') || 'gpt-3.5-turbo';
        const globalTemperatureRaw = parseFloat(localStorage.getItem('temperature') || '0.7');
        const globalTemperature = Number.isFinite(globalTemperatureRaw) ? globalTemperatureRaw : 0.7;
        if (!apiUrl || !apiKey) return generateLineUserWalletCardsFallback(user);

        const userName = String(user?.name || 'User').trim() || 'User';
        const persona = String(user?.persona || '').trim();
        const prompt = `你是${userName}本人。请根据人设生成钱包银行卡/信用卡列表，只输出 JSON。
要求：
1. mainCards 为 1-4 张，按人设合理，不要过多。
2. 每张卡包含 name 和 last4（4位数字字符串）。
3. 只输出 JSON：
{"mainCards":[{"name":"xx信用卡","last4":"1234"}]}
人设：
${persona || '无'}
`;
        try {
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
            if (!response.ok) throw new Error('卡片生成失败');
            const data = await response.json();
            const content = String(data.choices?.[0]?.message?.content || '').trim();
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('格式错误');
            const parsed = JSON.parse(jsonMatch[0]);
            const cards = Array.isArray(parsed.mainCards) ? parsed.mainCards : [];
            if (!cards.length) throw new Error('空结果');
            return cards;
        } catch (e) {
            return generateLineUserWalletCardsFallback(user);
        }
    };

    const getGiftTargets = () => {
        let friendIds = [];
        try {
            friendIds = JSON.parse(localStorage.getItem('global_friends_list') || '[]');
        } catch (e) {
            friendIds = [];
        }
        if (!Array.isArray(friendIds)) friendIds = [];
        return friendIds
            .map((chatId) => {
                const id = String(chatId || '').trim();
                if (!id) return null;
                const meta = JSON.parse(localStorage.getItem('chat_meta_' + id) || '{}');
                const name = String(meta.remark || meta.realName || '').trim() || '未命名对象';
                return { id, name };
            })
            .filter(Boolean);
    };

    const openLineWalletGiftModal = () => {
        if (!lineWalletGiftOverlay || !lineWalletGiftTarget || !lineWalletGiftAmount) return;
        const targets = getGiftTargets();
        if (!targets.length) {
            alert('暂无可赠送对象，请先添加好友');
            return;
        }
        lineWalletGiftTarget.innerHTML = '';
        targets.forEach((target) => {
            const opt = document.createElement('option');
            opt.value = target.id;
            opt.textContent = target.name;
            lineWalletGiftTarget.appendChild(opt);
        });
        lineWalletGiftAmount.value = '';
        lineWalletGiftOverlay.style.display = 'flex';
    };

    const closeLineWalletGiftModal = () => {
        if (!lineWalletGiftOverlay) return;
        lineWalletGiftOverlay.style.display = 'none';
    };

    const openLineWalletBalanceEditModal = () => {
        if (!lineWalletBalanceEditOverlay || !lineWalletBalanceEditInput) return;
        const currentUser = getCurrentLineUser();
        if (!currentUser) {
            alert('请先设置 LINE User');
            return;
        }
        const current = readLineUserWallet(currentUser.id);
        lineWalletBalanceEditInput.value = String(Number(current.balance || 0).toFixed(2));
        lineWalletBalanceEditOverlay.style.display = 'flex';
        setTimeout(() => lineWalletBalanceEditInput.focus(), 0);
    };

    const closeLineWalletBalanceEditModal = () => {
        if (!lineWalletBalanceEditOverlay) return;
        lineWalletBalanceEditOverlay.style.display = 'none';
    };

    const renderLineWalletCardManageList = () => {
        if (!lineWalletCardManageList) return;
        const currentUser = getCurrentLineUser();
        if (!currentUser) {
            lineWalletCardManageList.innerHTML = '<div class="line-user-wallet-empty-tip">请先设置 LINE User</div>';
            return;
        }
        const wallet = readLineUserWallet(currentUser.id);
        const cards = Array.isArray(wallet.mainCards) ? wallet.mainCards : [];
        if (!cards.length) {
            lineWalletCardManageList.innerHTML = '<div class="line-user-wallet-empty-tip">暂无银行卡 / 信用卡</div>';
            return;
        }
        lineWalletCardManageList.innerHTML = '';
        cards.forEach((card, index) => {
            const row = document.createElement('div');
            row.className = 'line-wallet-card-manage-item';
            row.innerHTML = `
                <div style="min-width:0;">
                    <div class="line-wallet-card-manage-title">${escapeLineWalletText(card.name || '银行卡')}</div>
                    <div class="line-wallet-card-manage-sub">**** ${escapeLineWalletText(card.last4 || '0000')}</div>
                </div>
                <button class="ins-btn-danger line-wallet-card-delete-btn" data-index="${index}" type="button">删除</button>
            `;
            lineWalletCardManageList.appendChild(row);
        });
    };

    const openLineWalletCardManageModal = () => {
        if (!lineWalletCardManageOverlay) return;
        renderLineWalletCardManageList();
        lineWalletCardManageOverlay.style.display = 'flex';
    };

    const closeLineWalletCardManageModal = () => {
        if (!lineWalletCardManageOverlay) return;
        lineWalletCardManageOverlay.style.display = 'none';
    };

    const renderLineHomeSummary = () => {
        if (!lineHomeUsername || !lineHomeAvatar) return;
        const users = getLineUsers();
        const selectedId = getLineSelectedUserId();
        const current = users.find((item) => item.id === selectedId) || users[0];
        if (current && current.id !== selectedId) {
            setLineSelectedUserId(current.id);
        }
        if (!current) {
            lineHomeUsername.textContent = 'User Name';
            lineHomeAvatar.innerHTML = getDefaultAvatarSvg(40);
            return;
        }
        lineHomeUsername.textContent = current.name || 'User Name';
        lineHomeAvatar.innerHTML = current.avatar
            ? `<img src="${current.avatar}" style="width:100%;height:100%;object-fit:cover;">`
            : getDefaultAvatarSvg(40);
    };

    const renderLineUserSettingsList = () => {
        if (!lineUserSettingsList) return;
        if (!Array.isArray(lineUserDraft) || lineUserDraft.length === 0) {
            lineUserSettingsList.innerHTML = '<div class="memory-token-empty">暂无User，点击上方加号添加</div>';
            return;
        }
        lineUserSettingsList.innerHTML = lineUserDraft.map((item) => `
            <div class="user-settings-card line-user-settings-item ${item.id === lineSelectedUserId ? 'selected' : ''}" data-id="${escapeLineUserInput(item.id)}">
                <div class="chat-profile-row compact-profile">
                    <div class="chat-profile-avatar-wrapper small-avatar line-user-avatar-trigger" data-id="${escapeLineUserInput(item.id)}">
                        <div class="chat-profile-avatar">
                            ${item.avatar ? `<img src="${escapeLineUserInput(item.avatar)}" alt="头像">` : getDefaultAvatarSvg(24)}
                        </div>
                        <input type="file" class="line-user-avatar-input" accept="image/*" style="display: none;">
                        <div class="avatar-edit-icon">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </div>
                    </div>
                    <div class="chat-profile-info">
                        <div class="info-row">
                            <span class="info-label">名字</span>
                            <input type="text" class="info-input line-user-name-input" value="${escapeLineUserInput(item.name)}" placeholder="输入名字">
                        </div>
                    </div>
                </div>
                <div class="settings-section compact-section">
                    <textarea class="persona-input line-user-persona-input" placeholder="输入User人设...">${escapeLineUserInput(item.persona)}</textarea>
                </div>
            </div>
        `).join('');
    };

    const openLineUserAddOverlay = () => {
        if (!lineUserAddOverlay || !lineUserAddRealnameInput) return;
        lineUserAddOverlay.style.display = 'flex';
        lineUserAddRealnameInput.value = '';
        setTimeout(() => lineUserAddRealnameInput.focus(), 0);
    };

    const closeLineUserAddOverlay = () => {
        if (!lineUserAddOverlay) return;
        lineUserAddOverlay.style.display = 'none';
    };

    const getFriendSignature = (chatId) => {
        const signature = localStorage.getItem('chat_signature_' + chatId)
            || localStorage.getItem('chat_persona_' + chatId)
            || largeStore.get('chat_user_persona_' + chatId, '');
        const normalized = String(signature || '').replace(/\s+/g, ' ').trim();
        return normalized || '这个人很神秘，还没有签名';
    };

    const getFriendFeedWallpaperStorageKey = (chatId) => `friend_feed_wallpaper_${String(chatId || '').trim()}`;

    const buildFriendFeedWallpaperStyle = (imageUrl) => {
        const normalized = String(imageUrl || '').trim();
        if (!normalized) return '';
        const safeImageUrl = normalized.replace(/"/g, '\\"');
        return `linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.08)), url("${safeImageUrl}")`;
    };

    const closeFriendProfileModal = () => {
        if (!friendProfileModal) return;
        friendProfileModal.style.display = 'none';
        activeFriendChatId = '';
    };

    const closeFriendFeedModal = () => {
        if (!friendFeedModal) return;
        friendFeedModal.dataset.chatId = '';
        if (friendFeedWallpaperInput) {
            friendFeedWallpaperInput.value = '';
        }
        closeAppModal(friendFeedModal);
    };

    const openFriendFeedModal = (chatId, fallbackAvatarHtml = '') => {
        if (!friendFeedModal || !friendFeedAvatar || !friendFeedWallpaper) return;
        const normalizedChatId = String(chatId || '').trim();
        const avatarRef = normalizedChatId ? String(localStorage.getItem('chat_avatar_' + normalizedChatId) || '').trim() : '';
        const savedWallpaperRef = normalizedChatId ? String(localStorage.getItem(getFriendFeedWallpaperStorageKey(normalizedChatId)) || '').trim() : '';
        const fallbackHtml = String(fallbackAvatarHtml || '').trim() || defaultFriendAvatarHtml;
        let avatarHtml = fallbackHtml;
        if (avatarRef) {
            if (isMediaRef(avatarRef)) {
                mediaResolveRef(avatarRef).then((url) => {
                    if (url) friendFeedAvatar.innerHTML = `<img src="${url}" alt="头像">`;
                });
                avatarHtml = fallbackHtml;
            } else {
                avatarHtml = `<img src="${avatarRef}" alt="头像">`;
            }
        }
        let wallpaperStyle = '';
        if (savedWallpaperRef) {
            if (isMediaRef(savedWallpaperRef)) {
                mediaResolveRef(savedWallpaperRef).then((url) => {
                    if (url) friendFeedWallpaper.style.backgroundImage = buildFriendFeedWallpaperStyle(url);
                });
            } else {
                wallpaperStyle = buildFriendFeedWallpaperStyle(savedWallpaperRef);
            }
        } else if (avatarRef && !isMediaRef(avatarRef)) {
            wallpaperStyle = buildFriendFeedWallpaperStyle(avatarRef);
        }
        friendFeedModal.dataset.chatId = normalizedChatId;
        friendFeedAvatar.innerHTML = avatarHtml;
        if (wallpaperStyle) friendFeedWallpaper.style.backgroundImage = wallpaperStyle;
        openAppModal(friendFeedModal);
    };

    const openFriendDeleteConfirmModal = (displayName) => {
        if (!friendDeleteConfirmModal) return;
        if (friendDeleteConfirmText) {
            friendDeleteConfirmText.textContent = `确定删除「${displayName || '该好友'}」吗？删除后会从好友列表和聊天列表移除，相关聊天记录也会被清除。`;
        }
        friendDeleteConfirmModal.style.display = 'flex';
    };

    const closeFriendDeleteConfirmModal = () => {
        if (!friendDeleteConfirmModal) return;
        friendDeleteConfirmModal.style.display = 'none';
    };

    const removeNameFromStorageList = (storageKey, chatId) => {
        const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!Array.isArray(raw)) return;
        const normalized = String(chatId || '').trim();
        if (!normalized) return;
        const next = raw.filter((name) => String(name || '').trim() !== normalized);
        if (JSON.stringify(raw) !== JSON.stringify(next)) {
            localStorage.setItem(storageKey, JSON.stringify(next));
        }
    };

    const removeFriendData = (chatId) => {
        const normalized = String(chatId || '').trim();
        if (!normalized) return;
        const selector = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(normalized) : normalized;
        const friendItem = document.querySelector(`#friends-list .group-subitem[data-chat-id="${selector}"]`);
        if (friendItem && friendItem.parentNode) {
            friendItem.parentNode.removeChild(friendItem);
        }
        const chatItem = document.querySelector(`#line-chat-list .chat-list-item[data-chat-id="${selector}"]`);
        if (chatItem && chatItem.parentNode) {
            chatItem.parentNode.removeChild(chatItem);
        }
        removeNameFromStorageList('global_friends_list', normalized);
        removeNameFromStorageList('global_chat_list', normalized);
        localStorage.removeItem('chat_meta_' + normalized);
        largeStore.remove('chat_history_' + normalized);
        localStorage.removeItem('chat_last_message_' + normalized);
        localStorage.removeItem('chat_remark_' + normalized);
        largeStore.remove('chat_persona_' + normalized);
        localStorage.removeItem('chat_avatar_' + normalized);
        localStorage.removeItem('chat_signature_' + normalized);
        localStorage.removeItem('chat_user_realname_' + normalized);
        localStorage.removeItem('chat_user_remark_' + normalized);
        largeStore.remove('chat_user_persona_' + normalized);
        localStorage.removeItem('chat_user_avatar_' + normalized);
        localStorage.removeItem('chat_worldbooks_' + normalized);
        localStorage.removeItem('chat_context_limit_' + normalized);
        largeStore.remove('chat_long_memory_' + normalized);
        localStorage.removeItem(getMemoryDiaryKey(normalized));
        localStorage.removeItem(getSummaryLimitKey(normalized));
        localStorage.removeItem(getAutoSummaryEnabledKey(normalized));
        localStorage.removeItem(getTimeSyncEnabledKey(normalized));
        localStorage.removeItem(getTimeZoneSyncEnabledKey(normalized));
        localStorage.removeItem(getUserTimeZoneKey(normalized));
        localStorage.removeItem(getCharTimeZoneKey(normalized));
        localStorage.removeItem(getUserCityKey(normalized));
        localStorage.removeItem(getCharCityKey(normalized));
        localStorage.removeItem(getSummaryCursorKey(normalized));
        localStorage.removeItem(getUnreadCountKey(normalized));
        localStorage.removeItem(getChatWallpaperStorageKey(normalized));

        const chatListContainer = document.getElementById('line-chat-list');
        const emptyPlaceholder = chatListContainer ? chatListContainer.querySelector('.empty-chat-placeholder') : null;
        if (emptyPlaceholder) {
            const hasItems = chatListContainer.querySelectorAll('.chat-list-item').length > 0;
            emptyPlaceholder.style.display = hasItems ? 'none' : 'block';
        }
        refreshChatListPreviews();
        refreshAllUnreadBadges();
        if (typeof saveGlobalData === 'function') {
            saveGlobalData();
        }

        const chatRoom = document.getElementById('chat-room');
        const chatRoomName = document.getElementById('chat-room-name');
        if (chatRoom && chatRoomName) {
            const currentChatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            if (currentChatId === normalized) {
                chatRoom.style.display = 'none';
                chatRoomName.textContent = '';
                chatRoomName.dataset.chatId = '';
                const chatContent = document.querySelector('.chat-room-content');
                if (chatContent) {
                    chatContent.innerHTML = '';
                }
            }
        }
    };

    const ensureChatItem = (chatId, displayName) => {
        const chatListContainer = document.getElementById('line-chat-list');
        if (!chatListContainer) return null;
        const selectorName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(chatId) : chatId;
        let chatItem = chatListContainer.querySelector(`.chat-list-item[data-chat-id="${selectorName}"]`);
        if (chatItem) return chatItem;

        const avatarRef = localStorage.getItem('chat_avatar_' + chatId);
        let avatarHtml = defaultFriendAvatarHtml;
        if (avatarRef) {
            if (isMediaRef(avatarRef)) {
                avatarHtml = defaultFriendAvatarHtml;
            } else {
                avatarHtml = `<img src="${avatarRef}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            }
        }

        chatItem = document.createElement('div');
        chatItem.className = 'chat-list-item';
        chatItem.dataset.chatId = chatId;
        chatItem.innerHTML = `
            <div class="chat-item-avatar">
                ${avatarHtml}
            </div>
            <div class="chat-item-info">
                <div class="chat-item-header">
                    <div class="chat-item-name">${displayName}</div>
                    <div class="chat-item-time"></div>
                </div>
                <div class="chat-item-msg">点击开始聊天</div>
            </div>
            <div class="chat-item-unread hidden"></div>
        `;
        chatListContainer.insertBefore(chatItem, chatListContainer.firstChild);
        if (avatarRef && isMediaRef(avatarRef)) {
            mediaResolveRef(avatarRef).then((url) => {
                const avatarDiv = chatItem.querySelector('.chat-item-avatar');
                if (avatarDiv && url) {
                    avatarDiv.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            });
        }
        updateChatListItemPreview(chatId, chatItem);
        sortChatListByLastMessage();
        if (typeof saveGlobalData === 'function') {
            saveGlobalData();
        }
        return chatItem;
    };

    const openFriendChat = (chatId) => {
        const friendItem = document.querySelector(`#friends-list .group-subitem[data-chat-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(chatId) : chatId}"]`);
        const displayName = friendItem?.querySelector('span')?.textContent?.trim()
            || getChatDisplayName(chatId)
            || getChatRealName(chatId)
            || chatId;
        const chatItem = ensureChatItem(chatId, displayName);
        if (!chatItem) return;

        const emptyPlaceholder = document.querySelector('.empty-chat-placeholder');
        if (emptyPlaceholder) {
            emptyPlaceholder.style.display = 'none';
        }
        const chatNavItem = document.querySelector('.line-nav-item[data-page="line-chat-page"]');
        if (chatNavItem && !chatNavItem.classList.contains('active')) {
            chatNavItem.click();
        }
        chatItem.click();
    };

    const openFriendProfileModal = (item) => {
        if (!item || !friendProfileModal || !friendProfileAvatar || !friendProfileName || !friendProfileSignature) return;
        const chatId = String(item.dataset.chatId || '').trim();
        if (!chatId) return;
        const displayName = String(item.querySelector('span')?.textContent || getChatDisplayName(chatId) || getChatRealName(chatId)).trim();
        const avatarEl = item.querySelector('.subitem-avatar');

        activeFriendChatId = chatId;
        friendProfileName.textContent = displayName;
        friendProfileAvatar.innerHTML = avatarEl ? avatarEl.innerHTML : defaultFriendAvatarHtml;
        friendProfileSignature.textContent = getFriendSignature(chatId);
        friendProfileModal.style.display = 'flex';
    };

    if (appLine) {
        appLine.addEventListener('click', () => {
            lineModal.classList.add('active');
            switchLinePage('line-home-page');
            lineWalletCurrentPageId = 'line-more-page';
        });
    }

    const switchLinePage = (targetPageId, syncNav = true) => {
        if (!targetPageId) return;
        document.querySelectorAll('.line-page').forEach(page => {
            page.style.display = 'none';
        });
        const targetPage = document.getElementById(targetPageId);
        if (targetPage) {
            targetPage.style.display = 'flex';
        }
        const commonHeader = document.querySelector('.line-header');
        if (commonHeader) {
            commonHeader.style.display = targetPageId === 'line-home-page' ? 'flex' : 'none';
        }
        if (syncNav) {
            const navItems = document.querySelectorAll('.line-nav-item');
            navItems.forEach((nav) => nav.classList.remove('active'));
            const nav = document.querySelector(`.line-nav-item[data-page="${targetPageId}"]`);
            if (nav) nav.classList.add('active');
        }
    };

    const navItems = document.querySelectorAll('.line-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const targetPageId = item.getAttribute('data-page');
            if (targetPageId) {
                switchLinePage(targetPageId, false);
                if (targetPageId === 'line-more-page') {
                    lineWalletCurrentPageId = 'line-more-page';
                }
            }
        });
    });

    if (lineMoreWalletBtn) {
        lineMoreWalletBtn.addEventListener('click', () => {
            lineWalletCurrentPageId = 'line-user-wallet-page';
            switchLinePage('line-user-wallet-page', false);
            renderLineUserWallet();
        });
    }
    if (lineUserWalletBackBtn) {
        lineUserWalletBackBtn.addEventListener('click', () => {
            lineWalletCurrentPageId = 'line-more-page';
            switchLinePage('line-more-page', false);
        });
    }
    if (lineUserWalletEditBalanceBtn) {
        lineUserWalletEditBalanceBtn.addEventListener('click', () => {
            openLineWalletBalanceEditModal();
        });
    }
    if (lineWalletBalanceEditClose) lineWalletBalanceEditClose.addEventListener('click', closeLineWalletBalanceEditModal);
    if (lineWalletBalanceEditCancel) lineWalletBalanceEditCancel.addEventListener('click', closeLineWalletBalanceEditModal);
    if (lineWalletBalanceEditOverlay) {
        lineWalletBalanceEditOverlay.addEventListener('click', (e) => {
            if (e.target === lineWalletBalanceEditOverlay) closeLineWalletBalanceEditModal();
        });
    }
    if (lineWalletBalanceEditConfirm) {
        lineWalletBalanceEditConfirm.addEventListener('click', () => {
            const currentUser = getCurrentLineUser();
            if (!currentUser) {
                alert('请先设置 LINE User');
                return;
            }
            const current = readLineUserWallet(currentUser.id);
            const balance = Number(String(lineWalletBalanceEditInput?.value || '').trim());
            if (!Number.isFinite(balance) || balance < 0) {
                alert('余额格式不正确');
                return;
            }
            saveLineUserWallet(currentUser.id, {
                ...current,
                balance: Number(balance.toFixed(2))
            });
            closeLineWalletBalanceEditModal();
            renderLineUserWallet();
        });
    }
    if (lineUserWalletCardsGenerateBtn) {
        lineUserWalletCardsGenerateBtn.addEventListener('click', async () => {
            const currentUser = getCurrentLineUser();
            if (!currentUser) {
                alert('请先设置 LINE User');
                return;
            }
            lineUserWalletCardsGenerateBtn.disabled = true;
            try {
                const cards = await generateLineUserWalletCardsByPersona(currentUser);
                const wallet = readLineUserWallet(currentUser.id);
                saveLineUserWallet(currentUser.id, {
                    ...wallet,
                    mainCards: cards
                });
                renderLineUserWallet();
            } catch (e) {
                alert('卡片生成失败: ' + (e?.message || e));
            } finally {
                lineUserWalletCardsGenerateBtn.disabled = false;
            }
        });
    }
    if (lineUserWalletGiftBtn) {
        lineUserWalletGiftBtn.addEventListener('click', () => {
            const currentUser = getCurrentLineUser();
            if (!currentUser) {
                alert('请先设置 LINE User');
                return;
            }
            openLineWalletGiftModal();
        });
    }
    if (lineUserWalletCardsManageBtn) {
        lineUserWalletCardsManageBtn.addEventListener('click', () => {
            const currentUser = getCurrentLineUser();
            if (!currentUser) {
                alert('请先设置 LINE User');
                return;
            }
            openLineWalletCardManageModal();
        });
    }
    if (lineWalletGiftClose) lineWalletGiftClose.addEventListener('click', closeLineWalletGiftModal);
    if (lineWalletGiftCancel) lineWalletGiftCancel.addEventListener('click', closeLineWalletGiftModal);
    if (lineWalletGiftOverlay) {
        lineWalletGiftOverlay.addEventListener('click', (e) => {
            if (e.target === lineWalletGiftOverlay) closeLineWalletGiftModal();
        });
    }
    if (lineWalletGiftConfirm) {
        lineWalletGiftConfirm.addEventListener('click', () => {
            const currentUser = getCurrentLineUser();
            if (!currentUser) {
                alert('请先设置 LINE User');
                return;
            }
            const wallet = readLineUserWallet(currentUser.id);
            const amount = Number(String(lineWalletGiftAmount?.value || '').trim());
            const targetId = String(lineWalletGiftTarget?.value || '').trim();
            if (!targetId) {
                alert('请选择赠送对象');
                return;
            }
            if (!Number.isFinite(amount) || amount <= 0) {
                alert('请输入有效金额');
                return;
            }
            if (Number(wallet.balance || 0) < amount) {
                alert('余额不足，无法赠送');
                return;
            }
            const targets = getGiftTargets();
            const target = targets.find((item) => item.id === targetId);
            const targetName = target ? target.name : '未知对象';
            const normalizedAmount = Number(amount.toFixed(2));
            const nextFamilyCards = Array.isArray(wallet.familyCards) ? [...wallet.familyCards] : [];
            nextFamilyCards.unshift({
                id: `family_gift_${Date.now()}`,
                source: 'real',
                name: `给 ${targetName} 的亲属卡`,
                meta: `送出 | 额度 ¥${normalizedAmount.toFixed(2)}`
            });
            const nextBills = Array.isArray(wallet.bills) ? [...wallet.bills] : [];
            nextBills.unshift({
                id: `bill_family_gift_${Date.now()}`,
                merchant: '亲属卡赠送',
                desc: `赠送给 ${targetName}`,
                amount: normalizedAmount,
                type: 'expense',
                timestamp: Date.now()
            });
            saveLineUserWallet(currentUser.id, {
                ...wallet,
                balance: Number((Number(wallet.balance || 0) - normalizedAmount).toFixed(2)),
                familyCards: nextFamilyCards.slice(0, 20),
                bills: nextBills.slice(0, 50)
            });
            closeLineWalletGiftModal();
            renderLineUserWallet();
        });
    }
    if (lineWalletCardManageClose) lineWalletCardManageClose.addEventListener('click', closeLineWalletCardManageModal);
    if (lineWalletCardManageDone) lineWalletCardManageDone.addEventListener('click', closeLineWalletCardManageModal);
    if (lineWalletCardManageOverlay) {
        lineWalletCardManageOverlay.addEventListener('click', (e) => {
            if (e.target === lineWalletCardManageOverlay) closeLineWalletCardManageModal();
        });
    }
    if (lineWalletCardManageList) {
        lineWalletCardManageList.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const btn = target.closest('.line-wallet-card-delete-btn');
            if (!btn) return;
            const currentUser = getCurrentLineUser();
            if (!currentUser) return;
            const index = Number(btn.getAttribute('data-index'));
            if (!Number.isInteger(index) || index < 0) return;
            const wallet = readLineUserWallet(currentUser.id);
            const cards = Array.isArray(wallet.mainCards) ? [...wallet.mainCards] : [];
            if (index >= cards.length) return;
            cards.splice(index, 1);
            saveLineUserWallet(currentUser.id, {
                ...wallet,
                mainCards: cards
            });
            renderLineWalletCardManageList();
            renderLineUserWallet();
        });
    }

    if (lineBackHomeBtn && lineModal) {
        lineBackHomeBtn.addEventListener('click', () => {
            closeFriendFeedModal();
            lineModal.classList.remove('active');
            lineWalletCurrentPageId = 'line-more-page';
        });
    }

    const groupItems = document.querySelectorAll('.line-group-item');
    groupItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);

            item.classList.toggle('active');

            if (targetContent) {
                targetContent.classList.toggle('active');
            }
        });
    });

    const friendsList = document.getElementById('friends-list');
    if (friendsList) {
        friendsList.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const item = target.closest('.group-subitem');
            if (!item) return;
            openFriendProfileModal(item);
        });
    }

    if (friendProfileModal) {
        friendProfileModal.addEventListener('click', (e) => {
            if (e.target === friendProfileModal) {
                closeFriendProfileModal();
            }
        });
    }

    if (friendProfileFeedBtn) {
        friendProfileFeedBtn.addEventListener('click', () => {
            if (!activeFriendChatId) return;
            const targetChatId = activeFriendChatId;
            const avatarHtml = friendProfileAvatar ? friendProfileAvatar.innerHTML : defaultFriendAvatarHtml;
            closeFriendProfileModal();
            openFriendFeedModal(targetChatId, avatarHtml);
        });
    }

    if (closeFriendFeedBtn) {
        closeFriendFeedBtn.addEventListener('click', closeFriendFeedModal);
    }

    if (friendFeedWallpaper && friendFeedWallpaperInput) {
        friendFeedWallpaper.addEventListener('click', () => {
            friendFeedWallpaperInput.click();
        });
        friendFeedWallpaperInput.addEventListener('change', async (e) => {
            const input = e.target instanceof HTMLInputElement ? e.target : null;
            const file = input?.files?.[0];
            if (!file) return;
            try {
                const imageDataUrl = await readLineUserAvatarAsDataUrl(file);
                const wallpaperStyle = buildFriendFeedWallpaperStyle(imageDataUrl);
                friendFeedWallpaper.style.backgroundImage = wallpaperStyle;
                const chatId = String(friendFeedModal?.dataset?.chatId || '').trim();
                if (chatId) {
                    localStorage.setItem(getFriendFeedWallpaperStorageKey(chatId), imageDataUrl);
                }
            } catch (error) {
                showApiErrorModal(error instanceof Error ? error.message : '图片读取失败');
            } finally {
                input.value = '';
            }
        });
    }

    if (friendProfileInfoBtn) {
        friendProfileInfoBtn.addEventListener('click', () => {
            if (!activeFriendChatId) return;
            const targetChatId = activeFriendChatId;
            closeFriendProfileModal();
            openFriendChat(targetChatId);
        });
    }

    if (friendProfileDeleteBtn) {
        friendProfileDeleteBtn.addEventListener('click', () => {
            if (!activeFriendChatId) return;
            const targetChatId = activeFriendChatId;
            const displayName = friendProfileName ? friendProfileName.textContent.trim() : getChatDisplayName(targetChatId) || getChatRealName(targetChatId) || targetChatId;
            openFriendDeleteConfirmModal(displayName || targetChatId);
        });
    }

    if (friendDeleteConfirmModal) {
        friendDeleteConfirmModal.addEventListener('click', (e) => {
            if (e.target === friendDeleteConfirmModal) {
                closeFriendDeleteConfirmModal();
            }
        });
    }

    if (closeFriendDeleteConfirmBtn) {
        closeFriendDeleteConfirmBtn.addEventListener('click', closeFriendDeleteConfirmModal);
    }

    if (cancelFriendDeleteConfirmBtn) {
        cancelFriendDeleteConfirmBtn.addEventListener('click', closeFriendDeleteConfirmModal);
    }

    if (confirmFriendDeleteConfirmBtn) {
        confirmFriendDeleteConfirmBtn.addEventListener('click', () => {
            if (!activeFriendChatId) return;
            const targetChatId = activeFriendChatId;
            removeFriendData(targetChatId);
            closeFriendDeleteConfirmModal();
            closeFriendProfileModal();
        });
    }

    if (lineUserRow && lineUserSettingsModal) {
        lineUserRow.addEventListener('click', () => {
            lineUserDraft = getLineUsers().map((item) => ({ ...item }));
            lineSelectedUserId = getLineSelectedUserId();
            if (!lineUserDraft.some((item) => item.id === lineSelectedUserId)) {
                lineSelectedUserId = lineUserDraft[0]?.id || '';
            }
            renderLineUserSettingsList();
            openAppModal(lineUserSettingsModal);
        });
    }

    if (closeLineUserSettingsBtn && lineUserSettingsModal) {
        closeLineUserSettingsBtn.addEventListener('click', () => {
            closeAppModal(lineUserSettingsModal);
        });
    }

    if (saveLineUserSettingsBtn && lineUserSettingsModal) {
        saveLineUserSettingsBtn.addEventListener('click', () => {
            if (!lineUserSettingsList) return;
            const rows = Array.from(lineUserSettingsList.querySelectorAll('.line-user-settings-item'));
            const nextUsers = rows.map((row) => {
                const id = String(row.dataset.id || '').trim();
                const nameInput = row.querySelector('.line-user-name-input');
                const personaInput = row.querySelector('.line-user-persona-input');
                const existed = lineUserDraft.find((item) => item.id === id);
                return {
                    id: id || (crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()),
                    name: String(nameInput ? nameInput.value : existed?.name || '').trim(),
                    persona: String(personaInput ? personaInput.value : existed?.persona || ''),
                    avatar: String(existed?.avatar || '')
                };
            }).filter((item) => item.name);
            setLineUsers(nextUsers);
            let nextSelectedId = lineSelectedUserId;
            if (!nextUsers.some((item) => item.id === nextSelectedId)) {
                nextSelectedId = nextUsers[0]?.id || '';
            }
            setLineSelectedUserId(nextSelectedId);
            lineSelectedUserId = nextSelectedId;
            lineUserDraft = nextUsers.map((item) => ({ ...item }));
            renderLineHomeSummary();
            const originalText = saveLineUserSettingsBtn.textContent;
            saveLineUserSettingsBtn.textContent = '已存';
            saveLineUserSettingsBtn.style.backgroundColor = '#333';
            setTimeout(() => {
                saveLineUserSettingsBtn.textContent = originalText;
                saveLineUserSettingsBtn.style.backgroundColor = '#000000';
                closeAppModal(lineUserSettingsModal);
            }, 450);
        });
    }

    if (openLineUserAddModalBtn) {
        openLineUserAddModalBtn.addEventListener('click', openLineUserAddOverlay);
    }

    if (cancelLineUserAddBtn) {
        cancelLineUserAddBtn.addEventListener('click', closeLineUserAddOverlay);
    }

    if (lineUserAddOverlay) {
        lineUserAddOverlay.addEventListener('click', (e) => {
            if (e.target === lineUserAddOverlay) {
                closeLineUserAddOverlay();
            }
        });
    }

    if (confirmLineUserAddBtn && lineUserAddRealnameInput) {
        confirmLineUserAddBtn.addEventListener('click', () => {
            const name = lineUserAddRealnameInput.value.trim();
            if (!name) {
                alert('请输入真名');
                return;
            }
            lineUserDraft.unshift({
                id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                name,
                persona: '',
                avatar: ''
            });
            lineSelectedUserId = lineUserDraft[0].id;
            renderLineUserSettingsList();
            closeLineUserAddOverlay();
        });
    }

    if (lineUserSettingsList) {
        lineUserSettingsList.addEventListener('click', (e) => {
            const trigger = e.target.closest('.line-user-avatar-trigger');
            if (trigger) {
                const input = trigger.querySelector('.line-user-avatar-input');
                if (input) {
                    input.value = '';
                    input.click();
                }
                return;
            }

            const target = e.target;
            if (target instanceof HTMLElement && (target.closest('.line-user-name-input') || target.closest('.line-user-persona-input'))) {
                return;
            }

            const card = target instanceof HTMLElement ? target.closest('.line-user-settings-item') : null;
            if (!card) return;
            const id = String(card.dataset.id || '').trim();
            if (!id) return;
            lineSelectedUserId = id;
            renderLineUserSettingsList();
        });

        lineUserSettingsList.addEventListener('focusin', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const card = target.closest('.line-user-settings-item');
            if (!card) return;
            const id = String(card.dataset.id || '').trim();
            if (!id || id === lineSelectedUserId) return;
            lineSelectedUserId = id;
            renderLineUserSettingsList();
        });

        lineUserSettingsList.addEventListener('input', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const card = target.closest('.line-user-settings-item');
            if (!card) return;
            const id = String(card.dataset.id || '').trim();
            const item = lineUserDraft.find((user) => user.id === id);
            if (!item) return;
            if (target.classList.contains('line-user-name-input')) {
                item.name = String(target.value || '');
            }
            if (target.classList.contains('line-user-persona-input')) {
                item.persona = String(target.value || '');
            }
        });

        lineUserSettingsList.addEventListener('change', async (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (!target.classList.contains('line-user-avatar-input')) return;
            const file = target.files && target.files[0];
            if (!file || !/^image\//i.test(file.type)) return;
            const card = target.closest('.line-user-settings-item');
            if (!card) return;
            const id = String(card.dataset.id || '').trim();
            try {
                const dataUrl = await readLineUserAvatarAsDataUrl(file);
                const item = lineUserDraft.find((user) => user.id === id);
                if (item) {
                    item.avatar = dataUrl;
                    renderLineUserSettingsList();
                }
            } catch (error) {
                showApiErrorModal(error.message || '头像上传失败');
            }
        });
    }

    renderLineHomeSummary();

    initAddFriendLogic();
    initChatRoomLogic();
    initGlobalPersistence();
    initWorldBookApp();
    initCharacterImportLogic();
}
