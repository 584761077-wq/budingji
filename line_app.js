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

    const cotToggle = document.getElementById('chat-cot-toggle');

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

        // 加载 CoT 开关状态（默认开启）
        const cotEnabled = localStorage.getItem('chat_cot_enabled_' + chatId) !== 'false';
        if (cotToggle) {
            cotToggle.checked = cotEnabled;
        }
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

            if (cotToggle) {
                localStorage.setItem('chat_cot_enabled_' + chatId, cotToggle.checked ? 'true' : 'false');
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
                if (typeof startAutoSummaryWorker === 'function') {
                    startAutoSummaryWorker(chatId);
                }
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

            if (typeof updateManualSummaryUI === 'function') {
                updateManualSummaryUI(chatId);
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

// 5. 聊天室功能逻辑
function initChatRoomLogic() {
    const chatRoom = document.getElementById('chat-room');
    const chatRoomName = document.getElementById('chat-room-name');
    const backBtn = document.getElementById('chat-room-back');
    const chatList = document.getElementById('line-chat-list');
    const toastStack = document.getElementById('incoming-message-toast-stack');
    
    // 输入相关元素
    const inputCapsule = document.querySelector('.chat-input-capsule');
    const inputField = inputCapsule ? inputCapsule.querySelector('.chat-input-field') : null;
    const sendBtn = document.getElementById('trigger-ai-btn');
    const chatContent = document.querySelector('.chat-room-content');
    const chatTimezoneIndicator = document.getElementById('chat-timezone-indicator');
    const replyPreview = document.getElementById('chat-reply-preview');
    const replyPreviewText = document.getElementById('chat-reply-preview-text');
    const replyPreviewClose = document.getElementById('chat-reply-preview-close');
    const chatRoomFooter = document.querySelector('.chat-room-footer');

    if (inputField && chatRoomFooter) {
        inputField.addEventListener('focus', () => {
            chatRoomFooter.classList.add('keyboard-open');
            // 核心修复：彻底解决 iOS 键盘顶起导致的灰条与闪屏
            // 将 body 固定，强制禁止浏览器原生推挤滚动
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            
            setTimeout(() => {
                if (chatContent) chatContent.scrollTop = chatContent.scrollHeight;
            }, 300); // 键盘弹起动画大约需要 250-300ms
        });
        
        inputField.addEventListener('blur', () => {
            chatRoomFooter.classList.remove('keyboard-open');
            // 恢复页面原本流状态
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            if (chatRoom) {
                chatRoom.style.height = '100%';
            }
            window.scrollTo(0, 0);
        });
    }

    // 使用 VisualViewport 监听键盘弹起，动态计算真实可用高度
    if (window.visualViewport) {
        let lastViewportHeight = window.visualViewport.height;

        const resetViewportScroll = () => {
            if (chatRoomFooter && chatRoomFooter.classList.contains('keyboard-open')) {
                // 如果当前视口高度发生了变化（键盘弹起或收起中），则不干预滚动，让其自然过渡
                if (window.visualViewport.height !== lastViewportHeight) return;
                
                // 仅在视口尺寸稳定时，检测到偏移才强制拉回，避免动画冲突
                if (window.scrollY > 0 || window.visualViewport.pageTop > 0) {
                    window.scrollTo(0, 0); 
                }
            }
        };

        window.visualViewport.addEventListener('resize', () => {
            lastViewportHeight = window.visualViewport.height;
            if (chatRoomFooter && chatRoomFooter.classList.contains('keyboard-open')) {
                // 实时同步可视区高度，让底栏完美贴紧键盘上方
                const vh = window.visualViewport.height + 'px';
                document.body.style.height = vh;
                if (chatRoom) {
                    chatRoom.style.height = vh;
                }
                window.scrollTo(0, 0);
                if (chatContent) {
                    chatContent.scrollTop = chatContent.scrollHeight;
                }
            }
        });

        // 监听视口滚动，当 iOS/Android 浏览器试图强行将整个页面推上去时，把它拉回来
        window.visualViewport.addEventListener('scroll', resetViewportScroll);
        // 也监听 document 的滚动事件，作为双保险
        document.addEventListener('scroll', resetViewportScroll, { passive: true });
    }

    // 聊天状态管理
    const chatStates = {}; // key: chatId, value: { isSending: boolean }
    const originalSendBtnIcon = sendBtn ? sendBtn.innerHTML : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2z"></path></svg>';
    let pendingQuote = null;
    const HISTORY_PAGE_SIZE = 30;
    const TIMESTAMP_INTERVAL_MS = 5 * 60 * 1000;
    const chatHistoryViewStates = {};
    let activeLoadMoreChatId = '';
    const themeStorageKey = 'theme_categories_v1';
    const themeTargetStorageKey = 'theme_category_targets_v1';
    const themeStyleId = 'line-chat-theme-style';

    function ensureThemeStyleTag() {
        let styleTag = document.getElementById(themeStyleId);
        if (styleTag) return styleTag;
        styleTag = document.createElement('style');
        styleTag.id = themeStyleId;
        document.head.appendChild(styleTag);
        return styleTag;
    }

    function clearChatTheme() {
        const styleTag = ensureThemeStyleTag();
        styleTag.textContent = '';
    }

    function applyChatTheme(chatId) {
        ThemeEngine.applyThemeToChatRoom(chatId);
    }

    window.addEventListener('theme-binding-updated', () => {
        if (!chatRoom || chatRoom.style.display === 'none') return;
        const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
        if (!chatId) return;
        applyChatTheme(chatId);
    });

    function updateSendButtonState(chatId) {
        if (!sendBtn) return;
        // 只有当前显示的聊天室匹配时才更新按钮
        if (!isChatRoomOpenFor(chatId)) return;
        
        const isSending = chatStates[chatId]?.isSending;
        if (isSending) {
             sendBtn.innerHTML = `<svg class="loading-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
             sendBtn.disabled = true;
             sendBtn.classList.add('loading');
        } else {
             sendBtn.innerHTML = originalSendBtnIcon;
             sendBtn.disabled = false;
             sendBtn.classList.remove('loading');
        }
    }

    function parseTimeToMinutes(timeStr) {
        const raw = String(timeStr || '').trim();
        const matched = raw.match(/^(\d{1,2}):(\d{1,2})$/);
        if (!matched) return null;
        const h = parseInt(matched[1], 10);
        const m = parseInt(matched[2], 10);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        return h * 60 + m;
    }

    function normalizeTimestamp(rawTs) {
        const value = Number(rawTs);
        if (!Number.isFinite(value)) return null;
        return value > 1e12 ? value : value * 1000;
    }

    function formatTimeDividerLabel(currentMeta, previousMeta) {
        const safeTime = String(currentMeta.timeStr || '').trim();
        const normalizedTs = normalizeTimestamp(currentMeta.ts);
        if (!normalizedTs) return safeTime || '刚刚';
        const date = new Date(normalizedTs);
        
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        let isNewDay = true;
        if (previousMeta && previousMeta.ts) {
            const prevTs = normalizeTimestamp(previousMeta.ts);
            if (prevTs) {
                const prevDate = new Date(prevTs);
                isNewDay = (prevDate.getFullYear() !== date.getFullYear() || 
                            prevDate.getMonth() !== date.getMonth() || 
                            prevDate.getDate() !== date.getDate());
            }
        }
        
        if (isNewDay) {
            return `${month}月${day}日 ${hh}:${mm}`;
        }
        return `${hh}:${mm}`;
    }

    function findFirstRenderableNode() {
        return Array.from(chatContent.children).find((node) => !node.classList.contains('chat-load-more-wrap')) || null;
    }

    function findLastMessageRow() {
        const rows = chatContent.querySelectorAll('.message-row');
        return rows.length > 0 ? rows[rows.length - 1] : null;
    }

    function shouldInsertTimeDivider(previousMeta, currentMeta, forceTimeDivider) {
        if (forceTimeDivider) return true;
        if (!previousMeta) return true;
        const prevTs = normalizeTimestamp(previousMeta.ts);
        const curTs = normalizeTimestamp(currentMeta.ts);
        if (prevTs && curTs) {
            return (curTs - prevTs) >= TIMESTAMP_INTERVAL_MS;
        }
        const prevMinutes = parseTimeToMinutes(previousMeta.timeStr);
        const curMinutes = parseTimeToMinutes(currentMeta.timeStr);
        if (prevMinutes !== null && curMinutes !== null) {
            const diff = curMinutes - prevMinutes;
            return diff >= 5 || diff < 0;
        }
        return previousMeta.timeStr !== currentMeta.timeStr;
    }

    function renderTimeDivider(currentMeta, options = {}) {
        const divider = document.createElement('div');
        divider.className = 'chat-time-divider';
        divider.textContent = formatTimeDividerLabel(currentMeta, options.previousMeta);
        if (options.prepend) {
            const anchor = options.anchor || findFirstRenderableNode();
            if (anchor) {
                chatContent.insertBefore(divider, anchor);
            } else {
                chatContent.appendChild(divider);
            }
            return;
        }
        chatContent.appendChild(divider);
    }

    function normalizeChatHistory(chatId) {
        let history = largeStore.get('chat_history_' + chatId, []);
        let hasChanges = false;
        history = history.map((msg) => {
            const normalized = { ...msg };
            if (!normalized.id) {
                normalized.id = crypto.randomUUID();
                hasChanges = true;
            }
            if (!Number.isFinite(Number(normalized.ts))) {
                normalized.ts = null;
            } else {
                normalized.ts = Number(normalized.ts);
            }
            return normalized;
        });
        if (hasChanges) {
            largeStore.put('chat_history_' + chatId, history);
            if (history.length > 0) {
                const lastMsg = history[history.length - 1];
                localStorage.setItem('chat_last_message_' + chatId, JSON.stringify({ message: lastMsg, ts: lastMsg.ts }));
            }
        }
        return history;
    }

    function updateLoadMoreVisibility(chatId) {
        const wrap = chatContent.querySelector('.chat-load-more-wrap');
        const btn = chatContent.querySelector('.chat-load-more-btn');
        const state = chatHistoryViewStates[chatId];
        if (!wrap || !btn || !state) return;
        if (state.startIndex <= 0) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = '加载更多消息';
    }

    function renderHistoryBatch(chatId, messages, startIndex, options = {}) {
        let previousMeta = options.previousMeta || null;
        messages.forEach((msg, index) => {
            const currentMeta = { timeStr: msg.time, ts: msg.ts };
            const forceTimeDivider = options.forceFirstDivider ? index === 0 : false;
            appendMessageToUI(
                msg.role,
                msg.content,
                msg.time,
                chatId,
                msg.id,
                msg,
                {
                    autoScroll: false,
                    prepend: !!options.prepend,
                    forceTimeDivider,
                    previousMeta,
                    anchor: options.anchor || null
                }
            );
            previousMeta = currentMeta;
        });
    }

    function loadMoreHistory(chatId) {
        const state = chatHistoryViewStates[chatId];
        if (!state || state.startIndex <= 0) return;
        const nextStart = Math.max(0, state.startIndex - HISTORY_PAGE_SIZE);
        const chunk = state.history.slice(nextStart, state.startIndex);
        const prevHeight = chatContent.scrollHeight;
        const prevTop = chatContent.scrollTop;
        const anchor = findFirstRenderableNode();
        renderHistoryBatch(chatId, chunk, nextStart, { prepend: true, forceFirstDivider: true, anchor });
        state.startIndex = nextStart;
        updateLoadMoreVisibility(chatId);
        const currentHeight = chatContent.scrollHeight;
        chatContent.scrollTop = Math.max(0, currentHeight - prevHeight + prevTop);
    }

    function ensureLoadMoreControl(chatId) {
        activeLoadMoreChatId = chatId;
        let wrap = chatContent.querySelector('.chat-load-more-wrap');
        let btn = chatContent.querySelector('.chat-load-more-btn');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'chat-load-more-wrap';
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chat-load-more-btn';
            btn.textContent = '加载更多消息';
            wrap.appendChild(btn);
            chatContent.prepend(wrap);
        }
        if (btn) {
            btn.onclick = () => {
                if (!activeLoadMoreChatId) return;
                loadMoreHistory(activeLoadMoreChatId);
            };
        }
    }

    // 加载历史记录
    function loadChatHistory(chatId) {
        if (isMultiSelectMode) {
            exitMultiSelectMode();
        }
        const transferChanged = processTransferExpiry(chatId);
        if (transferChanged) {
            refreshChatListPreviewFor(chatId);
        }
        chatContent.innerHTML = '';
        const history = normalizeChatHistory(chatId);
        const startIndex = Math.max(0, history.length - HISTORY_PAGE_SIZE);
        chatHistoryViewStates[chatId] = {
            history,
            startIndex
        };
        ensureLoadMoreControl(chatId);
        const chunk = history.slice(startIndex);
        renderHistoryBatch(chatId, chunk, startIndex, { forceFirstDivider: true });
        updateLoadMoreVisibility(chatId);
        chatContent.scrollTop = chatContent.scrollHeight;
        
        if (typeof startAutoSummaryWorker === 'function') {
            startAutoSummaryWorker(chatId);
        }
    }

    function isChatRoomOpenFor(chatId) {
        if (!chatRoom || chatRoom.style.display === 'none') return false;
        const currentChatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
        return currentChatId === chatId;
    }

    function toPlainMessageText(content) {
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
        if (content.includes('chat-inline-sticker')) return '发送了一条贴图消息';
        if (content.includes('camera-photo-placeholder')) return '发送了一张图片';
        if (/<img[^>]*src=["']data:image\/[^"']+["'][^>]*>/i.test(content)) return '发送了一张本地图片';
        return '';
    }

    function truncateQuoteText(text) {
        const raw = String(text || '').replace(/\s+/g, ' ').trim();
        if (!raw) return '引用消息';
        return raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
    }

    function updateReplyPreviewUI() {
        if (!replyPreview || !replyPreviewText) return;
        if (!pendingQuote) {
            replyPreview.style.display = 'none';
            replyPreviewText.textContent = '';
            return;
        }
        replyPreview.style.display = 'flex';
        replyPreviewText.textContent = `引用：${truncateQuoteText(pendingQuote.text)}`;
    }

    function clearPendingQuote() {
        pendingQuote = null;
        updateReplyPreviewUI();
    }

    function showIncomingMessageToast(chatId, content) {
        if (!toastStack) return;
        if (isChatRoomOpenFor(chatId)) return;

        const toast = document.createElement('div');
        toast.className = 'ins-message-toast';
        const preview = toPlainMessageText(content) || '你收到了一条新消息';
        const title = getChatDisplayName(chatId) || getChatRealName(chatId) || chatId;
        toast.innerHTML = `
            <div class="ins-message-toast-title">${title}</div>
            <div class="ins-message-toast-content">${preview}</div>
        `;
        toastStack.prepend(toast);
        while (toastStack.children.length > 3) {
            toastStack.removeChild(toastStack.lastElementChild);
        }
        setTimeout(() => {
            toast.remove();
        }, 2800);
    }

    async function showIncomingMessageSystemNotification(chatId, content) {
        if (!budingjiShouldTriggerBackgroundPush()) return;
        const title = getChatDisplayName(chatId) || getChatRealName(chatId) || chatId;
        const preview = toPlainMessageText(content) || '你收到了一条新消息';
        try {
            await budingjiShowSystemNotification({
                title,
                body: preview,
                tag: `budingji-chat-${chatId}`,
                data: {
                    chatId,
                    url: `./index.html#chat=${encodeURIComponent(chatId)}`
                }
            });
        } catch (error) {
            console.log('System notification failed:', error);
        }
    }

    // 保存消息
    function saveMessage(chatId, role, content, extra = {}) {
    const history = largeStore.get('chat_history_' + chatId, []);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMsg = { id: crypto.randomUUID(), role, content, time: timeStr, ts: Date.now(), ...extra };

    history.push(newMsg);
    largeStore.put('chat_history_' + chatId, history);
    localStorage.setItem('chat_last_message_' + chatId, JSON.stringify({ message: newMsg, ts: newMsg.ts }));

    const state = chatHistoryViewStates[chatId];
    if (state && Array.isArray(state.history)) {
        if (state.history !== history) {
            state.history.push(newMsg);
        }
    }

    refreshChatListPreviewFor(chatId);

    Promise.resolve().then(() => {
        if (typeof startAutoSummaryWorker === 'function') {
            startAutoSummaryWorker(chatId);
        } else {
            triggerAutoSummaryIfNeeded(chatId).catch((error) => {
                console.error('Auto summary trigger failed:', error);
            });
        }
    });

    return newMsg;
}

    // 添加消息到 UI
    function appendMessageToUI(role, content, timeStr, chatId, id, extra = {}, options = {}) {
        // 防止串台：只有当前打开的聊天室是该角色时才上屏
        if (!isChatRoomOpenFor(chatId)) return;
        const shouldPrepend = !!options.prepend;
        const shouldAutoScroll = options.autoScroll !== false;
        const currentMeta = {
            timeStr,
            ts: extra && Number.isFinite(Number(extra.ts)) ? Number(extra.ts) : null
        };
        let previousMeta = options.previousMeta || null;
        if (!previousMeta && !shouldPrepend) {
            const lastRow = findLastMessageRow();
            if (lastRow) {
                previousMeta = {
                    timeStr: lastRow.dataset.time || '',
                    ts: lastRow.dataset.ts || null
                };
            }
        }
        if (shouldInsertTimeDivider(previousMeta, currentMeta, !!options.forceTimeDivider)) {
            renderTimeDivider(currentMeta, { prepend: shouldPrepend, anchor: options.anchor || null, previousMeta: previousMeta });
        }

        const msgRow = document.createElement('div');
        const quote = extra && extra.quote ? extra.quote : null;
        
        if (role === 'system') {
            msgRow.className = 'message-row system-message';
            if (options.isNew) msgRow.classList.add('new-message-anim');
            msgRow.dataset.id = id;
            msgRow.dataset.time = String(timeStr || '');
            msgRow.dataset.ts = currentMeta.ts ? String(currentMeta.ts) : '';
            msgRow.innerHTML = `<div class="system-message-content">${escapeHtml(content)}</div>`;
        } else {
            msgRow.className = `message-row ${role === 'user' ? 'right' : 'left'}`;
            if (options.isNew) msgRow.classList.add('new-message-anim');
            if (quote) msgRow.classList.add('has-quote');
            msgRow.dataset.id = id;
            msgRow.dataset.time = String(timeStr || '');
            msgRow.dataset.ts = currentMeta.ts ? String(currentMeta.ts) : '';
        }
        const isStickerMessage = typeof content === 'string' && content.includes('chat-inline-sticker');
        const isCameraPlaceholder = typeof content === 'string' && content.includes('camera-photo-placeholder');
        const transferData = extra && extra.transfer ? normalizeTransferPayload(extra.transfer) : null;
        const voiceData = extra && extra.voice ? extra.voice : null;
        const voiceDuration = voiceData ? Math.max(1, Number(voiceData.duration) || 1) : 0;
        const voiceTranscriptRaw = voiceData ? String(voiceData.transcript || content || '') : '';
        const safeVoiceTranscript = escapeHtml(voiceTranscriptRaw.trim() || '无可用转文字内容');
        let bubbleContent = voiceData
            ? `<button class="voice-message-btn" type="button"><span class="voice-message-duration">${voiceDuration}"</span><span class="voice-message-wave"><span class="voice-wave-bar"></span><span class="voice-wave-bar"></span><span class="voice-wave-bar"></span></span></button><div class="voice-transcript" style="display:none;">${safeVoiceTranscript}</div>`
            : content;
        const quotePreview = quote ? truncateQuoteText(quote.text) : '';
        
        // 头像逻辑
        let avatarContent = '';
        if (role === 'user') {
            const userAvatarRef = localStorage.getItem('chat_user_avatar_' + chatId);
            if (userAvatarRef) {
                if (isMediaRef(userAvatarRef)) {
                    avatarContent = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
                    mediaResolveRef(userAvatarRef).then((url) => {
                        const row = document.querySelector(`.message-row[data-id="${CSS.escape(id)}"] .message-avatar`);
                        if (row && url) row.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    });
                } else {
                    avatarContent = `<img src="${userAvatarRef}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            } else {
                avatarContent = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4--4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }
        } else {
            const currentAvatar = localStorage.getItem('chat_avatar_' + chatId);
            const defaultSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            if (currentAvatar) {
                if (isMediaRef(currentAvatar)) {
                    avatarContent = defaultSvg;
                    mediaResolveRef(currentAvatar).then((url) => {
                        const row = document.querySelector(`.message-row[data-id="${CSS.escape(id)}"] .message-avatar`);
                        if (row && url) row.innerHTML = `<img src="${url}" alt="avatar">`;
                    });
                } else {
                    avatarContent = `<img src="${currentAvatar}" alt="avatar">`;
                }
            } else {
                avatarContent = defaultSvg;
            }
        }

        const translationText = extra && extra.translation ? extra.translation : '';
        let translationHtml = '';
        
        if (translationText) {
            const bilingualStyle = localStorage.getItem('chat_bilingual_style_' + chatId) || 'outside';
            if (bilingualStyle === 'inside') {
                bubbleContent += `<hr style="border:none; border-top: 1px solid rgba(0,0,0,0.1); margin: 4px 0;" /><span style="font-size:0.85em; color:#86868b;">${escapeHtml(translationText).replace(/\n/g, '<br>')}</span>`;
            } else {
                translationHtml = `<div class="message-translation" style="display: none; font-size: 0.85rem; color: #86868b; margin-top: 4px; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 8px; line-height: 1.4; word-break: break-word;">${escapeHtml(translationText).replace(/\n/g, '<br>')}</div>`;
            }
        }

        const bubbleClasses = [
            'message-bubble',
            isStickerMessage ? 'sticker-bubble' : '',
            voiceData ? 'voice-bubble' : ''
        ].filter(Boolean).join(' ');
        const bubbleMarkup = transferData
            ? `<div class="message-special">${renderTransferCardMarkup(role, transferData, id)}</div>`
            : isCameraPlaceholder
            ? `<div class="message-special">${bubbleContent}</div>`
            : `<div class="${bubbleClasses}">${bubbleContent}</div>`;

        if (role !== 'system') {
            msgRow.innerHTML = `
                <div class="message-avatar">${avatarContent}</div>
                <div class="message-container">
                    <div class="message-main">
                        ${bubbleMarkup}
                        ${translationHtml}
                        ${quote ? `<button class="message-quote-anchor" type="button" data-quote-id="${escapeHtml(quote.id)}" title="${escapeHtml(quote.text || '')}">${escapeHtml(quotePreview)}</button>` : ''}
                    </div>
                    <div class="message-meta-info">
                        ${role === 'user' ? '<div class="meta-read">Read</div>' : ''}
                        <div class="meta-time">${timeStr}</div>
                    </div>
                </div>
            `;
        }
        
        // 双语模式：点击气泡显示/隐藏翻译
        if (translationText) {
            const bubbleEl = msgRow.querySelector('.message-bubble, .message-special');
            const transEl = msgRow.querySelector('.message-translation');
            if (bubbleEl && transEl) {
                bubbleEl.addEventListener('click', (e) => {
                    // 如果点击的是图片等内部元素，可能需要冒泡，但如果是普通文本气泡直接处理
                    if (transEl.style.display === 'none') {
                        transEl.style.display = 'block';
                    } else {
                        transEl.style.display = 'none';
                    }
                });
            }
        }
        const resolveMediaImagesInElement = (el) => {
            const imgs = el.querySelectorAll('img');
            imgs.forEach((img) => {
                const src = String(img.getAttribute('src') || '').trim();
                if (/^media:/i.test(src)) {
                    mediaResolveRef(src).then((url) => {
                        if (url) img.setAttribute('src', url);
                    });
                }
            });
        };
        resolveMediaImagesInElement(msgRow);

        if (role === 'assistant' && extra && extra.thinkNote) {
            const avatarEl = msgRow.querySelector('.message-avatar');
            if (avatarEl) {
                avatarEl.style.cursor = 'pointer';
                avatarEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const existing = document.querySelectorAll('.think-note-sticky');
                    existing.forEach((el) => el.remove());
                    const rect = avatarEl.getBoundingClientRect();
                    const panel = document.createElement('div');
                    panel.className = 'think-note-sticky';
                    panel.style.position = 'fixed';
                    panel.style.left = '50%';
                    panel.style.top = '50%';
                    panel.style.transform = 'translate(-50%, -50%)';
                    panel.style.zIndex = '9999';
                    panel.style.background = '#fff5f7';
                    panel.style.color = '#444';
                    panel.style.border = '1px solid rgba(0,0,0,0.06)';
                    panel.style.borderRadius = '12px';
                    panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2), 0 0 0 100vw rgba(0,0,0,0.4)';
                    panel.style.padding = '20px 24px';
                    panel.style.width = '80vw';
                    panel.style.maxWidth = '400px';
                    panel.style.maxHeight = '70vh';
                    panel.style.overflowY = 'auto';
                    panel.style.fontSize = '0.92rem';
                    panel.style.lineHeight = '1.6';
                    panel.style.wordBreak = 'break-word';

                    let formattedNote = escapeHtml(String(extra.thinkNote || '')).trim();
                    formattedNote = formattedNote.replace(/\n+/g, '\n');
                    formattedNote = formattedNote.replace(/\n(Q\d+[:：])/ig, '\n\n$1');
                    
                    formattedNote = formattedNote.split('\n').map(line => {
                        if (/^Q\d+[:：]/i.test(line)) {
                            return `<strong style="color:#222; font-weight:700; font-size: 1.05em;">${line}</strong>`;
                        } else if (/^A\d+[:：]/i.test(line)) {
                            return `<strong style="color:#444; font-weight:600; font-size: 0.95em;">${line}</strong>`;
                        } else if (line.trim()) {
                            // 其他文本
                            return `<span style="color:#555; font-size: 0.9em;">${line}</span>`;
                        }
                        return line;
                    }).join('<br>');

                    panel.innerHTML = `<div>${formattedNote}</div>`;
                    document.body.appendChild(panel);
                    const onDocClick = (ev) => {
                        if (!panel.contains(ev.target)) {
                            panel.remove();
                        }
                    };
                    setTimeout(() => {
                        document.addEventListener('click', onDocClick, { once: true });
                    }, 0);
                });
            }
        }

        // 心绪精灵逻辑 (Mood Sprite)
        // 仅当包含 sprite 数据且未被 dismissed (除非被收藏) 时显示
        if (role === 'assistant' && extra && extra.sprite) {
             const isDismissed = extra.sprite.isDismissed;
             const isFavorited = extra.sprite.isFavorited;

             if (!isDismissed || isFavorited) {
                 // 将精灵附加到 message-row，而不是 avatar 内部，以便更自由地飘动
                 // 计算随机位置 (基于 message-row 的相对坐标)
                 const spriteEl = document.createElement('div');
                 spriteEl.className = 'mood-sprite';
                 spriteEl.style.backgroundColor = extra.sprite.color || '#FFD700';
                 spriteEl.textContent = '✦'; 
                 spriteEl.title = `心情: ${extra.sprite.mood}`;
                 
                 // 随机位置逻辑：
                 // X: 从头像右侧 (约50px) 到 屏幕宽度的 60% 左右，避免太靠右
                 // Y: 在当前行高度范围内上下浮动
                 const randomX = 50 + Math.random() * 150; // 50px ~ 200px
                 const randomY = Math.random() * 40 - 20;  // -20px ~ 20px
                 
                 // 初始位置 (头像处)
                 spriteEl.style.left = '40px';
                 spriteEl.style.top = '10px';
                 spriteEl.style.opacity = '0';
                 spriteEl.style.transform = 'scale(0.5)';

                 msgRow.appendChild(spriteEl);

                 // 触发动画
                 // 使用 setTimeout 确保 DOM 插入后再改变样式触发 transition
                 setTimeout(() => {
                     spriteEl.style.transition = 'all 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                     spriteEl.style.left = `${randomX}px`;
                     spriteEl.style.top = `${10 + randomY}px`;
                     spriteEl.style.opacity = '1';
                     spriteEl.style.transform = 'scale(1) rotate(360deg)';
                     
                     // 动画结束后，添加漂浮动画
                     setTimeout(() => {
                         spriteEl.style.animation = 'popOutFloat 4s ease-in-out infinite alternate';
                     }, 1500);
                 }, 50);

                 spriteEl.addEventListener('click', (e) => {
                     e.stopPropagation();
                    showSpriteModal(extra.sprite, chatId, id, spriteEl);
                 });
             }
        }
        
        // 绑定长按事件
        const bubble = msgRow.querySelector('.message-bubble, .message-special');
        const quoteAnchor = msgRow.querySelector('.message-quote-anchor');
        let pressTimer;

        if (quoteAnchor) {
            quoteAnchor.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = quoteAnchor.dataset.quoteId;
                if (!targetId) return;
                const targetRow = Array.from(chatContent.querySelectorAll('.message-row')).find((row) => row.dataset.id === targetId);
                if (!targetRow) return;
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetRow.classList.add('quoted-target');
                setTimeout(() => targetRow.classList.remove('quoted-target'), 1300);
            });
        }

        if (voiceData && bubble) {
            bubble.addEventListener('click', (e) => {
                if (isMultiSelectMode) return;
                const transcriptEl = bubble.querySelector('.voice-transcript');
                if (!transcriptEl) return;
                const willShow = transcriptEl.style.display === 'none' || transcriptEl.style.display === '';
                transcriptEl.style.display = willShow ? 'block' : 'none';
                bubble.classList.toggle('voice-expanded', willShow);
                e.stopPropagation();
            });
        }

        if (bubble) {
            // 触摸设备
            bubble.addEventListener('touchstart', (e) => {
                if (isMultiSelectMode) return;
                pressTimer = setTimeout(() => {
                    if (isMultiSelectMode) return;
                    showContextMenu(e, id, content, chatId, role, timeStr);
                }, 500); // 500ms 长按
            });

            bubble.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
            });

            bubble.addEventListener('touchmove', () => {
                clearTimeout(pressTimer); // 移动取消长按
            });

            // 桌面设备 (鼠标右键或长按模拟)
            bubble.addEventListener('mousedown', (e) => {
                if (isMultiSelectMode) return;
                // 左键长按
                if (e.button === 0) {
                    pressTimer = setTimeout(() => {
                        if (isMultiSelectMode) return;
                        showContextMenu(e, id, content, chatId, role, timeStr);
                    }, 500);
                }
            });

            bubble.addEventListener('mouseup', () => {
                clearTimeout(pressTimer);
            });
            
            bubble.addEventListener('mouseleave', () => {
                clearTimeout(pressTimer);
            });

            // 阻止默认右键菜单
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (isMultiSelectMode) return;
                showContextMenu(e, id, content, chatId, role, timeStr);
            });
        }

        if (shouldPrepend) {
            const anchor = options.anchor || findFirstRenderableNode();
            if (anchor) {
                chatContent.insertBefore(msgRow, anchor);
            } else {
                chatContent.appendChild(msgRow);
            }
        } else {
            chatContent.appendChild(msgRow);
        }
        if (shouldAutoScroll) {
            chatContent.scrollTop = chatContent.scrollHeight;
        }
    }

    // 回车仅发送上屏（不触发 AI）
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = inputField.value.trim();
                if (!text) return;

                const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
                const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
                const newMsg = saveMessage(chatId, 'user', text, extra);
                appendMessageToUI('user', text, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });
                inputField.value = '';
                clearPendingQuote();
            }
        });
    }

    // 点击发送按钮触发 AI
    if (sendBtn) {
        let sendBtnTouchHandled = false;

        // 阻止 mousedown 默认行为，防止 PC 端点击时输入框失焦
        sendBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        // 阻止 touchstart 默认行为，防止移动端点击时键盘收起
        sendBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });

        // 在 touchend 执行发送
        sendBtn.addEventListener('touchend', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            sendBtnTouchHandled = true;
            setTimeout(() => { sendBtnTouchHandled = false; }, 300); // 防止标志位卡死
            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            await triggerAIResponse(chatId);
        }, { passive: false });

        sendBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (sendBtnTouchHandled) {
                sendBtnTouchHandled = false;
                return;
            }
            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            await triggerAIResponse(chatId);
            if (inputField) {
                inputField.focus(); // PC 端可能需要重新获取焦点
            }
        });
    }

    function decodeHtmlEntities(value) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = value;
        return textarea.value;
    }

    function normalizeMessageForModel(content) {
        if (typeof content !== 'string') return '';
        const temp = document.createElement('div');
        temp.innerHTML = content;
        temp.querySelectorAll('.camera-photo-placeholder').forEach((el) => {
            const text = String(el.dataset.photoText || '').trim();
            const token = `[图片:${text || '无描述'}]`;
            el.replaceWith(document.createTextNode(token));
        });

        let normalized = temp.innerHTML.replace(/<img[^>]*class=["'][^"']*chat-inline-sticker[^"']*["'][^>]*>/gi, (imgTag) => {
            const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
            const rawName = altMatch ? altMatch[1] : '未命名表情';
            const stickerName = decodeHtmlEntities(rawName).trim() || '未命名表情';
            return `[贴图:${stickerName}]`;
        });

        normalized = normalized.replace(/<img[^>]*>/gi, (imgTag) => isLocalImageTag(imgTag) ? '[本地图片]' : imgTag);
        
        // 剪掉思维链和心绪精灵的残留标签，给历史记录减负
        normalized = normalized.replace(/<think_note>[\s\S]*?<\/think_note>/ig, '');
        normalized = normalized.replace(/<mood_sprite\b[^>]*>[\s\S]*?(?:<\/mood_sprite\s*>|$)/ig, '');
        normalized = normalized.replace(/<\/?mood_sprite\b[^>]*>/ig, '');
        
        normalized = normalized.replace(/<[^>]+>/g, '');
        return decodeHtmlEntities(normalized).trim();
    }

    function formatTurnInputForModel(msg) {
        if (!msg) return '';
        const normalized = normalizeMessageForModel(msg.content);
        if (msg.voice) {
            const duration = Math.max(1, Number(msg.voice.duration) || estimateVoiceDurationSeconds(normalized));
            const transcript = normalized || String(msg.voice.transcript || '').trim() || '无';
            return `[语音消息 ${duration}" 转文字: ${transcript}]`;
        }
        return normalized;
    }

    function formatHistoryMessageForModel(msg, speaker) {
        const turnText = formatTurnInputForModel(msg);
        return `${speaker}: ${turnText || '无'}`;
    }

  function buildTurnInputBlockForModel(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return '';

    const parts = messages.map((msg) => {
        if (!msg || (msg.role !== 'user' && msg.role !== 'system')) return '';

        const blocks = [];
        const quote = msg.quote || (msg.extra && msg.extra.quote) || null;

        if (quote && quote.text) {
            blocks.push('[用户当前正在引用一条消息]');
            blocks.push(`引用内容：${String(quote.text).trim()}`);
        }

        const turnText = formatTurnInputForModel(msg);
        if (msg.role === 'system') {
            blocks.push(`[系统/旁白消息]\n${turnText}`);
        } else {
            blocks.push(turnText);
        }

        return blocks.filter(Boolean).join('\n');
    }).map((text) => String(text || '').trim()).filter(Boolean);

    return parts.join('\n\n');
}

    function parseAssistantVoiceMessage(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return null;
        const match = text.match(/^\[语音\]([\s\S]*?)\[\/语音\]$/i) || text.match(/^<voice>([\s\S]*?)<\/voice>$/i);
        if (!match) return null;
        const transcript = String(match[1] || '').trim();
        if (!transcript) return null;
        return {
            transcript,
            duration: estimateVoiceDurationSeconds(transcript)
        };
    }

    function parseAssistantPhotoMessage(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return null;
        const match = text.match(/^<photo>([\s\S]*?)<\/photo>$/i)
            || text.match(/^\[(?:图片|照片|文字图)\]([\s\S]*?)\[\/(?:图片|照片|文字图)\]$/i)
            || text.match(/^(?:\[|【)\s*(?:图片|照片|文字图)\s*[:：]\s*([^\]】\n]+)\s*(?:\]|】)$/i);
        if (!match) return null;
        const content = String(match[1] || '').trim();
        return {
            text: content || '无描述'
        };
    }

    function buildCameraPlaceholderHtml(rawText) {
        const text = String(rawText || '').trim();
        const safeText = escapeHtml(text || '无描述');
        return `
            <div class="camera-photo-placeholder" data-photo-text="${safeText}" title="点击查看图片内容">
                <div class="camera-photo-icon"></div>
                <div class="camera-photo-label">图片</div>
            </div>
        `;
    }

    function parseAssistantTransferMessage(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return null;
        const match = text.match(/^(?:\[|【)\s*转账\s*[:：]\s*([0-9]+(?:\.[0-9]{1,2})?)(?:\s*[|｜]\s*([^\]】\n]*))?\s*(?:\]|】)$/i);
        if (!match) return null;
        const amount = Number(match[1]);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return {
            amount: Number(amount.toFixed(2)),
            note: String(match[2] || '').trim()
        };
    }

    function parseAssistantTransferDecisionMessage(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return null;
        const match = text.match(/^(?:\[|【)\s*转账处理\s*[:：]\s*(收款|拒绝|拒收|accept|reject)(?:\s*[|｜]\s*([^\]】\n|｜]+))?\s*(?:\]|】)$/i);
        if (!match) return null;
        const actionText = String(match[1] || '').trim().toLowerCase();
        const action = actionText === '收款' || actionText === 'accept' ? 'receive' : 'reject';
        const transferId = String(match[2] || '').trim();
        return { action, transferId };
    }

    function extractLocalImageDataUrls(content) {
        return extractLocalImageSources(content);
    }
    async function resolveMediaSourcesToDataUrls(sources) {
        const results = [];
        for (const src of sources) {
            if (/^data:image\//i.test(src)) {
                results.push(src);
            } else if (/^media:/i.test(src)) {
                try {
                    const id = src.slice(6);
                    const blob = await mediaGet(id);
                    if (blob) {
                        const dataUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(String(reader.result || ''));
                            reader.readAsDataURL(blob);
                        });
                        if (dataUrl) results.push(String(dataUrl));
                    }
                } catch (e) {}
            }
        }
        return results;
    }

    async function collectLocalImageInputs(currentTurn, contextHistory) {
        const records = [];

        if (Array.isArray(contextHistory)) {
            for (let index = 0; index < contextHistory.length; index += 1) {
                const msg = contextHistory[index];
                if (!msg || msg.role !== 'user') continue;
                const srcs = extractLocalImageDataUrls(msg.content);
                const images = await resolveMediaSourcesToDataUrls(srcs);
                if (images.length === 0) continue;
                records.push({
                    source: `上下文第${index + 1}条用户消息`,
                    text: normalizeMessageForModel(msg.content),
                    images
                });
            }
        }

        const currentTurns = Array.isArray(currentTurn) ? currentTurn : (currentTurn ? [currentTurn] : []);
        const currentLabelBase = currentTurns.length > 1 ? '本轮第' : '本轮输入';
        for (let index = 0; index < currentTurns.length; index += 1) {
            const msg = currentTurns[index];
            if (!msg || msg.role !== 'user') continue;
            const srcs = extractLocalImageDataUrls(msg.content);
            const images = await resolveMediaSourcesToDataUrls(srcs);
            if (images.length === 0) continue;
            const source = currentTurns.length > 1 ? `${currentLabelBase}${index + 1}条消息` : currentLabelBase;
            records.push({
                source,
                text: normalizeMessageForModel(msg.content),
                images
            });
        }

        return records;
    }

    function buildLocalImagePromptText(imageRecords) {
        if (!Array.isArray(imageRecords) || imageRecords.length === 0) return '';
        return imageRecords.map((record, index) => {
            const text = String(record.text || '').trim() || '无';
            return `${index + 1}. 来源: ${record.source} | 图片数: ${record.images.length} | 关联文本: ${text}`;
        }).join('\n');
    }

    function buildUserMessagePayload(runtimeInput, imageRecords) {
        if (!Array.isArray(imageRecords) || imageRecords.length === 0) {
            return runtimeInput;
        }
        const payload = [{ type: 'text', text: runtimeInput }];
        payload.push({ type: 'text', text: '以下是用户上传的本地图片（base64）：' });
        imageRecords.forEach((record, index) => {
            payload.push({
                type: 'text',
                text: `图片组${index + 1}，来源：${record.source}，关联文本：${record.text || '无'}`
            });
            record.images.forEach((dataUrl) => {
                payload.push({
                    type: 'image_url',
                    image_url: { url: dataUrl }
                });
            });
        });
        return payload;
    }

    function mergeBackWorldbookWithUserPayload(backWorldbookUserText, userPayload) {
        if (!backWorldbookUserText) return userPayload;
        if (Array.isArray(userPayload)) {
            const merged = [...userPayload];
            if (merged.length > 0 && merged[0] && merged[0].type === 'text') {
                merged[0] = {
                    ...merged[0],
                    text: `${backWorldbookUserText}\n\n${String(merged[0].text || '')}`
                };
            } else {
                merged.unshift({ type: 'text', text: backWorldbookUserText });
            }
            return merged;
        }
        return `${backWorldbookUserText}\n\n${String(userPayload || '')}`;
    }

    function readImageAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error(`读取图片失败：${file.name || '未命名图片'}`));
            reader.readAsDataURL(file);
        });
    }

    function getAssistantBoundStickers(chatId) {
        const categories = JSON.parse(localStorage.getItem('sticker_categories_v1') || '[]');
        const targetMap = JSON.parse(localStorage.getItem('sticker_category_targets_v1') || '{}');
        const stickerMap = new Map();

        categories.forEach((category) => {
            const targets = targetMap[category.id] || [];
            if (!targets.includes(chatId)) return;
            if (!Array.isArray(category.emojis)) return;

            category.emojis.forEach((emoji) => {
                const name = String(emoji.name || '').trim();
                const url = String(emoji.url || '').trim();
                if (!name || !/^https?:\/\//i.test(url)) return;
                if (!stickerMap.has(name)) {
                    stickerMap.set(name, { name, url, category: category.name || '未分类' });
                }
            });
        });

        return Array.from(stickerMap.values());
    }

    function createAssistantStickerTokenRegex() {
        return /(?:\[|【)\s*(?:贴图|STICKER)\s*[:：]\s*([^\]】\n]+)\s*(?:\]|】)/gi;
    }

    // 将混合段拆成真正的短消息，并在这里就丢弃未绑定贴图。
    function normalizeAssistantReplySegments(content, allowedStickers) {
        if (typeof content !== 'string') return [];
        const trimmed = content.trim();
        if (!trimmed) return [];

        const byName = new Map((allowedStickers || []).map(item => [item.name, item]));
        const tokenRegex = createAssistantStickerTokenRegex();
        const segments = [];
        let lastIndex = 0;
        let matchedAnyToken = false;
        let match;

        while ((match = tokenRegex.exec(content)) !== null) {
            matchedAnyToken = true;
            const beforeText = content.slice(lastIndex, match.index).trim();
            if (beforeText) {
                segments.push({ type: 'text', content: beforeText });
            }

            const stickerName = String(match[1] || '').trim();
            const sticker = byName.get(stickerName);
            if (sticker) {
                segments.push({ type: 'sticker', content: `[贴图:${sticker.name}]` });
            }

            lastIndex = match.index + match[0].length;
        }

        if (!matchedAnyToken) {
            return [{ type: 'text', content: trimmed }];
        }

        const afterText = content.slice(lastIndex).trim();
        if (afterText) {
            segments.push({ type: 'text', content: afterText });
        }

        return segments;
    }

    function convertAssistantStickerTokens(content, allowedStickers) {
        if (typeof content !== 'string') return '';
        const byName = new Map((allowedStickers || []).map(item => [item.name, item]));
        const tokenRegex = createAssistantStickerTokenRegex();
        const stickers = [];
        let matchedAnyToken = false;
        let match;
        while ((match = tokenRegex.exec(content)) !== null) {
            matchedAnyToken = true;
            const name = String(match[1] || '').trim();
            const sticker = byName.get(name);
            if (!sticker) continue;
            stickers.push(`<img src="${sticker.url}" alt="${escapeHtml(sticker.name)}" class="chat-inline-sticker">`);
        }
        if (matchedAnyToken) {
            return stickers.length > 0 ? stickers.join('') : '';
        }
        return content.trim();
    }

    function decodeAssistantMarkupEntities(text) {
        return String(text || '')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&amp;/gi, '&');
    }

    function normalizeSpriteColor(colorValue) {
        const raw = String(colorValue || '').trim();
        if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
            return raw;
        }
        return '#FFD700';
    }

    function splitSpriteContent(rawContent) {
        const text = String(rawContent || '').trim();
        if (!text) {
            return { content: '', secret: '' };
        }
        const splitMatch = text.split(/\n\s*-{3,}\s*\n/i);
        if (splitMatch.length > 1) {
            return {
                content: String(splitMatch[0] || '').trim(),
                secret: String(splitMatch.slice(1).join('\n') || '').trim()
            };
        }
        return { content: text, secret: '' };
    }

    function extractMoodSpriteFromReply(visibleReply) {
        const normalized = decodeAssistantMarkupEntities(visibleReply);
        const spriteRegex = /<mood_sprite\b([^>]*)>([\s\S]*?)(?:<\/mood_sprite\s*>|$)/gi;
        let spriteData = null;
        let match;
        while ((match = spriteRegex.exec(normalized)) !== null) {
            const attrText = String(match[1] || '');
            const rawContent = String(match[2] || '').trim();
            const moodMatch = /mood\s*=\s*(["'])(.*?)\1/i.exec(attrText);
            const colorMatch = /color\s*=\s*(["'])(.*?)\1/i.exec(attrText);
            const parts = splitSpriteContent(rawContent);
            spriteData = {
                mood: moodMatch ? String(moodMatch[2] || '').trim() || '未知' : '未知',
                color: normalizeSpriteColor(colorMatch ? colorMatch[2] : '#FFD700'),
                content: parts.content,
                secret: parts.secret
            };
        }
        const cleanedText = normalized
            .replace(/<mood_sprite\b[^>]*>[\s\S]*?(?:<\/mood_sprite\s*>|$)/gi, '')
            .replace(/<\/?mood_sprite\b[^>]*>/gi, '')
            .trim();
        return { text: cleanedText, sprite: spriteData };
    }

    function stripMoodSpriteFragments(text) {
        const normalized = decodeAssistantMarkupEntities(text);
        return normalized
            .replace(/<mood_sprite\b[^>]*>[\s\S]*?(?:<\/mood_sprite\s*>|$)/gi, '')
            .replace(/<\/?mood_sprite\b[^>]*>/gi, '')
            .trim();
    }

    // 将 triggerAIResponse 暴露到全局，以便 checkBackgroundActivity 调用
    window.triggerAIResponse = async function(chatId, options = {}) {
        // UI Loading 状态 (使用全局管理)
        chatStates[chatId] = chatStates[chatId] || {};
        chatStates[chatId].isSending = true;
        updateSendButtonState(chatId);
        
        const isBackground = options.isBackground === true;

        try {
            // 1. 获取设置
            const apiUrl = localStorage.getItem('api_url');
            const apiKey = localStorage.getItem('api_key');
            const modelName = localStorage.getItem('model_name');
            const cotEnabled = localStorage.getItem('chat_cot_enabled_' + chatId) !== 'false';
            
            if (!apiUrl || !apiKey) {
                throw new Error('请先在设置中配置 API URL 和 Key');
            }

            const charPersona = largeStore.get('chat_persona_' + chatId, '');
            const userName = localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || 'User';
            const userPersona = largeStore.get('chat_user_persona_' + chatId, '');
            const longTermMemory = buildMemoryLongTermText(chatId);
            largeStore.put('chat_long_memory_' + chatId, longTermMemory);
            const timeSyncEnabled = localStorage.getItem(getTimeSyncEnabledKey(chatId)) === 'true';
            const realName = getChatRealName(chatId) || getChatDisplayName(chatId) || chatId;
            const now = new Date();
            const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];

            const limit = parseInt(localStorage.getItem('chat_context_limit_' + chatId) || '100');
            const fullHistory = largeStore.get('chat_history_' + chatId, []);
            let lastAssistantIndex = -1;
            for (let i = fullHistory.length - 1; i >= 0; i -= 1) {
                if (fullHistory[i] && fullHistory[i].role === 'assistant') {
                    lastAssistantIndex = i;
                    break;
                }
            }
            const currentTurnMessages = lastAssistantIndex >= 0
                ? fullHistory.slice(lastAssistantIndex + 1)
                : fullHistory.slice();
            const currentTurnUserMessages = currentTurnMessages.filter((msg) => msg && (msg.role === 'user' || msg.role === 'system'));
            const currentTurn = currentTurnUserMessages.length > 0
                ? currentTurnUserMessages[currentTurnUserMessages.length - 1]
                : null;

           let timeGapPrompt = '';
            let userMessageTimePrefix = '';
            if (timeSyncEnabled && fullHistory.length > currentTurnUserMessages.length) {
                const lastMsgIndex = fullHistory.length - currentTurnUserMessages.length - 1;
                if (lastMsgIndex >= 0) {
                    const lastMsg = fullHistory[lastMsgIndex];
                    const lastTs = Number(lastMsg.ts);
                    if (Number.isFinite(lastTs)) {
                        const diffMs = now.getTime() - lastTs;
                        const diffMinutes = Math.floor(diffMs / 60000);
                        if (diffMinutes >= 360) {
                            let timeDesc = '';
                            let gapHint = '';
                            const nowDateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                            if (diffMinutes < 1440) {
                                const hours = Math.floor(diffMinutes / 60);
                                const mins = diffMinutes % 60;
                                timeDesc = `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
                                gapHint = '这是隔了一阵后的重新开口，可以自然带一点间隔感，但不要主动解释自己刚刚去做了什么，也不要强行表演“刚回来”。';
                            } else {
                                const days = Math.floor(diffMinutes / 1440);
                                timeDesc = `${days}天`;
                                gapHint = '已经隔了至少一天，可以明显体现久违感和时间流逝感。请根据人设自然表现想念、别扭、抱怨、试探、冷淡、委屈或松一口气，但不要生硬演戏。';
                            }

 timeGapPrompt = `
[时间感知]
你们已经有${timeDesc}没有聊天了。
${gapHint}
`;
                            userMessageTimePrefix = `【时间间隔：距离上次聊天已过${timeDesc}；当前时间：${nowDateText}】\n`;
                        }
                    }
                }
            }

            const timeSyncPrompt = timeSyncEnabled
                ? `
[当前现实时间]
${nowDate} ${nowTime} ${weekday}
请活在这个时间点里（作息、状态、问候语）。
${timeGapPrompt}
`
                : '';

            const timeZoneData = buildTimeZoneComputedData(chatId, now);
            const timeZonePrompt = timeZoneData.enabled
                ? `
[双方地点时区]
${timeZoneData.userCity || userName}：${timeZoneData.userTime}（${timeZoneData.userTimeZone}）
${timeZoneData.charCity || realName}：${timeZoneData.charTime}（${timeZoneData.charTimeZone}）
时差（TA-我）：${timeZoneData.diffLabel}
你当前处于：${timeZoneData.charPeriod}
请严格考虑双方时差来决定回复语气、问候和作息相关表达，不要无视深夜/清晨场景。
`
                : '';
            const weatherMapPrompt = await buildWeatherMapPrompt(chatId);

            const wbIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
            const allWbItems = largeStore.get('worldbook_items', []);
            const boundWorldbooks = wbIds.map(id => allWbItems.find(i => String(i.id) === String(id))).filter(Boolean);
            
            // 分类世界书：前(before)、后(after)
            // 兼容旧的 front/middle/back 数据
            const beforeWbs = boundWorldbooks.filter(wb => wb.depth === 'before' || wb.depth === 'front');
            const afterWbs = boundWorldbooks.filter(wb => wb.depth === 'after' || wb.depth === 'back' || wb.depth === 'middle' || !wb.depth);

            const buildWbText = (wbs) => wbs.map(item => {
                const itemKeywords = item.keywords ? `关键词: ${item.keywords}` : '关键词: 无';
                return `- ${item.name}\n  分类: ${item.category || '未分类'}\n  ${itemKeywords}\n  内容: ${item.content || ''}`;
            }).join('\n');

            const beforeWbContent = buildWbText(beforeWbs);
            const afterWbContent = buildWbText(afterWbs);

            const assistantBoundStickers = getAssistantBoundStickers(chatId);
            const hasBoundAssistantStickers = assistantBoundStickers.length > 0;
            const assistantStickerRuleText = hasBoundAssistantStickers
                ? assistantBoundStickers.map(item => item.name).join('、')
                : '';
            const assistantStickerPromptText = hasBoundAssistantStickers
                ? `- [贴图:名称]（强制：只能从【${assistantStickerRuleText}】中选择，严禁捏造或翻译！）`
                : '- 当前未绑定任何贴图：禁止输出任何 [贴图:名称]、【贴图:名称】或 STICKER 标记；需要表达情绪时，只能使用文字、语音或图片。';

            const phoneLockData = await ensurePhoneLockDataAsync(chatId);
                        const phoneLockPrompt = phoneLockData
                ? `
**[手机锁屏]**
你的手机锁屏密码是${phoneLockData.passcode}。
密保问题与答案：
1) ${phoneLockData.questions?.[0]?.q || '无'} / ${phoneLockData.questions?.[0]?.a || '无'}
2) ${phoneLockData.questions?.[1]?.q || '无'} / ${phoneLockData.questions?.[1]?.a || '无'}
3) ${phoneLockData.questions?.[2]?.q || '无'} / ${phoneLockData.questions?.[2]?.a || '无'}

这些信息属于你的私人隐私，默认不要主动泄露，也不要完整说出、暗示、拆开透露、逐位提示密码或答案。
即使关系亲密，也应先根据当下情绪、信任程度、关系状态和你的性格决定要不要说。
如果你不想告诉，可以自然地拒绝、转移话题、逗对方、设条件、让对方猜，或直接表现警惕与边界感，但不要说出真实密码或密保答案。
`
                : '';

            const historyCandidates = lastAssistantIndex >= 0 ? fullHistory.slice(0, lastAssistantIndex + 1) : [];
            const contextHistory = historyCandidates.slice(Math.max(0, historyCandidates.length - limit));
            // 不再将历史记录拼接成一段文本
            const pendingIncomingTransfersPrompt = buildPendingIncomingTransfersPromptForChar(chatId);

             const systemPrompt = `
严格执行以下高阶沉浸式角色扮演规则。现在你是${realName}，你现在正在与${userName}通过手机聊天软件（Line）进行线上聊天。
这是一个线上聊天。严禁提出任何关于线下见面、现实世界互动或转为其他非本平台联系方式的建议。你必须始终保持在线角色的身份。

以下设定是你存在的基石。

${beforeWbContent ? `**【全局设定/前置世界书】**\n${beforeWbContent}` : ''}

**【你的人设】**
${charPersona || '无'}
**【${userName}的信息】**
${userPersona || '无'}

${afterWbContent ? `**【场景/物品/后置世界书】**\n${afterWbContent}` : ''}

**【你和${userName}之间的长期记忆】**
${longTermMemory || '无'}

**【活人运转逻辑（扮演准则与生动表达技巧）】**
**绝对沉浸**：永远以“我 = ${realName}”的第一人称说话。
**生活感**：你的回复必须充满“人气”。基于你的人设，你可以懒散、可以犯错等。不要做一个完美的客服。
**世界观融合**：可以在对话中不经意、自然地提到地透露出世界书里的设定（例如地名、术语、常识），不要干巴巴地解说设定。
**保持"活人感"**：你有自己的日常、兴趣、朋友圈和社交生活，除了和用户聊天，你每天还有自己的生活，不是围绕用户打转的，你可以偶尔和用户分享生活的趣事。

**【当前情景】**
- 手机锁屏状态：${phoneLockPrompt || '无'}
- 当前现实时间：${timeSyncPrompt}
- 你所在的时区：${timeZonePrompt}
- 你所在地的天气：${weatherMapPrompt}

**【你拥有的能力标签清单】**（原则：只有当符合你的人设、经济状况和当前情绪时才使用。）
${assistantStickerPromptText}
- [语音]内容[/语音]
- [图片:描述]
- [转账:金额|备注]（仅在你要主动给 ${userName} 转账时使用，必须独立成条）
- [转账处理:收款|转账ID] 或 [转账处理:拒绝|转账ID]（仅用于处理 ${userName} 发给你的待收款转账，必须独立成条）
- <quote>原文</quote>

**【待你处理的入账转账】**
${pendingIncomingTransfersPrompt}
若为“无”，你禁止输出任何 [转账处理:...] 标签。
`.replace(/\n{3,}/g, '\n\n').trim();

            const formatInstructionPrompt = `
**【输出格式与排版要求】**
1. 对话节奏：根据真人的聊天习惯，可以一次性发送多条短消息。使用 [SPLIT]拆分为 3-8条短消息发送。。
`;

           const formatInstructionPromptCoT = `
现在，作为 ** ${realName}**，基于你的人设、记忆和当前情景，开始回复。

你必须在正式回复前先进行“思维链”内心独白，请直接以第一人称（“我”）代入此刻的情境，展现你最真实的心理活动。

请严格按以下格式输出：

<think_note>
Q1：我是谁？我的人设性格是？
A1：……
Q2：对方这句话的潜台词是什么？我有过度解读吗？
A2：……
Q3：我现在第一时间的真实内心OS是什么？（吐槽/委屈/开心/无奈等，符合我的人设）
A3：……
Q4：我接下来该怎么回？发几条？发不发贴图？如何自然地表现出我的"活人感"？
A4：……
Q5：我的回答有去掉爹味、油腻吗？有重复上文的模板吗？
Q5：……
</think_note>

<reply>
消息1[SPLIT]消息2
</reply>

<mood_sprite mood="核心情绪" color="#RRGGBB">
这里写你没发出去的真实内心，一句话。（吐槽/纠结/爱意/碎碎念/幽默/真实）。绝不能违背人设。
---
绝对不能让对方知道的一个念头（直白/真实）。绝不能违背人设。
</mood_sprite>
`;

            const roundInput = buildTurnInputBlockForModel(currentTurnUserMessages);
            const localImageRecords = await collectLocalImageInputs(currentTurnUserMessages, contextHistory);
            const localImagePromptText = buildLocalImagePromptText(localImageRecords);
            const localImageSection = localImagePromptText
                ? `
[本地图片输入]
${localImagePromptText}
`
                : '';
           const roundMessageText = `[本轮消息开始]\n${userMessageTimePrefix || ''}${roundInput || '无'}\n[本轮消息结束]`;
  const currentUserText = `
${roundMessageText}
${localImageSection}
`.trim();

            // 1. 准备各个模块的内容，去除空值污染，增强“活人感”
            const userMessagePayload = buildUserMessagePayload(currentUserText, localImageRecords);
            const personaUserText = charPersona ? `[角色人设]\n${charPersona}` : '';
            const longTermMemoryText = longTermMemory ? `[核心记忆]\n${longTermMemory}` : '';
            const userPersonaText = userPersona ? `[${userName}是谁]\n${userPersona}` : '';
            const timeUserText = String(timeSyncPrompt || '').trim();

            const importedMeDate = largeStore.get('love_journal_imported_schedule_date_' + chatId, '');
            const importedHerDate = largeStore.get('love_journal_imported_her_schedule_date_' + chatId, '');

            const savedMeSchedule = importedMeDate === nowDate ? largeStore.get('love_journal_imported_schedule_' + chatId, '') : '';
            const importedWbs = importedMeDate === nowDate ? largeStore.get('love_journal_imported_wbs_' + chatId, '') : '';
            const savedHerSchedule = importedHerDate === nowDate ? largeStore.get('love_journal_imported_her_schedule_' + chatId, '') : '';
            const importedHerWbs = importedHerDate === nowDate ? largeStore.get('love_journal_imported_her_wbs_' + chatId, '') : '';
            
            let meScheduleText = '';
            if (savedMeSchedule) {
                meScheduleText = `[你的心里认知：你今天的日程安排]
${savedMeSchedule}

【你的日程处理原则（非常重要）】：
1. 正常聊天即可，绝对不需要在回复中刻意说明或反复提及你在执行日程，这只是让你心里知道自己这个时间点大概在干嘛。
2. 保持灵活变通：如果聊天中有了新的决定或突发情况，你可以随时改变计划，不需要死板地完全遵守日程。
3. 无日程的时间段：如果当前时间不在日程表的时间段内（比如凌晨深夜），说明现在是自由/休息时间（比如本该睡觉但还在聊天），此时可以完全忽略日程的约束。但如果被问起白天或其他时间的安排，你需要清楚知道日程里的内容。`;
                if (importedWbs) {
                    meScheduleText += `\n\n[日程关联世界书/背景]\n${importedWbs}`;
                }
            }

            let herScheduleText = '';
            if (savedHerSchedule) {
                herScheduleText = `[你的心里认知：【${userName}】今天的日程安排]
${savedHerSchedule}

【对方日程处理原则（非常重要）】：
1. 正常聊天即可，不需要反复提及对方的日程，这只是让你心里清楚对方今天在忙什么。
2. 可以根据时间点适时地关心或配合对方的日程，但不要生硬照念。`;
                if (importedHerWbs) {
                    herScheduleText += `\n\n[对方日程关联世界书/背景]\n${importedHerWbs}`;
                }
            }

            // 2. 按照“四层架构”重构打包逻辑
            
            // ==========================================
            // 第一层：Top System (全局基石)
            // ==========================================
            let topSystemBlocks = [systemPrompt];
            if (timeUserText) topSystemBlocks.push(timeUserText);
            if (timeZonePrompt) topSystemBlocks.push(timeZonePrompt);
            if (weatherMapPrompt) topSystemBlocks.push(weatherMapPrompt);
            if (phoneLockPrompt) topSystemBlocks.push(phoneLockPrompt);
            if (pendingIncomingTransfersPrompt) topSystemBlocks.push(pendingIncomingTransfersPrompt);
            
            const layer1TopSystem = { role: "system", content: topSystemBlocks.join('\n\n') };

            // ==========================================
            // 第二层：Context System (环境与日程)
            // ==========================================
            let contextSystemBlocks = [];
            if (meScheduleText) contextSystemBlocks.push(meScheduleText);
            if (herScheduleText) contextSystemBlocks.push(herScheduleText);
            
            const layer2ContextSystem = contextSystemBlocks.length > 0 
                ? { role: "system", content: contextSystemBlocks.join('\n\n') } 
                : null;

            // ==========================================
            // 第三层：History (历史对话)
            // ==========================================
            let historyMessages = [];
            if (longTermMemoryText) historyMessages.push({ role: "system", content: longTermMemoryText });
            
            contextHistory.forEach(msg => {
                if (msg.role === 'system') {
                    historyMessages.push({ role: "system", content: `[系统/旁白]\n${formatTurnInputForModel(msg)}` });
                } else if (msg.role === 'assistant') {
                    historyMessages.push({ role: "assistant", content: formatTurnInputForModel(msg) });
                } else {
                    historyMessages.push({ role: "user", content: formatTurnInputForModel(msg) });
                }
            });

            // ==========================================
            // 第四层：Bottom User (终极强制指令层)
            // ==========================================
            let finalUserContentParts = [];
            
            // 1. 用户的最新消息文本
            let latestUserText = '';
            if (isBackground) {
                latestUserText = "【系统提示】距离上次聊天已经过去了一段时间。现在请你主动向我发一条消息。请完全沉浸在你的角色设定中，结合当前的时间和你的日常，自然地开启一个新话题或者分享你现在的状态。绝对不要提及“时间到了”、“主动找你”等系统指令，要表现得像是一个真实的活人随手发来的消息。";
            } else {
                latestUserText = userMessagePayload;
            }
            finalUserContentParts.push(latestUserText);

            // 3. 加上一条明显的分隔符
            finalUserContentParts.push(`====================\n[核心执行指令]`);

            // 4. 拼上 finalFormatPrompt
            let finalFormatPrompt = formatInstructionPrompt;
            finalUserContentParts.push(finalFormatPrompt);

            // 5. 如果开启了思维链（cotEnabled），紧接着拼上 formatInstructionPromptCoT
            if (cotEnabled) {
                finalUserContentParts.push(formatInstructionPromptCoT);
            }

            // 6. 拼上条数限制和双语翻译要求
            try {
                const replyCountConfig = JSON.parse(localStorage.getItem('chat_reply_count_' + chatId) || 'null');
                if (replyCountConfig && (replyCountConfig.min || replyCountConfig.max)) {
                    const min = replyCountConfig.min || replyCountConfig.max;
                    const max = replyCountConfig.max || replyCountConfig.min;
                    finalUserContentParts.push(`**【回复条数限制】**\n请严格遵守回复条数限制，本次回复必须输出 ${min} 到 ${max} 条消息（使用 [SPLIT] 分隔）。`);
                }
            } catch (e) {}

            try {
                const bilingualEnabled = localStorage.getItem('chat_bilingual_' + chatId) === 'true';
                if (bilingualEnabled) {
                    finalUserContentParts.push(`**【双语模式】**\n用户已开启双语模式。请在回复内容的结尾处，使用 \`<translation>翻译成标准中文的内容</translation>\` 标签提供本次回复的中文翻译（无论是外语、方言还是标准中文，都请提供对应的标准中文翻译）。特别注意：如果输出仅仅是单独的emoji表情或颜文字等，没有实质性的语言文字，则不需要翻译，也不要输出 \`<translation>\` 标签。注意，只在 \`<translation>\` 标签内提供翻译结果，如果输出多条消息，则请为每条消息分别附上独立的 \`<translation>\` 标签。标签之外保持原本的角色设定和对话方式，不要让角色自己说出“这是翻译”之类的话。`);
                }
            } catch (e) {}

            const layer4BottomUser = { role: "user", content: finalUserContentParts.join('\n\n') };

            // 最终合并打包 messages 数组
            const messages = [layer1TopSystem];
            if (layer2ContextSystem) messages.push(layer2ContextSystem);
            messages.push(...historyMessages);
            messages.push(layer4BottomUser);

            // 3. 调用 API
            const streamEnabled = localStorage.getItem('stream_enabled') === 'true';
            const savedTemperature = parseFloat(localStorage.getItem('temperature') || '0.7');
            const temperature = Number.isFinite(savedTemperature) ? savedTemperature : 0.7;
            const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelName || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature,
                    stream: streamEnabled
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error('API Error: ' + err);
            }

            let reply = '';
            if (streamEnabled) {
                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('流式响应不可用');
                }
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                const parseStreamLine = (line) => {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) return;
                    const payload = trimmed.slice(5).trim();
                    if (!payload || payload === '[DONE]') return;
                    try {
                        const chunk = JSON.parse(payload);
                        const deltaContent = chunk.choices?.[0]?.delta?.content;
                        const messageContent = chunk.choices?.[0]?.message?.content;
                        if (typeof deltaContent === 'string') reply += deltaContent;
                        else if (typeof messageContent === 'string') reply += messageContent;
                    } catch (e) {
                    }
                };

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    lines.forEach(parseStreamLine);
                }
                if (buffer) parseStreamLine(buffer);
            } else {
                const data = await response.json();
                reply = data.choices?.[0]?.message?.content || '';
            }

            let thinkNoteText = '';
            let safeReply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            const thinkMatch = safeReply.match(/<think_note>([\s\S]*?)<\/think_note>/i);
            if (thinkMatch) {
                thinkNoteText = (thinkMatch[1] || '').trim();
            }
            const replyMatchBlock = safeReply.match(/<reply>([\s\S]*?)<\/reply>/i);
            let visibleReply = replyMatchBlock
                ? String(replyMatchBlock[1] || '').trim()
                : safeReply.replace(/<think_note>[\s\S]*?<\/think_note>/ig, '').trim();

            // 修复心绪精灵和引用在 <reply> 标签外被丢弃的问题
            if (replyMatchBlock) {
                const spriteMatch = safeReply.match(/<mood_sprite\b[^>]*>[\s\S]*?(?:<\/mood_sprite\s*>|$)/i);
                if (spriteMatch && !visibleReply.includes(spriteMatch[0])) {
                    visibleReply += '\n\n' + spriteMatch[0];
                }
                const quoteMatchOutside = safeReply.match(/<quote>([\s\S]*?)<\/quote>/i);
                if (quoteMatchOutside && !visibleReply.includes(quoteMatchOutside[0])) {
                    visibleReply = quoteMatchOutside[0] + '\n\n' + visibleReply;
                }
            }

        let quoteData = null;
