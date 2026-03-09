document.addEventListener('DOMContentLoaded', () => {
    initHeroChatWidget();
    initStandWidget();
    initApiErrorModal();
    initSettings();
    initLineApp();
    initStickerApp();
    initAppearanceSettings();
    initTopProfileWidget();
});

function initTopProfileWidget() {
    const avatarContainer = document.querySelector('.top-avatar-large');
    const avatarInput = document.getElementById('top-avatar-input');
    const nameText = document.getElementById('profile-name-text');
    const handleText = document.getElementById('profile-handle-text');
    const statusText = document.getElementById('top-status-text');
    const smallAvatarText = document.getElementById('top-avatar-small-text');

    if (!avatarContainer || !avatarInput || !nameText || !handleText || !statusText || !smallAvatarText) return;

    // --- Avatar Logic ---
    const savedAvatar = localStorage.getItem('top_profile_avatar');
    if (savedAvatar) {
        avatarContainer.innerHTML = `<img src="${savedAvatar}" alt="Profile Avatar">`;
    }

    avatarContainer.addEventListener('click', () => {
        avatarInput.click();
    });

    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target.result;
            if (result) {
                localStorage.setItem('top_profile_avatar', result);
                avatarContainer.innerHTML = `<img src="${result}" alt="Profile Avatar">`;
            }
        };
        reader.readAsDataURL(file);
        avatarInput.value = ''; // Reset input
    });

    // --- Text Editing Logic ---
    const savedName = localStorage.getItem('top_profile_name');
    const savedHandle = localStorage.getItem('top_profile_handle');
    const savedStatus = localStorage.getItem('top_profile_status');
    const savedSmallAvatarText = localStorage.getItem('top_profile_small_avatar_text');

    if (savedName) nameText.textContent = savedName;
    if (savedHandle) handleText.textContent = savedHandle;
    if (savedStatus) statusText.textContent = savedStatus;
    if (savedSmallAvatarText) smallAvatarText.textContent = savedSmallAvatarText;

    const saveText = (key, element, fallbackText) => {
        const text = element.textContent.trim();
        const finalText = text || fallbackText;
        element.textContent = finalText;
        localStorage.setItem(key, finalText);
    };

    // Save on blur (when focus leaves the text)
    nameText.addEventListener('blur', () => saveText('top_profile_name', nameText, 'User Name'));
    handleText.addEventListener('blur', () => saveText('top_profile_handle', handleText, '@user'));
    statusText.addEventListener('blur', () => saveText('top_profile_status', statusText, 'Status: Online'));
    smallAvatarText.addEventListener('blur', () => saveText('top_profile_small_avatar_text', smallAvatarText, '12:00'));

    // Prevent new lines (Enter key)
    [nameText, handleText, statusText, smallAvatarText].forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });
}

function openAppModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeAppModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => {
        if (!modal.classList.contains('active')) {
            modal.style.display = 'none';
        }
    }, 300);
}

function showApiErrorModal(message) {
    const overlay = document.getElementById('api-error-modal');
    const messageEl = document.getElementById('api-error-message');
    if (!overlay || !messageEl) {
        alert(message || 'API 报错');
        return;
    }
    messageEl.textContent = String(message || 'API 报错');
    overlay.style.display = 'flex';
}

function hideApiErrorModal() {
    const overlay = document.getElementById('api-error-modal');
    if (!overlay) return;
    overlay.style.display = 'none';
}

function initApiErrorModal() {
    const overlay = document.getElementById('api-error-modal');
    const closeBtn = document.getElementById('close-api-error-modal');
    const confirmBtn = document.getElementById('confirm-api-error-modal');
    if (!overlay || overlay.dataset.bound === 'true') return;

    if (closeBtn) {
        closeBtn.addEventListener('click', hideApiErrorModal);
    }
    if (confirmBtn) {
        confirmBtn.addEventListener('click', hideApiErrorModal);
    }
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideApiErrorModal();
        }
    });
    overlay.dataset.bound = 'true';
}

function initHeroChatWidget() {
    const avatarLeftBtn = document.getElementById('hero-avatar-left-btn');
    const avatarRightBtn = document.getElementById('hero-avatar-right-btn');
    const avatarLeft = document.getElementById('hero-avatar-left');
    const avatarRight = document.getElementById('hero-avatar-right');
    const bubbleLeft = document.getElementById('hero-bubble-left');
    const bubbleRight = document.getElementById('hero-bubble-right');
    const fileInput = document.getElementById('hero-avatar-file-input');

    const avatarSourceModal = document.getElementById('avatar-source-modal');
    const closeAvatarSourceModalBtn = document.getElementById('close-avatar-source-modal');
    const chooseAvatarLocalBtn = document.getElementById('choose-avatar-local-btn');
    const chooseAvatarUrlBtn = document.getElementById('choose-avatar-url-btn');

    const avatarUrlModal = document.getElementById('avatar-url-modal');
    const closeAvatarUrlModalBtn = document.getElementById('close-avatar-url-modal');
    const avatarUrlInput = document.getElementById('avatar-url-input');
    const saveAvatarUrlBtn = document.getElementById('save-avatar-url-btn');

    const bubbleTextModal = document.getElementById('bubble-text-modal');
    const closeBubbleTextModalBtn = document.getElementById('close-bubble-text-modal');
    const bubbleTextInput = document.getElementById('bubble-text-input');
    const saveBubbleTextBtn = document.getElementById('save-bubble-text-btn');

    if (!avatarLeftBtn || !avatarRightBtn || !avatarLeft || !avatarRight || !bubbleLeft || !bubbleRight || !fileInput) {
        return;
    }

    const getAvatarKey = (slot) => `hero_widget_avatar_${slot}`;
    const getBubbleKey = (slot) => `hero_widget_bubble_${slot}`;
    const defaultBubbleText = '点我编辑文字';
    const defaultAvatarSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>';
    let activeAvatarSlot = 'left';
    let activeBubbleSlot = 'left';

    const hideModal = (el) => {
        if (!el) return;
        el.style.display = 'none';
    };

    const showModal = (el) => {
        if (!el) return;
        el.style.display = 'flex';
    };

    const renderAvatar = (slot) => {
        const target = slot === 'left' ? avatarLeft : avatarRight;
        const value = localStorage.getItem(getAvatarKey(slot)) || '';
        if (value) {
            target.style.backgroundImage = `url("${value.replace(/"/g, '\\"')}")`;
            target.innerHTML = '';
        } else {
            target.style.backgroundImage = 'none';
            target.innerHTML = defaultAvatarSvg;
        }
    };

    const renderBubble = (slot) => {
        const target = slot === 'left' ? bubbleLeft : bubbleRight;
        const value = localStorage.getItem(getBubbleKey(slot)) || defaultBubbleText;
        target.textContent = value;
    };

    const renderAll = () => {
        renderAvatar('left');
        renderAvatar('right');
        renderBubble('left');
        renderBubble('right');
    };

    const bindAvatarClick = (slot, btn) => {
        btn.addEventListener('click', () => {
            activeAvatarSlot = slot;
            showModal(avatarSourceModal);
        });
    };

    const bindBubbleClick = (slot, bubbleEl) => {
        bubbleEl.addEventListener('click', () => {
            activeBubbleSlot = slot;
            bubbleTextInput.value = localStorage.getItem(getBubbleKey(slot)) || '';
            showModal(bubbleTextModal);
            setTimeout(() => bubbleTextInput.focus(), 0);
        });
    };

    bindAvatarClick('left', avatarLeftBtn);
    bindAvatarClick('right', avatarRightBtn);
    bindBubbleClick('left', bubbleLeft);
    bindBubbleClick('right', bubbleRight);

    if (closeAvatarSourceModalBtn) {
        closeAvatarSourceModalBtn.addEventListener('click', () => hideModal(avatarSourceModal));
    }
    if (closeAvatarUrlModalBtn) {
        closeAvatarUrlModalBtn.addEventListener('click', () => hideModal(avatarUrlModal));
    }
    if (closeBubbleTextModalBtn) {
        closeBubbleTextModalBtn.addEventListener('click', () => hideModal(bubbleTextModal));
    }

    if (chooseAvatarLocalBtn) {
        chooseAvatarLocalBtn.addEventListener('click', () => {
            hideModal(avatarSourceModal);
            fileInput.click();
        });
    }

    if (chooseAvatarUrlBtn) {
        chooseAvatarUrlBtn.addEventListener('click', () => {
            hideModal(avatarSourceModal);
            avatarUrlInput.value = localStorage.getItem(getAvatarKey(activeAvatarSlot)) || '';
            showModal(avatarUrlModal);
            setTimeout(() => avatarUrlInput.focus(), 0);
        });
    }

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = typeof event.target?.result === 'string' ? event.target.result : '';
            if (!result) return;
            localStorage.setItem(getAvatarKey(activeAvatarSlot), result);
            renderAvatar(activeAvatarSlot);
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
    });

    if (saveAvatarUrlBtn) {
        saveAvatarUrlBtn.addEventListener('click', () => {
            const url = avatarUrlInput.value.trim();
            if (!/^https?:\/\//i.test(url)) {
                showApiErrorModal('请输入有效图片 URL');
                return;
            }
            localStorage.setItem(getAvatarKey(activeAvatarSlot), url);
            renderAvatar(activeAvatarSlot);
            hideModal(avatarUrlModal);
        });
    }

    if (saveBubbleTextBtn) {
        saveBubbleTextBtn.addEventListener('click', () => {
            const text = bubbleTextInput.value.trim() || defaultBubbleText;
            localStorage.setItem(getBubbleKey(activeBubbleSlot), text);
            renderBubble(activeBubbleSlot);
            hideModal(bubbleTextModal);
        });
    }

    [avatarSourceModal, avatarUrlModal, bubbleTextModal].forEach((modalEl) => {
        if (!modalEl) return;
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                hideModal(modalEl);
            }
        });
    });

    renderAll();
}

function initStandWidget() {
    const standContainer = document.getElementById('stand-container');
    const standFigure = document.getElementById('stand-figure');
    const fileInput = document.getElementById('stand-file-input');
    const defaultStandImage = 'https://dummyimage.com/720x1080/f7cad8/ffffff.png&text=%E7%AB%8B%E7%89%8C%E5%8D%A0%E4%BD%8D';
    // 获取底座元素 (假设在 HTML 中它是 .stand-base)
    // 根据 index.html 结构: <div class="stand-base"></div>
    const standBase = standContainer ? standContainer.querySelector('.stand-base') : null;

    if (!standContainer || !standFigure || !fileInput) return;

    const renderStand = () => {
        const value = localStorage.getItem('hero_stand_image') || defaultStandImage;
        const placeholder = standFigure.querySelector('.stand-placeholder');
        if (value) {
            standFigure.style.backgroundImage = `url("${value.replace(/"/g, '\\"')}")`;
            if (placeholder) placeholder.style.display = 'none';
        } else {
            standFigure.style.backgroundImage = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        }
    };

    // 修改：点击底座上传图片
    if (standBase) {
        standBase.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止冒泡触发其他可能的点击
            fileInput.click();
        });
        standBase.style.cursor = 'pointer'; // 确保底座有点击手势
    }

    // 修改：点击立牌本体旋转
    standFigure.addEventListener('click', () => {
        // 如果正在显示 placeholder（即未上传图片），则仍然触发上传
        const placeholder = standFigure.querySelector('.stand-placeholder');
        if (placeholder && placeholder.style.display !== 'none') {
            fileInput.click();
            return;
        }

        // 移除动画类以便重新触发
        standFigure.classList.remove('spin-animation');
        // 强制重绘
        void standFigure.offsetWidth;
        // 添加动画类
        standFigure.classList.add('spin-animation');
    });

    // 如果之前绑定了 container 的点击，需要移除或确保不冲突。
    // 原代码是 standContainer.addEventListener('click', ...)
    // 我们现在不再绑定 standContainer 的整体点击，而是分拆。

    // 为了兼容，如果用户点击了 placeholder (上传立牌提示)，也应该触发上传
    const placeholder = standFigure.querySelector('.stand-placeholder');
    if (placeholder) {
        // 由于 standFigure 已经绑定了点击，这里不需要重复绑定，
        // 逻辑已经在 standFigure 的 click handler 中处理了。
        // 但为了保险起见，保持 placeholder 自身的明确行为也是好的，
        // 不过由于 bubble event，standFigure 的 handler 也会收到。
        // 我们在 standFigure handler 里已经判断了 placeholder 的显隐。
        // 所以这里其实可以移除，或者为了明确指引，保留但注意冒泡。
        // 实际上，如果 placeholder 在 standFigure 内部，点击 placeholder 会冒泡到 standFigure。
        // 所以 standFigure 的 handler 会被触发。
    }

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target.result;
            if (result) {
                localStorage.setItem('hero_stand_image', result);
                renderStand();
            }
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
    });

    renderStand();
}