const quoteTagRegex = /<quote>([\s\S]*?)<\/quote>/i;
const quoteMatch = visibleReply.match(quoteTagRegex);

function normalizeQuoteMatchText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/[【】[\]()（）"'“”‘’<>]/g, '')
        .trim()
        .toLowerCase();
}

function findBestQuotedMessageInCurrentTurn(rawQuoteText, turnMessages, fallbackMsg) {
    if (!rawQuoteText) return fallbackMsg || null;

    const normalizedQuote = normalizeQuoteMatchText(rawQuoteText);
    if (!normalizedQuote) return fallbackMsg || null;

    const candidates = Array.isArray(turnMessages) ? [...turnMessages].reverse() : [];

    // 只在“当前这一轮”里匹配
    let found = candidates.find(msg => {
        const plain = normalizeQuoteMatchText(toPlainMessageText(msg.content || ''));
        return plain && plain === normalizedQuote;
    });
    if (found) return found;

    found = candidates.find(msg => {
        const plain = normalizeQuoteMatchText(toPlainMessageText(msg.content || ''));
        return plain && (plain.includes(normalizedQuote) || normalizedQuote.includes(plain));
    });
    if (found) return found;

    return fallbackMsg || null;
}

if (quoteMatch) {
    const rawQuoteText = String(quoteMatch[1] || '').replace(/\s+/g, ' ').trim();

    const currentTurnMessages = Array.isArray(currentTurnUserMessages)
        ? currentTurnUserMessages
        : (currentTurn ? [currentTurn] : []);

    const fallbackMsg = currentTurn && currentTurn.role === 'user'
        ? currentTurn
        : currentTurnMessages[currentTurnMessages.length - 1] || null;

    const matchedMsg = findBestQuotedMessageInCurrentTurn(
        rawQuoteText,
        currentTurnMessages,
        fallbackMsg
    );

    if (rawQuoteText && matchedMsg && matchedMsg.id) {
        quoteData = {
            id: matchedMsg.id,
            text: rawQuoteText
        };
    }
}
            visibleReply = visibleReply.replace(/<quote>[\s\S]*?<\/quote>/gi, '').trim();
            
            const spriteExtraction = extractMoodSpriteFromReply(visibleReply);
            const spriteData = spriteExtraction.sprite;
            visibleReply = spriteExtraction.text;

            const splitToken = visibleReply.includes('[SPLIT]') ? '[SPLIT]' : '|||';
            const replyMessages = visibleReply.split(splitToken);
            const normalizedReplyMessages = [];
            let hasVisibleMessage = false;
            let backgroundNotificationPreview = '';
            let transferStatusChangedInThisReply = false;
            
            for (let i = 0; i < replyMessages.length; i++) {
                let rawPart = stripMoodSpriteFragments(replyMessages[i]);
                
                let translationText = null;
                const transMatch = rawPart.match(/<translation>([\s\S]*?)<\/translation>/i);
                if (transMatch) {
                    translationText = transMatch[1].trim();
                    rawPart = rawPart.replace(/<translation>[\s\S]*?<\/translation>/ig, '').trim();
                    if (translationText === rawPart) {
                        translationText = null;
                    }
                }
                
                if (!rawPart) continue;
                const parsedPhoto = parseAssistantPhotoMessage(rawPart);
                const parsedVoice = parseAssistantVoiceMessage(rawPart);
                const parsedTransfer = parseAssistantTransferMessage(rawPart);
                const parsedTransferDecision = parseAssistantTransferDecisionMessage(rawPart);
                if (parsedPhoto) {
                    normalizedReplyMessages.push({
                        msgContent: buildCameraPlaceholderHtml(parsedPhoto.text),
                        parsedVoice: null,
                        parsedTransfer: null,
                        transferMode: null,
                        translationText
                    });
                    continue;
                }
                if (parsedVoice) {
                    normalizedReplyMessages.push({
                        msgContent: parsedVoice.transcript,
                        parsedVoice,
                        parsedTransfer: null,
                        transferMode: null,
                        translationText
                    });
                    continue;
                }
                if (parsedTransferDecision) {
                    const decidedTransfer = applyAssistantTransferDecision(chatId, parsedTransferDecision);
                    if (decidedTransfer) {
                        transferStatusChangedInThisReply = true;
                        normalizedReplyMessages.push({
                            msgContent: decidedTransfer.status === 'accepted' ? '已收款' : '已拒收',
                            parsedVoice: null,
                            parsedTransfer: decidedTransfer,
                            transferMode: 'decision',
                            translationText: null
                        });
                    }
                    continue;
                }
                if (parsedTransfer) {
                    normalizedReplyMessages.push({
                        msgContent: `[转账] ¥${parsedTransfer.amount.toFixed(2)}`,
                        parsedVoice: null,
                        parsedTransfer,
                        transferMode: 'new',
                        translationText
                    });
                    continue;
                }

                const normalizedSegments = normalizeAssistantReplySegments(rawPart, assistantBoundStickers);
                normalizedSegments.forEach(segment => {
                    const msgContent = segment.type === 'sticker'
                        ? convertAssistantStickerTokens(segment.content, assistantBoundStickers)
                        : segment.content;
                    if (!msgContent) return;
                    normalizedReplyMessages.push({
                        msgContent,
                        parsedVoice: null,
                        parsedTransfer: null,
                        transferMode: null,
                        translationText
                    });
                });
            }

            for (let i = 0; i < normalizedReplyMessages.length; i++) {
                const messageItem = normalizedReplyMessages[i];
                const msgContent = messageItem.msgContent;
                const parsedVoice = messageItem.parsedVoice;
                const parsedTransfer = messageItem.parsedTransfer;
                const transferMode = messageItem.transferMode || null;
                if (!msgContent) continue;

                hasVisibleMessage = true;
                if (!backgroundNotificationPreview) {
                    backgroundNotificationPreview = parsedVoice
                        ? '发送了一条语音消息'
                        : (parsedTransfer ? (transferMode === 'decision' ? '处理了一笔转账' : '发来一笔转账') : msgContent);
                }

                // 根据用户要求：消息弹出弄慢一些，且每条都是一样的固定速度，设为2秒
                const typingDelay = 2000;
                await new Promise(resolve => setTimeout(resolve, typingDelay));

                const isLast = i === normalizedReplyMessages.length - 1;
                const isFirst = i === 0;
                const extra = {};
                if (parsedVoice) extra.voice = parsedVoice;
                if (parsedTransfer) {
                    if (transferMode === 'decision') {
                        extra.transfer = normalizeTransferPayload(parsedTransfer);
                    } else {
                        const charWallet = readCharWalletByChatId(chatId);
                        if (Number(charWallet.balance || 0) < parsedTransfer.amount) {
                            const failText = '（转账失败：char余额不足）';
                            const failMsg = saveMessage(chatId, 'assistant', failText, {});
                            appendMessageToUI('assistant', failText, failMsg.time, chatId, failMsg.id, failMsg, { isNew: true });
                            continue;
                        }
                        const nextCharWallet = {
                            ...charWallet,
                            balance: Number((Number(charWallet.balance || 0) - parsedTransfer.amount).toFixed(2)),
                            bills: appendWalletBillItem(charWallet.bills, {
                                merchant: '转账支出',
                                desc: `向 ${String(localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || 'User')} 转账${parsedTransfer.note ? `（${parsedTransfer.note}）` : ''}`,
                                amount: parsedTransfer.amount,
                                type: 'expense',
                                timestamp: Date.now()
                            })
                        };
                        saveCharWalletByChatId(chatId, nextCharWallet);
                        extra.transfer = normalizeTransferPayload({
                            id: `transfer_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                            amount: parsedTransfer.amount,
                            note: parsedTransfer.note,
                            createdAt: Date.now(),
                            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                            senderType: 'char',
                            senderUserId: String(getCurrentLineUserForWallet()?.id || '').trim(),
                            status: 'pending',
                            refunded: false,
                            received: false
                        });
                    }
                }
                if (isLast && spriteData) extra.sprite = spriteData;
                if (isFirst && quoteData) extra.quote = quoteData;
                if (messageItem.translationText) extra.translation = messageItem.translationText;
                if (isFirst && thinkNoteText) extra.thinkNote = thinkNoteText;

                const newMsg = saveMessage(chatId, 'assistant', msgContent, extra);
                const shouldUnread = !isChatRoomOpenFor(chatId);
                if (shouldUnread) {
                    increaseUnread(chatId);
                    showIncomingMessageToast(chatId, parsedVoice ? '发送了一条语音消息' : msgContent);
                }
                appendMessageToUI('assistant', msgContent, newMsg.time, chatId, newMsg.id, extra, { isNew: true });
            }

            if (backgroundNotificationPreview) {
                await showIncomingMessageSystemNotification(chatId, backgroundNotificationPreview);
            }
            if (transferStatusChangedInThisReply && isChatRoomOpenFor(chatId)) {
                loadChatHistory(chatId);
            }

            if (!hasVisibleMessage) {
                throw new Error('API 未返回可显示文字');
            }

        } catch (error) {
            console.error(error);
            showApiErrorModal(error.message || 'AI 请求失败');
        } finally {
            if (chatStates[chatId]) {
                chatStates[chatId].isSending = false;
            }
            updateSendButtonState(chatId);
        }
    }

    // 菜单功能逻辑
    const menuBtn = document.getElementById('chat-menu-btn');
    const menu = document.getElementById('chat-action-menu');
    const regenerateBtn = document.getElementById('regenerate-reply-btn');
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');
    const voiceActionBtn = document.getElementById('voice-action-btn');
    const photoInput = document.getElementById('chat-photo-input');
    const stickerBtn = document.getElementById('chat-sticker-btn');
    const stickerMenu = document.getElementById('chat-sticker-menu');
    const stickerMenuContent = document.getElementById('chat-sticker-menu-content');
    const voiceActionModal = document.getElementById('voice-action-modal');
    const closeVoiceActionModalBtn = document.getElementById('close-voice-action-modal');
    const voiceActionInputBtn = document.getElementById('voice-action-input-btn');
    const voiceActionRecordBtn = document.getElementById('voice-action-record-btn');
    const voiceInputModal = document.getElementById('voice-input-modal');
    const closeVoiceInputModalBtn = document.getElementById('close-voice-input-modal');
    const voiceInputContent = document.getElementById('voice-input-content');
    const saveVoiceInputBtn = document.getElementById('save-voice-input-btn');
    const systemMessageBtn = document.getElementById('system-message-btn');
    const transferActionBtn = document.getElementById('transfer-action-btn');
    const systemMessageModal = document.getElementById('system-message-modal');
    const closeSystemMessageModalBtn = document.getElementById('close-system-message-modal');
    const systemMessageContent = document.getElementById('system-message-content');
    const saveSystemMessageBtn = document.getElementById('save-system-message-btn');
    const photoContentModal = document.getElementById('photo-content-modal');
    const closePhotoContentModalBtn = document.getElementById('close-photo-content-modal');
    const photoContentText = document.getElementById('photo-content-text');
    const transferModal = document.getElementById('transfer-modal');
    const closeTransferModalBtn = document.getElementById('close-transfer-modal');
    const cancelTransferModalBtn = document.getElementById('cancel-transfer-modal');
    const confirmTransferModalBtn = document.getElementById('confirm-transfer-modal');
    const transferAmountInput = document.getElementById('transfer-amount-input');
    const transferNoteInput = document.getElementById('transfer-note-input');
    const transferDecisionModal = document.getElementById('transfer-decision-modal');
    const closeTransferDecisionModalBtn = document.getElementById('close-transfer-decision-modal');
    const rejectTransferDecisionModalBtn = document.getElementById('reject-transfer-decision-modal');
    const receiveTransferDecisionModalBtn = document.getElementById('receive-transfer-decision-modal');
    const transferDecisionAmountEl = document.getElementById('transfer-decision-amount');
    const transferDecisionNoteEl = document.getElementById('transfer-decision-note');

    // Context Menu & Multi-select Logic
    const contextMenu = document.getElementById('message-context-menu');
    const editModal = document.getElementById('edit-message-modal');
    const editContent = document.getElementById('edit-message-content');
    const saveEditBtn = document.getElementById('save-edit-message');
    const closeEditBtn = document.getElementById('close-edit-message');
    const multiSelectBar = document.getElementById('multi-select-bar');
    const multiSelectCount = document.getElementById('multi-select-count');
    const multiSelectCancelBtn = document.getElementById('multi-select-cancel');
    const multiSelectDeleteBtn = document.getElementById('multi-select-delete');

    let currentContextMsg = null; // { id, content, chatId }
    const stickerStorageKey = 'sticker_categories_v1';
    const stickerTargetStorageKey = 'sticker_category_targets_v1';
    let activeStickerCategoryId = null;
    let isMultiSelectMode = false;
    const selectedMsgIds = new Set();
    let transferExpiryTicker = null;
    let pendingTransferDecisionContext = null;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeTransferPayload(raw) {
        const data = raw && typeof raw === 'object' ? raw : {};
        const amount = Number(data.amount);
        const createdAt = Number.isFinite(Number(data.createdAt)) ? Number(data.createdAt) : Date.now();
        const expiresAt = Number.isFinite(Number(data.expiresAt)) ? Number(data.expiresAt) : (createdAt + 24 * 60 * 60 * 1000);
        const statusRaw = String(data.status || 'pending').trim();
        const allowedStatus = new Set(['pending', 'accepted', 'rejected', 'expired']);
        return {
            id: String(data.id || `transfer_${createdAt}_${Math.random().toString(16).slice(2)}`),
            amount: Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : 0,
            note: String(data.note || '').trim(),
            createdAt,
            expiresAt,
            senderType: String(data.senderType || 'user').trim() === 'char' ? 'char' : 'user',
            senderUserId: String(data.senderUserId || '').trim(),
            status: allowedStatus.has(statusRaw) ? statusRaw : 'pending',
            refunded: data.refunded === true,
            received: data.received === true,
            refundedAt: Number.isFinite(Number(data.refundedAt)) ? Number(data.refundedAt) : null,
            receivedAt: Number.isFinite(Number(data.receivedAt)) ? Number(data.receivedAt) : null
        };
    }

    function appendWalletBillItem(list, bill) {
        const safe = Array.isArray(list) ? [...list] : [];
        safe.unshift({
            id: String(bill.id || `bill_${Date.now()}_${Math.random().toString(16).slice(2)}`),
            merchant: String(bill.merchant || '').trim() || '账单',
            desc: String(bill.desc || '').trim(),
            amount: Number.isFinite(Number(bill.amount)) ? Number(bill.amount) : 0,
            type: bill.type === 'income' ? 'income' : 'expense',
            timestamp: Number.isFinite(Number(bill.timestamp)) ? Number(bill.timestamp) : Date.now()
        });
        return safe.slice(0, 80);
    }

    function getTransferStatusLabel(transfer) {
        const status = String(transfer?.status || 'pending');
        if (status === 'accepted') return '已收款';
        if (status === 'rejected') return '已拒收，已退回';
        if (status === 'expired') return '已超时，已退回';
        return '待收款（24小时内）';
    }

    function canCurrentUserOperateTransfer(role, transfer) {
        const safeTransfer = normalizeTransferPayload(transfer);
        return safeTransfer.status === 'pending' && safeTransfer.senderType === 'char' && role === 'assistant';
    }

    function renderTransferCardMarkup(role, transfer, msgId) {
        const safeTransfer = normalizeTransferPayload(transfer);
        const note = safeTransfer.note ? escapeHtml(safeTransfer.note) : '无备注';
        const statusLabel = getTransferStatusLabel(safeTransfer);
        const canOperate = canCurrentUserOperateTransfer(role, safeTransfer);
        const title = safeTransfer.senderType === 'char'
            ? (role === 'assistant' ? '您已收到转账' : '您已发送转账')
            : (role === 'user' ? '您已发送转账' : '您已收到转账');
            
        // LINE style icon
        const iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="#00B900"/>
            <path d="M8 8L12 13M16 8L12 13M12 13V18M9 14H15M9 16H15" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

        return `
            <div
                class="transfer-card${safeTransfer.senderType === 'char' ? ' sender-char' : ''}${canOperate ? ' is-operable' : ''}"
                data-transfer-card="1"
                data-transfer-id="${escapeHtml(safeTransfer.id)}"
                data-msg-id="${escapeHtml(msgId || '')}"
                data-transfer-operable="${canOperate ? '1' : '0'}"
            >
                <div class="transfer-card-header">
                    <div class="transfer-card-icon">${iconSvg}</div>
                    <div class="transfer-card-info">
                        <div class="transfer-card-title">${title}</div>
                        <div class="transfer-card-amount">¥ ${safeTransfer.amount.toFixed(2)}</div>
                    </div>
                </div>
                ${note !== '无备注' ? `<div class="transfer-card-note">${note}</div>` : ''}
                <div class="transfer-card-divider"></div>
                <div class="transfer-card-footer">
                    <div class="transfer-card-brand">LINE Pay</div>
                    <div class="transfer-card-status">${statusLabel}${canOperate ? ' <span style="font-family: monospace; font-size: 14px; margin-left: 2px;">›</span>' : ''}</div>
                </div>
            </div>
        `;
    }

    function closeTransferModal() {
        if (!transferModal) return;
        transferModal.style.display = 'none';
    }

    function openTransferModal() {
        if (!transferModal || !transferAmountInput || !transferNoteInput) return;
        transferAmountInput.value = '';
        transferNoteInput.value = '';
        transferModal.style.display = 'flex';
        setTimeout(() => transferAmountInput.focus(), 0);
    }

    function closeTransferDecisionModal() {
        if (!transferDecisionModal) return;
        transferDecisionModal.style.display = 'none';
        pendingTransferDecisionContext = null;
    }

    function openTransferDecisionModal(chatId, msgId) {
        if (!transferDecisionModal || !transferDecisionAmountEl || !transferDecisionNoteEl) return;
        const history = largeStore.get('chat_history_' + chatId, []);
        if (!Array.isArray(history) || history.length === 0) return;
        const target = history.find((msg) => msg && msg.id === msgId && msg.transfer);
        if (!target) return;
        const transfer = normalizeTransferPayload(target.transfer);
        if (!canCurrentUserOperateTransfer(target.role, transfer)) return;

        transferDecisionAmountEl.textContent = `¥${transfer.amount.toFixed(2)}`;
        transferDecisionNoteEl.textContent = transfer.note || '无备注';
        pendingTransferDecisionContext = { chatId, msgId };
        transferDecisionModal.style.display = 'flex';
    }

    function refundTransferToUserWallet(chatId, transfer, reasonText) {
        const safeTransfer = normalizeTransferPayload(transfer);
        if (safeTransfer.refunded || safeTransfer.amount <= 0) return safeTransfer;
        const senderUserId = safeTransfer.senderUserId || String(getCurrentLineUserForWallet()?.id || '').trim();
        if (!senderUserId) return safeTransfer;
        const senderWallet = readLineWalletByUserId(senderUserId);
        const amount = safeTransfer.amount;
        const nextSenderWallet = {
            ...senderWallet,
            balance: Number((Number(senderWallet.balance || 0) + amount).toFixed(2)),
            bills: appendWalletBillItem(senderWallet.bills, {
                merchant: '转账退回',
                desc: reasonText || `来自 ${getChatDisplayName(chatId) || getChatRealName(chatId) || 'TA'} 的退回`,
                amount,
                type: 'income',
                timestamp: Date.now()
            })
        };
        saveLineWalletByUserId(senderUserId, nextSenderWallet);
        safeTransfer.refunded = true;
        safeTransfer.refundedAt = Date.now();
        return safeTransfer;
    }

    function receiveTransferToCharWallet(chatId, transfer) {
        const safeTransfer = normalizeTransferPayload(transfer);
        if (safeTransfer.received || safeTransfer.amount <= 0) return safeTransfer;
        const charWallet = readCharWalletByChatId(chatId);
        const amount = safeTransfer.amount;
        const nextCharWallet = {
            ...charWallet,
            balance: Number((Number(charWallet.balance || 0) + amount).toFixed(2)),
            bills: appendWalletBillItem(charWallet.bills, {
                merchant: '转账收款',
                desc: `来自 ${String(localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || 'User')}`,
                amount,
                type: 'income',
                timestamp: Date.now()
            })
        };
        saveCharWalletByChatId(chatId, nextCharWallet);
        safeTransfer.received = true;
        safeTransfer.receivedAt = Date.now();
        return safeTransfer;
    }

    function refundTransferToCharWallet(chatId, transfer, reasonText) {
        const safeTransfer = normalizeTransferPayload(transfer);
        if (safeTransfer.refunded || safeTransfer.amount <= 0) return safeTransfer;
        const charWallet = readCharWalletByChatId(chatId);
        const amount = safeTransfer.amount;
        const nextCharWallet = {
            ...charWallet,
            balance: Number((Number(charWallet.balance || 0) + amount).toFixed(2)),
            bills: appendWalletBillItem(charWallet.bills, {
                merchant: '转账退回',
                desc: reasonText || '转账退回',
                amount,
                type: 'income',
                timestamp: Date.now()
            })
        };
        saveCharWalletByChatId(chatId, nextCharWallet);
        safeTransfer.refunded = true;
        safeTransfer.refundedAt = Date.now();
        return safeTransfer;
    }

    function receiveTransferToUserWallet(chatId, transfer) {
        const safeTransfer = normalizeTransferPayload(transfer);
        if (safeTransfer.received || safeTransfer.amount <= 0) return safeTransfer;
        const currentUser = getCurrentLineUserForWallet();
        if (!currentUser || !currentUser.id) return safeTransfer;
        const userWallet = readLineWalletByUserId(currentUser.id);
        const amount = safeTransfer.amount;
        const nextUserWallet = {
            ...userWallet,
            balance: Number((Number(userWallet.balance || 0) + amount).toFixed(2)),
            bills: appendWalletBillItem(userWallet.bills, {
                merchant: '转账收款',
                desc: `来自 ${getChatDisplayName(chatId) || getChatRealName(chatId) || 'TA'}`,
                amount,
                type: 'income',
                timestamp: Date.now()
            })
        };
        saveLineWalletByUserId(currentUser.id, nextUserWallet);
        safeTransfer.received = true;
        safeTransfer.receivedAt = Date.now();
        return safeTransfer;
    }

    function refundTransferBySender(chatId, transfer, reasonText) {
        const safeTransfer = normalizeTransferPayload(transfer);
        if (safeTransfer.senderType === 'char') {
            return refundTransferToCharWallet(chatId, safeTransfer, reasonText);
        }
        return refundTransferToUserWallet(chatId, safeTransfer, reasonText);
    }

    function receiveTransferBySender(chatId, transfer) {
        const safeTransfer = normalizeTransferPayload(transfer);
        if (safeTransfer.senderType === 'char') {
            return receiveTransferToUserWallet(chatId, safeTransfer);
        }
        return receiveTransferToCharWallet(chatId, safeTransfer);
    }

    function applyTransferDecisionToHistory(chatId, history, targetIndex, action, operatorType) {
        if (!Array.isArray(history) || targetIndex < 0 || targetIndex >= history.length) return null;
        const targetMsg = history[targetIndex];
        if (!targetMsg || !targetMsg.transfer) return null;

        const transfer = normalizeTransferPayload(targetMsg.transfer);
        if (transfer.status !== 'pending') return null;

        const expectedSenderType = operatorType === 'char' ? 'user' : 'char';
        if (transfer.senderType !== expectedSenderType) return null;

        let nextTransfer = transfer;
        if (action === 'receive') {
            nextTransfer.status = 'accepted';
            nextTransfer = receiveTransferBySender(chatId, nextTransfer);
        } else if (action === 'reject') {
            nextTransfer.status = 'rejected';
            const reasonText = operatorType === 'char'
                ? '对方拒绝收款，已退回'
                : '你已拒绝收款，已退回';
            nextTransfer = refundTransferBySender(chatId, nextTransfer, reasonText);
        } else {
            return null;
        }

        history[targetIndex] = {
            ...targetMsg,
            transfer: normalizeTransferPayload(nextTransfer)
        };
        persistChatHistory(chatId, history);
        return normalizeTransferPayload(nextTransfer);
    }

    function applyUserTransferDecision(chatId, msgId, action) {
        const history = largeStore.get('chat_history_' + chatId, []);
        if (!Array.isArray(history) || history.length === 0) return null;
        const targetIndex = history.findIndex((msg) => msg && msg.id === msgId && msg.transfer);
        if (targetIndex < 0) return null;
        return applyTransferDecisionToHistory(chatId, history, targetIndex, action, 'user');
    }

    function applyAssistantTransferDecision(chatId, decision) {
        const action = decision && decision.action;
        const transferId = String(decision && decision.transferId ? decision.transferId : '').trim();
        const history = largeStore.get('chat_history_' + chatId, []);
        if (!Array.isArray(history) || history.length === 0) return null;

        let targetIndex = -1;
        if (transferId) {
            targetIndex = history.findIndex((msg) => {
                if (!msg || !msg.transfer) return false;
                const transfer = normalizeTransferPayload(msg.transfer);
                return transfer.id === transferId && transfer.senderType === 'user' && transfer.status === 'pending';
            });
        }
        if (targetIndex < 0) {
            for (let i = history.length - 1; i >= 0; i -= 1) {
                const msg = history[i];
                if (!msg || !msg.transfer) continue;
                const transfer = normalizeTransferPayload(msg.transfer);
                if (transfer.senderType === 'user' && transfer.status === 'pending') {
                    targetIndex = i;
                    break;
                }
            }
        }
        if (targetIndex < 0) return null;
        return applyTransferDecisionToHistory(chatId, history, targetIndex, action, 'char');
    }

    function buildPendingIncomingTransfersPromptForChar(chatId) {
        const history = largeStore.get('chat_history_' + chatId, []);
        if (!Array.isArray(history) || history.length === 0) return '无';
        const pending = [];
        for (let i = 0; i < history.length; i += 1) {
            const msg = history[i];
            if (!msg || !msg.transfer) continue;
            const transfer = normalizeTransferPayload(msg.transfer);
            if (transfer.senderType !== 'user' || transfer.status !== 'pending') continue;
            const createdTime = new Date(transfer.createdAt).toLocaleString('zh-CN', { hour12: false });
            pending.push(`- ID:${transfer.id} | 金额:¥${transfer.amount.toFixed(2)} | 备注:${transfer.note || '无'} | 发起时间:${createdTime}`);
        }
        return pending.length > 0 ? pending.join('\n') : '无';
    }

    function processTransferExpiry(chatId) {
        const history = largeStore.get('chat_history_' + chatId, []);
        if (!Array.isArray(history) || history.length === 0) return false;
        const now = Date.now();
        let changed = false;
        for (let i = 0; i < history.length; i += 1) {
            const msg = history[i];
            if (!msg || !msg.transfer) continue;
            const transfer = normalizeTransferPayload(msg.transfer);
            if (transfer.status !== 'pending') continue;
            if (now < transfer.expiresAt) continue;
            transfer.status = 'expired';
            const refundedTransfer = refundTransferBySender(chatId, transfer, '24小时未收款，自动退回');
            history[i] = { ...msg, transfer: refundedTransfer };
            changed = true;
        }
        if (changed) {
            persistChatHistory(chatId, history);
        }
        return changed;
    }

    function closeStickerMenu() {
        if (stickerMenu) {
            stickerMenu.style.display = 'none';
        }
    }

    function closeVoiceActionModal() {
        if (voiceActionModal) {
            voiceActionModal.style.display = 'none';
        }
    }

    function closeVoiceInputModal() {
        if (voiceInputModal) {
            voiceInputModal.style.display = 'none';
        }
    }

    function closeSystemMessageModal() {
        if (systemMessageModal) {
            systemMessageModal.style.display = 'none';
        }
    }

    function closePhotoContentModal() {
        if (photoContentModal) {
            photoContentModal.style.display = 'none';
        }
    }

    let originalStickerIcon = '';
    const stickerSendIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg>`;
    function setStickerSendMode(active) {
        if (!stickerBtn) return;
        if (!originalStickerIcon) originalStickerIcon = stickerBtn.innerHTML;
        if (active) {
            stickerBtn.classList.add('send-mode');
            stickerBtn.innerHTML = stickerSendIcon;
            stickerBtn.title = '发送';
        } else {
            stickerBtn.classList.remove('send-mode');
            stickerBtn.innerHTML = originalStickerIcon || stickerBtn.innerHTML;
            stickerBtn.title = '';
        }
    }
    function sendInputToScreen() {
        if (!inputField) return;
        const text = inputField.value.trim();
        if (!text) return;
        const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
        const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
        const newMsg = saveMessage(chatId, 'user', text, extra);
        appendMessageToUI('user', text, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });
        inputField.value = '';
        clearPendingQuote();
        setStickerSendMode(false);
    }
    if (inputField) {
        inputField.addEventListener('focus', () => setStickerSendMode(true));
        inputField.addEventListener('blur', () => {
            if (!inputField.value.trim()) setStickerSendMode(false);
        });
        inputField.addEventListener('input', () => {
            const hasText = !!inputField.value.trim();
            setStickerSendMode(hasText);
        });
    }

    function estimateVoiceDurationSeconds(text) {
        const normalized = String(text || '').replace(/\s+/g, '');
        if (!normalized) return 1;
        const byLength = Math.round(normalized.length / 3);
        return Math.max(1, Math.min(60, byLength));
    }

    function sendSystemMessage(text) {
        const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
        const newMsg = saveMessage(chatId, 'system', text, {});
        appendMessageToUI('system', text, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });
    }

    function getAvailableStickerCategories(chatId) {
        const categories = JSON.parse(localStorage.getItem(stickerStorageKey) || '[]');
        const targetMap = JSON.parse(localStorage.getItem(stickerTargetStorageKey) || '{}');
        return categories.filter(category => {
            if (!category || !Array.isArray(category.emojis) || category.emojis.length === 0) return false;
            const targets = targetMap[category.id] || [];
            return targets.includes('我') || targets.includes(chatId);
        });
    }

    function renderStickerMenu(chatId) {
        if (!stickerMenuContent) return;
        const categories = getAvailableStickerCategories(chatId);

        if (categories.length === 0) {
            activeStickerCategoryId = null;
            stickerMenuContent.innerHTML = '<div class="sticker-panel-empty">未绑定可用贴图分类</div>';
            return;
        }

        if (!categories.some(category => category.id === activeStickerCategoryId)) {
            activeStickerCategoryId = categories[0].id;
        }

        const activeCategory = categories.find(category => category.id === activeStickerCategoryId) || categories[0];
        const tabs = categories.map(category => `
            <button class="chat-sticker-tab ${category.id === activeCategory.id ? 'active' : ''}" type="button" data-category-id="${escapeHtml(category.id)}">
                ${escapeHtml(category.name)}
            </button>
        `).join('');

        const emojis = activeCategory.emojis.map(emoji => `
            <button class="sticker-panel-emoji-btn" type="button" data-name="${escapeHtml(emoji.name)}" data-url="${escapeHtml(emoji.url)}">
                <img src="${escapeHtml(emoji.url)}" alt="${escapeHtml(emoji.name)}">
                <span class="sticker-panel-emoji-label">${escapeHtml(emoji.name)}</span>
            </button>
        `).join('');

        stickerMenuContent.innerHTML = `
            <div class="chat-sticker-layout">
                <div class="chat-sticker-tabs">${tabs}</div>
                <div class="chat-sticker-panel">
                    <div class="chat-sticker-grid">${emojis}</div>
                </div>
            </div>
        `;
    }

    function clampSummaryCursor(chatId, historyLength) {
        const cursorKey = getSummaryCursorKey(chatId);
        const raw = localStorage.getItem(cursorKey);
        if (raw === null) return;
        const parsed = parseInt(raw, 10);
        if (!Number.isFinite(parsed)) {
            localStorage.removeItem(cursorKey);
            return;
        }
        const clamped = Math.max(0, Math.min(parsed, historyLength));
        if (clamped !== parsed) {
            localStorage.setItem(cursorKey, String(clamped));
        }
    }

    function persistChatHistory(chatId, history) {
        const prevHistory = largeStore.get('chat_history_' + chatId, []);
        const prevLength = Array.isArray(prevHistory) ? prevHistory.length : 0;
        const safeHistory = Array.isArray(history) ? history : [];
        largeStore.put('chat_history_' + chatId, safeHistory);
        
        // 更新最后一条消息的元数据
        if (safeHistory.length > 0) {
            const lastMsg = safeHistory[safeHistory.length - 1];
            localStorage.setItem('chat_last_message_' + chatId, JSON.stringify({ message: lastMsg, ts: lastMsg.ts }));
        } else {
            localStorage.removeItem('chat_last_message_' + chatId);
        }

        clampSummaryCursor(chatId, safeHistory.length);
        if (safeHistory.length < prevLength) {
            localStorage.setItem(getSummaryCursorKey(chatId), String(safeHistory.length));
        }
    }

    function updateSelectCount() {
        if (multiSelectCount) {
            multiSelectCount.textContent = `已选择 ${selectedMsgIds.size} 条`;
        }
        if (multiSelectDeleteBtn) {
            multiSelectDeleteBtn.disabled = selectedMsgIds.size === 0;
        }
    }

    function toggleMessageSelection(messageId) {
        if (!messageId) return;
        const selectorId = String(messageId).replace(/"/g, '\\"');
        const row = chatContent.querySelector(`.message-row[data-id="${selectorId}"]`);
        if (!row) return;

        if (selectedMsgIds.has(messageId)) {
            selectedMsgIds.delete(messageId);
            row.classList.remove('selected');
        } else {
            selectedMsgIds.add(messageId);
            row.classList.add('selected');
        }
        updateSelectCount();
    }

    function enterMultiSelectMode(initialMessageId) {
        isMultiSelectMode = true;
        selectedMsgIds.clear();
        contextMenu.style.display = 'none';
        closeStickerMenu();
        if (menu) {
            menu.style.display = 'none';
        }
        if (chatRoom) {
            chatRoom.classList.add('multi-select-mode');
        }
        if (multiSelectBar) {
            multiSelectBar.style.display = 'flex';
        }
        if (initialMessageId) {
            const selectorId = String(initialMessageId).replace(/"/g, '\\"');
            const row = chatContent.querySelector(`.message-row[data-id="${selectorId}"]`);
            if (row) {
                selectedMsgIds.add(initialMessageId);
                row.classList.add('selected');
            }
        }
        updateSelectCount();
    }

    function exitMultiSelectMode() {
        isMultiSelectMode = false;
        selectedMsgIds.clear();
        if (chatRoom) {
            chatRoom.classList.remove('multi-select-mode');
        }
        chatContent.querySelectorAll('.message-row.selected').forEach((row) => {
            row.classList.remove('selected');
        });
        if (multiSelectBar) {
            multiSelectBar.style.display = 'none';
        }
        updateSelectCount();
    }

    function deleteSelectedMessages() {
        if (!isMultiSelectMode || selectedMsgIds.size === 0) {
            alert('请先选择要删除的消息');
            return;
        }
        const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
        const shouldDelete = confirm(`确定彻底删除选中的 ${selectedMsgIds.size} 条消息吗？\n删除后会同时从聊天记录和发送给 AI 的上下文中移除，且不可恢复。`);
        if (!shouldDelete) return;

        let history = largeStore.get('chat_history_' + chatId, []);
        history = history.filter((m) => !selectedMsgIds.has(m.id));
        persistChatHistory(chatId, history);
        loadChatHistory(chatId);
        refreshChatListPreviewFor(chatId);
    }

    function showContextMenu(e, id, content, chatId, role, timeStr) {
        if (isMultiSelectMode) return;
        // Prevent default browser context menu
        e.preventDefault();
        
        currentContextMsg = { id, content, chatId, role, timeStr };
        
        // Calculate position
        let x = e.clientX || (e.touches && e.touches[0].clientX);
        let y = e.clientY || (e.touches && e.touches[0].clientY);

        // Adjust for menu width (approx 120px) and height
        // Center horizontally on click
        const menuWidth = 180;
        x -= menuWidth / 2;

        // Ensure within bounds
        if (x < 10) x = 10;
        if (x + menuWidth > window.innerWidth - 10) x = window.innerWidth - menuWidth - 10;
        
        // Position above by default
        const menuHeight = 50;
        y -= menuHeight + 10; 
        
        // Flip if too close to top
        if (y < 10) {
            y += menuHeight + 40; // Move below
            contextMenu.classList.add('flipped');
        } else {
            contextMenu.classList.remove('flipped');
        }

        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.style.display = 'flex';

        // Close menu when clicking outside
        const closeMenu = (ev) => {
            if (!contextMenu.contains(ev.target)) {
                contextMenu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('touchstart', closeMenu);
            }
        };
        // Delay adding listener to avoid immediate close
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            document.addEventListener('touchstart', closeMenu);
        }, 100);
    }

    // Context Menu Actions
    document.getElementById('ctx-edit').addEventListener('click', () => {
        if (!currentContextMsg) return;
        contextMenu.style.display = 'none';
        
        // Open Edit Modal
        editContent.value = normalizeMessageForModel(currentContextMsg.content);
        editModal.style.display = 'flex';
        setTimeout(() => editContent.focus(), 0);
    });

    document.getElementById('ctx-delete').addEventListener('click', () => {
        if (!currentContextMsg) return;
        contextMenu.style.display = 'none';
        enterMultiSelectMode(currentContextMsg.id);
        alert('已进入多选删除模式。删除后消息会从聊天记录和 AI 上下文中彻底移除。');
    });

    document.getElementById('ctx-quote').addEventListener('click', () => {
        if (!currentContextMsg) return;
        contextMenu.style.display = 'none';
        pendingQuote = {
            id: currentContextMsg.id,
            text: toPlainMessageText(currentContextMsg.content) || '引用消息'
        };
        updateReplyPreviewUI();
        if (inputField) {
            inputField.focus();
        }
    });

    // Edit Logic
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            if (!currentContextMsg) return;
            const newContent = editContent.value.trim();
            if (!newContent) {
                alert('内容不能为空');
                return;
            }

            // Update Data
            const chatId = currentContextMsg.chatId;
            let history = largeStore.get('chat_history_' + chatId, []);
            const msgIndex = history.findIndex(m => m.id === currentContextMsg.id);
            
           if (msgIndex !== -1) {
    history[msgIndex].content = newContent;
    persistChatHistory(chatId, history);

    // Reload is safer to sync everything
    loadChatHistory(chatId);
    refreshChatListPreviewFor(chatId);
}

            editModal.style.display = 'none';
        });
    }

    if (closeEditBtn) {
        closeEditBtn.addEventListener('click', () => {
            editModal.style.display = 'none';
        });
    }

    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                editModal.style.display = 'none';
            }
        });
    }

    if (chatContent) {
        chatContent.addEventListener('click', (e) => {
            const transferCardEl = e.target.closest('.transfer-card[data-transfer-operable="1"]');
            if (transferCardEl && chatContent.contains(transferCardEl)) {
                if (isMultiSelectMode) return;
                const msgId = String(transferCardEl.getAttribute('data-msg-id') || '').trim();
                const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
                if (!msgId || !chatId) return;
                openTransferDecisionModal(chatId, msgId);
                return;
            }

            const photoTarget = e.target.closest('.camera-photo-placeholder');
            if (photoTarget && chatContent.contains(photoTarget)) {
                if (isMultiSelectMode) return;
                const text = photoTarget.dataset.photoText || '';
                if (photoContentText) {
                    photoContentText.textContent = text || '暂无内容';
                }
                if (photoContentModal) {
                    photoContentModal.style.display = 'flex';
                }
                return;
            }
            if (!isMultiSelectMode) return;
            const row = e.target.closest('.message-row');
            if (!row || !chatContent.contains(row)) return;
            e.preventDefault();
            toggleMessageSelection(row.dataset.id);
        });
    }

    if (multiSelectCancelBtn) {
        multiSelectCancelBtn.addEventListener('click', () => {
            exitMultiSelectMode();
        });
    }

    if (multiSelectDeleteBtn) {
        multiSelectDeleteBtn.addEventListener('click', () => {
            deleteSelectedMessages();
        });
    }

    if (menuBtn && menu) {
        // 切换菜单显示
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeStickerMenu();
            if (menu.style.display === 'none') {
                menu.style.display = 'block';
            } else {
                menu.style.display = 'none';
            }
        });

        // 点击外部关闭菜单
        document.addEventListener('click', (e) => {
            if (menu.style.display !== 'none' && !menu.contains(e.target) && !menuBtn.contains(e.target)) {
                menu.style.display = 'none';
            }
        });

        // 重回功能
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', async () => {
                menu.style.display = 'none'; // 关闭菜单
                
                const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
                const history = largeStore.get('chat_history_' + chatId, []);
                
                // 检查是否有消息
                if (history.length === 0) return;

                // 从后往前查找，移除最近的连续 assistant 消息
                // 如果最后一条是 user，则直接重试回复（相当于重发）
                // 如果最后一条是 assistant，则删除这一轮的所有 assistant 消息，然后重试
                
                let hasRemoved = false;
                
                // 只要最后一条是 assistant，就移除
                while (history.length > 0 && history[history.length - 1].role === 'assistant') {
                    history.pop();
                    hasRemoved = true;
                }

                // 保存更新后的历史记录
                persistChatHistory(chatId, history);
                
                // 重新加载 UI（移除屏幕上的消息）
                loadChatHistory(chatId);
                
                // 触发 AI 回复
                if (history.length === 0 || history[history.length - 1].role !== 'user') return;
                await triggerAIResponse(chatId);
            });
        }
    }

    if (uploadPhotoBtn && photoInput) {
        uploadPhotoBtn.addEventListener('click', () => {
            if (menu) {
                menu.style.display = 'none';
            }
            photoInput.click();
        });

        photoInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []).filter((file) => /^image\//i.test(file.type));
            photoInput.value = '';
            if (files.length === 0) return;

            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            const quoteExtra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : null;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const dataUrl = await readImageAsDataUrl(file);
                    if (!dataUrl) continue;
                    const imageContent = `<img src="${dataUrl}" alt="${escapeHtml(file.name || '本地图片')}" class="chat-inline-local-image">`;
                    const extra = i === 0 && quoteExtra ? quoteExtra : {};
                    const newMsg = saveMessage(chatId, 'user', imageContent, extra);
                    appendMessageToUI('user', imageContent, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });
                } catch (error) {
                    showApiErrorModal(error.message || '图片上传失败');
                    break;
                }
            }
            clearPendingQuote();
        });
    }

    const cameraActionBtn = document.getElementById('camera-action-btn');
    const cameraInputModal = document.getElementById('camera-input-modal');
    const closeCameraInputModalBtn = document.getElementById('close-camera-input-modal');
    const sendCameraPhotoBtn = document.getElementById('send-camera-photo-btn');
    const cameraInputContent = document.getElementById('camera-input-content');

    if (cameraActionBtn && cameraInputModal) {
        cameraActionBtn.addEventListener('click', () => {
            if (menu) {
                menu.style.display = 'none';
            }
            closeStickerMenu();
            cameraInputContent.value = '';
            cameraInputModal.style.display = 'flex';
            setTimeout(() => cameraInputContent.focus(), 0);
        });
    }

    if (closeCameraInputModalBtn) {
        closeCameraInputModalBtn.addEventListener('click', () => {
            cameraInputModal.style.display = 'none';
        });
    }

    if (cameraInputModal) {
        cameraInputModal.addEventListener('click', (e) => {
            if (e.target === cameraInputModal) {
                cameraInputModal.style.display = 'none';
            }
        });
    }

    if (sendCameraPhotoBtn && cameraInputContent) {
        sendCameraPhotoBtn.addEventListener('click', () => {
            const content = cameraInputContent.value.trim();
            if (!content) {
                alert('照片内容不能为空');
                return;
            }
            
            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
            const photoHtml = buildCameraPlaceholderHtml(content);
            const newMsg = saveMessage(chatId, 'user', photoHtml, extra);
            appendMessageToUI('user', photoHtml, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });
            
            cameraInputModal.style.display = 'none';
            clearPendingQuote();
        });
    }

    if (voiceActionBtn && voiceActionModal) {
        voiceActionBtn.addEventListener('click', () => {
            if (menu) {
                menu.style.display = 'none';
            }
            closeStickerMenu();
            voiceActionModal.style.display = 'flex';
        });
    }

    if (systemMessageBtn && systemMessageModal) {
        systemMessageBtn.addEventListener('click', () => {
            if (menu) {
                menu.style.display = 'none';
            }
            closeStickerMenu();
            systemMessageModal.style.display = 'flex';
        });
    }

    if (transferActionBtn) {
        transferActionBtn.addEventListener('click', () => {
            if (menu) {
                menu.style.display = 'none';
            }
            closeStickerMenu();
            openTransferModal();
        });
    }

    if (closeTransferModalBtn) {
        closeTransferModalBtn.addEventListener('click', closeTransferModal);
    }

    if (cancelTransferModalBtn) {
        cancelTransferModalBtn.addEventListener('click', closeTransferModal);
    }

    if (transferModal) {
        transferModal.addEventListener('click', (e) => {
            if (e.target === transferModal) {
                closeTransferModal();
            }
        });
    }

    if (closeTransferDecisionModalBtn) {
        closeTransferDecisionModalBtn.addEventListener('click', closeTransferDecisionModal);
    }

    if (transferDecisionModal) {
        transferDecisionModal.addEventListener('click', (e) => {
            if (e.target === transferDecisionModal) {
                closeTransferDecisionModal();
            }
        });
    }

    function submitTransferDecisionFromModal(action) {
        const context = pendingTransferDecisionContext;
        if (!context || !context.chatId || !context.msgId) return;
        const nextTransfer = applyUserTransferDecision(context.chatId, context.msgId, action);
        if (!nextTransfer) {
            closeTransferDecisionModal();
            loadChatHistory(context.chatId);
            refreshChatListPreviewFor(context.chatId);
            return;
        }
        const resultText = action === 'receive' ? '已收款' : '已拒收';
        saveMessage(context.chatId, 'user', resultText, { transfer: nextTransfer });
        closeTransferDecisionModal();
        loadChatHistory(context.chatId);
        refreshChatListPreviewFor(context.chatId);
    }

    if (receiveTransferDecisionModalBtn) {
        receiveTransferDecisionModalBtn.addEventListener('click', () => {
            submitTransferDecisionFromModal('receive');
        });
    }

    if (rejectTransferDecisionModalBtn) {
        rejectTransferDecisionModalBtn.addEventListener('click', () => {
            submitTransferDecisionFromModal('reject');
        });
    }

    if (confirmTransferModalBtn) {
        confirmTransferModalBtn.addEventListener('click', () => {
            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            const currentUser = getCurrentLineUserForWallet();
            if (!chatId) return;
            if (!currentUser || !currentUser.id) {
                alert('请先在 LINE 首页设置 User');
                return;
            }
            const amount = Number(String(transferAmountInput?.value || '').trim());
            const note = String(transferNoteInput?.value || '').trim();
            if (!Number.isFinite(amount) || amount <= 0) {
                alert('请输入有效金额');
                return;
            }
            const normalizedAmount = Number(amount.toFixed(2));
            const targetName = getChatDisplayName(chatId) || getChatRealName(chatId) || 'TA';
            const userWallet = readLineWalletByUserId(currentUser.id);
            if (Number(userWallet.balance || 0) < normalizedAmount) {
                alert('余额不足');
                return;
            }
            const nextUserWallet = {
                ...userWallet,
                balance: Number((Number(userWallet.balance || 0) - normalizedAmount).toFixed(2)),
                bills: appendWalletBillItem(userWallet.bills, {
                    merchant: '转账支出',
                    desc: `向 ${targetName} 转账${note ? `（${note}）` : ''}`,
                    amount: normalizedAmount,
                    type: 'expense',
                    timestamp: Date.now()
                })
            };
            saveLineWalletByUserId(currentUser.id, nextUserWallet);

            const transferPayload = normalizeTransferPayload({
                id: `transfer_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                amount: normalizedAmount,
                note,
                createdAt: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                senderType: 'user',
                senderUserId: currentUser.id,
                status: 'pending',
                refunded: false,
                received: false
            });
            const extra = {
                ...(pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {}),
                transfer: transferPayload
            };
            const transferText = `[转账] ¥${normalizedAmount.toFixed(2)}`;
            const newMsg = saveMessage(chatId, 'user', transferText, extra);
            appendMessageToUI('user', transferText, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });
            clearPendingQuote();
            closeTransferModal();
        });
    }

    if (closeSystemMessageModalBtn) {
        closeSystemMessageModalBtn.addEventListener('click', () => {
            closeSystemMessageModal();
        });
    }

    if (systemMessageModal) {
        systemMessageModal.addEventListener('click', (e) => {
            if (e.target === systemMessageModal) {
                closeSystemMessageModal();
            }
        });
    }

    if (closeVoiceActionModalBtn) {
        closeVoiceActionModalBtn.addEventListener('click', () => {
            closeVoiceActionModal();
        });
    }

    if (voiceActionModal) {
        voiceActionModal.addEventListener('click', (e) => {
            if (e.target === voiceActionModal) {
                closeVoiceActionModal();
            }
        });
    }

    if (voiceActionInputBtn) {
        voiceActionInputBtn.addEventListener('click', () => {
            closeVoiceActionModal();
            if (voiceInputModal) {
                voiceInputModal.style.display = 'flex';
                setTimeout(() => {
                    if (voiceInputContent) {
                        voiceInputContent.focus();
                    }
                }, 0);
            }
        });
    }

    if (voiceActionRecordBtn) {
        voiceActionRecordBtn.addEventListener('click', () => {
            closeVoiceActionModal();
            alert('录音功能即将上线');
        });
    }

    if (closeVoiceInputModalBtn) {
        closeVoiceInputModalBtn.addEventListener('click', () => {
            closeVoiceInputModal();
        });
    }



    if (photoContentModal) {
        photoContentModal.addEventListener('click', (e) => {
            if (e.target === photoContentModal) {
                closePhotoContentModal();
            }
        });
    }

    if (closePhotoContentModalBtn) {
        closePhotoContentModalBtn.addEventListener('click', () => {
            closePhotoContentModal();
        });
    }

    if (saveVoiceInputBtn) {
        saveVoiceInputBtn.addEventListener('click', () => {
            const rawText = voiceInputContent ? voiceInputContent.value.trim() : '';
            if (!rawText) {
                alert('请输入语音内容');
                return;
            }

            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            const duration = estimateVoiceDurationSeconds(rawText);
            const extra = {
                ...(pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {}),
                voice: {
                    duration,
                    transcript: rawText
                }
            };
            const newMsg = saveMessage(chatId, 'user', rawText, extra);
            appendMessageToUI('user', rawText, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });

            if (voiceInputContent) {
                voiceInputContent.value = '';
            }
            clearPendingQuote();
            closeVoiceInputModal();
        });
    }

    if (saveSystemMessageBtn) {
        saveSystemMessageBtn.addEventListener('click', () => {
            const rawText = systemMessageContent ? systemMessageContent.value.trim() : '';
            if (!rawText) {
                alert('请输入旁白/系统消息内容');
                return;
            }
            sendSystemMessage(rawText);
            if (systemMessageContent) {
                systemMessageContent.value = '';
            }
            closeSystemMessageModal();
        });
    }

    if (stickerBtn && stickerMenu) {
        let stickerTouchHandled = false;

        // 阻止 mousedown 默认行为，防止 PC 端点击时输入框失焦
        stickerBtn.addEventListener('mousedown', (e) => {
            if (stickerBtn.classList.contains('send-mode')) {
                e.preventDefault();
            }
        });

        // 阻止 touchstart 默认行为，防止移动端点击时键盘收起
        stickerBtn.addEventListener('touchstart', (e) => {
            if (stickerBtn.classList.contains('send-mode')) {
                e.preventDefault();
            }
        }, { passive: false });

        // 在 touchend 执行发送，并设置标志位防止触发后续 click 导致打开表情包菜单
        stickerBtn.addEventListener('touchend', (e) => {
            if (stickerBtn.classList.contains('send-mode')) {
                e.preventDefault();
                e.stopPropagation();
                stickerTouchHandled = true;
                setTimeout(() => { stickerTouchHandled = false; }, 300); // 防止标志位卡死
                sendInputToScreen();
            }
        }, { passive: false });

        stickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (stickerTouchHandled) {
                stickerTouchHandled = false;
                return;
            }
            if (stickerBtn.classList.contains('send-mode')) {
                sendInputToScreen();
                if (inputField) {
                    inputField.focus(); // PC端点击时重新获取焦点
                }
                return;
            }
            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            stickerMenu.dataset.chatId = chatId;
            renderStickerMenu(chatId);
            menu.style.display = 'none';
            if (stickerMenu.style.display === 'none') {
                stickerMenu.style.display = 'block';
            } else {
                stickerMenu.style.display = 'none';
            }
        });
    }

    if (stickerMenu) {
        stickerMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabBtn = e.target.closest('.chat-sticker-tab');
            if (tabBtn) {
                const categoryId = tabBtn.dataset.categoryId;
                if (categoryId) {
                    activeStickerCategoryId = categoryId;
                    const chatId = stickerMenu.dataset.chatId || chatRoomName.dataset.chatId || chatRoomName.textContent;
                    renderStickerMenu(chatId);
                }
                return;
            }

            const stickerBtnEl = e.target.closest('.sticker-panel-emoji-btn');
            if (!stickerBtnEl) return;

            const stickerName = stickerBtnEl.dataset.name || '表情';
            const stickerUrl = stickerBtnEl.dataset.url || '';
            if (!/^https?:\/\//i.test(stickerUrl)) return;

            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            const stickerContent = `<img src="${stickerUrl}" alt="${escapeHtml(stickerName)}" class="chat-inline-sticker">`;
            const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
            const newMsg = saveMessage(chatId, 'user', stickerContent, extra);
            appendMessageToUI('user', stickerContent, newMsg.time, chatId, newMsg.id, newMsg, { isNew: true });
            clearPendingQuote();
            closeStickerMenu();
        });

        document.addEventListener('click', (e) => {
            if (stickerMenu.style.display !== 'none' && !stickerMenu.contains(e.target) && (!stickerBtn || !stickerBtn.contains(e.target))) {
                closeStickerMenu();
            }
        });
    }

    // 打开聊天室的通用函数
    function openChatRoom(chatId) {
        if (!chatRoom) return;
        exitMultiSelectMode();
        closeStickerMenu();
        clearPendingQuote();

        const displayName = getChatDisplayName(chatId) || getChatRealName(chatId) || chatId;
        chatRoomName.textContent = displayName;
        chatRoomName.dataset.chatId = chatId;
        clearUnread(chatId);
        applyChatWallpaper(chatId);
        applyChatTheme(chatId);
        
        chatRoom.style.display = 'flex';
        updateChatTimeZoneIndicator(chatId);
        
        // 同步按钮状态
        updateSendButtonState(chatId);

        // 加载真实历史记录
        loadChatHistory(chatId);
        ensurePhoneLockDataAsync(chatId).catch(() => {});
    }

    if (!transferExpiryTicker) {
        transferExpiryTicker = setInterval(() => {
            const currentChatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            if (!currentChatId || !isChatRoomOpenFor(currentChatId)) return;
            const changed = processTransferExpiry(currentChatId);
            if (!changed) return;
            loadChatHistory(currentChatId);
            refreshChatListPreviewFor(currentChatId);
        }, 30000);
    }

    setInterval(() => {
        const currentChatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
        if (!currentChatId || !isChatRoomOpenFor(currentChatId)) return;
        updateChatTimeZoneIndicator(currentChatId);
    }, 60000);

    // 绑定事件委托，处理聊天列表点击（包括动态添加的项）
    if (chatList) {
        chatList.addEventListener('click', (e) => {
            // 找到被点击的 chat-list-item
            const item = e.target.closest('.chat-list-item');
            if (item) {
                const chatId = item.dataset.chatId || '';
                if (!chatId) return;
                openChatRoom(chatId);
            }
        });
    }

    // 关闭聊天室
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (chatRoom) {
                chatRoom.style.display = 'none';
            }
            if (chatTimezoneIndicator) {
                chatTimezoneIndicator.style.display = 'none';
                chatTimezoneIndicator.textContent = '';
            }
            clearChatTheme();
            exitMultiSelectMode();
            closeStickerMenu();
            closeTransferModal();
            clearPendingQuote();
        });
    }

    if (replyPreviewClose) {
        replyPreviewClose.addEventListener('click', () => {
            clearPendingQuote();
        });
    }

    // Mood Sprite Modal Logic
    const spriteModal = document.createElement('div');
    spriteModal.className = 'mood-sprite-modal';
    spriteModal.style.display = 'none';
    spriteModal.innerHTML = `
        <div class="mood-sprite-content">
            <div class="mood-sprite-header">
                <span class="mood-sprite-title">内心独白</span>
                <div class="mood-sprite-controls">
                    <button class="mood-sprite-fav" title="收藏便签">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                    </button>
                    <button class="mood-sprite-close">×</button>
                </div>
            </div>
            <div class="mood-sprite-body"></div>
        </div>
    `;
    document.body.appendChild(spriteModal);

    const spriteCloseBtn = spriteModal.querySelector('.mood-sprite-close');
    const spriteFavBtn = spriteModal.querySelector('.mood-sprite-fav');
    const spriteBody = spriteModal.querySelector('.mood-sprite-body');

    let currentSpriteContext = null; // { chatId, msgId, spriteEl, isFavorited }

    function getSpriteSnapshot(chatId, msgId, fallbackSprite) {
        const history = largeStore.get('chat_history_' + chatId, []);
        const msg = history.find(m => m.id === msgId);
        if (msg && msg.sprite) {
            return { ...msg.sprite };
        }
        if (fallbackSprite) {
            return { ...fallbackSprite };
        }
        return null;
    }

    function showSpriteModal(spriteData, chatId, msgId, spriteEl) {
        const latestSprite = getSpriteSnapshot(chatId, msgId, spriteData);
        if (!latestSprite) return;
        
        // Ensure modal exists
        if (!document.body.contains(spriteModal)) {
            document.body.appendChild(spriteModal);
        }

        currentSpriteContext = {
            chatId,
            msgId,
            spriteEl,
            isFavorited: !!latestSprite.isFavorited
        };

        const charName = getChatDisplayName(chatId) || getChatRealName(chatId) || chatId;
        spriteModal.querySelector('.mood-sprite-title').textContent = `${charName} 的随笔`;
        spriteBody.textContent = '';
        const mainTextEl = document.createElement('div');
        mainTextEl.textContent = String(latestSprite.content || '').trim();
        spriteBody.appendChild(mainTextEl);
        if (latestSprite.secret) {
            const secretWrap = document.createElement('div');
            secretWrap.style.marginTop = '15px';
            secretWrap.style.borderTop = '1px dashed rgba(0,0,0,0.1)';
            secretWrap.style.paddingTop = '10px';
            const secretText = document.createElement('span');
            secretText.style.textDecoration = 'line-through';
            secretText.style.color = '#888';
            secretText.style.fontSize = '0.9em';
            secretText.textContent = String(latestSprite.secret || '').trim();
            secretWrap.appendChild(secretText);
            spriteBody.appendChild(secretWrap);
        }
        spriteBody.style.borderLeft = `4px solid ${normalizeSpriteColor(latestSprite.color)}`;
        
        // Update Fav Button State
        if (currentSpriteContext.isFavorited) {
            spriteFavBtn.classList.add('active');
        } else {
            spriteFavBtn.classList.remove('active');
        }

        spriteModal.style.display = 'flex';
        // Add animation class
        const content = spriteModal.querySelector('.mood-sprite-content');
        content.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    }

    function handleSpriteClose() {
        if (!currentSpriteContext) {
            spriteModal.style.display = 'none';
            return;
        }

        const { chatId, msgId, spriteEl, isFavorited } = currentSpriteContext;

        if (!isFavorited) {
            // Not favorited -> Disappear logic
            if (spriteEl && spriteEl.parentNode) {
                // Fade out animation
                spriteEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                spriteEl.style.opacity = '0';
                spriteEl.style.transform = 'scale(0)';
                setTimeout(() => {
                    if (spriteEl.parentNode) {
                        spriteEl.parentNode.removeChild(spriteEl);
                    }
                }, 500);
            }

            // Update storage to mark as dismissed
            updateMessageExtra(chatId, msgId, (extra) => {
                if (extra.sprite) {
                    extra.sprite.isDismissed = true;
                }
                return extra;
            });
        }

        spriteModal.style.display = 'none';
        currentSpriteContext = null;
    }

    function toggleSpriteFavorite() {
        if (!currentSpriteContext) return;
        
        currentSpriteContext.isFavorited = !currentSpriteContext.isFavorited;
        
        // Update UI
        if (currentSpriteContext.isFavorited) {
            spriteFavBtn.classList.add('active');
        } else {
            spriteFavBtn.classList.remove('active');
        }

        // Update Storage
        updateMessageExtra(currentSpriteContext.chatId, currentSpriteContext.msgId, (extra) => {
            if (extra.sprite) {
                extra.sprite.isFavorited = currentSpriteContext.isFavorited;
                // If favorited, ensure it's not dismissed
                if (currentSpriteContext.isFavorited) {
                    delete extra.sprite.isDismissed;
                }
            }
            return extra;
        });
    }

    // Helper to safely update message extra data
    function updateMessageExtra(chatId, msgId, callback) {
        const history = largeStore.get('chat_history_' + chatId, []);
        const index = history.findIndex(m => m.id === msgId);
        if (index !== -1) {
            const msg = history[index];
            // Since saveMessage spreads extra properties into the root of the object,
            // we should pass the whole msg object to the callback, or normalize it.
            // But to fix the specific issue with 'sprite' property which is at root:
            
            // We construct a proxy object that represents the 'extra' data including root properties like 'sprite'
            let extraProxy = {
                sprite: msg.sprite,
                ...msg.extra
            };

            const updatedExtra = callback(extraProxy);
            
            // Apply changes back to msg
            if (updatedExtra.sprite) {
                msg.sprite = updatedExtra.sprite;
            }
            // If there are other extra properties, we might need to handle them, 
            // but currently we only care about sprite.
            
            history[index] = msg;
            largeStore.put('chat_history_' + chatId, history);
            if (index === history.length - 1) {
                localStorage.setItem('chat_last_message_' + chatId, JSON.stringify({ message: msg, ts: msg.ts }));
            }
        }
    }

    spriteCloseBtn.addEventListener('click', handleSpriteClose);
    spriteFavBtn.addEventListener('click', toggleSpriteFavorite);

    spriteModal.addEventListener('click', (e) => {
        if (e.target === spriteModal) {
            handleSpriteClose();
        }
    });

    initChatSettingsLogic(chatRoomName);
    initChatAdvancedSettingsLogic(chatRoomName);
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
    const lineMoreCotBtn = document.getElementById('line-more-cot-btn');
    const lineUserCotBackBtn = document.getElementById('line-user-cot-back-btn');
    const lineUserCotSaveBtn = document.getElementById('line-user-cot-save-btn');
    const lineUserCotTextarea = document.getElementById('line-user-cot-textarea');
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

    if (lineMoreCotBtn) {
        lineMoreCotBtn.addEventListener('click', () => {
            if (lineUserCotTextarea) {
                lineUserCotTextarea.value = localStorage.getItem('line_user_cot_content') || '';
            }
            switchLinePage('line-user-cot-page', false);
        });
    }
    if (lineUserCotBackBtn) {
        lineUserCotBackBtn.addEventListener('click', () => {
            switchLinePage('line-more-page', false);
        });
    }
    if (lineUserCotSaveBtn) {
        lineUserCotSaveBtn.addEventListener('click', () => {
            if (lineUserCotTextarea) {
                localStorage.setItem('line_user_cot_content', lineUserCotTextarea.value);
                alert('思维cot保存成功');
            }
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