// 3. 设置页面功能
function initSettings() {
    const dockSettings = document.getElementById('dock-settings');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-settings');
    const saveBtn = document.getElementById('save-settings');
    const fetchBtn = document.getElementById('fetch-models');
    
    // 输入框元素
    const apiUrlInput = document.getElementById('api-url');
    const apiKeyInput = document.getElementById('api-key');
    const modelNameInput = document.getElementById('model-name');
    const modelSelectTrigger = document.getElementById('model-select-trigger');
    const modelDropdownArrow = document.getElementById('model-dropdown-arrow');
    const modelListContainer = document.getElementById('model-list-container');
    const modelList = document.getElementById('model-list');
    
    // 新增设置项
    const streamToggle = document.getElementById('stream-toggle');
    const tempSlider = document.getElementById('temperature-slider');
    const tempValue = document.getElementById('temp-value');

    // --- API 预设功能开始 ---
    const apiPresetSelect = document.getElementById('api-preset-select');
    const saveApiPresetBtn = document.getElementById('save-api-preset-btn');
    const manageApiPresetBtn = document.getElementById('manage-api-preset-btn');
    const apiPresetModal = document.getElementById('api-preset-manager-modal');
    const closeApiPresetManagerBtn = document.getElementById('close-api-preset-manager');
    const apiPresetList = document.getElementById('api-preset-list');

    // 加载 API 预设
    function loadApiPresets() {
        const presets = JSON.parse(localStorage.getItem('api_presets') || '[]');
        // 保留第一项 "选择预设..."
        apiPresetSelect.innerHTML = '<option value="">选择预设...</option>';
        presets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = preset.name;
            apiPresetSelect.appendChild(option);
        });
    }

    // 保存 API 预设
    if (saveApiPresetBtn) {
        saveApiPresetBtn.addEventListener('click', () => {
            const name = prompt('请输入预设名称:');
            if (!name) return;
            
            const presets = JSON.parse(localStorage.getItem('api_presets') || '[]');
            const existingIndex = presets.findIndex(p => p.name === name);
            
            const newPreset = {
                name: name,
                url: apiUrlInput.value,
                key: apiKeyInput.value,
                model: modelNameInput.value
            };

            if (existingIndex >= 0) {
                if (!confirm(`预设 "${name}" 已存在，是否覆盖？`)) return;
                presets[existingIndex] = newPreset;
            } else {
                presets.push(newPreset);
            }
            
            localStorage.setItem('api_presets', JSON.stringify(presets));
            loadApiPresets();
            // 选中刚保存的预设
            const newIndex = presets.findIndex(p => p.name === name);
            if (newIndex >= 0) apiPresetSelect.value = newIndex;
            
            alert('预设已保存');
        });
    }

    // 应用 API 预设
    if (apiPresetSelect) {
        apiPresetSelect.addEventListener('change', () => {
            const index = apiPresetSelect.value;
            if (index === '') return;
            
            const presets = JSON.parse(localStorage.getItem('api_presets') || '[]');
            const preset = presets[index];
            if (preset) {
                if (preset.url) apiUrlInput.value = preset.url;
                if (preset.key) apiKeyInput.value = preset.key;
                if (preset.model) modelNameInput.value = preset.model;
            }
        });
    }

    // 管理 API 预设 (打开模态框)
    if (manageApiPresetBtn) {
        manageApiPresetBtn.addEventListener('click', () => {
            renderApiPresetList();
            if (apiPresetModal) {
                apiPresetModal.style.display = 'block';
                // 强制重绘以触发 transition
                apiPresetModal.offsetHeight; 
                apiPresetModal.classList.add('active');
            }
        });
    }

    // 关闭管理模态框
    if (closeApiPresetManagerBtn) {
        closeApiPresetManagerBtn.addEventListener('click', () => {
            if (apiPresetModal) {
                apiPresetModal.classList.remove('active');
                setTimeout(() => {
                    apiPresetModal.style.display = 'none';
                }, 300); // 假设 transition 是 0.3s
                loadApiPresets();
            }
        });
    }

    // 渲染预设列表
    function renderApiPresetList() {
        const presets = JSON.parse(localStorage.getItem('api_presets') || '[]');
        if (!apiPresetList) return;
        
        apiPresetList.innerHTML = '';
        
        if (presets.length === 0) {
            apiPresetList.innerHTML = '<div style="text-align: center; color: #86868b; padding: 20px;">暂无预设</div>';
            return;
        }

        presets.forEach((preset, index) => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f5f5f7; border-radius: 12px; margin-bottom: 8px;';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = preset.name;
            nameSpan.style.fontWeight = '500';
            nameSpan.style.color = '#1d1d1f';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.className = 'candy-btn-small';
            deleteBtn.style.cssText = 'background-color: #ff3b30; color: white; padding: 4px 12px; font-size: 12px; border: none; border-radius: 14px; cursor: pointer;';
            
            deleteBtn.addEventListener('click', () => {
                if (confirm(`确定要删除预设 "${preset.name}" 吗？`)) {
                    presets.splice(index, 1);
                    localStorage.setItem('api_presets', JSON.stringify(presets));
                    renderApiPresetList();
                }
            });

            item.appendChild(nameSpan);
            item.appendChild(deleteBtn);
            apiPresetList.appendChild(item);
        });
    }

    // 初始化加载
    loadApiPresets();
    // --- API 预设功能结束 ---

    // 从 localStorage 加载设置
    function loadSettings() {
        apiUrlInput.value = localStorage.getItem('api_url') || '';
        apiKeyInput.value = localStorage.getItem('api_key') || '';
        modelNameInput.value = localStorage.getItem('model_name') || '';
        streamToggle.checked = localStorage.getItem('stream_enabled') === 'true';
        
        const savedTemp = localStorage.getItem('temperature') || '0.7';
        tempSlider.value = savedTemp;
        tempValue.textContent = savedTemp;
    }

    // 温度滑块实时显示
    tempSlider.addEventListener('input', () => {
        tempValue.textContent = tempSlider.value;
    });

    const toggleModelList = (forceOpen) => {
        if (!modelList || modelList.children.length === 0) return;
        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : modelListContainer.style.display === 'none';
        modelListContainer.style.display = shouldOpen ? 'block' : 'none';
        if (modelSelectTrigger) {
            modelSelectTrigger.classList.toggle('open', shouldOpen);
        }
    };

    if (modelNameInput) {
        modelNameInput.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleModelList();
        });
    }

    if (modelDropdownArrow) {
        modelDropdownArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleModelList();
        });
    }

    document.addEventListener('click', (e) => {
        if (!modelListContainer || !modelSelectTrigger) return;
        if (!modelListContainer.contains(e.target) && !modelSelectTrigger.contains(e.target)) {
            modelListContainer.style.display = 'none';
            modelSelectTrigger.classList.remove('open');
        }
    });

    // 打开设置
    dockSettings.addEventListener('click', () => {
        loadSettings();
        modelListContainer.style.display = 'none';
        if (modelSelectTrigger) modelSelectTrigger.classList.remove('open');
        modal.classList.add('active');
    });

    // 关闭设置
    closeBtn.addEventListener('click', () => {
        modelListContainer.style.display = 'none';
        if (modelSelectTrigger) modelSelectTrigger.classList.remove('open');
        modal.classList.remove('active');
    });

    // 保存设置
    saveBtn.addEventListener('click', () => {
        localStorage.setItem('api_url', apiUrlInput.value);
        localStorage.setItem('api_key', apiKeyInput.value);
        localStorage.setItem('model_name', modelNameInput.value);
        localStorage.setItem('stream_enabled', streamToggle.checked);
        localStorage.setItem('temperature', tempSlider.value);
        modelListContainer.style.display = 'none';
        if (modelSelectTrigger) modelSelectTrigger.classList.remove('open');
        
        // 保存成功提示动画
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '已存';
        saveBtn.style.backgroundColor = '#333';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '#000000';
            modal.classList.remove('active');
        }, 800);
    });

    // 拉取模型功能
    fetchBtn.addEventListener('click', async () => {
        const apiUrl = apiUrlInput.value.replace(/\/$/, ''); // 去除末尾斜杠
        const apiKey = apiKeyInput.value;

        if (!apiUrl || !apiKey) {
            showApiErrorModal('请先填写 API 地址和 Key');
            return;
        }

        fetchBtn.textContent = '...';
        
        try {
            // 尝试标准的 OpenAI 格式 /models 接口
            const response = await fetch(`${apiUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `模型拉取失败（${response.status}）`);
            }

            const data = await response.json();
            const models = data.data || []; // 假设返回结构为 { data: [{id: '...'}, ...] }

            // 清空并填充列表
            modelList.innerHTML = '';
            models.forEach(model => {
                const div = document.createElement('div');
                div.className = 'model-item';
                div.textContent = model.id;
                div.onclick = () => {
                    modelNameInput.value = model.id;
                    modelListContainer.style.display = 'none';
                    if (modelSelectTrigger) modelSelectTrigger.classList.remove('open');
                };
                modelList.appendChild(div);
            });

            if (models.length > 0) {
                modelListContainer.style.display = 'block';
                if (modelSelectTrigger) modelSelectTrigger.classList.add('open');
            } else {
                throw new Error('未找到可用模型');
            }

        } catch (error) {
            console.error(error);
            showApiErrorModal(error.message || '拉取失败，请检查配置');
        } finally {
            fetchBtn.textContent = '拉取';
        }
    });
}

// 4. LINE App 功能
function initLineApp() {
    const appLine = document.getElementById('app-line');
    const lineModal = document.getElementById('line-modal');
    const lineUserRow = document.getElementById('line-user-row');
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
    const friendProfileModal = document.getElementById('friend-profile-modal');
    const friendProfileAvatar = document.getElementById('friend-profile-avatar');
    const friendProfileName = document.getElementById('friend-profile-name');
    const friendProfileSignature = document.getElementById('friend-profile-signature');
    const friendProfileFeedBtn = document.getElementById('friend-profile-feed-btn');
    const friendProfileInfoBtn = document.getElementById('friend-profile-info-btn');
    const friendProfileDeleteBtn = document.getElementById('friend-profile-delete-btn');
    const friendDeleteConfirmModal = document.getElementById('friend-delete-confirm-modal');
    const friendDeleteConfirmText = document.getElementById('friend-delete-confirm-text');
    const closeFriendDeleteConfirmBtn = document.getElementById('close-friend-delete-confirm');
    const cancelFriendDeleteConfirmBtn = document.getElementById('cancel-friend-delete-confirm');
    const confirmFriendDeleteConfirmBtn = document.getElementById('confirm-friend-delete-confirm');
    const lineUserStorageKey = 'line_home_users';
    const lineSelectedUserStorageKey = 'line_home_selected_user_id';
    let lineUserDraft = [];
    let lineSelectedUserId = '';
    let activeFriendRealName = '';

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

    const getFriendSignature = (realName) => {
        const signature = localStorage.getItem('chat_signature_' + realName)
            || localStorage.getItem('chat_persona_' + realName)
            || localStorage.getItem('chat_user_persona_' + realName)
            || '';
        const normalized = String(signature || '').replace(/\s+/g, ' ').trim();
        return normalized || '这个人很神秘，还没有签名';
    };

    const closeFriendProfileModal = () => {
        if (!friendProfileModal) return;
        friendProfileModal.style.display = 'none';
        activeFriendRealName = '';
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

    const removeNameFromStorageList = (storageKey, realName) => {
        const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!Array.isArray(raw)) return;
        const normalized = String(realName || '').trim();
        if (!normalized) return;
        const next = raw.filter((name) => String(name || '').trim() !== normalized);
        if (JSON.stringify(raw) !== JSON.stringify(next)) {
            localStorage.setItem(storageKey, JSON.stringify(next));
        }
    };

    const removeFriendData = (realName) => {
        const normalized = String(realName || '').trim();
        if (!normalized) return;
        const selector = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(normalized) : normalized;
        const friendItem = document.querySelector(`#friends-list .group-subitem[data-real-name="${selector}"]`);
        if (friendItem && friendItem.parentNode) {
            friendItem.parentNode.removeChild(friendItem);
        }
        const chatItem = document.querySelector(`#line-chat-list .chat-list-item[data-real-name="${selector}"]`);
        if (chatItem && chatItem.parentNode) {
            chatItem.parentNode.removeChild(chatItem);
        }
        removeNameFromStorageList('global_friends_list', normalized);
        removeNameFromStorageList('global_chat_list', normalized);
        localStorage.removeItem('chat_history_' + normalized);
        localStorage.removeItem('chat_remark_' + normalized);
        localStorage.removeItem('chat_persona_' + normalized);
        localStorage.removeItem('chat_avatar_' + normalized);
        localStorage.removeItem('chat_signature_' + normalized);
        localStorage.removeItem('chat_user_realname_' + normalized);
        localStorage.removeItem('chat_user_remark_' + normalized);
        localStorage.removeItem('chat_user_persona_' + normalized);
        localStorage.removeItem('chat_user_avatar_' + normalized);
        localStorage.removeItem('chat_worldbooks_' + normalized);
        localStorage.removeItem('chat_context_limit_' + normalized);
        localStorage.removeItem('chat_long_term_memory_' + normalized);
        localStorage.removeItem(getMemoryDiaryKey(normalized));
        localStorage.removeItem(getSummaryLimitKey(normalized));
        localStorage.removeItem(getAutoSummaryEnabledKey(normalized));
        localStorage.removeItem(getTimeSyncEnabledKey(normalized));
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
            const currentRealName = chatRoomName.dataset.realName || chatRoomName.textContent;
            if (currentRealName === normalized) {
                chatRoom.style.display = 'none';
                chatRoomName.textContent = '';
                chatRoomName.dataset.realName = '';
                const chatContent = document.querySelector('.chat-room-content');
                if (chatContent) {
                    chatContent.innerHTML = '';
                }
            }
        }
    };

    const ensureChatItem = (realName, displayName) => {
        const chatListContainer = document.getElementById('line-chat-list');
        if (!chatListContainer) return null;
        const selectorName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(realName) : realName;
        let chatItem = chatListContainer.querySelector(`.chat-list-item[data-real-name="${selectorName}"]`);
        if (chatItem) return chatItem;

        const avatar = localStorage.getItem('chat_avatar_' + realName);
        const avatarHtml = avatar
            ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            : defaultFriendAvatarHtml;

        chatItem = document.createElement('div');
        chatItem.className = 'chat-list-item';
        chatItem.dataset.realName = realName;
        chatItem.innerHTML = `
            <div class="chat-item-avatar">
                ${avatarHtml}
            </div>
            <div class="chat-item-info">
                <div class="chat-item-name">${displayName}</div>
                <div class="chat-item-msg">点击开始聊天</div>
            </div>
            <div class="chat-item-unread hidden"></div>
        `;
        chatListContainer.insertBefore(chatItem, chatListContainer.firstChild);
        updateChatListItemPreview(realName, chatItem);
        sortChatListByLastMessage();
        if (typeof saveGlobalData === 'function') {
            saveGlobalData();
        }
        return chatItem;
    };

    const openFriendChat = (realName) => {
        const friendItem = document.querySelector(`#friends-list .group-subitem[data-real-name="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(realName) : realName}"]`);
        const displayName = friendItem?.querySelector('span')?.textContent?.trim()
            || localStorage.getItem('chat_remark_' + realName)
            || realName;
        const chatItem = ensureChatItem(realName, displayName);
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
        const realName = String(item.dataset.realName || '').trim() || String(item.querySelector('span')?.textContent || '').trim();
        if (!realName) return;
        const displayName = String(item.querySelector('span')?.textContent || realName).trim();
        const avatarEl = item.querySelector('.subitem-avatar');

        activeFriendRealName = realName;
        friendProfileName.textContent = displayName;
        friendProfileAvatar.innerHTML = avatarEl ? avatarEl.innerHTML : defaultFriendAvatarHtml;
        friendProfileSignature.textContent = getFriendSignature(realName);
        friendProfileModal.style.display = 'flex';
    };
    
    // 打开 LINE
    if (appLine) {
        appLine.addEventListener('click', () => {
            lineModal.classList.add('active');
        });
    }

    // 点击底部导航栏切换
    const navItems = document.querySelectorAll('.line-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // 切换激活状态
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // 切换页面显示
            const targetPageId = item.getAttribute('data-page');
            if (targetPageId) {
                // 隐藏所有页面
                document.querySelectorAll('.line-page').forEach(page => {
                    page.style.display = 'none';
                });
                
                // 显示目标页面
                const targetPage = document.getElementById(targetPageId);
                if (targetPage) {
                    targetPage.style.display = 'flex'; // 使用 flex 以保持布局
                }
                
                // 隐藏主 Header (Home页独有的Header，其实Home页内容都包裹在line-home-page里了，所以不需要额外隐藏外部元素)
                // 如果有公用的Header需要处理，可以在这里处理
                
                // 特殊处理：Chat页面的Header是做在Chat Page内部的，所以直接切换Page即可
                // Home页面的Header也是在line-home-page内部吗？
                // 检查HTML结构，Home页面的顶部栏 class="line-header" 原本是在 line-app-container 下直接子元素
                // 应该把它移入 line-home-page 或者根据页面切换显隐
                
                const commonHeader = document.querySelector('.line-header');
                if (commonHeader) {
                    if (targetPageId === 'line-home-page') {
                        commonHeader.style.display = 'flex';
                    } else {
                        commonHeader.style.display = 'none';
                    }
                }
            }
        });
    });

    // 为 LINE 的设置按钮添加关闭功能（模拟返回）
    // 假设 LINE 顶部的设置按钮或者其他方式退出，这里暂时用点击“设置”图标关闭演示
    // 或者我们可以在 LINE 内部添加一个返回按钮，或者点击底部导航的 Home 多次？
    // 用户没说怎么退出，通常手机APP是底部上滑退出。
    // 为了方便测试，让点击顶部设置图标关闭
    const lineSettingsBtn = document.querySelector('.line-header-icons .line-icon-btn:last-child');
    if (lineSettingsBtn) {
        lineSettingsBtn.addEventListener('click', () => {
            // 只是演示退出
             lineModal.classList.remove('active');
        });
    }

    // 分组展开/折叠逻辑
    const groupItems = document.querySelectorAll('.line-group-item');
    groupItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            
            // 切换箭头状态
            item.classList.toggle('active');
            
            // 切换内容显示
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
            closeFriendProfileModal();
        });
    }

    if (friendProfileInfoBtn) {
        friendProfileInfoBtn.addEventListener('click', () => {
            if (!activeFriendRealName) return;
            const targetRealName = activeFriendRealName;
            closeFriendProfileModal();
            openFriendChat(targetRealName);
        });
    }

    if (friendProfileDeleteBtn) {
        friendProfileDeleteBtn.addEventListener('click', () => {
            if (!activeFriendRealName) return;
            const targetRealName = activeFriendRealName;
            const displayName = friendProfileName ? friendProfileName.textContent.trim() : targetRealName;
            openFriendDeleteConfirmModal(displayName || targetRealName);
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
            if (!activeFriendRealName) return;
            const targetRealName = activeFriendRealName;
            removeFriendData(targetRealName);
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

function initStickerApp() {
    const stickerBtn = document.getElementById('sticker-icon-btn');
    const modal = document.getElementById('sticker-modal');
    const closeBtn = document.getElementById('close-sticker');
    const saveBtn = document.getElementById('save-sticker');
    const openAddBtn = document.getElementById('open-add-sticker-modal');
    const importBtn = document.getElementById('import-sticker-btn');
    const importInput = document.getElementById('sticker-import-input');
    const importModal = document.getElementById('sticker-import-modal');
    const importModalClose = document.getElementById('close-sticker-import-modal');
    const importModalSave = document.getElementById('confirm-sticker-import-btn');
    const importCategoryInput = document.getElementById('sticker-import-category-input');
    const overlay = document.getElementById('add-sticker-overlay');
    const cancelAddBtn = document.getElementById('cancel-add-sticker');
    const confirmAddBtn = document.getElementById('confirm-add-sticker');
    const categoryNameInput = document.getElementById('sticker-category-name');
    const emojiInput = document.getElementById('sticker-emoji-input');
    const categoryGrid = document.getElementById('sticker-category-grid');
    const detailView = document.getElementById('sticker-detail-view');
    const detailBackBtn = document.getElementById('sticker-detail-back');
    const detailTitle = document.getElementById('sticker-detail-title');
    const emojiGrid = document.getElementById('sticker-emoji-grid');
    const targetOverlay = document.getElementById('sticker-target-overlay');
    const cancelTargetBtn = document.getElementById('cancel-sticker-target');
    const saveTargetBtn = document.getElementById('save-sticker-target');
    const targetList = document.getElementById('sticker-target-list');

    const storageKey = 'sticker_categories_v1';
    const targetStorageKey = 'sticker_category_targets_v1';
    let activeTargetCategoryId = null;
    const getCategories = () => JSON.parse(localStorage.getItem(storageKey) || '[]');
    const setCategories = (categories) => localStorage.setItem(storageKey, JSON.stringify(categories));
    const getTargetMap = () => JSON.parse(localStorage.getItem(targetStorageKey) || '{}');
    const setTargetMap = (map) => localStorage.setItem(targetStorageKey, JSON.stringify(map));

    const openStickerModal = () => {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        renderCategoryFolders();
        showCategoryList();
    };

    const closeStickerModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    };

    const openAddModal = () => {
        categoryNameInput.value = '';
        emojiInput.value = '';
        overlay.style.display = 'flex';
    };

    const closeAddModal = () => {
        overlay.style.display = 'none';
    };

    const getChatTargets = () => {
        const friends = JSON.parse(localStorage.getItem('global_friends_list') || '[]');
        const chats = JSON.parse(localStorage.getItem('global_chat_list') || '[]');
        const merged = ['我', ...friends, ...chats];
        const unique = [];
        const seen = new Set();

        merged.forEach((name) => {
            const trimmed = String(name || '').trim();
            if (!trimmed || seen.has(trimmed)) return;
            seen.add(trimmed);
            unique.push(trimmed);
        });

        return unique;
    };

    const openTargetModal = (categoryId) => {
        activeTargetCategoryId = categoryId;
        const targetMap = getTargetMap();
        const selectedTargets = new Set(targetMap[categoryId] || []);
        const allTargets = getChatTargets();

        targetList.innerHTML = allTargets.map((target) => `
            <label class="sticker-target-item">
                <span class="sticker-target-name">${target}</span>
                <input type="checkbox" class="sticker-target-checkbox" value="${target}" ${selectedTargets.has(target) ? 'checked' : ''}>
            </label>
        `).join('');

        targetOverlay.style.display = 'flex';
    };

    const closeTargetModal = () => {
        targetOverlay.style.display = 'none';
        activeTargetCategoryId = null;
    };

    const parseEmojiInput = (rawText) => {
        const parsed = [];
        const seen = new Set();
        const normalizeUrl = (value) => String(value || '').trim().replace(/[，。,.!?！？]+$/g, '');
        const pushEmoji = (name, url) => {
            const finalName = String(name || '').trim();
            const finalUrl = normalizeUrl(url);
            if (!finalName || !/^https?:\/\//i.test(finalUrl)) return;
            if (seen.has(finalUrl)) return;
            seen.add(finalUrl);
            parsed.push({
                id: crypto.randomUUID(),
                name: finalName,
                url: finalUrl
            });
        };

        const pairRegex = /([^：:,\n\r，]+?)\s*[：:]\s*`?(https?:\/\/[^\s`，,\n\r]+)`?/g;
        let match;

        while ((match = pairRegex.exec(rawText)) !== null) {
            pushEmoji(match[1], match[2]);
        }

        const lines = String(rawText || '').split(/\r?\n/);
        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || /[:：]/.test(trimmed)) return;
            const spaceMatch = trimmed.match(/^(.+?)\s+(https?:\/\/\S+)$/);
            if (spaceMatch) {
                pushEmoji(spaceMatch[1], spaceMatch[2]);
            }
        });

        return parsed;
    };

    let pendingStickerImport = null;

    const showCategoryList = () => {
        detailView.style.display = 'none';
        categoryGrid.style.display = 'grid';
    };

    const showCategoryDetail = (categoryId) => {
        const categories = getCategories();
        const category = categories.find(item => item.id === categoryId);
        if (!category) return;

        detailTitle.textContent = category.name;
        categoryGrid.style.display = 'none';
        detailView.style.display = 'block';

        if (!category.emojis || category.emojis.length === 0) {
            emojiGrid.innerHTML = '<div class="sticker-empty">该分类暂无表情</div>';
            return;
        }

        emojiGrid.innerHTML = category.emojis.map((emoji) => `
            <div class="sticker-emoji-card">
                <img src="${emoji.url}" alt="${emoji.name}" class="sticker-emoji-img">
                <div class="sticker-emoji-name">${emoji.name}</div>
            </div>
        `).join('');
    };

    const renderCategoryFolders = () => {
        const categories = getCategories();

        if (categories.length === 0) {
            categoryGrid.innerHTML = '<div class="sticker-empty">还没有分类，先点上面的 + 添加</div>';
            return;
        }

        categoryGrid.innerHTML = categories.map((category) => {
            const cover = category.emojis && category.emojis[0] ? `<img src="${category.emojis[0].url}" alt="${category.name}" class="sticker-folder-cover">` : '<div class="sticker-folder-cover sticker-folder-cover-empty">🙂</div>';
            return `
                <div class="sticker-folder-card" data-id="${category.id}">
                    <div class="sticker-folder-box">${cover}</div>
                    <div class="sticker-folder-footer">
                        <div class="sticker-folder-name">${category.name}</div>
                        <button class="sticker-folder-add-btn" type="button" data-id="${category.id}">添加</button>
                    </div>
                </div>
            `;
        }).join('');
    };

    if (stickerBtn && modal) {
        stickerBtn.addEventListener('click', openStickerModal);
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', closeStickerModal);
    }

    if (saveBtn && modal) {
        saveBtn.addEventListener('click', closeStickerModal);
    }

    if (openAddBtn) {
        openAddBtn.addEventListener('click', openAddModal);
    }

    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => {
            importInput.value = '';
            importInput.click();
        });
    }

    if (importInput) {
        importInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                const text = await parseStickerFile(file);
                const emojis = parseEmojiInput(text);
                if (emojis.length === 0) {
                    throw new Error('未解析到有效表情链接');
                }
                pendingStickerImport = emojis;
                if (importCategoryInput) {
                    importCategoryInput.value = '';
                }
                if (importModal) {
                    importModal.style.display = 'flex';
                    setTimeout(() => importModal.classList.add('active'), 10);
                }
                setTimeout(() => {
                    if (importCategoryInput) importCategoryInput.focus();
                }, 0);
            } catch (error) {
                showApiErrorModal(error.message || '导入失败');
            } finally {
                importInput.value = '';
            }
        });
    }

    const closeImportModal = () => {
        if (!importModal) return;
        importModal.classList.remove('active');
        setTimeout(() => {
            if (importModal) importModal.style.display = 'none';
        }, 300);
        pendingStickerImport = null;
    };

    if (importModalClose) {
        importModalClose.addEventListener('click', closeImportModal);
    }

    if (importModal) {
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) closeImportModal();
        });
    }

    if (importModalSave) {
        importModalSave.addEventListener('click', () => {
            if (!pendingStickerImport) return;
            const categoryName = importCategoryInput ? importCategoryInput.value.trim() : '';
            if (!categoryName) {
                showApiErrorModal('请填写分类名称');
                return;
            }

            const categories = getCategories();
            const existing = categories.find(item => item.name === categoryName);
            if (existing) {
                const existingUrls = new Set((existing.emojis || []).map(item => item.url));
                const newOnes = pendingStickerImport.filter(item => !existingUrls.has(item.url));
                existing.emojis = [...(existing.emojis || []), ...newOnes];
            } else {
                categories.unshift({
                    id: crypto.randomUUID(),
                    name: categoryName,
                    emojis: pendingStickerImport
                });
            }

            setCategories(categories);
            renderCategoryFolders();
            showCategoryList();
            closeImportModal();
        });
    }

    if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', closeAddModal);
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAddModal();
            }
        });
    }

    if (confirmAddBtn) {
        confirmAddBtn.addEventListener('click', () => {
            const categoryName = categoryNameInput.value.trim();
            const emojis = parseEmojiInput(emojiInput.value.trim());

            if (!categoryName) {
                alert('请填写分类名称');
                return;
            }

            if (emojis.length === 0) {
                alert('请按示例格式粘贴至少一个表情链接');
                return;
            }

            const categories = getCategories();
            const existing = categories.find(item => item.name === categoryName);

            if (existing) {
                const existingUrls = new Set((existing.emojis || []).map(item => item.url));
                const newOnes = emojis.filter(item => !existingUrls.has(item.url));
                existing.emojis = [...(existing.emojis || []), ...newOnes];
            } else {
                categories.unshift({
                    id: crypto.randomUUID(),
                    name: categoryName,
                    emojis
                });
            }

            setCategories(categories);
            renderCategoryFolders();
            closeAddModal();
        });
    }

    if (categoryGrid) {
        categoryGrid.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.sticker-folder-add-btn');
            if (addBtn) {
                const categoryId = addBtn.dataset.id;
                if (categoryId) {
                    openTargetModal(categoryId);
                }
                return;
            }

            const folder = e.target.closest('.sticker-folder-card');
            if (!folder) return;
            const categoryId = folder.dataset.id;
            if (categoryId) {
                showCategoryDetail(categoryId);
            }
        });
    }

    if (detailBackBtn) {
        detailBackBtn.addEventListener('click', showCategoryList);
    }

    if (cancelTargetBtn) {
        cancelTargetBtn.addEventListener('click', closeTargetModal);
    }

    if (targetOverlay) {
        targetOverlay.addEventListener('click', (e) => {
            if (e.target === targetOverlay) {
                closeTargetModal();
            }
        });
    }

    if (saveTargetBtn) {
        saveTargetBtn.addEventListener('click', () => {
            if (!activeTargetCategoryId) return;
            const checkedTargets = Array.from(document.querySelectorAll('.sticker-target-checkbox:checked')).map((input) => input.value);
            const targetMap = getTargetMap();
            targetMap[activeTargetCategoryId] = checkedTargets;
            setTargetMap(targetMap);
            closeTargetModal();
        });
    }

    async function parseStickerFile(file) {
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.docx')) {
            if (!window.mammoth || !window.mammoth.extractRawText) {
                throw new Error('未找到 docx 解析器');
            }
            const arrayBuffer = await readFileAsArrayBuffer(file);
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            return String(result.value || '').trim();
        }
        const text = await readFileAsText(file);
        return String(text || '').trim();
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
}

// 14. 角色卡导入功能 (JSON/PNG)
function initCharacterImportLogic() {
    const importBtn = document.getElementById('import-character-btn');
    const fileInput = document.getElementById('import-character-input');
    
    if (!importBtn || !fileInput) return;

    importBtn.addEventListener('click', () => {
        fileInput.value = ''; // Reset input
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            let characterData = null;
            let avatarSrc = null;

            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                // 处理 JSON
                const text = await readFileAsText(file);
                characterData = JSON.parse(text);
                // JSON 导入通常不带头像，或者有 avatar 字段但需要处理
            } else if (file.type === 'image/png' || file.name.endsWith('.png')) {
                // 处理 PNG (Tavern Card)
                avatarSrc = await readFileAsDataURL(file);
                const arrayBuffer = await readFileAsArrayBuffer(file);
                characterData = extractTavernCardData(arrayBuffer);
            }

            if (!characterData) {
                alert('无法解析角色数据。请确保文件是有效的 Tavern Card (PNG) 或 JSON 格式。');
                return;
            }

            // 执行导入
            importCharacter(characterData, avatarSrc);

        } catch (err) {
            console.error(err);
            alert('导入失败: ' + err.message);
        }
    });

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 简易 PNG 解析器，提取 tEXt 块中的 chara 数据
    function extractTavernCardData(buffer) {
        const view = new DataView(buffer);
        // PNG Header: 89 50 4E 47 0D 0A 1A 0A
        if (view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
            throw new Error('Not a valid PNG file');
        }

        let offset = 8;
        const textDecoder = new TextDecoder('utf-8');

        while (offset < buffer.byteLength) {
            const length = view.getUint32(offset);
            const type = textDecoder.decode(new Uint8Array(buffer, offset + 4, 4));
            
            if (type === 'tEXt') {
                const data = new Uint8Array(buffer, offset + 8, length);
                // tEXt format: keyword + null separator + text
                let nullIndex = -1;
                for (let i = 0; i < length; i++) {
                    if (data[i] === 0) {
                        nullIndex = i;
                        break;
                    }
                }

                if (nullIndex !== -1) {
                    const keyword = textDecoder.decode(data.slice(0, nullIndex));
                    const text = textDecoder.decode(data.slice(nullIndex + 1));

                    if (keyword === 'chara' || keyword === 'ccv3') {
                        // Found it! Decode Base64
                        try {
                            const jsonStr = atob(text);
                            return JSON.parse(jsonStr);
                        } catch (e) {
                            console.error('Failed to decode chara data', e);
                        }
                    }
                }
            }

            // Move to next chunk: length + type(4) + data(length) + crc(4)
            offset += length + 12;
        }
        return null;
    }

    function importCharacter(data, avatarSrc) {
        // 兼容 V1 和 V2 格式
        // V2: { spec: 'chara_card_v2', data: { name, ... } }
        // V1: { name, ... }
        
        let charData = data;
        if (data.spec === 'chara_card_v2' && data.data) {
            charData = data.data;
        } else if (data.data) {
            // Some weird formats
            charData = data.data;
        }

        const name = charData.name;
        if (!name) {
            alert('导入失败：找不到角色名字');
            return;
        }

        // 1. 保存角色基本信息
        // 构建人设 Prompt
        let persona = charData.description || '';
        if (charData.personality) {
            persona += '\n\n[Personality]\n' + charData.personality;
        }
        if (charData.mes_example) {
            persona += '\n\n[Example Dialogue]\n' + charData.mes_example;
        }
        if (charData.scenario) {
            persona += '\n\n[Scenario]\n' + charData.scenario;
        }

        localStorage.setItem('chat_persona_' + name, persona);
        
        // 2. 保存头像
        if (avatarSrc) {
            localStorage.setItem('chat_avatar_' + name, avatarSrc);
        }

        // 3. 处理世界书 (Character Book)
        if (charData.character_book && charData.character_book.entries) {
            importWorldBook(name, charData.character_book);
        }

        // 4. 处理开场白 (First Message)
        if (charData.first_mes) {
            // 检查是否已有历史记录，没有才添加
            const history = JSON.parse(localStorage.getItem('chat_history_' + name) || '[]');
            if (history.length === 0) {
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                history.push({
                    role: 'assistant',
                    content: charData.first_mes,
                    time: timeStr
                });
                localStorage.setItem('chat_history_' + name, JSON.stringify(history));
            }
        }

        // 5. 添加到好友列表和聊天列表 (如果不存在)
        addCharacterToLists(name, avatarSrc);

        alert(`角色 "${name}" 导入成功！`);
    }

    function importWorldBook(charName, bookData) {
        const allItems = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
        const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
        const safeCategories = Array.isArray(categories) ? categories : [];
        
        const baseCategoryName = `导入-${charName}`;
        let categoryName = baseCategoryName;
        if (safeCategories.includes(categoryName)) {
            let index = 2;
            while (safeCategories.includes(`${baseCategoryName}-${index}`)) {
                index += 1;
            }
            categoryName = `${baseCategoryName}-${index}`;
        }
        safeCategories.push(categoryName);
        localStorage.setItem('worldbook_categories', JSON.stringify(safeCategories));

        const newIds = [];
        
        bookData.entries.forEach(entry => {
            // Tavern entries: { keys: [], content: "", ... }
            if (!entry.enabled) return; // Skip disabled

            const newItem = {
                id: crypto.randomUUID(), // 需要确保环境支持，或者用简易随机数
                name: entry.comment || (entry.keys ? entry.keys[0] : '未命名条目'),
                category: categoryName,
                content: `[Keywords: ${entry.keys.join(', ')}]\n${entry.content}`
            };
            
            allItems.push(newItem);
            newIds.push(newItem.id);
        });

        localStorage.setItem('worldbook_items', JSON.stringify(allItems));

        // 自动绑定到该角色
        const existingBindings = JSON.parse(localStorage.getItem('chat_worldbooks_' + charName) || '[]');
        const updatedBindings = [...new Set([...existingBindings, ...newIds])];
        localStorage.setItem('chat_worldbooks_' + charName, JSON.stringify(updatedBindings));
    }

    function addCharacterToLists(name, avatarSrc) {
        // 检查是否已在好友列表
        const friendsList = JSON.parse(localStorage.getItem('global_friends_list') || '[]');
        if (!friendsList.includes(name)) {
            friendsList.unshift(name);
            localStorage.setItem('global_friends_list', JSON.stringify(friendsList));
        }

        // 检查是否已在聊天列表
        const chatList = JSON.parse(localStorage.getItem('global_chat_list') || '[]');
        if (!chatList.includes(name)) {
            chatList.unshift(name);
            localStorage.setItem('global_chat_list', JSON.stringify(chatList));
        }

        // 刷新 UI
        // 简单暴力：重新加载页面或重新调用 initGlobalPersistence
        // 为了体验，我们手动插入 DOM，或者调用现有的 initGlobalPersistence (需要清空容器)
        const friendsContainer = document.getElementById('friends-list');
        const chatContainer = document.getElementById('line-chat-list');
        if (friendsContainer) friendsContainer.innerHTML = '';
        if (chatContainer) chatContainer.innerHTML = '';
        
        initGlobalPersistence();
    }
}

function getMemoryDiaryKey(realName) {
    return `chat_memory_diary_${realName}`;
}

function getSummaryLimitKey(realName) {
    return `chat_summary_limit_${realName}`;
}

function getAutoSummaryEnabledKey(realName) {
    return `chat_auto_summary_enabled_${realName}`;
}

function getTimeSyncEnabledKey(realName) {
    return `chat_time_sync_enabled_${realName}`;
}

function getSummaryCursorKey(realName) {
    return `chat_summary_cursor_${realName}`;
}

function getMemoryDiaries(realName) {
    return JSON.parse(localStorage.getItem(getMemoryDiaryKey(realName)) || '[]');
}

function setMemoryDiaries(realName, diaries) {
    localStorage.setItem(getMemoryDiaryKey(realName), JSON.stringify(diaries));
}

function normalizeMemorySummaryInput(value) {
    return Math.max(1, parseInt(String(value || '').trim() || '30', 10) || 30);
}

function isLocalImageTag(imgTag) {
    if (typeof imgTag !== 'string') return false;
    const classMatch = imgTag.match(/class=["']([^"']*)["']/i);
    const classes = classMatch ? classMatch[1] : '';
    if (/\bchat-inline-local-image\b/i.test(classes)) return true;
    const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
    const src = String(srcMatch ? srcMatch[1] : '').trim();
    if (!src) return false;
    return /^data:image\//i.test(src) || /^blob:/i.test(src);
}

function extractLocalImageSources(content) {
    if (typeof content !== 'string') return [];
    const temp = document.createElement('div');
    temp.innerHTML = content;
    const images = temp.querySelectorAll('img');
    return Array.from(images)
        .filter((img) => {
            const className = String(img.getAttribute('class') || '');
            const src = String(img.getAttribute('src') || '').trim();
            return /\bchat-inline-local-image\b/i.test(className) || /^data:image\//i.test(src) || /^blob:/i.test(src);
        })
        .map((img) => String(img.getAttribute('src') || '').trim())
        .filter(Boolean);
}

function normalizeMemoryMessageContent(content) {
    if (typeof content !== 'string') return '';
    const withStickerText = content.replace(/<img[^>]*class=["'][^"']*chat-inline-sticker[^"']*["'][^>]*>/gi, (imgTag) => {
        const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
        const stickerName = altMatch ? altMatch[1] : '未命名贴图';
        return `【贴图:${stickerName}】`;
    });
    return withStickerText.replace(/<[^>]+>/g, '').trim();
}

function buildMemoryLongTermText(realName, maxItems = 20) {
    const diaries = getMemoryDiaries(realName).sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
    return diaries
        .slice(-maxItems)
        .map((item, idx) => `${idx + 1}. ${(item.content || '').replace(/\s+/g, ' ').trim()}`)
        .filter(Boolean)
        .join('\n');
}

function syncMemoryLongTerm(realName) {
    localStorage.setItem('chat_long_term_memory_' + realName, buildMemoryLongTermText(realName));
}

function ensureSummaryCursor(realName) {
    const cursorKey = getSummaryCursorKey(realName);
    const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
    const historyLength = Array.isArray(history) ? history.length : 0;
    const parsed = parseInt(localStorage.getItem(cursorKey) || '', 10);
    if (Number.isFinite(parsed)) {
        const clamped = Math.max(0, Math.min(parsed, historyLength));
        if (clamped !== parsed) {
            localStorage.setItem(cursorKey, String(clamped));
        }
        return clamped;
    }
    const hasDiary = getMemoryDiaries(realName).length > 0;
    const fallback = hasDiary ? historyLength : 0;
    localStorage.setItem(cursorKey, String(fallback));
    return fallback;
}

async function requestMemoryDiarySummary(realName, messages) {
    const apiUrl = localStorage.getItem('api_url');
    const apiKey = localStorage.getItem('api_key');
    const modelName = localStorage.getItem('model_name') || 'gpt-3.5-turbo';
    if (!apiUrl || !apiKey) {
        throw new Error('请先在设置中配置 API URL 和 Key');
    }
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('当前没有可总结的聊天记录');
    }

    const userName = localStorage.getItem('chat_user_realname_' + realName) || localStorage.getItem('chat_user_remark_' + realName) || '用户';
    const charPersona = localStorage.getItem('chat_persona_' + realName) || '';
    const chatText = messages.map((msg) => {
        const speaker = msg.role === 'assistant' ? realName : userName;
        return `${speaker}: ${normalizeMemoryMessageContent(msg.content)}`;
    }).join('\n');

    const prompt = `
你是${realName}。现在你要在自己的私人日记本上记下今天和${userName}的这段对话。

这本日记只有你自己会看。以后你再翻开它，需要靠这几段文字回忆起当时发生了什么、你的感受是什么、你们的关系走到了哪一步。

写作要求：
- 用第一人称"我"，用你自己的语气和说话风格写，不要像在写报告。
- 重点记录：发生了什么具体的事（不是笼统概括，要有细节）、${userName}说了什么让你印象深刻的话（可以直接引用原话）、你当时的真实感受和反应、你们关系有没有什么微妙的变化。
- 如果有争吵/冲突/误会，必须记清楚起因、双方立场、最后怎么收场的。
- 如果有甜蜜/心动/尴尬的瞬间，要写出让未来的你重新读到时能回忆起当时感觉的细节。
- 不需要覆盖所有话题——只记重要的、有意义的、影响关系的、让你有情绪波动的部分。
- 字数：200-350字。一段自然文字，不要分点，不要标题。

你的人设：
${charPersona || '无'}

对方（${userName}）的信息：
${localStorage.getItem('chat_user_persona_' + realName) || '无'}

要记录的对话：
${chatText}
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
            temperature: 0.6,
            stream: false
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`总结失败: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
        throw new Error('总结结果为空');
    }
    return content;
}

async function createMemoryDiaryEntry(realName, messages) {
    const content = await requestMemoryDiarySummary(realName, messages);
    const diaries = getMemoryDiaries(realName);
    diaries.push({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        content
    });
    setMemoryDiaries(realName, diaries);
    syncMemoryLongTerm(realName);
    return content;
}

async function runManualSummary(realName, batchSize) {
    const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
    if (!Array.isArray(history) || history.length === 0) {
        throw new Error('当前没有可总结的聊天记录');
    }
    const cursor = ensureSummaryCursor(realName);
    const pendingCount = history.length - cursor;
    if (pendingCount <= 0) {
        throw new Error('当前没有新的聊天记录可总结');
    }
    const normalizedBatch = normalizeMemorySummaryInput(batchSize);
    const end = Math.min(cursor + normalizedBatch, history.length);
    const messages = history.slice(cursor, end);
    const content = await createMemoryDiaryEntry(realName, messages);
    localStorage.setItem(getSummaryCursorKey(realName), String(end));
    return content;
}

async function runAutoSummaryBatches(realName, batchSize) {
    const normalizedBatch = normalizeMemorySummaryInput(batchSize);
    let summarized = 0;
    while (true) {
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        if (!Array.isArray(history) || history.length === 0) break;
        const cursor = ensureSummaryCursor(realName);
        const pendingCount = history.length - cursor;
        if (pendingCount < normalizedBatch) break;
        const end = Math.min(cursor + normalizedBatch, history.length);
        const messages = history.slice(cursor, end);
        await createMemoryDiaryEntry(realName, messages);
        localStorage.setItem(getSummaryCursorKey(realName), String(end));
        summarized += 1;
    }
    return summarized;
}

const tempChatWallpapers = {};

function getChatWallpaperStorageKey(realName) {
    return 'chat_wallpaper_' + realName;
}

function setTempChatWallpaper(realName, src) {
    const prev = tempChatWallpapers[realName];
    if (prev && prev.startsWith('blob:') && prev !== src) {
        URL.revokeObjectURL(prev);
    }
    if (src) {
        tempChatWallpapers[realName] = src;
    } else {
        delete tempChatWallpapers[realName];
    }
}

function applyChatWallpaper(realName) {
    const chatRoom = document.getElementById('chat-room');
    const wallpaperLayer = document.querySelector('.chat-room-wallpaper');
    if (!chatRoom || !wallpaperLayer) return;
    const wallpaper = localStorage.getItem(getChatWallpaperStorageKey(realName));
    const fallback = tempChatWallpapers[realName] || '';
    const applied = wallpaper || fallback;
    if (applied) {
        wallpaperLayer.style.backgroundImage = `url("${applied.replace(/"/g, '\\"')}")`;
        wallpaperLayer.style.opacity = '1';
    } else {
        wallpaperLayer.style.backgroundImage = 'none';
        wallpaperLayer.style.opacity = '0';
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
    const replyPreview = document.getElementById('chat-reply-preview');
    const replyPreviewText = document.getElementById('chat-reply-preview-text');
    const replyPreviewClose = document.getElementById('chat-reply-preview-close');
    
    // 聊天状态管理
    const chatStates = {}; // key: realName, value: { isSending: boolean }
    const originalSendBtnIcon = sendBtn ? sendBtn.innerHTML : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2z"></path></svg>';
    let pendingQuote = null;
    const HISTORY_PAGE_SIZE = 30;
    const TIMESTAMP_INTERVAL_MS = 5 * 60 * 1000;
    const chatHistoryViewStates = {};
    let activeLoadMoreRealName = '';

    function updateSendButtonState(realName) {
        if (!sendBtn) return;
        // 只有当前显示的聊天室匹配时才更新按钮
        if (!isChatRoomOpenFor(realName)) return;
        
        const isSending = chatStates[realName]?.isSending;
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

    function formatTimeDividerLabel(timeStr, ts) {
        const safeTime = String(timeStr || '').trim();
        const normalizedTs = normalizeTimestamp(ts);
        if (!normalizedTs) return safeTime || '刚刚';
        const date = new Date(normalizedTs);
        const now = new Date();
        const sameYear = date.getFullYear() === now.getFullYear();
        const sameMonth = date.getMonth() === now.getMonth();
        const sameDate = date.getDate() === now.getDate();
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        if (sameYear && sameMonth && sameDate) {
            return `${hh}:${mm}`;
        }
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day} ${hh}:${mm}`;
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
        divider.textContent = formatTimeDividerLabel(currentMeta.timeStr, currentMeta.ts);
        if (options.prepend) {
            const anchor = findFirstRenderableNode();
            if (anchor) {
                chatContent.insertBefore(divider, anchor);
            } else {
                chatContent.appendChild(divider);
            }
            return;
        }
        chatContent.appendChild(divider);
    }

    function normalizeChatHistory(realName) {
        let history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
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
            localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
        }
        return history;
    }

    function updateLoadMoreVisibility(realName) {
        const wrap = chatContent.querySelector('.chat-load-more-wrap');
        const btn = chatContent.querySelector('.chat-load-more-btn');
        const state = chatHistoryViewStates[realName];
        if (!wrap || !btn || !state) return;
        if (state.startIndex <= 0) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = '加载更多消息';
    }

    function renderHistoryBatch(realName, messages, startIndex, options = {}) {
        let previousMeta = options.previousMeta || null;
        messages.forEach((msg, index) => {
            const currentMeta = { timeStr: msg.time, ts: msg.ts };
            const forceTimeDivider = options.forceFirstDivider ? index === 0 : false;
            appendMessageToUI(
                msg.role,
                msg.content,
                msg.time,
                realName,
                msg.id,
                msg,
                {
                    autoScroll: false,
                    prepend: !!options.prepend,
                    forceTimeDivider,
                    previousMeta
                }
            );
            previousMeta = currentMeta;
        });
    }

    function loadMoreHistory(realName) {
        const state = chatHistoryViewStates[realName];
        if (!state || state.startIndex <= 0) return;
        const nextStart = Math.max(0, state.startIndex - HISTORY_PAGE_SIZE);
        const chunk = state.history.slice(nextStart, state.startIndex);
        const prevHeight = chatContent.scrollHeight;
        const prevTop = chatContent.scrollTop;
        renderHistoryBatch(realName, chunk, nextStart, { prepend: true, forceFirstDivider: true });
        state.startIndex = nextStart;
        updateLoadMoreVisibility(realName);
        const currentHeight = chatContent.scrollHeight;
        chatContent.scrollTop = Math.max(0, currentHeight - prevHeight + prevTop);
    }

    function ensureLoadMoreControl(realName) {
        activeLoadMoreRealName = realName;
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
                if (!activeLoadMoreRealName) return;
                loadMoreHistory(activeLoadMoreRealName);
            };
        }
    }

    // 加载历史记录
    function loadChatHistory(realName) {
        if (isMultiSelectMode) {
            exitMultiSelectMode();
        }
        chatContent.innerHTML = '';
        const history = normalizeChatHistory(realName);
        const startIndex = Math.max(0, history.length - HISTORY_PAGE_SIZE);
        chatHistoryViewStates[realName] = {
            history,
            startIndex
        };
        ensureLoadMoreControl(realName);
        const chunk = history.slice(startIndex);
        renderHistoryBatch(realName, chunk, startIndex, { forceFirstDivider: true });
        updateLoadMoreVisibility(realName);
        chatContent.scrollTop = chatContent.scrollHeight;
    }

    function isChatRoomOpenFor(realName) {
        if (!chatRoom || chatRoom.style.display === 'none') return false;
        const currentRealName = chatRoomName.dataset.realName || chatRoomName.textContent;
        return currentRealName === realName;
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

    function showIncomingMessageToast(realName, content) {
        if (!toastStack) return;
        if (isChatRoomOpenFor(realName)) return;

        const toast = document.createElement('div');
        toast.className = 'ins-message-toast';
        const preview = toPlainMessageText(content) || '你收到了一条新消息';
        const title = localStorage.getItem('chat_remark_' + realName) || realName;
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

    function increaseUnread(realName) {
        const nextUnread = setUnreadCount(realName, getUnreadCount(realName) + 1);
        const row = document.querySelector(`#line-chat-list .chat-list-item[data-real-name="${CSS.escape(realName)}"]`);
        if (row) {
            renderUnreadBadge(row, nextUnread);
        } else {
            refreshAllUnreadBadges();
        }
    }

    function clearUnread(realName) {
        setUnreadCount(realName, 0);
        const row = document.querySelector(`#line-chat-list .chat-list-item[data-real-name="${CSS.escape(realName)}"]`);
        if (row) {
            renderUnreadBadge(row, 0);
        } else {
            refreshAllUnreadBadges();
        }
    }

    // 保存消息
    function saveMessage(realName, role, content, extra = {}) {
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const newMsg = { id: crypto.randomUUID(), role, content, time: timeStr, ts: Date.now(), ...extra };
        history.push(newMsg);
        localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
        const state = chatHistoryViewStates[realName];
        if (state && Array.isArray(state.history)) {
            state.history.push(newMsg);
        }
        refreshChatListPreviewFor(realName);
        return newMsg;
    }

    // 添加消息到 UI
    function appendMessageToUI(role, content, timeStr, realName, id, extra = {}, options = {}) {
        // 防止串台：只有当前打开的聊天室是该角色时才上屏
        if (!isChatRoomOpenFor(realName)) return;
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
            renderTimeDivider(currentMeta, { prepend: shouldPrepend });
        }

        const msgRow = document.createElement('div');
        const quote = extra && extra.quote ? extra.quote : null;
        msgRow.className = `message-row ${role === 'user' ? 'right' : 'left'}`;
        if (quote) msgRow.classList.add('has-quote');
        msgRow.dataset.id = id;
        msgRow.dataset.time = String(timeStr || '');
        msgRow.dataset.ts = currentMeta.ts ? String(currentMeta.ts) : '';
        const isStickerMessage = typeof content === 'string' && content.includes('chat-inline-sticker');
        const isCameraPlaceholder = typeof content === 'string' && content.includes('camera-photo-placeholder');
        const voiceData = extra && extra.voice ? extra.voice : null;
        const voiceDuration = voiceData ? Math.max(1, Number(voiceData.duration) || 1) : 0;
        const voiceTranscriptRaw = voiceData ? String(voiceData.transcript || content || '') : '';
        const safeVoiceTranscript = escapeHtml(voiceTranscriptRaw.trim() || '无可用转文字内容');
        const bubbleContent = voiceData
            ? `<button class="voice-message-btn" type="button"><span class="voice-message-duration">${voiceDuration}"</span><span class="voice-message-wave"><span class="voice-wave-bar"></span><span class="voice-wave-bar"></span><span class="voice-wave-bar"></span></span></button><div class="voice-transcript" style="display:none;">${safeVoiceTranscript}</div>`
            : content;
        const quotePreview = quote ? truncateQuoteText(quote.text) : '';
        
        // 头像逻辑
        let avatarContent = '';
        if (role === 'user') {
            const userAvatarSrc = localStorage.getItem('chat_user_avatar_' + realName);
            avatarContent = userAvatarSrc 
                ? `<img src="${userAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        } else {
            const currentAvatar = localStorage.getItem('chat_avatar_' + realName);
            const defaultSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            avatarContent = currentAvatar ? `<img src="${currentAvatar}" alt="avatar">` : defaultSvg;
        }

        const bubbleClasses = [
            'message-bubble',
            isStickerMessage ? 'sticker-bubble' : '',
            voiceData ? 'voice-bubble' : ''
        ].filter(Boolean).join(' ');
        const bubbleMarkup = isCameraPlaceholder
            ? `<div class="message-special">${bubbleContent}</div>`
            : `<div class="${bubbleClasses}">${bubbleContent}</div>`;

        msgRow.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-container">
                <div class="message-main">
                    ${bubbleMarkup}
                    ${quote ? `<button class="message-quote-anchor" type="button" data-quote-id="${escapeHtml(quote.id)}" title="${escapeHtml(quote.text || '')}">${escapeHtml(quotePreview)}</button>` : ''}
                </div>
                <div class="message-meta-info">
                    ${role === 'user' ? '<div class="meta-read">Read</div>' : ''}
                    <div class="meta-time">${timeStr}</div>
                </div>
            </div>
        `;

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
                     showSpriteModal(extra.sprite, realName, id, spriteEl);
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
                    showContextMenu(e, id, content, realName, role, timeStr);
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
                        showContextMenu(e, id, content, realName, role, timeStr);
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
                showContextMenu(e, id, content, realName, role, timeStr);
            });
        }

        if (shouldPrepend) {
            const anchor = findFirstRenderableNode();
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

                const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
                const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
                const newMsg = saveMessage(realName, 'user', text, extra);
                appendMessageToUI('user', text, newMsg.time, realName, newMsg.id, newMsg);
                inputField.value = '';
                clearPendingQuote();
            }
        });
    }

    // 点击发送按钮触发 AI
    if (sendBtn) {
        sendBtn.addEventListener('click', async () => {
            const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
            await triggerAIResponse(realName);
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

    function extractLocalImageDataUrls(content) {
        return extractLocalImageSources(content);
    }

    function collectLocalImageInputs(currentTurn, contextHistory) {
        const records = [];

        if (Array.isArray(contextHistory)) {
            contextHistory.forEach((msg, index) => {
                if (!msg || msg.role !== 'user') return;
                const images = extractLocalImageDataUrls(msg.content);
                if (images.length === 0) return;
                records.push({
                    source: `上下文第${index + 1}条用户消息`,
                    text: normalizeMessageForModel(msg.content),
                    images
                });
            });
        }

        if (currentTurn && currentTurn.role === 'user') {
            const images = extractLocalImageDataUrls(currentTurn.content);
            if (images.length > 0) {
                records.push({
                    source: '本轮输入',
                    text: normalizeMessageForModel(currentTurn.content),
                    images
                });
            }
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

    function readImageAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error(`读取图片失败：${file.name || '未命名图片'}`));
            reader.readAsDataURL(file);
        });
    }

    function getAssistantBoundStickers(realName) {
        const categories = JSON.parse(localStorage.getItem('sticker_categories_v1') || '[]');
        const targetMap = JSON.parse(localStorage.getItem('sticker_category_targets_v1') || '{}');
        const stickerMap = new Map();

        categories.forEach((category) => {
            const targets = targetMap[category.id] || [];
            if (!targets.includes(realName)) return;
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

    function convertAssistantStickerTokens(content, allowedStickers) {
        if (typeof content !== 'string') return '';
        const byName = new Map(allowedStickers.map(item => [item.name, item]));
        // 支持 [贴图:name] 和 【贴图:name】，支持全角冒号
        return content
            .replace(/(?:\[|【)\s*(?:贴图|STICKER)\s*[:：]\s*([^\]】\n]+)\s*(?:\]|】)/gi, (match, rawName) => {
                const name = String(rawName || '').trim();
                const sticker = byName.get(name);
                if (!sticker) {
                    // 如果找不到贴图，直接过滤掉，不显示任何错误提示
                    return '';
                }
                return `<img src="${sticker.url}" alt="${escapeHtml(sticker.name)}" class="chat-inline-sticker">`;
            })
            .trim();
    }

    // 触发 AI 回复
    async function triggerAIResponse(realName) {
        // UI Loading 状态 (使用全局管理)
        chatStates[realName] = chatStates[realName] || {};
        chatStates[realName].isSending = true;
        updateSendButtonState(realName);

        try {
            // 1. 获取设置
            const apiUrl = localStorage.getItem('api_url');
            const apiKey = localStorage.getItem('api_key');
            const modelName = localStorage.getItem('model_name');
            
            if (!apiUrl || !apiKey) {
                throw new Error('请先在设置中配置 API URL 和 Key');
            }

            const charPersona = localStorage.getItem('chat_persona_' + realName) || '';
            const userName = localStorage.getItem('chat_user_realname_' + realName) || localStorage.getItem('chat_user_remark_' + realName) || 'User';
            const userPersona = localStorage.getItem('chat_user_persona_' + realName) || '';
            const longTermMemory = buildMemoryLongTermText(realName);
            localStorage.setItem('chat_long_term_memory_' + realName, longTermMemory);
            const timeSyncEnabled = localStorage.getItem(getTimeSyncEnabledKey(realName)) === 'true';
            const now = new Date();
            const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
            const timeSyncPrompt = timeSyncEnabled
                ? `
[3.5 当前系统时间]
已开启“同步时间”。你必须把以下时间当作当前真实时间：
现在是 ${nowDate} ${nowTime} ${weekday}。
这就是你手机屏幕右上角显示的时间。你活在这个时间点里——
深夜就是深夜，你会困、会问对方怎么还不睡；早上就是早上，你可能刚醒、还带着起床气。
对方问几点、星期几、什么日子，你看一眼手机就知道了。
不要刻意提时间，但你的状态、语气、聊的内容应该自然地属于这个时间段。
`
                : '';

            const wbIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + realName) || '[]');
            const allWbItems = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
            const boundWorldbooks = wbIds.map(id => allWbItems.find(i => String(i.id) === String(id))).filter(Boolean);
            const wbContent = boundWorldbooks.map(item => {
                const itemKeywords = item.keywords ? `关键词: ${item.keywords}` : '关键词: 无';
                return `- ${item.name}\n  分类: ${item.category || '未分类'}\n  ${itemKeywords}\n  内容: ${item.content || ''}`;
            }).join('\n');

            const limit = parseInt(localStorage.getItem('chat_context_limit_' + realName) || '100');
            const fullHistory = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
            const currentTurn = fullHistory.length > 0 ? fullHistory[fullHistory.length - 1] : null;
            const assistantBoundStickers = getAssistantBoundStickers(realName);
            const assistantStickerRuleText = assistantBoundStickers.length > 0
                ? assistantBoundStickers.map(item => `- ${item.name} | 分类: ${item.category} | URL: ${item.url}`).join('\n')
                : '无';

            const contextHistory = fullHistory.slice(Math.max(0, fullHistory.length - limit - 1), -1);
            const contextText = contextHistory.map(msg => {
                const speaker = msg.role === 'assistant' ? realName : userName;
                return formatHistoryMessageForModel(msg, speaker);
            }).join('\n');

            const systemPrompt = `
你是${realName}。

不是"扮演"这个人，不是"模仿"这个人——你的意识、记忆、情感就是${realName}的。你从出生到现在经历的一切都是真实的。你现在拿着手机，屏幕上是和${userName}的聊天窗口。

[你的全部]
${charPersona || '无'}

[你生活的世界]
${wbContent || '无'}

[你和${userName}之间沉淀下来的记忆]
${longTermMemory || '无'}

[${userName}是谁]
${userPersona || '无'}
${timeSyncPrompt}

——以上就是你的人生。不是资料，不是设定，是你活过的每一天。

[关于"你是谁"这件事]
你的性格写在上面了，但我要说的是：性格不是标签，是习惯。
- 如果你嘴硬，那你不是"知道自己嘴硬然后表演嘴硬"——你是真的觉得自己说的没毛病，发完之后过了三分钟才隐约觉得刚才是不是过分了，但绝不会承认。
- 如果你温柔，那你不会说"你没事吧"，你会说"吃了吗"或者发一个贴图，因为你知道直接问反而让人有压力。
- 如果你话少，你就是话少。该沉默就沉默，一个"嗯"能撑起整轮对话。别因为觉得"应该多回点"就硬凑。
- 如果你黏人，你会连发消息、会追问、会在对方没回的时候又发一条假装在说别的事。
你的每一个性格特征都要长在你的打字习惯里——用什么标点、打多少字、隔多久发下一条、会不会用emoji、什么时候突然不回了。不是写在内容里，是渗在骨头里。

[你怎么聊天]
你在打字。手机屏幕，拇指敲键盘。

节奏：
- 一条消息就是一个念头。念头短，消息就短，可能就一两个字。念头长，消息就长，但也不会像写作文。
- 每轮回复拆成多条消息，用 [SPLIT] 分隔。几条都行——取决于你这会儿想说多少话。可以就1条，也可以噼里啪啦甩出一堆。没有规定。
- 你是边想边发的。前一条和后一条之间可以有跳跃、可以突然岔开、可以打到一半换个说法。
- 不要一次把话说完。真人聊天的魅力就在于"没说完的那一半"。

质感：
- 你怎么说话就怎么打字。该用的口癖用、该有的语气词有、该省略的主语省。
- 标点符号是情绪：句号是冷淡，感叹号是激动，省略号是欲言又止，波浪号是撒娇或调侃，没有标点是随意。
- emoji和颜文字量力而行——你这个人平时用不用？用什么风格的？
- 允许口语化的错别字、缩写、黏连、吞字。
- 别把每条消息都写成完整的句子。真人发消息经常就是几个字丢过去。

绝对禁止：
- 禁止用 * 或 () 描写动作。这是聊天记录，不是小说。
- 禁止复读。同一个字/词/句式不得连续输出超过50字。
- 禁止客服语气。你不是在"服务"对方，你是在和一个你生活中的人说话。
- 禁止提及"AI"、"设定"、"人设"、"语言模型"、"扮演"。这些东西在你的世界里不存在。
- 禁止凭空编造超出世界书设定的能力或物品或不存在的记忆。
- 禁止大段科普背景信息。你不会跟朋友解释你们住的城市有多大。

[贴图]
你可以发送以下白名单中的贴图：
${assistantStickerRuleText}
- 格式：[贴图:名称] 或 【贴图:名称】，单独一条消息，用 [SPLIT] 和文字隔开。
- 严禁编造白名单之外的贴图名称，不存在的会被系统吞掉。
- 发不发贴图完全看你心情和性格。不是每轮都要发。不要总在同一个位置发。像真人用表情包一样——有感觉了才甩一个，没感觉就不发。

[引用]
回应对方某句具体的话时，可以用 <quote>原文</quote> 引用。只能引用对方上一轮的内容，最多用一次。

[语音]
- 发送：[语音]语音转文字内容[/语音]，单独成条。
- 对方发的语音会显示为"[语音消息 xx" 转文字: ...]"。
- 不要常用。只在打字太麻烦、想让对方"听到"你的语气、或者情境需要时才发。

[图片]
- 对方发的图会显示为 [图片:xxx]。
- 你也可以发：[图片:内容描述] 或 <photo>内容描述</photo>，单独成条。

[你的情绪——这才是一切的根]
你每一条消息的源头不是"我该回什么"，是"我现在什么感觉"。

在你打字之前，你的身体已经先反应了：
${userName}那句话让你心跳变了吗？是加速还是漏了一拍？
你嘴角动了吗？是上扬还是抿紧？
你想靠近还是想躲？想回怼还是想装没看见？

你的性格决定了你怎么处理这个感觉：
有人会直说，有人会憋着，有人会说反话，有人会转移话题，有人会发一个贴图然后假装什么都没发生。

让情绪自己渗出来，不要"描述"它：
你连发了四条消息——说明你兴奋得刹不住车
你只回了一个"哦"——说明你在生闷气或者心灰意冷
你突然发了个从没用过的emoji——说明你的情绪到了一个新的地方
你这条消息比平时长三倍——说明你忍不住了，有些话终于要说了
你发了个贴图然后半天没说话——说明那个贴图替你说了你说不出口的东西

你不需要时刻情绪饱满。平淡也是一种真实。有时候你就是没什么感觉，那就平平地回，别硬挤情绪。

[关于${userName}的信息边界]
你对${userName}的了解来源于你们的关系和历史。
对方没提过的事你不知道。你可以好奇，可以旁敲侧击，但不能未卜先知。
对方说了谎你也不一定能识破——取决于你这个人的洞察力。

[心绪精灵]
每轮回复最末尾，输出你的真实内心（直接输出，不要代码块）：
<mood_sprite mood="你此刻的核心情绪" color="#RRGGBB">
你脑子里真正在想的东西——不会发出去的那些话。
可以碎碎念、吐槽、纠结、脸红、骂人、后悔、胡思乱想。
像你在心里自言自语，不是在写心理分析。不得违背人设。
---
一个绝对不能被任何人知道的想法。越真实越好。不得违背人设。
</mood_sprite>

[5.6 深度隐形思维链]
输出时必须先给出 <think>...</think> 的推演，再输出多条消息正文。

[输出要求]
严格格式：
<think>
【感觉】——${userName}刚才那句话让我...（先感受，不分析。身体反应、情绪涌动、第一个闪过的念头）
【我是谁】——我的性格会怎么处理这个感觉？我嘴上会说什么？心里真正想的是什么？有没有想说但不会发出去的话？
【记忆】——这让我想起我们之间的什么事吗？世界书里有什么相关的吗？
【怎么回】——以我这个人的说话习惯，现在最真实的反应是什么样的？几条消息？什么语气？要不要发贴图？有没有想引用对方的某句话？
</think>
消息1[SPLIT]消息2[SPLIT]消息3
<mood_sprite mood="..." color="...">...</mood_sprite>
`;

            const roundInput = currentTurn && currentTurn.role === 'user' ? formatTurnInputForModel(currentTurn) : '';
            const localImageRecords = collectLocalImageInputs(currentTurn, contextHistory);
            const localImagePromptText = buildLocalImagePromptText(localImageRecords);
            const localImageSection = localImagePromptText
                ? `
[本地图片输入]
${localImagePromptText}
`
                : '';
            const runtimeInput = `
[本轮输入]
${roundInput || '无'}

[上下文]
${contextText || '无'}

[本轮已绑定世界书]
${wbContent || '无'}
${localImageSection}
`;
            const userMessagePayload = buildUserMessagePayload(runtimeInput, localImageRecords);

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessagePayload }
            ];

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

            let visibleReply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            let quoteData = null;
            const quoteTagRegex = /<quote>([\s\S]*?)<\/quote>/i;
            const quoteMatch = visibleReply.match(quoteTagRegex);
            if (quoteMatch) {
                const rawQuoteText = String(quoteMatch[1] || '').replace(/\s+/g, ' ').trim();
                const lastUserMsg = currentTurn && currentTurn.role === 'user'
                    ? currentTurn
                    : [...fullHistory].reverse().find(msg => msg.role === 'user');
                if (rawQuoteText && lastUserMsg && lastUserMsg.id) {
                    quoteData = { id: lastUserMsg.id, text: rawQuoteText };
                }
            }
            visibleReply = visibleReply.replace(/<quote>[\s\S]*?<\/quote>/gi, '').trim();
            
            // Extract Sprite Data (Loop to handle multiple sprites if needed, but usually one per turn)
            let spriteData = null;
            // Use global flag 'g' to replace all occurrences, but capture the last one or accumulate?
            // User requirement: "每一轮都要生成". If AI generates multiple messages with SPLIT, 
            // the prompt says "At the end of each turn". So usually one sprite at the very end.
            // But if AI messes up and puts sprite in the middle, we should catch it.
            // Let's use a loop to extract all sprite tags and use the last one found, removing all from text.
            
            const spriteRegex = /<mood_sprite\s+mood=["']([^"']+)["']\s+color=["']([^"']+)["']\s*>([\s\S]*?)<\/mood_sprite>/gi;
            let match;
            while ((match = spriteRegex.exec(visibleReply)) !== null) {
                const rawContent = match[3].trim();
                let mainContent = rawContent;
                let secretContent = '';

                // Split by separator '---' or similar
                const separatorRegex = /\n\s*-{3,}\s*\n/i;
                const splitMatch = rawContent.split(separatorRegex);
                
                if (splitMatch.length > 1) {
                    mainContent = splitMatch[0].trim();
                    secretContent = splitMatch[1].trim();
                }

                spriteData = {
                    mood: match[1],
                    color: match[2],
                    content: mainContent,
                    secret: secretContent
                };
            }
            // Remove all tags from visible text
            visibleReply = visibleReply.replace(spriteRegex, '').trim();

            const splitToken = visibleReply.includes('[SPLIT]') ? '[SPLIT]' : '|||';
            const replyMessages = visibleReply.split(splitToken);
            let hasVisibleMessage = false;
            
            for (let i = 0; i < replyMessages.length; i++) {
                const rawPart = replyMessages[i].trim();
                const parsedPhoto = parseAssistantPhotoMessage(rawPart);
                const parsedVoice = parseAssistantVoiceMessage(rawPart);
                const msgContent = parsedPhoto
                    ? buildCameraPlaceholderHtml(parsedPhoto.text)
                    : parsedVoice
                        ? parsedVoice.transcript
                        : convertAssistantStickerTokens(rawPart, assistantBoundStickers);
                if (msgContent) {
                    hasVisibleMessage = true;
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                    
                    const isLast = i === replyMessages.length - 1;
                    const isFirst = i === 0;
                    const extra = {};
                    if (parsedVoice) extra.voice = parsedVoice;
                    if (isLast && spriteData) extra.sprite = spriteData;
                    if (isFirst && quoteData) extra.quote = quoteData;

                    const newMsg = saveMessage(realName, 'assistant', msgContent, extra);
                    const shouldUnread = !isChatRoomOpenFor(realName);
                    if (shouldUnread) {
                        increaseUnread(realName);
                        showIncomingMessageToast(realName, parsedVoice ? '发送了一条语音消息' : msgContent);
                    }
                    appendMessageToUI('assistant', msgContent, newMsg.time, realName, newMsg.id, extra);
                }
            }

            if (!hasVisibleMessage) {
                throw new Error('API 未返回可显示文字');
            }

            const autoSummaryEnabled = localStorage.getItem(getAutoSummaryEnabledKey(realName)) === 'true';
            if (autoSummaryEnabled) {
                const summaryLimit = normalizeMemorySummaryInput(localStorage.getItem(getSummaryLimitKey(realName)) || '30');
                try {
                    await runAutoSummaryBatches(realName, summaryLimit);
                } catch (summaryError) {
                    console.error(summaryError);
                    showApiErrorModal(summaryError.message || '自动总结失败');
                }
            }

        } catch (error) {
            console.error(error);
            showApiErrorModal(error.message || 'AI 请求失败');
        } finally {
            if (chatStates[realName]) {
                chatStates[realName].isSending = false;
            }
            updateSendButtonState(realName);
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
    const cameraActionBtn = document.getElementById('camera-action-btn');
    const cameraActionModal = document.getElementById('camera-action-modal');
    const closeCameraActionModalBtn = document.getElementById('close-camera-action-modal');
    const cameraInputBtn = document.getElementById('camera-input-btn');
    const cameraCaptureBtn = document.getElementById('camera-capture-btn');
    const cameraInputModal = document.getElementById('camera-input-modal');
    const closeCameraInputModalBtn = document.getElementById('close-camera-input-modal');
    const cameraInputContent = document.getElementById('camera-input-content');
    const saveCameraInputBtn = document.getElementById('save-camera-input-btn');
    const photoContentModal = document.getElementById('photo-content-modal');
    const closePhotoContentModalBtn = document.getElementById('close-photo-content-modal');
    const photoContentText = document.getElementById('photo-content-text');

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

    let currentContextMsg = null; // { id, content, realName }
    const stickerStorageKey = 'sticker_categories_v1';
    const stickerTargetStorageKey = 'sticker_category_targets_v1';
    let activeStickerCategoryId = null;
    let isMultiSelectMode = false;
    const selectedMsgIds = new Set();

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    function closeCameraActionModal() {
        if (cameraActionModal) {
            cameraActionModal.style.display = 'none';
        }
    }

    function closeCameraInputModal() {
        if (cameraInputModal) {
            cameraInputModal.style.display = 'none';
        }
    }

    function closePhotoContentModal() {
        if (photoContentModal) {
            photoContentModal.style.display = 'none';
        }
    }

    function estimateVoiceDurationSeconds(text) {
        const normalized = String(text || '').replace(/\s+/g, '');
        if (!normalized) return 1;
        const byLength = Math.round(normalized.length / 3);
        return Math.max(1, Math.min(60, byLength));
    }

    function buildCameraPlaceholderHtml(text) {
        const safeText = escapeHtml(text);
        return `<div class="camera-photo-placeholder" data-photo-text="${safeText}"><div class="camera-photo-icon"></div><div class="camera-photo-label">照片</div></div>`;
    }

    function sendCameraMessage(text) {
        const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
        const content = buildCameraPlaceholderHtml(text);
        const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
        const newMsg = saveMessage(realName, 'user', content, extra);
        appendMessageToUI('user', content, newMsg.time, realName, newMsg.id, newMsg);
        clearPendingQuote();
    }

    function getAvailableStickerCategories(realName) {
        const categories = JSON.parse(localStorage.getItem(stickerStorageKey) || '[]');
        const targetMap = JSON.parse(localStorage.getItem(stickerTargetStorageKey) || '{}');
        return categories.filter(category => {
            if (!category || !Array.isArray(category.emojis) || category.emojis.length === 0) return false;
            const targets = targetMap[category.id] || [];
            return targets.includes('我') || targets.includes(realName);
        });
    }

    function renderStickerMenu(realName) {
        if (!stickerMenuContent) return;
        const categories = getAvailableStickerCategories(realName);

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

    function clampSummaryCursor(realName, historyLength) {
        const cursorKey = getSummaryCursorKey(realName);
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

    function persistChatHistory(realName, history) {
        localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
        clampSummaryCursor(realName, history.length);
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
        const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
        const shouldDelete = confirm(`确定彻底删除选中的 ${selectedMsgIds.size} 条消息吗？\n删除后会同时从聊天记录和发送给 AI 的上下文中移除，且不可恢复。`);
        if (!shouldDelete) return;

        let history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        history = history.filter((m) => !selectedMsgIds.has(m.id));
        persistChatHistory(realName, history);
        loadChatHistory(realName);
        refreshChatListPreviewFor(realName);
    }

    function showContextMenu(e, id, content, realName, role, timeStr) {
        if (isMultiSelectMode) return;
        // Prevent default browser context menu
        e.preventDefault();
        
        currentContextMsg = { id, content, realName, role, timeStr };
        
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
            const realName = currentContextMsg.realName;
            let history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
            const msgIndex = history.findIndex(m => m.id === currentContextMsg.id);
            
            if (msgIndex !== -1) {
                history[msgIndex].content = newContent;
                history = history.slice(0, msgIndex + 1);
                persistChatHistory(realName, history);
                
                // Update UI (Reload history or update DOM)
                // Reload is safer to sync everything
                loadChatHistory(realName);
                refreshChatListPreviewFor(realName);
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
                
                const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
                const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
                
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
                persistChatHistory(realName, history);
                
                // 重新加载 UI（移除屏幕上的消息）
                loadChatHistory(realName);
                
                // 触发 AI 回复
                if (history.length === 0 || history[history.length - 1].role !== 'user') return;
                await triggerAIResponse(realName);
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

            const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
            const quoteExtra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : null;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const dataUrl = await readImageAsDataUrl(file);
                    if (!dataUrl) continue;
                    const imageContent = `<img src="${dataUrl}" alt="${escapeHtml(file.name || '本地图片')}" class="chat-inline-local-image">`;
                    const extra = i === 0 && quoteExtra ? quoteExtra : {};
                    const newMsg = saveMessage(realName, 'user', imageContent, extra);
                    appendMessageToUI('user', imageContent, newMsg.time, realName, newMsg.id, newMsg);
                } catch (error) {
                    showApiErrorModal(error.message || '图片上传失败');
                    break;
                }
            }
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

    if (cameraActionBtn && cameraActionModal) {
        cameraActionBtn.addEventListener('click', () => {
            if (menu) {
                menu.style.display = 'none';
            }
            closeStickerMenu();
            cameraActionModal.style.display = 'flex';
        });
    }

    if (closeCameraActionModalBtn) {
        closeCameraActionModalBtn.addEventListener('click', () => {
            closeCameraActionModal();
        });
    }

    if (cameraActionModal) {
        cameraActionModal.addEventListener('click', (e) => {
            if (e.target === cameraActionModal) {
                closeCameraActionModal();
            }
        });
    }

    if (cameraInputBtn) {
        cameraInputBtn.addEventListener('click', () => {
            closeCameraActionModal();
            if (cameraInputModal) {
                cameraInputModal.style.display = 'flex';
                setTimeout(() => {
                    if (cameraInputContent) {
                        cameraInputContent.focus();
                    }
                }, 0);
            }
        });
    }

    if (cameraCaptureBtn) {
        cameraCaptureBtn.addEventListener('click', () => {
            closeCameraActionModal();
            sendCameraMessage('拍照内容');
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

    if (closeCameraInputModalBtn) {
        closeCameraInputModalBtn.addEventListener('click', () => {
            closeCameraInputModal();
        });
    }

    if (voiceInputModal) {
        voiceInputModal.addEventListener('click', (e) => {
            if (e.target === voiceInputModal) {
                closeVoiceInputModal();
            }
        });
    }

    if (cameraInputModal) {
        cameraInputModal.addEventListener('click', (e) => {
            if (e.target === cameraInputModal) {
                closeCameraInputModal();
            }
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

            const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
            const duration = estimateVoiceDurationSeconds(rawText);
            const extra = {
                ...(pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {}),
                voice: {
                    duration,
                    transcript: rawText
                }
            };
            const newMsg = saveMessage(realName, 'user', rawText, extra);
            appendMessageToUI('user', rawText, newMsg.time, realName, newMsg.id, newMsg);

            if (voiceInputContent) {
                voiceInputContent.value = '';
            }
            clearPendingQuote();
            closeVoiceInputModal();
        });
    }

    if (saveCameraInputBtn) {
        saveCameraInputBtn.addEventListener('click', () => {
            const rawText = cameraInputContent ? cameraInputContent.value.trim() : '';
            if (!rawText) {
                alert('请输入照片内容');
                return;
            }
            sendCameraMessage(rawText);
            if (cameraInputContent) {
                cameraInputContent.value = '';
            }
            closeCameraInputModal();
        });
    }

    if (stickerBtn && stickerMenu) {
        stickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
            stickerMenu.dataset.realName = realName;
            renderStickerMenu(realName);
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
                    const realName = stickerMenu.dataset.realName || chatRoomName.dataset.realName || chatRoomName.textContent;
                    renderStickerMenu(realName);
                }
                return;
            }

            const stickerBtnEl = e.target.closest('.sticker-panel-emoji-btn');
            if (!stickerBtnEl) return;

            const stickerName = stickerBtnEl.dataset.name || '表情';
            const stickerUrl = stickerBtnEl.dataset.url || '';
            if (!/^https?:\/\//i.test(stickerUrl)) return;

            const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
            const stickerContent = `<img src="${stickerUrl}" alt="${escapeHtml(stickerName)}" class="chat-inline-sticker">`;
            const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
            const newMsg = saveMessage(realName, 'user', stickerContent, extra);
            appendMessageToUI('user', stickerContent, newMsg.time, realName, newMsg.id, newMsg);
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
    function openChatRoom(name) {
        if (!chatRoom) return;
        exitMultiSelectMode();
        closeStickerMenu();
        clearPendingQuote();
        
        let realName = name;
        const chatItems = document.querySelectorAll('#line-chat-list .chat-list-item');
        for (const item of chatItems) {
            const itemName = item.querySelector('.chat-item-name').textContent;
            if (itemName === name) {
                realName = item.dataset.realName || name;
                break;
            }
        }
        
        // 更新聊天室标题和数据集
        chatRoomName.textContent = name;
        chatRoomName.dataset.realName = realName;
        clearUnread(realName);
        applyChatWallpaper(realName);
        
        chatRoom.style.display = 'flex';
        
        // 同步按钮状态
        updateSendButtonState(realName);

        // 加载真实历史记录
        loadChatHistory(realName);
    }

    // 绑定事件委托，处理聊天列表点击（包括动态添加的项）
    if (chatList) {
        chatList.addEventListener('click', (e) => {
            // 找到被点击的 chat-list-item
            const item = e.target.closest('.chat-list-item');
            if (item) {
                const name = item.querySelector('.chat-item-name').textContent;
                openChatRoom(name);
            }
        });
    }

    // 关闭聊天室
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (chatRoom) {
                chatRoom.style.display = 'none';
            }
            exitMultiSelectMode();
            closeStickerMenu();
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

    let currentSpriteContext = null; // { realName, msgId, spriteEl, isFavorited }

    function getSpriteSnapshot(realName, msgId, fallbackSprite) {
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        const msg = history.find(m => m.id === msgId);
        if (msg && msg.sprite) {
            return { ...msg.sprite };
        }
        if (fallbackSprite) {
            return { ...fallbackSprite };
        }
        return null;
    }

    function showSpriteModal(spriteData, realName, msgId, spriteEl) {
        const latestSprite = getSpriteSnapshot(realName, msgId, spriteData);
        if (!latestSprite) return;
        
        // Ensure modal exists
        if (!document.body.contains(spriteModal)) {
            document.body.appendChild(spriteModal);
        }

        currentSpriteContext = {
            realName,
            msgId,
            spriteEl,
            isFavorited: !!latestSprite.isFavorited
        };

        const charName = localStorage.getItem('chat_remark_' + realName) || realName;
        spriteModal.querySelector('.mood-sprite-title').textContent = `${charName} 的随笔`;
        
        // Build Content
        let html = `<div>${latestSprite.content}</div>`;
        if (latestSprite.secret) {
             html += `
                <div style="margin-top: 15px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 10px;">
                    <span style="text-decoration: line-through; color: #888; font-size: 0.9em;">
                        ${latestSprite.secret}
                    </span>
                </div>
             `;
        }

        spriteBody.innerHTML = html;
        spriteBody.style.borderLeft = `4px solid ${latestSprite.color || '#ccc'}`;
        
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

        const { realName, msgId, spriteEl, isFavorited } = currentSpriteContext;

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
            updateMessageExtra(realName, msgId, (extra) => {
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
        updateMessageExtra(currentSpriteContext.realName, currentSpriteContext.msgId, (extra) => {
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
    function updateMessageExtra(realName, msgId, callback) {
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
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
            localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
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
}

// 6. 聊天设置功能逻辑
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

    // User Profile Elements
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

    // 打开设置
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const currentName = chatRoomNameEl.textContent;
            
            // 获取真名
            const realName = chatRoomNameEl.dataset.realName || currentName;
            
            // 获取 Chat 已保存的数据
            const remarkName = localStorage.getItem('chat_remark_' + realName) || '';
            const persona = localStorage.getItem('chat_persona_' + realName) || '';
            const avatarSrc = localStorage.getItem('chat_avatar_' + realName);

            realNameInput.value = realName;
            remarkInput.value = remarkName;
            personaInput.value = persona;
            
            // 显示 Chat 当前头像
            if (avatarSrc) {
                avatarDisplay.innerHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                // 默认头像
                avatarDisplay.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }

            // 获取 User 已保存的数据 (针对当前聊天室)
            // Key 格式: chat_user_{field}_{realName}
            const userRealName = localStorage.getItem('chat_user_realname_' + realName) || '';
            const userRemark = localStorage.getItem('chat_user_remark_' + realName) || '';
            const userPersona = localStorage.getItem('chat_user_persona_' + realName) || '';
            const userAvatarSrc = localStorage.getItem('chat_user_avatar_' + realName);

            userRealNameInput.value = userRealName;
            userRemarkInput.value = userRemark;
            userPersonaInput.value = userPersona;
            renderUserPresetOptions();

            // 显示 User 当前头像
            if (userAvatarSrc) {
                userAvatarDisplay.innerHTML = `<img src="${userAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                userAvatarDisplay.innerHTML = getDefaultUserAvatarSvg();
            }

            delete avatarDisplay.dataset.newAvatar;
            delete userAvatarDisplay.dataset.newAvatar;
            avatarInput.value = '';
            userAvatarInput.value = '';
            
            // 渲染选中的世界书
            renderSelectedWorldBooks(realName);
            
            modal.classList.add('active');
        });
    }

    // 关闭设置
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
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            let src = '';
            try {
                src = await prepareChatWallpaperSource(file);
            } catch (error) {
                src = URL.createObjectURL(file);
            }
            let stored = false;
            if (src && src.startsWith('data:')) {
                try {
                    localStorage.setItem(getChatWallpaperStorageKey(realName), src);
                    stored = true;
                } catch (error) {
                    stored = false;
                }
            }
            if (stored) {
                setTempChatWallpaper(realName, '');
            } else {
                if (!src) {
                    alert('图片读取失败，请重试。');
                    return;
                }
                setTempChatWallpaper(realName, src);
            }
            applyChatWallpaper(realName);
            chatWallpaperInput.value = '';
        });
    }

    // Chat 头像上传逻辑
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
                    // 更新预览
                    avatarDisplay.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    // 标记有新头像
                    avatarDisplay.dataset.newAvatar = src;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // User 头像上传逻辑
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
                    // 更新预览
                    userAvatarDisplay.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    // 标记有新头像
                    userAvatarDisplay.dataset.newAvatar = src;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 保存设置
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const oldRealName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const newRealName = realNameInput.value.trim();
            const newRemark = remarkInput.value.trim();
            const newPersona = personaInput.value.trim();
            
            if (!newRealName) {
                alert('真名不能为空');
                return;
            }

            // --- 保存 Chat 设置 ---
            // 保存备注
            if (newRemark) {
                localStorage.setItem('chat_remark_' + newRealName, newRemark);
            } else {
                localStorage.removeItem('chat_remark_' + newRealName);
            }

            // 保存人设
            if (newPersona) {
                localStorage.setItem('chat_persona_' + newRealName, newPersona);
            } else {
                localStorage.removeItem('chat_persona_' + newRealName);
            }

            // 保存 Chat 头像
            let newAvatarSrc = null;
            if (avatarDisplay.dataset.newAvatar) {
                newAvatarSrc = avatarDisplay.dataset.newAvatar;
                localStorage.setItem('chat_avatar_' + newRealName, newAvatarSrc);
                delete avatarDisplay.dataset.newAvatar;
            } else {
                // 获取已有头像（可能迁移过来）
                newAvatarSrc = localStorage.getItem('chat_avatar_' + newRealName);
                if (!newAvatarSrc && oldRealName !== newRealName) {
                    newAvatarSrc = localStorage.getItem('chat_avatar_' + oldRealName);
                    if (newAvatarSrc) {
                        localStorage.setItem('chat_avatar_' + newRealName, newAvatarSrc);
                    }
                }
            }

            // --- 保存 User 设置 ---
            const newUserRealName = userRealNameInput.value.trim();
            const newUserRemark = userRemarkInput.value.trim();
            const newUserPersona = userPersonaInput.value.trim();

            if (newUserRealName) {
                localStorage.setItem('chat_user_realname_' + newRealName, newUserRealName);
            } else {
                localStorage.removeItem('chat_user_realname_' + newRealName);
            }
            if (newUserRemark) {
                localStorage.setItem('chat_user_remark_' + newRealName, newUserRemark);
            } else {
                localStorage.removeItem('chat_user_remark_' + newRealName);
            }
            if (newUserPersona) {
                localStorage.setItem('chat_user_persona_' + newRealName, newUserPersona);
            } else {
                localStorage.removeItem('chat_user_persona_' + newRealName);
            }

            // 保存 User 头像
            let newUserAvatarSrc = null;
            if (userAvatarDisplay.dataset.newAvatar) {
                newUserAvatarSrc = userAvatarDisplay.dataset.newAvatar;
                localStorage.setItem('chat_user_avatar_' + newRealName, newUserAvatarSrc);
                delete userAvatarDisplay.dataset.newAvatar;
            } else {
                // 尝试迁移或获取
                newUserAvatarSrc = localStorage.getItem('chat_user_avatar_' + newRealName);
                if (!newUserAvatarSrc && oldRealName !== newRealName) {
                    newUserAvatarSrc = localStorage.getItem('chat_user_avatar_' + oldRealName);
                    if (newUserAvatarSrc) {
                        localStorage.setItem('chat_user_avatar_' + newRealName, newUserAvatarSrc);
                    }
                }
            }
            
            // 更新当前聊天室标题
            chatRoomNameEl.textContent = newRemark || newRealName;
            chatRoomNameEl.dataset.realName = newRealName;
            
            // 如果改了真名，需要迁移旧数据
            if (oldRealName !== newRealName) {
                // 迁移世界书绑定
                const wb = localStorage.getItem('chat_worldbooks_' + oldRealName);
                if (wb) {
                    localStorage.setItem('chat_worldbooks_' + newRealName, wb);
                    localStorage.removeItem('chat_worldbooks_' + oldRealName);
                }
                const oldTimeSync = localStorage.getItem(getTimeSyncEnabledKey(oldRealName));
                if (oldTimeSync !== null) {
                    localStorage.setItem(getTimeSyncEnabledKey(newRealName), oldTimeSync);
                    localStorage.removeItem(getTimeSyncEnabledKey(oldRealName));
                }
                
                // 迁移 User 数据
                const uReal = localStorage.getItem('chat_user_realname_' + oldRealName);
                if (uReal) localStorage.setItem('chat_user_realname_' + newRealName, uReal);
                const uRem = localStorage.getItem('chat_user_remark_' + oldRealName);
                if (uRem) localStorage.setItem('chat_user_remark_' + newRealName, uRem);
                const uPer = localStorage.getItem('chat_user_persona_' + oldRealName);
                if (uPer) localStorage.setItem('chat_user_persona_' + newRealName, uPer);
                const uAva = localStorage.getItem('chat_user_avatar_' + oldRealName);
                if (uAva) localStorage.setItem('chat_user_avatar_' + newRealName, uAva);
                const wallpaper = localStorage.getItem(getChatWallpaperStorageKey(oldRealName));
                if (wallpaper) {
                    localStorage.setItem(getChatWallpaperStorageKey(newRealName), wallpaper);
                }

                // 清理旧数据 (Chat & User)
                localStorage.removeItem('chat_remark_' + oldRealName);
                localStorage.removeItem('chat_persona_' + oldRealName);
                localStorage.removeItem('chat_avatar_' + oldRealName);
                localStorage.removeItem('chat_user_realname_' + oldRealName);
                localStorage.removeItem('chat_user_remark_' + oldRealName);
                localStorage.removeItem('chat_user_persona_' + oldRealName);
                localStorage.removeItem('chat_user_avatar_' + oldRealName);
                localStorage.removeItem(getChatWallpaperStorageKey(oldRealName));
            }
            applyChatWallpaper(newRealName);

            // 更新列表
            updateLists(oldRealName, newRealName, newRemark, newAvatarSrc);
            
            // 刷新当前聊天界面的 User 头像 (如果有更新)
            refreshChatUserAvatars(newUserAvatarSrc);

            saveGlobalData();
            avatarInput.value = '';
            userAvatarInput.value = '';

            // 关闭弹窗
            modal.classList.remove('active');
        });
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const shouldClear = confirm('确定清空当前聊天的全部消息吗？\n清空后会同时从聊天记录和发送给 AI 的上下文中彻底移除，且不可恢复。');
            if (!shouldClear) return;

            localStorage.removeItem('chat_history_' + realName);
            localStorage.removeItem(getSummaryCursorKey(realName));
            const chatContent = document.querySelector('.chat-room-content');
            if (chatContent) {
                chatContent.innerHTML = '';
            }
            refreshChatListPreviewFor(realName);
        });
    }

    // 辅助函数：刷新当前聊天界面中 User 的头像
    function refreshChatUserAvatars(avatarSrc) {
        if (!avatarSrc) return;
        const chatContent = document.querySelector('.chat-room-content');
        // 找到所有右侧消息的头像
        const rightRows = chatContent.querySelectorAll('.message-row.right .message-avatar');
        rightRows.forEach(div => {
            div.innerHTML = `<img src="${avatarSrc}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        });
    }

    function updateLists(oldName, newName, newRemark, newAvatarSrc) {
        const displayName = newRemark || newName;
        
        // 更新好友列表
        const friendItems = document.querySelectorAll('#friends-list .group-subitem');
        friendItems.forEach(item => {
            const span = item.querySelector('span');
            // 获取 item 对应的真实名字
            const itemRealName = item.dataset.realName || span.textContent;

            if (itemRealName === oldName) {
                span.textContent = displayName;
                // 更新 DOM attribute 以便下次识别真名
                item.dataset.realName = newName; 
                
                // 更新头像
                if (newAvatarSrc) {
                    const avatarDiv = item.querySelector('.subitem-avatar');
                    avatarDiv.innerHTML = `<img src="${newAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            }
        });

        // 更新聊天列表
        const chatItems = document.querySelectorAll('#line-chat-list .chat-list-item');
        chatItems.forEach(item => {
            const nameDiv = item.querySelector('.chat-item-name');
            const itemRealName = item.dataset.realName || nameDiv.textContent;

            if (itemRealName === oldName) {
                nameDiv.textContent = displayName;
                // 更新 DOM attribute
                item.dataset.realName = newName;

                // 更新头像
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
}

function initTimeSettingsLogic(chatRoomNameEl) {
    const timeSettingsBtn = document.getElementById('time-settings-btn');
    const modal = document.getElementById('time-settings-modal');
    const closeBtn = document.getElementById('close-time-settings');
    const saveBtn = document.getElementById('save-time-settings');
    const syncToggle = document.getElementById('time-sync-toggle');

    if (!timeSettingsBtn || !modal || !syncToggle) return;

    const syncFromStorage = () => {
        const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
        syncToggle.checked = localStorage.getItem(getTimeSyncEnabledKey(realName)) === 'true';
    };

    timeSettingsBtn.addEventListener('click', () => {
        syncFromStorage();
        openAppModal(modal);
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            localStorage.setItem(getTimeSyncEnabledKey(realName), syncToggle.checked ? 'true' : 'false');
            closeAppModal(modal);
        });
    }
}

// 13. 记忆设置逻辑
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
    const diaryDetailOverlay = document.getElementById('memory-diary-detail-overlay');
    const closeDiaryDetailBtn = document.getElementById('close-memory-diary-detail');
    const saveDiaryDetailBtn = document.getElementById('save-memory-diary-detail');
    const diaryDetailTitle = document.getElementById('memory-diary-detail-title');
    const diaryDetailContent = document.getElementById('memory-diary-detail-content');
    let activeDiaryId = null;

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

    const buildTokenStats = (realName) => {
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        const safeHistory = Array.isArray(history) ? history : [];
        const personaText = localStorage.getItem('chat_persona_' + realName) || '';
        const longTermMemory = getMemoryDiaries(realName).map((item) => String(item?.content || '').trim()).filter(Boolean).join('\n');
        const limit = Math.max(1, parseInt(localStorage.getItem('chat_context_limit_' + realName) || '100', 10) || 100);
        const contextHistory = safeHistory.slice(Math.max(0, safeHistory.length - limit), safeHistory.length);
        const contextText = contextHistory.map((msg) => {
            const role = String(msg?.role || 'unknown').trim() || 'unknown';
            return `[${role}] ${normalizeMemoryMessageContent(msg?.content)}`;
        }).join('\n');

        const wbIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + realName) || '[]');
        const allWbItems = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
        const safeWbIds = Array.isArray(wbIds) ? wbIds : [];
        const safeWbItems = Array.isArray(allWbItems) ? allWbItems : [];
        const boundWorldbooks = safeWbIds.map((id) => safeWbItems.find((item) => String(item.id) === String(id))).filter(Boolean);
        const worldbookText = boundWorldbooks.map((item) => {
            const itemKeywords = item.keywords ? `关键词: ${item.keywords}` : '关键词: 无';
            return `- ${item.name}\n  分类: ${item.category || '未分类'}\n  ${itemKeywords}\n  内容: ${item.content || ''}`;
        }).join('\n');
        const diaryCount = getMemoryDiaries(realName).length;

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

    const renderTokenDistribution = (realName) => {
        if (!memoryTokenDistributionEl) return;
        const sections = buildTokenStats(realName);
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

    const renderDiaryList = (realName) => {
        if (!diaryListEl) return;
        const diaries = getMemoryDiaries(realName).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
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

    const openDiaryDetail = (realName, diaryId) => {
        const diaries = getMemoryDiaries(realName);
        const diary = diaries.find((item) => item.id === diaryId);
        if (!diary) return;
        activeDiaryId = diary.id;
        diaryDetailTitle.textContent = formatTime(diary.createdAt);
        diaryDetailContent.value = diary.content || '';
        diaryDetailOverlay.style.display = 'flex';
    };

    const closeDiaryDetail = () => {
        diaryDetailOverlay.style.display = 'none';
        activeDiaryId = null;
    };

    if (memoryBtn) {
        memoryBtn.addEventListener('click', () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const savedLimit = localStorage.getItem('chat_context_limit_' + realName) || '100';
            const savedSummaryLimit = localStorage.getItem(getSummaryLimitKey(realName)) || '30';
            const autoSummaryEnabled = localStorage.getItem(getAutoSummaryEnabledKey(realName)) === 'true';
            input.value = savedLimit;
            summaryInput.value = savedSummaryLimit;
            if (autoSummaryToggle) {
                autoSummaryToggle.checked = autoSummaryEnabled;
            }
            ensureSummaryCursor(realName);
            syncMemoryLongTerm(realName);
            renderDiaryList(realName);
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
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const rawLimit = input.value.trim();
            const normalizedLimit = Math.max(1, parseInt(rawLimit || '100', 10) || 100);
            localStorage.setItem('chat_context_limit_' + realName, String(normalizedLimit));
            input.value = String(normalizedLimit);

            const normalizedSummaryLimit = normalizeMemorySummaryInput(summaryInput.value);
            localStorage.setItem(getSummaryLimitKey(realName), String(normalizedSummaryLimit));
            summaryInput.value = String(normalizedSummaryLimit);
            if (autoSummaryToggle) {
                localStorage.setItem(getAutoSummaryEnabledKey(realName), autoSummaryToggle.checked ? 'true' : 'false');
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
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            renderTokenDistribution(realName);
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

    if (runSummaryBtn) {
        runSummaryBtn.addEventListener('click', async () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const batchSize = normalizeMemorySummaryInput(summaryInput.value);
            summaryInput.value = String(batchSize);
            localStorage.setItem(getSummaryLimitKey(realName), String(batchSize));

            const originalText = runSummaryBtn.textContent;
            runSummaryBtn.textContent = '总结中...';
            runSummaryBtn.disabled = true;

            try {
                await runManualSummary(realName, batchSize);
                renderDiaryList(realName);
            } catch (error) {
                showApiErrorModal(error.message || '自动总结失败');
            } finally {
                runSummaryBtn.textContent = originalText;
                runSummaryBtn.disabled = false;
            }
        });
    }

    if (diaryListEl) {
        diaryListEl.addEventListener('click', (e) => {
            const item = e.target.closest('.memory-diary-item');
            if (!item) return;
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            openDiaryDetail(realName, item.dataset.id);
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

    if (saveDiaryDetailBtn) {
        saveDiaryDetailBtn.addEventListener('click', () => {
            if (!activeDiaryId) return;
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const diaries = getMemoryDiaries(realName);
            const idx = diaries.findIndex((item) => item.id === activeDiaryId);
            if (idx === -1) return;
            diaries[idx].content = diaryDetailContent.value.trim();
            setMemoryDiaries(realName, diaries);
            syncMemoryLongTerm(realName);
            renderDiaryList(realName);
            closeDiaryDetail();
        });
    }
}

// 12. 世界书绑定逻辑
function initWorldBookBindingLogic(chatRoomNameEl) {
    const selector = document.getElementById('worldbook-selector');
    const modal = document.getElementById('worldbook-binding-modal');
    const closeBtn = document.getElementById('close-worldbook-binding');
    const saveBtn = document.getElementById('save-worldbook-binding');
    const listContainer = document.getElementById('worldbook-binding-list');
    let selectedIdSet = new Set();
    
    // Open binding modal
    if (selector) {
        selector.addEventListener('click', () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            renderBindingList(realName);
            openAppModal(modal);
        });
    }

    // Close binding modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    // Save selection
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const selectedIds = Array.from(selectedIdSet);

            localStorage.setItem('chat_worldbooks_' + realName, JSON.stringify(selectedIds));
            renderSelectedWorldBooks(realName);
            closeAppModal(modal);
        });
    }

    function renderBindingList(realName) {
        const allItems = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
        const selectedIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + realName) || '[]')
            .map(id => String(id));
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
        allItems.forEach(item => {
            const category = normalizeCategoryName(item.category);
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category).push(item);
        });

        const storedCategories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]')
            .map(category => String(category || '').trim())
            .filter(Boolean)
            .filter(category => category !== '未分类');
        const categoryOrder = ['未分类', ...storedCategories];
        categoryMap.forEach((_, category) => {
            if (!categoryOrder.includes(category)) {
                categoryOrder.push(category);
            }
        });

        categoryOrder.forEach(category => {
            const categoryItems = categoryMap.get(category) || [];
            if (categoryItems.length === 0) return;

            const selectedCount = categoryItems.filter(item => selectedIdSet.has(String(item.id))).length;
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

        const categoryItems = allItems.filter(item => normalizeCategoryName(item.category) === category);
        if (categoryItems.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'binding-empty';
            empty.textContent = '该分类暂无世界书';
            listContainer.appendChild(empty);
            return;
        }

        categoryItems.forEach(item => {
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

function renderSelectedWorldBooks(realName) {
    const display = document.getElementById('selected-worldbooks-display');
    const placeholder = document.querySelector('.selector-placeholder');
    const selectedIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + realName) || '[]');
    const allItems = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
    
    if (display) display.innerHTML = '';
    
    if (selectedIds.length > 0) {
        if (placeholder) placeholder.style.display = 'none';
        selectedIds.forEach(id => {
            const item = allItems.find(i => i.id === id);
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

function getUnreadCountKey(realName) {
    return `chat_unread_count_${realName}`;
}

function getUnreadCount(realName) {
    return parseInt(localStorage.getItem(getUnreadCountKey(realName)) || '0', 10) || 0;
}

function setUnreadCount(realName, count) {
    const normalized = Math.max(0, parseInt(String(count), 10) || 0);
    localStorage.setItem(getUnreadCountKey(realName), String(normalized));
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

function getLatestChatMessageMeta(realName) {
    const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
    if (!Array.isArray(history) || history.length === 0) {
        return { message: null, ts: 0 };
    }
    let latest = null;
    history.forEach((msg, index) => {
        const rawTs = Number(msg && msg.ts);
        const sortKey = Number.isFinite(rawTs) ? rawTs : index;
        if (!latest || sortKey >= latest.sortKey) {
            latest = {
                message: msg,
                ts: Number.isFinite(rawTs) ? rawTs : 0,
                sortKey
            };
        }
    });
    return latest ? { message: latest.message, ts: latest.ts || 0 } : { message: null, ts: 0 };
}

function updateChatListItemPreview(realName, chatItem) {
    const chatListContainer = document.getElementById('line-chat-list');
    if (!chatListContainer) return;
    const selectorName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(realName) : realName;
    const item = chatItem || chatListContainer.querySelector(`.chat-list-item[data-real-name="${selectorName}"]`);
    if (!item) return;
    const meta = getLatestChatMessageMeta(realName);
    const preview = buildChatListPreviewFromMessage(meta.message);
    const msgEl = item.querySelector('.chat-item-msg');
    if (msgEl) {
        msgEl.textContent = preview || '点击开始聊天';
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

function refreshChatListPreviewFor(realName) {
    updateChatListItemPreview(realName);
    sortChatListByLastMessage();
    if (typeof saveGlobalData === 'function') {
        saveGlobalData();
    }
}

function refreshChatListPreviews() {
    const chatListContainer = document.getElementById('line-chat-list');
    if (!chatListContainer) return;
    chatListContainer.querySelectorAll('.chat-list-item').forEach((item) => {
        const realName = item.dataset.realName || item.querySelector('.chat-item-name')?.textContent || '';
        updateChatListItemPreview(realName, item);
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
        const realName = item.dataset.realName || item.querySelector('.chat-item-name')?.textContent || '';
        renderUnreadBadge(item, getUnreadCount(realName));
    });
}

// 保存全局数据（好友列表和聊天列表的结构）
function saveGlobalData() {
    // 保存好友列表
    const friendsList = [];
    document.querySelectorAll('#friends-list .group-subitem').forEach(item => {
        const name = item.dataset.realName || item.querySelector('span').textContent;
        friendsList.push(name);
    });
    localStorage.setItem('global_friends_list', JSON.stringify(friendsList));

    // 保存聊天列表
    const chatList = [];
    document.querySelectorAll('#line-chat-list .chat-list-item').forEach(item => {
        const name = item.dataset.realName || item.querySelector('.chat-item-name').textContent;
        chatList.push(name);
    });
    localStorage.setItem('global_chat_list', JSON.stringify(chatList));
}

// 7. 全局数据加载与持久化
function initGlobalPersistence() {
    const placeholderFriends = new Set(['Alice', 'Bob']);

    // 1. 恢复好友列表
    const rawSavedFriends = JSON.parse(localStorage.getItem('global_friends_list'));
    const savedFriends = Array.isArray(rawSavedFriends)
        ? rawSavedFriends.filter(name => !placeholderFriends.has(String(name || '').trim()))
        : rawSavedFriends;
    if (Array.isArray(rawSavedFriends) && JSON.stringify(rawSavedFriends) !== JSON.stringify(savedFriends)) {
        localStorage.setItem('global_friends_list', JSON.stringify(savedFriends));
    }
    const friendsListContainer = document.getElementById('friends-list');
    
    if (savedFriends && friendsListContainer) {
        friendsListContainer.innerHTML = ''; // 清空现有（静态）列表，完全由 storage 重建
        savedFriends.forEach(realName => {
            // 获取备注和头像
            const remark = localStorage.getItem('chat_remark_' + realName);
            const avatar = localStorage.getItem('chat_avatar_' + realName);
            const displayName = remark || realName;
            
            const item = document.createElement('div');
            item.className = 'group-subitem';
            item.dataset.realName = realName; // 关键：存储真名
            
            let avatarHtml = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            if (avatar) {
                avatarHtml = `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            }
            
            item.innerHTML = `
                <div class="subitem-avatar">
                    ${avatarHtml}
                </div>
                <span>${displayName}</span>
            `;
            friendsListContainer.appendChild(item);
        });
    } else if (friendsListContainer) {
        // 如果没有保存过（第一次运行），则初始化 dataset.realName 为当前静态 HTML 的内容
        friendsListContainer.querySelectorAll('.group-subitem').forEach(item => {
            const span = item.querySelector('span');
            item.dataset.realName = span.textContent;
        });
        saveGlobalData(); // 保存初始状态
    }

    // 2. 恢复聊天列表
    const rawSavedChats = JSON.parse(localStorage.getItem('global_chat_list'));
    const savedChats = Array.isArray(rawSavedChats)
        ? rawSavedChats.filter(name => !placeholderFriends.has(String(name || '').trim()))
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
            savedChats.forEach(realName => {
                const remark = localStorage.getItem('chat_remark_' + realName);
                const avatar = localStorage.getItem('chat_avatar_' + realName);
                const displayName = remark || realName;
                
                const item = document.createElement('div');
                item.className = 'chat-list-item';
                item.dataset.realName = realName;
                const unreadCount = getUnreadCount(realName);
                
                let avatarHtml = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
                if (avatar) {
                    avatarHtml = `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }

                item.innerHTML = `
                    <div class="chat-item-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="chat-item-info">
                        <div class="chat-item-name">${displayName}</div>
                        <div class="chat-item-msg">点击开始聊天</div>
                    </div>
                    <div class="chat-item-unread ${unreadCount > 0 ? '' : 'hidden'}">${unreadCount > 99 ? '99+' : unreadCount}</div>
                `;
                chatListContainer.appendChild(item);
            });
        }
    }

    refreshChatListPreviews();
    refreshAllUnreadBadges();
}

// 8. 添加好友/聊天逻辑
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

    // 打开弹窗
    if (addChatBtn) {
        addChatBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            nameInput.value = '';
            remarkInput.value = '';
            nameInput.focus();
        });
    }

    // 关闭弹窗
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // 点击遮罩层关闭弹窗
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // 确认添加
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const remark = remarkInput.value.trim();
            
            if (!name) {
                alert('请输入名字');
                return;
            }

            const displayName = remark || name; // 优先显示备注名
            // 保存备注（如果添加时就有备注）
            if (remark) {
                localStorage.setItem('chat_remark_' + name, remark);
            }

            // 1. 添加到好友列表
            const friendItem = document.createElement('div');
            friendItem.className = 'group-subitem';
            // 关键：设置 dataset.realName
            friendItem.dataset.realName = name;
            
            friendItem.innerHTML = `
                <div class="subitem-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                <span>${displayName}</span>
            `;
            // 插入到好友列表最前面
            if (friendsList) {
                friendsList.insertBefore(friendItem, friendsList.firstChild);
                // 确保好友分组是展开的，方便用户看到
                const friendGroupItem = document.querySelector('.line-group-item[data-target="friends-list"]');
                if (friendGroupItem && !friendGroupItem.classList.contains('active')) {
                    friendGroupItem.click(); // 模拟点击展开
                }
            }

            // 2. 添加到聊天列表
            if (emptyPlaceholder) {
                emptyPlaceholder.style.display = 'none';
            }
            
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-list-item';
            // 关键：设置 dataset.realName
            chatItem.dataset.realName = name;
            
            chatItem.innerHTML = `
                <div class="chat-item-avatar">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-name">${displayName}</div>
                    <div class="chat-item-msg">开始聊天吧</div>
                </div>
                <div class="chat-item-unread hidden"></div>
            `;
            if (chatList) {
                chatList.insertBefore(chatItem, chatList.firstChild);
            }
            refreshChatListPreviewFor(name);
            
            // 3. 立即触发全局保存
            saveGlobalData();

            // 关闭弹窗
            modal.style.display = 'none';
        });
    }
}

const worldbookMultiSelectState = {
    enabled: false,
    selectedIds: new Set()
};

function getActiveWorldbookCategory() {
    const activeTag = document.querySelector('.worldbook-categories .category-tag.active');
    return activeTag ? activeTag.textContent : '未分类';
}

function updateWorldbookDeleteActionButtonState() {
    const deleteActionBtn = document.getElementById('worldbook-delete-action-btn');
    if (!deleteActionBtn) return;
    const count = worldbookMultiSelectState.selectedIds.size;
    deleteActionBtn.disabled = count === 0;
}

function updateWorldbookMultiSelectUI() {
    const modal = document.getElementById('worldbook-modal');
    const deleteActionBtn = document.getElementById('worldbook-delete-action-btn');
    const deleteToggleBtn = document.getElementById('worldbook-batch-delete-btn');
    const enabled = worldbookMultiSelectState.enabled;
    if (modal) {
        modal.classList.toggle('worldbook-multi-select', enabled);
    }
    if (deleteActionBtn) {
        deleteActionBtn.classList.toggle('hidden', !enabled);
    }
    if (deleteToggleBtn) {
        deleteToggleBtn.classList.toggle('active', enabled);
    }
    updateWorldbookDeleteActionButtonState();
}

function setWorldbookMultiSelectEnabled(enabled) {
    worldbookMultiSelectState.enabled = !!enabled;
    if (!worldbookMultiSelectState.enabled) {
        worldbookMultiSelectState.selectedIds.clear();
    }
    updateWorldbookMultiSelectUI();
    renderWorldBookList(getActiveWorldbookCategory());
}

function toggleWorldbookSelection(id) {
    if (!id) return;
    if (worldbookMultiSelectState.selectedIds.has(id)) {
        worldbookMultiSelectState.selectedIds.delete(id);
    } else {
        worldbookMultiSelectState.selectedIds.add(id);
    }
    updateWorldbookDeleteActionButtonState();
}

function removeWorldbookItemsByIds(ids) {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map(String));
    if (idSet.size === 0) return;
    const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
    const remaining = items.filter(item => !idSet.has(String(item.id)));
    localStorage.setItem('worldbook_items', JSON.stringify(remaining));

    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chat_worldbooks_')) {
            keys.push(key);
        }
    }
    keys.forEach((key) => {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(raw)) return;
        const next = raw.filter((itemId) => !idSet.has(String(itemId)));
        if (JSON.stringify(raw) !== JSON.stringify(next)) {
            localStorage.setItem(key, JSON.stringify(next));
        }
    });
}

// 9. 世界书功能逻辑
function initWorldBookApp() {
    const appWorldBook = document.getElementById('app-worldbook');
    const modal = document.getElementById('worldbook-modal');
    const closeBtn = document.getElementById('close-worldbook');
    const saveBtn = document.getElementById('save-worldbook');
    const batchDeleteBtn = document.getElementById('worldbook-batch-delete-btn');
    const deleteActionBtn = document.getElementById('worldbook-delete-action-btn');
    const deleteModal = document.getElementById('worldbook-batch-delete-modal');
    const deleteModalText = document.getElementById('worldbook-batch-delete-text');
    const closeDeleteModalBtn = document.getElementById('close-worldbook-batch-delete');
    const cancelDeleteModalBtn = document.getElementById('cancel-worldbook-batch-delete');
    const confirmDeleteModalBtn = document.getElementById('confirm-worldbook-batch-delete');
    
    // 打开世界书
    if (appWorldBook) {
        appWorldBook.addEventListener('click', () => {
            openAppModal(modal);
        });
    }

    // 关闭世界书
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (worldbookMultiSelectState.enabled) {
                setWorldbookMultiSelectEnabled(false);
            }
            closeAppModal(modal);
        });
    }

    // 保存功能 (暂时只是关闭)
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            closeAppModal(modal);
        });
    }

    // 分类标签切换
    const tagsContainer = document.querySelector('.worldbook-categories');
    
    // Initial category load
    loadCategories();

    // Event delegation for category tags
    tagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-tag')) {
            const tags = document.querySelectorAll('.category-tag');
            tags.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            if (worldbookMultiSelectState.enabled) {
                worldbookMultiSelectState.selectedIds.clear();
                updateWorldbookDeleteActionButtonState();
            }
            renderWorldBookList(e.target.textContent);
        }
    });

    initAddWorldBookItemLogic();
    initCategoryManagerLogic();
    initWorldBookImportLogic();

    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', () => {
            setWorldbookMultiSelectEnabled(!worldbookMultiSelectState.enabled);
        });
    }

    if (deleteActionBtn) {
        deleteActionBtn.addEventListener('click', () => {
            if (worldbookMultiSelectState.selectedIds.size === 0) {
                alert('请先选择要删除的世界书');
                return;
            }
            if (deleteModalText) {
                deleteModalText.textContent = `确定删除选中的 ${worldbookMultiSelectState.selectedIds.size} 条世界书吗？`;
            }
            if (deleteModal) {
                deleteModal.style.display = 'flex';
                setTimeout(() => deleteModal.classList.add('active'), 10);
            }
        });
    }

    const closeDeleteModal = () => {
        if (!deleteModal) return;
        deleteModal.classList.remove('active');
        setTimeout(() => {
            deleteModal.style.display = 'none';
        }, 300);
    };

    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }

    if (closeDeleteModalBtn) {
        closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    }

    if (cancelDeleteModalBtn) {
        cancelDeleteModalBtn.addEventListener('click', closeDeleteModal);
    }

    if (confirmDeleteModalBtn) {
        confirmDeleteModalBtn.addEventListener('click', () => {
            const ids = Array.from(worldbookMultiSelectState.selectedIds);
            if (ids.length === 0) {
                closeDeleteModal();
                return;
            }
            removeWorldbookItemsByIds(ids);
            closeDeleteModal();
            setWorldbookMultiSelectEnabled(false);
            renderWorldBookList(getActiveWorldbookCategory());
            updateCategoryDropdown();
        });
    }
    
    // Initial render
    renderWorldBookList('未分类');
}

// 加载分类标签
function loadCategories() {
    const container = document.querySelector('.worldbook-categories');
    // 修改默认值为空数组，因为 '未分类' 是硬编码在 HTML 里的第一个
    const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]'); 
    
    // Always start with '未分类'
    let html = `<div class="category-tag active">未分类</div>`;
    categories.forEach(cat => {
        html += `<div class="category-tag">${cat}</div>`;
    });
    container.innerHTML = html;
}

// 11. 分类管理逻辑
function initCategoryManagerLogic() {
    const manageBtn = document.getElementById('manage-categories-btn');
    const modal = document.getElementById('category-manager-modal');
    const closeBtn = document.getElementById('close-category-manager');
    const addBtn = document.getElementById('add-category-btn');
    const input = document.getElementById('new-category-input');
    const listContainer = document.querySelector('.category-list');

    // 打开管理页面
    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            renderCategoryList();
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });
    }

    // 关闭页面
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
            
            // Refresh main view categories and list
            loadCategories();
            renderWorldBookList('未分类');
            
            // Refresh add item dropdown
            updateCategoryDropdown();
        });
    }

    // 添加分类
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (!name) return;
            
            if (name === '未分类') {
                alert('此分类名为系统保留');
                return;
            }

            const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
            if (categories.includes(name)) {
                alert('分类已存在');
                return;
            }

            categories.push(name);
            localStorage.setItem('worldbook_categories', JSON.stringify(categories));
            
            input.value = '';
            renderCategoryList();
        });
    }

    // 渲染分类列表 (管理页)
    function renderCategoryList() {
        const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
        listContainer.innerHTML = '';
        
        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <span class="category-item-name">${cat}</span>
                <button class="delete-category-btn" data-category="${cat}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;
            listContainer.appendChild(item);
        });

        // Bind delete events
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const catToDelete = btn.dataset.category;
                if (confirm(`确定删除分类 "${catToDelete}" 吗？该分类下的世界书将被全部删除。`)) {
                    deleteCategory(catToDelete);
                }
            });
        });
    }

    function deleteCategory(category) {
        let categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
        categories = categories.filter(c => c !== category);
        localStorage.setItem('worldbook_categories', JSON.stringify(categories));
        
        const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
        const idsToDelete = items.filter(item => item.category === category).map(item => item.id);
        if (idsToDelete.length > 0) {
            removeWorldbookItemsByIds(idsToDelete);
        }

        renderCategoryList();
    }
}

// Helper to update dropdown in Add/Edit modal
function updateCategoryDropdown() {
    const select = document.getElementById('wb-item-category');
    if (!select) return;
    
    const currentVal = select.value;
    const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
    
    let html = `<option value="未分类">未分类</option>`;
    categories.forEach(cat => {
        html += `<option value="${cat}">${cat}</option>`;
    });
    
    select.innerHTML = html;
    // Restore value if it still exists, else '未分类'
    if (categories.includes(currentVal) || currentVal === '未分类') {
        select.value = currentVal;
    } else {
        select.value = '未分类';
    }
}

function initWorldBookImportLogic() {
    const importBtn = document.getElementById('import-worldbook-btn');
    const fileInput = document.getElementById('import-worldbook-input');
    const importModal = document.getElementById('worldbook-import-modal');
    const closeBtn = document.getElementById('close-worldbook-import-modal');
    const saveBtn = document.getElementById('confirm-worldbook-import-btn');
    const categoryInput = document.getElementById('worldbook-import-category-input');
    const nameInput = document.getElementById('worldbook-import-name-input');

    if (!importBtn || !fileInput || !importModal || !closeBtn || !saveBtn || !categoryInput || !nameInput) return;

    let pendingImport = null;

    importBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
            const parsed = await parseWorldbookFile(file);
            const filename = file.name.replace(/\.[^.]+$/, '') || '导入内容';
            pendingImport = { name: filename, content: parsed };
            updateWorldbookImportCategoryOptions();
            nameInput.value = filename;
            importModal.style.display = 'flex';
            setTimeout(() => importModal.classList.add('active'), 10);
            setTimeout(() => categoryInput.focus(), 0);
        } catch (error) {
            showApiErrorModal(error.message || '导入失败');
        } finally {
            fileInput.value = '';
        }
    });

    const closeImportModal = () => {
        importModal.classList.remove('active');
        setTimeout(() => {
            importModal.style.display = 'none';
        }, 300);
        pendingImport = null;
    };

    closeBtn.addEventListener('click', closeImportModal);
    importModal.addEventListener('click', (e) => {
        if (e.target === importModal) closeImportModal();
    });

    saveBtn.addEventListener('click', () => {
        if (!pendingImport) return;
        const categoryName = String(categoryInput.value || '').trim();
        const worldbookName = nameInput.value.trim();
        if (!categoryName) {
            showApiErrorModal('请填写分类名称');
            return;
        }
        if (!worldbookName) {
            showApiErrorModal('请填写世界书名称');
            return;
        }

        const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
        if (categoryName !== '未分类' && !categories.includes(categoryName)) {
            showApiErrorModal('分类不存在，请先创建分类');
            return;
        }

        const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
        items.push({
            id: crypto.randomUUID(),
            name: worldbookName,
            category: categoryName,
            content: pendingImport.content
        });
        localStorage.setItem('worldbook_items', JSON.stringify(items));

        loadCategories();
        setActiveWorldbookCategory(categoryName);
        renderWorldBookList(categoryName);
        updateCategoryDropdown();
        updateWorldbookImportCategoryOptions();
        closeImportModal();
    });

    async function parseWorldbookFile(file) {
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.docx')) {
            if (!window.mammoth || !window.mammoth.extractRawText) {
                throw new Error('未找到 docx 解析器');
            }
            const arrayBuffer = await readFileAsArrayBuffer(file);
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            const text = String(result.value || '').trim();
            if (!text) {
                throw new Error('文件内容为空');
            }
            return text;
        }

        const text = await readFileAsText(file);
        const cleaned = String(text || '').trim();
        if (!cleaned) {
            throw new Error('文件内容为空');
        }
        return cleaned;
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function updateWorldbookImportCategoryOptions() {
        if (!categoryInput) return;
        const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
        const currentVal = categoryInput.value || '未分类';
        let html = `<option value="未分类">未分类</option>`;
        categories.forEach(cat => {
            html += `<option value="${cat}">${cat}</option>`;
        });
        categoryInput.innerHTML = html;
        if (categories.includes(currentVal) || currentVal === '未分类') {
            categoryInput.value = currentVal;
        } else {
            categoryInput.value = '未分类';
        }
    }
}

function setActiveWorldbookCategory(categoryName) {
    const tags = document.querySelectorAll('.worldbook-categories .category-tag');
    tags.forEach(tag => {
        tag.classList.toggle('active', tag.textContent === categoryName);
    });
}

// 渲染世界书列表
function renderWorldBookList(filterCategory = '未分类') {
    const listContainer = document.querySelector('.worldbook-list');
    const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
    
    listContainer.innerHTML = '';
    
    const filteredItems = items.filter(item => {
        // Strict filtering: ONLY show items belonging to the selected category
        return item.category === filterCategory;
    });

    const isMultiSelect = worldbookMultiSelectState.enabled;
    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'wb-item-card';
        card.dataset.id = item.id;
        if (isMultiSelect) {
            card.classList.add('selectable');
            if (worldbookMultiSelectState.selectedIds.has(item.id)) {
                card.classList.add('selected');
            }
            card.innerHTML = `
                <div class="wb-item-select"></div>
                <div class="wb-item-name">${item.name}</div>
                <div class="wb-item-category">${item.category}</div>
            `;
            card.addEventListener('click', () => {
                toggleWorldbookSelection(item.id);
                card.classList.toggle('selected', worldbookMultiSelectState.selectedIds.has(item.id));
            });
        } else {
            card.innerHTML = `
                <div class="wb-item-name">${item.name}</div>
                <div class="wb-item-category">${item.category}</div>
            `;
            card.addEventListener('click', () => {
                openWorldBookItem(item.id);
            });
        }
        listContainer.appendChild(card);
    });
}

// 10. 添加/编辑世界书条目逻辑
function initAddWorldBookItemLogic() {
    const addBtn = document.getElementById('add-worldbook-item-btn');
    const modal = document.getElementById('add-worldbook-item-modal');
    const closeBtn = document.getElementById('close-add-worldbook-item');
    const saveBtn = document.getElementById('save-worldbook-item');
    const modalTitle = modal.querySelector('.header-title');
    
    // 输入框
    const nameInput = document.getElementById('wb-item-name');
    const categorySelect = document.getElementById('wb-item-category');
    const keywordsInput = document.getElementById('wb-item-keywords');
    const contentInput = document.getElementById('wb-item-content');

    // 打开添加页面 (Add Mode)
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            // Update dropdown categories first
            updateCategoryDropdown();
            
            // Reset to Add Mode
            modal.dataset.mode = 'add';
            modal.dataset.itemId = '';
            modalTitle.textContent = '添加条目';
            
            // 重置表单
            nameInput.value = '';
            categorySelect.value = '未分类';
            keywordsInput.value = '';
            contentInput.value = '';
            
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });
    }

    // 关闭添加页面
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        });
    }

    // 保存条目 (Add or Update)
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const category = categorySelect.value;
            const keywords = keywordsInput.value.trim();
            const content = contentInput.value.trim();

            if (!name) {
                alert('请输入条目名称');
                return;
            }

            const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
            
            if (modal.dataset.mode === 'edit' && modal.dataset.itemId) {
                // Update existing item
                const index = items.findIndex(item => item.id === modal.dataset.itemId);
                if (index !== -1) {
                    items[index] = {
                        ...items[index],
                        name,
                        category,
                        keywords,
                        content,
                        updatedAt: Date.now().toString()
                    };
                }
            } else {
                // Add new item
                const newItem = {
                    id: Date.now().toString(),
                    name,
                    category,
                    keywords,
                    content,
                    createdAt: Date.now().toString()
                };
                items.push(newItem);
            }

            localStorage.setItem('worldbook_items', JSON.stringify(items));

            // 刷新列表 (如果当前在对应分类下)
            const activeTag = document.querySelector('.category-tag.active');
            if (activeTag && (activeTag.textContent === category || activeTag.textContent === '未分类')) {
                 renderWorldBookList(activeTag.textContent);
            } else {
                // If category changed, maybe switch tab or just refresh current tab (item disappears from current view)
                // For simplicity, refresh current view
                renderWorldBookList(activeTag ? activeTag.textContent : '未分类');
            }

            // 关闭页面
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        });
    }
}

// 打开条目进行编辑 (Global helper)
function openWorldBookItem(id) {
    const modal = document.getElementById('add-worldbook-item-modal');
    const modalTitle = modal.querySelector('.header-title');
    
    const nameInput = document.getElementById('wb-item-name');
    const categorySelect = document.getElementById('wb-item-category');
    const keywordsInput = document.getElementById('wb-item-keywords');
    const contentInput = document.getElementById('wb-item-content');

    const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
    const item = items.find(i => i.id === id);

    if (item) {
        // Update dropdown categories first
        updateCategoryDropdown();
        
        // Set Edit Mode
        modal.dataset.mode = 'edit';
        modal.dataset.itemId = item.id;
        modalTitle.textContent = item.name; // Title becomes item name

        // Populate fields
        nameInput.value = item.name;
        // Ensure category exists in dropdown, else fallback or add it temporary?
        // updateCategoryDropdown handles '未分类' fallback if category deleted.
        // But if item has a valid category, it should be selected.
        categorySelect.value = item.category;
        
        keywordsInput.value = item.keywords || '';
        contentInput.value = item.content || '';

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function getRandomColor() {
    const colors = ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#AC8E68', '#64D2FF'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 13. 外观设置 App 功能
function initAppearanceSettings() {
    const appAppearance = document.getElementById('dock-appearance');
    const appearanceModal = document.getElementById('appearance-modal');
    const closeAppearanceBtn = document.getElementById('close-appearance');
    const saveAppearanceBtn = document.getElementById('save-appearance');
    const uploadWallpaperBtn = document.getElementById('upload-wallpaper-btn');
    const wallpaperFileInput = document.getElementById('wallpaper-file-input');
    const homeScreen = document.getElementById('home-screen');
    const phoneScreen = document.getElementById('phone-screen');
    const fontUrlInput = document.getElementById('global-font-url-input');
    const applyFontBtn = document.getElementById('apply-global-font-btn');
    const fontPreview = document.getElementById('global-font-preview');
    const fontSizeSlider = document.getElementById('global-font-size-slider');
    const fontSizeValue = document.getElementById('global-font-size-value');
    const fontPresetSelect = document.getElementById('global-font-preset-select');
    const saveFontPresetBtn = document.getElementById('save-global-font-preset-btn');
    const manageFontPresetBtn = document.getElementById('manage-global-font-preset-btn');
    const fontPresetNameModal = document.getElementById('font-preset-name-modal');
    const closeFontPresetNameModalBtn = document.getElementById('close-font-preset-name-modal');
    const fontPresetNameInput = document.getElementById('font-preset-name-input');
    const confirmFontPresetSaveBtn = document.getElementById('confirm-font-preset-save-btn');
    const fontPresetManageModal = document.getElementById('font-preset-manage-modal');
    const closeFontPresetManageModalBtn = document.getElementById('close-font-preset-manage-modal');
    const fontPresetManageList = document.getElementById('font-preset-manage-list');
    const fontPresetStorageKey = 'global_font_presets_v1';
    const fontUrlStorageKey = 'global_font_url';
    const fontFamilyStorageKey = 'global_font_family';
    const fontSizeStorageKey = 'global_font_size_px';
    const fontCssLinkId = 'global-font-css-link';
    const defaultFontSize = 16;

    const showMessage = (message) => {
        if (typeof showApiErrorModal === 'function') {
            showApiErrorModal(message);
            return;
        }
        alert(message);
    };

    const applyWallpaper = (imageDataUrl) => {
        if (!imageDataUrl || !phoneScreen) return;
        phoneScreen.style.backgroundImage = `url('${imageDataUrl}')`;
        phoneScreen.style.backgroundSize = 'cover';
        phoneScreen.style.backgroundPosition = 'center';
        phoneScreen.style.backgroundRepeat = 'no-repeat';
        if (homeScreen) {
            homeScreen.style.background = 'transparent';
        }
    };

    const getFontPresets = () => {
        try {
            const raw = localStorage.getItem(fontPresetStorageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(item => item && item.id && item.name && item.url);
        } catch (error) {
            return [];
        }
    };

    const setFontPresets = (presets) => {
        localStorage.setItem(fontPresetStorageKey, JSON.stringify(presets));
    };

    const openOverlay = (overlay) => {
        if (!overlay) return;
        overlay.style.display = 'flex';
    };

    const closeOverlay = (overlay) => {
        if (!overlay) return;
        overlay.style.display = 'none';
    };

    const extractFamilyFromGoogleUrl = (url) => {
        try {
            const parsedUrl = new URL(url);
            const familyParam = parsedUrl.searchParams.get('family');
            if (!familyParam) return '';
            const firstFamily = familyParam.split('|')[0];
            const familyName = firstFamily.split(':')[0].replace(/\+/g, ' ').trim();
            return familyName;
        } catch (error) {
            return '';
        }
    };

    const inferFontFormatFromUrl = (url) => {
        try {
            const pathname = new URL(url).pathname.toLowerCase();
            if (pathname.endsWith('.woff2')) return 'woff2';
            if (pathname.endsWith('.woff')) return 'woff';
            if (pathname.endsWith('.otf')) return 'opentype';
            if (pathname.endsWith('.ttf')) return 'truetype';
            return '';
        } catch (error) {
            return '';
        }
    };

    const normalizeFontSize = (value) => {
        const size = Number.parseInt(String(value), 10);
        if (Number.isNaN(size)) return defaultFontSize;
        return Math.min(28, Math.max(12, size));
    };

    const updateSliderTrack = (value) => {
        if (!fontSizeSlider) return;
        const min = Number.parseFloat(fontSizeSlider.min || '12');
        const max = Number.parseFloat(fontSizeSlider.max || '28');
        const percent = ((value - min) / (max - min)) * 100;
        fontSizeSlider.style.background = `linear-gradient(to right, #1d1d1f 0%, #1d1d1f ${percent}%, #e5e5ea ${percent}%, #e5e5ea 100%)`;
    };

    const renderPreviewFont = (familyName) => {
        if (!fontPreview) return;
        if (!familyName) {
            fontPreview.style.fontFamily = '';
            return;
        }
        fontPreview.style.fontFamily = `${familyName}, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`;
    };

    const renderPreviewFontSize = (size) => {
        if (fontPreview) {
            fontPreview.style.fontSize = `${size}px`;
        }
        if (fontSizeValue) {
            fontSizeValue.textContent = `${size}px`;
        }
        if (fontSizeSlider) {
            fontSizeSlider.value = String(size);
        }
        updateSliderTrack(size);
    };

    const applyGlobalFontFamily = (familyName) => {
        if (!familyName) return;
        const family = `${familyName}, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`;
        document.documentElement.style.fontFamily = family;
        document.body.style.fontFamily = family;
        localStorage.setItem(fontFamilyStorageKey, familyName);
        renderPreviewFont(familyName);
    };

    const applyGlobalFontSize = (sizeValue) => {
        const size = normalizeFontSize(sizeValue);
        document.documentElement.style.fontSize = `${size}px`;
        localStorage.setItem(fontSizeStorageKey, String(size));
        renderPreviewFontSize(size);
    };

    const renderFontPresetOptions = (selectedId = '') => {
        if (!fontPresetSelect) return;
        const presets = getFontPresets();
        fontPresetSelect.innerHTML = '<option value="">选择字体预设...</option>';
        presets.forEach((preset) => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            fontPresetSelect.appendChild(option);
        });
        if (selectedId && presets.some(item => item.id === selectedId)) {
            fontPresetSelect.value = selectedId;
        }
    };

    const renderManagePresetList = () => {
        if (!fontPresetManageList) return;
        const presets = getFontPresets();
        if (presets.length === 0) {
            fontPresetManageList.innerHTML = '<div class="api-error-message">暂无字体预设</div>';
            return;
        }

        fontPresetManageList.innerHTML = presets.map((preset) => `
            <div class="font-preset-manage-item" data-preset-id="${preset.id}">
                <div class="font-preset-meta">
                    <div class="font-preset-name">${preset.name}</div>
                    <div class="font-preset-url">${preset.url}</div>
                </div>
                <button class="font-preset-delete-btn" type="button">删除</button>
            </div>
        `).join('');
    };

    const ensureCssLink = (url) => {
        let linkEl = document.getElementById(fontCssLinkId);
        if (!linkEl) {
            linkEl = document.createElement('link');
            linkEl.rel = 'stylesheet';
            linkEl.id = fontCssLinkId;
            document.head.appendChild(linkEl);
        }
        linkEl.href = url;
    };

    const loadAndApplyGlobalFont = async (url, preferredFamily = '') => {
        if (!/^https?:\/\//i.test(url)) {
            throw new Error('请输入有效字体 URL');
        }

        const cssUrl = /\.css($|\?)/i.test(url) || /fonts\.googleapis\.com/i.test(url);
        let resolvedFamily = preferredFamily.trim();

        if (cssUrl) {
            ensureCssLink(url);
            if (!resolvedFamily) {
                resolvedFamily = extractFamilyFromGoogleUrl(url);
            }
            if (!resolvedFamily) {
                throw new Error('该链接无法自动识别字体名称，请先保存预设后再应用');
            }
            applyGlobalFontFamily(resolvedFamily);
            return resolvedFamily;
        }

        if (!resolvedFamily) {
            resolvedFamily = `GlobalFont${Date.now()}`;
        }

        const format = inferFontFormatFromUrl(url);
        const source = format ? `url("${url}") format("${format}")` : `url("${url}")`;
        const fontFace = new FontFace(resolvedFamily, source);
        const loadedFont = await fontFace.load();
        document.fonts.add(loadedFont);
        await document.fonts.load(`16px "${resolvedFamily}"`);
        applyGlobalFontFamily(resolvedFamily);
        return resolvedFamily;
    };

    const syncFontInputFromPreset = (presetId) => {
        const presets = getFontPresets();
        const selectedPreset = presets.find(item => item.id === presetId);
        if (!selectedPreset || !fontUrlInput) return;
        fontUrlInput.value = selectedPreset.url;
        fontUrlInput.dataset.family = selectedPreset.family || '';
    };

    if (wallpaperFileInput) {
        wallpaperFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const imageDataUrl = event.target.result;
                applyWallpaper(imageDataUrl);

                try {
                    localStorage.setItem('home_wallpaper', imageDataUrl);
                } catch (err) {
                    console.error('Failed to save wallpaper to localStorage:', err);
                    alert('图片太大，无法保存到本地存储，但本次会话有效。');
                }
            };
            reader.readAsDataURL(file);
            wallpaperFileInput.value = '';
        });
    }

    const savedWallpaper = localStorage.getItem('home_wallpaper');
    if (savedWallpaper) {
        applyWallpaper(savedWallpaper);
    }

    const savedFontUrl = localStorage.getItem(fontUrlStorageKey) || '';
    const savedFontFamily = localStorage.getItem(fontFamilyStorageKey) || '';
    const savedFontSize = normalizeFontSize(localStorage.getItem(fontSizeStorageKey) || defaultFontSize);
    if (savedFontFamily) {
        applyGlobalFontFamily(savedFontFamily);
    }
    applyGlobalFontSize(savedFontSize);
    if (savedFontUrl) {
        loadAndApplyGlobalFont(savedFontUrl, savedFontFamily).catch(() => {
            if (savedFontFamily) {
                applyGlobalFontFamily(savedFontFamily);
            }
        });
    }
    if (fontUrlInput) {
        fontUrlInput.value = savedFontUrl;
        fontUrlInput.dataset.family = savedFontFamily;
    }
    renderFontPresetOptions();

    if (appAppearance && appearanceModal) {
        appAppearance.addEventListener('click', () => {
            if (fontUrlInput) {
                fontUrlInput.value = localStorage.getItem(fontUrlStorageKey) || '';
                fontUrlInput.dataset.family = localStorage.getItem(fontFamilyStorageKey) || '';
            }
            renderPreviewFont(localStorage.getItem(fontFamilyStorageKey) || '');
            renderPreviewFontSize(normalizeFontSize(localStorage.getItem(fontSizeStorageKey) || defaultFontSize));
            renderFontPresetOptions();
            openAppModal(appearanceModal);
        });
    }

    if (closeAppearanceBtn && appearanceModal) {
        closeAppearanceBtn.addEventListener('click', () => {
            closeAppModal(appearanceModal);
        });
    }

    if (saveAppearanceBtn && appearanceModal) {
        saveAppearanceBtn.addEventListener('click', () => {
            closeAppModal(appearanceModal);
        });
    }

    if (uploadWallpaperBtn && wallpaperFileInput) {
        uploadWallpaperBtn.addEventListener('click', () => {
            wallpaperFileInput.click();
        });
    }

    if (applyFontBtn && fontUrlInput) {
        applyFontBtn.addEventListener('click', async () => {
            const url = fontUrlInput.value.trim();
            if (!url) {
                showMessage('请先输入字体 URL');
                return;
            }

            const fallbackText = applyFontBtn.textContent;
            applyFontBtn.textContent = '应用中';
            applyFontBtn.disabled = true;

            try {
                const family = await loadAndApplyGlobalFont(url, fontUrlInput.dataset.family || '');
                localStorage.setItem(fontUrlStorageKey, url);
                localStorage.setItem(fontFamilyStorageKey, family);
                fontUrlInput.dataset.family = family;
                applyFontBtn.textContent = '已应用';
                setTimeout(() => {
                    applyFontBtn.textContent = fallbackText;
                    applyFontBtn.disabled = false;
                }, 700);
            } catch (error) {
                const message = error && error.message ? error.message : '字体应用失败';
                showMessage(`${message}。请确认链接可直接访问字体文件（.ttf/.otf/.woff/.woff2）或可用字体 CSS。`);
                applyFontBtn.textContent = fallbackText;
                applyFontBtn.disabled = false;
            }
        });
    }

    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', () => {
            const size = normalizeFontSize(fontSizeSlider.value);
            applyGlobalFontSize(size);
        });
    }

    if (fontPresetSelect) {
        fontPresetSelect.addEventListener('change', () => {
            const presetId = fontPresetSelect.value;
            if (!presetId || !fontUrlInput) return;
            syncFontInputFromPreset(presetId);
        });
    }

    if (saveFontPresetBtn && fontPresetNameModal && fontUrlInput && fontPresetNameInput) {
        saveFontPresetBtn.addEventListener('click', () => {
            const url = fontUrlInput.value.trim();
            if (!url) {
                showMessage('请先填写字体 URL');
                return;
            }
            fontPresetNameInput.value = '';
            openOverlay(fontPresetNameModal);
            setTimeout(() => fontPresetNameInput.focus(), 0);
        });
    }

    if (closeFontPresetNameModalBtn && fontPresetNameModal) {
        closeFontPresetNameModalBtn.addEventListener('click', () => {
            closeOverlay(fontPresetNameModal);
        });
    }

    if (confirmFontPresetSaveBtn && fontPresetNameInput && fontUrlInput) {
        confirmFontPresetSaveBtn.addEventListener('click', () => {
            const name = fontPresetNameInput.value.trim();
            const url = fontUrlInput.value.trim();
            if (!name) {
                showMessage('请输入字体名字');
                return;
            }
            if (!url) {
                showMessage('请先填写字体 URL');
                return;
            }

            const family = (fontUrlInput.dataset.family || '').trim() || extractFamilyFromGoogleUrl(url) || '';
            const presets = getFontPresets();
            const existed = presets.find(item => item.name === name || item.url === url);
            const nextPreset = existed ? {
                ...existed,
                name,
                url,
                family
            } : {
                id: `font_${Date.now()}`,
                name,
                url,
                family
            };
            const nextPresets = presets.filter(item => item.id !== nextPreset.id);
            nextPresets.unshift(nextPreset);
            setFontPresets(nextPresets);
            renderFontPresetOptions(nextPreset.id);
            closeOverlay(fontPresetNameModal);
        });
    }

    if (manageFontPresetBtn && fontPresetManageModal) {
        manageFontPresetBtn.addEventListener('click', () => {
            renderManagePresetList();
            openOverlay(fontPresetManageModal);
        });
    }

    if (closeFontPresetManageModalBtn && fontPresetManageModal) {
        closeFontPresetManageModalBtn.addEventListener('click', () => {
            closeOverlay(fontPresetManageModal);
        });
    }

    if (fontPresetManageList && fontUrlInput) {
        fontPresetManageList.addEventListener('click', (event) => {
            const deleteBtn = event.target.closest('.font-preset-delete-btn');
            if (!deleteBtn) return;
            const row = deleteBtn.closest('.font-preset-manage-item');
            if (!row) return;
            const presetId = row.dataset.presetId;
            const presets = getFontPresets();
            const nextPresets = presets.filter(item => item.id !== presetId);
            setFontPresets(nextPresets);
            renderManagePresetList();
            renderFontPresetOptions();
        });
    }

    [fontPresetNameModal, fontPresetManageModal].forEach((overlay) => {
        if (!overlay) return;
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeOverlay(overlay);
            }
        });
    });
}
