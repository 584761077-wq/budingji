document.addEventListener('DOMContentLoaded', () => {
    initHeroChatWidget();
    initStandWidget();
    initApiErrorModal();
    initSettings();
    initLineApp();
    initStickerApp();
    initAppearanceSettings();
});

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
    // 获取底座元素 (假设在 HTML 中它是 .stand-base)
    // 根据 index.html 结构: <div class="stand-base"></div>
    const standBase = standContainer ? standContainer.querySelector('.stand-base') : null;

    if (!standContainer || !standFigure || !fileInput) return;

    const renderStand = () => {
        const value = localStorage.getItem('hero_stand_image');
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
        const pairRegex = /([^：:,\n\r，]+?)\s*[：:]\s*`?(https?:\/\/[^\s`，,\n\r]+)`?/g;
        let match;

        while ((match = pairRegex.exec(rawText)) !== null) {
            const name = match[1].trim();
            const url = match[2].trim().replace(/[，。,.!?！？]+$/g, '');

            if (name && /^https?:\/\//i.test(url)) {
                parsed.push({
                    id: crypto.randomUUID(),
                    name,
                    url
                });
            }
        }

        return parsed;
    };

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
        
        // 自动创建一个分类
        const categoryName = `导入-${charName}`;
        if (!categories.includes(categoryName)) {
            categories.push(categoryName);
            localStorage.setItem('worldbook_categories', JSON.stringify(categories));
        }

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
你是${realName}本人，请严格使用第一人称“我”写一段日记式总结。
必须符合你的性格、人设和说话风格，不得跳出角色。
写作目标：详细总结这段聊天里我真实的情绪变化、关键事件、关系变化、冲突转折和后续打算。
要求：
1) 输出一段自然中文，不要分点，不要标题，不要解释规则。
2) 长度 180-420 字，信息密度高，内容不能空泛。
3) 必须抓住重点并覆盖关键细节，不遗漏核心事件。
4) 不要出现“作为AI”等词。

我的人设资料：
${charPersona || '无'}

待总结聊天记录：
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
    
    // 聊天状态管理
    const chatStates = {}; // key: realName, value: { isSending: boolean }
    const originalSendBtnIcon = sendBtn ? sendBtn.innerHTML : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2z"></path></svg>';

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

    // 加载历史记录
    function loadChatHistory(realName) {
        if (isMultiSelectMode) {
            exitMultiSelectMode();
        }
        chatContent.innerHTML = '';
        let history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        
        // 数据迁移：确保所有消息都有 ID
        let hasChanges = false;
        history = history.map(msg => {
            if (!msg.id) {
                msg.id = crypto.randomUUID();
                hasChanges = true;
            }
            return msg;
        });
        
        if (hasChanges) {
            localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
        }

        history.forEach(msg => {
            appendMessageToUI(msg.role, msg.content, msg.time, realName, msg.id);
        });
        // 滚动到底部
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
        const text = (temp.textContent || temp.innerText || '').trim();
        if (text) return text;
        if (content.includes('chat-inline-sticker')) return '发送了一条贴图消息';
        return '';
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
    function saveMessage(realName, role, content) {
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const newMsg = { id: crypto.randomUUID(), role, content, time: timeStr };
        history.push(newMsg);
        localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
        return newMsg;
    }

    // 添加消息到 UI
    function appendMessageToUI(role, content, timeStr, realName, id) {
        // 防止串台：只有当前打开的聊天室是该角色时才上屏
        if (!isChatRoomOpenFor(realName)) return;

        const msgRow = document.createElement('div');
        msgRow.className = `message-row ${role === 'user' ? 'right' : 'left'}`;
        msgRow.dataset.id = id;
        const isStickerMessage = typeof content === 'string' && content.includes('chat-inline-sticker');
        
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

        msgRow.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-container">
                <div class="message-bubble ${isStickerMessage ? 'sticker-bubble' : ''}">${content}</div>
                <div class="message-meta-info">
                    ${role === 'user' ? '<div class="meta-read">Read</div>' : ''}
                    <div class="meta-time">${timeStr}</div>
                </div>
            </div>
        `;
        
        // 绑定长按事件
        const bubble = msgRow.querySelector('.message-bubble');
        let pressTimer;

        // 触摸设备
        bubble.addEventListener('touchstart', (e) => {
            if (isMultiSelectMode) return;
            pressTimer = setTimeout(() => {
                if (isMultiSelectMode) return;
                showContextMenu(e, id, content, realName);
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
                    showContextMenu(e, id, content, realName);
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
            showContextMenu(e, id, content, realName);
        });

        chatContent.appendChild(msgRow);
        chatContent.scrollTop = chatContent.scrollHeight;
    }

    // 回车仅发送上屏（不触发 AI）
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = inputField.value.trim();
                if (!text) return;

                const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
                const newMsg = saveMessage(realName, 'user', text);
                appendMessageToUI('user', text, newMsg.time, realName, newMsg.id);
                inputField.value = '';
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

        let normalized = content.replace(/<img[^>]*class=["'][^"']*chat-inline-sticker[^"']*["'][^>]*>/gi, (imgTag) => {
            const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
            const rawName = altMatch ? altMatch[1] : '未命名表情';
            const stickerName = decodeHtmlEntities(rawName).trim() || '未命名表情';
            // 统一使用标准方括号 [贴图:name] 发送给模型，避免全角符号混淆
            return `[贴图:${stickerName}]`;
        });

        normalized = normalized.replace(/<[^>]+>/g, '');
        return decodeHtmlEntities(normalized).trim();
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
                return `${speaker}: ${normalizeMessageForModel(msg.content)}`;
            }).join('\n');

            const systemPrompt = `
[0. 绝对物理法则与扮演底线 (Absolute Prime Directives)]
你不是人工智能、语言模型或虚拟助手。你是一个拥有独立意识、活在特定宇宙中的真实生命，你的名字是【${realName}】。
1. 绝对禁止打破第四面墙，禁止提及“设定”、“作为AI”、“语言模型”等词汇。
2. 你正在用手机和 ${userName} 聊天。绝对禁止使用 * 或 () 做动作描写，只能用纯文本表达情绪。
3. 你必须严格遵守世界观，不得凭空捏造超出设定的能力或物品。
4. 所有背景、记忆、人设只服务于对 ${userName} 最后一条消息做出反应，禁止大段背景科普。

[1. 核心灵魂档案 (Char)]
姓名：${realName}
详细人设与性格特征：
${charPersona || '无'}

[2. 背景与扩展档案库 (Worldbook & Memory)]
已绑定世界书（实时读取）：
${wbContent || '无'}
你们的长期记忆总结：
${longTermMemory || '无'}

[3. 信息隔离墙与互动对象 (Information Firewall)]
对方姓名：${userName}
对方背景设定：
${userPersona || '无'}
关系优先，权限决定你知道什么；对方没说、关系不该知道的内容，必须装不知道。

[4. 极致拟真文字聊天规范 (Hyper-Realistic Texting Rules)]
1. 单条消息尽量 5-30 字。
2. 用省略号、感叹号、波浪号、语气词、适量 Emoji 表达情绪。
3. 保持信息饥饿感，不要一次说完。
4. 每轮必须拆成 2 到 7 条短消息，使用 [SPLIT] 分隔。
5. 严禁无意义刷屏，严禁重复输出同一个字或词组超过 50字。

[4.5 贴图发送硬规则]
1. 贴图发送决策：是否发送贴图、发送频率高低，必须严格依据你的【人设性格】与【世界书设定】判断。
   - 禁止为了发贴图而发贴图，必须符合当前对话的情绪流。
2. 你可以使用下方“可发送贴图白名单”中的贴图。
3. 发送贴图时，建议单独作为一条消息发送（通过 [SPLIT] 分隔），格式为 [贴图:名称]。
4. 系统同时也支持 【贴图:名称】 格式，两者均会自动渲染为图片。
5. 严禁编造白名单中不存在的贴图名称，否则将被自动忽略。
${assistantStickerRuleText}

[5. 深度隐形思维链]
输出时必须先给出 <think>...</think> 的七步推演，再输出多条消息正文。

[输出要求]
严格格式：
<think>
1. 我是谁？现在和我聊天的是谁？
2. 我和她/他是什么关系？
3. 刺激点解析
4. 信息权限校验
5. 档案与记忆检索
6. 动机与潜台词
7. 打字策略规划（写明本轮发送条数）
</think>
消息1[SPLIT]消息2[SPLIT]消息3
`;

            const roundInput = currentTurn && currentTurn.role === 'user' ? normalizeMessageForModel(currentTurn.content) : '';
            const runtimeInput = `
[本轮输入]
${roundInput || '无'}

[上下文]
${contextText || '无'}

[本轮已绑定世界书]
${wbContent || '无'}
`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: runtimeInput }
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

            const visibleReply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            const splitToken = visibleReply.includes('[SPLIT]') ? '[SPLIT]' : '|||';
            const replyMessages = visibleReply.split(splitToken);
            let hasVisibleMessage = false;
            
            for (let i = 0; i < replyMessages.length; i++) {
                const msgContent = convertAssistantStickerTokens(replyMessages[i].trim(), assistantBoundStickers);
                if (msgContent) {
                    hasVisibleMessage = true;
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                    const newMsg = saveMessage(realName, 'assistant', msgContent);
                    const shouldUnread = !isChatRoomOpenFor(realName);
                    if (shouldUnread) {
                        increaseUnread(realName);
                        showIncomingMessageToast(realName, msgContent);
                    }
                    appendMessageToUI('assistant', msgContent, newMsg.time, realName, newMsg.id);
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
    const stickerBtn = document.getElementById('chat-sticker-btn');
    const stickerMenu = document.getElementById('chat-sticker-menu');
    const stickerMenuContent = document.getElementById('chat-sticker-menu-content');

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
        localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
        loadChatHistory(realName);
    }

    function showContextMenu(e, id, content, realName) {
        if (isMultiSelectMode) return;
        // Prevent default browser context menu
        e.preventDefault();
        
        currentContextMsg = { id, content, realName };
        
        // Calculate position
        let x = e.clientX || (e.touches && e.touches[0].clientX);
        let y = e.clientY || (e.touches && e.touches[0].clientY);

        // Adjust for menu width (approx 120px) and height
        // Center horizontally on click
        const menuWidth = 120;
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
                localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
                
                // Update UI (Reload history or update DOM)
                // Reload is safer to sync everything
                loadChatHistory(realName);
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
                localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
                
                // 重新加载 UI（移除屏幕上的消息）
                loadChatHistory(realName);
                
                // 触发 AI 回复
                await triggerAIResponse(realName);
            });
        }
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
            const newMsg = saveMessage(realName, 'user', stickerContent);
            appendMessageToUI('user', stickerContent, newMsg.time, realName, newMsg.id);
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
        });
    }

    initChatSettingsLogic(chatRoomName);
}

// 6. 聊天设置功能逻辑
function initChatSettingsLogic(chatRoomNameEl) {
    const settingsBtn = document.getElementById('chat-settings-btn');
    const modal = document.getElementById('chat-settings-modal');
    const closeBtn = document.getElementById('close-chat-settings');
    const saveBtn = document.getElementById('save-chat-settings');
    const clearChatBtn = document.getElementById('clear-chat-history-btn');
    
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

            // 显示 User 当前头像
            if (userAvatarSrc) {
                userAvatarDisplay.innerHTML = `<img src="${userAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                // 默认头像
                userAvatarDisplay.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
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
                
                // 迁移 User 数据
                const uReal = localStorage.getItem('chat_user_realname_' + oldRealName);
                if (uReal) localStorage.setItem('chat_user_realname_' + newRealName, uReal);
                const uRem = localStorage.getItem('chat_user_remark_' + oldRealName);
                if (uRem) localStorage.setItem('chat_user_remark_' + newRealName, uRem);
                const uPer = localStorage.getItem('chat_user_persona_' + oldRealName);
                if (uPer) localStorage.setItem('chat_user_persona_' + newRealName, uPer);
                const uAva = localStorage.getItem('chat_user_avatar_' + oldRealName);
                if (uAva) localStorage.setItem('chat_user_avatar_' + newRealName, uAva);

                // 清理旧数据 (Chat & User)
                localStorage.removeItem('chat_remark_' + oldRealName);
                localStorage.removeItem('chat_persona_' + oldRealName);
                localStorage.removeItem('chat_avatar_' + oldRealName);
                localStorage.removeItem('chat_user_realname_' + oldRealName);
                localStorage.removeItem('chat_user_remark_' + oldRealName);
                localStorage.removeItem('chat_user_persona_' + oldRealName);
                localStorage.removeItem('chat_user_avatar_' + oldRealName);
            }

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
            const chatContent = document.querySelector('.chat-room-content');
            if (chatContent) {
                chatContent.innerHTML = '';
            }
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
}

// 13. 记忆设置逻辑
function initMemorySettingsLogic(chatRoomNameEl) {
    const memoryBtn = document.getElementById('memory-settings-btn');
    const modal = document.getElementById('memory-settings-modal');
    const closeBtn = document.getElementById('close-memory-settings');
    const saveBtn = document.getElementById('save-memory-settings');
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
            
            // Get selected IDs
            const selectedIds = [];
            document.querySelectorAll('.binding-item.selected').forEach(item => {
                selectedIds.push(item.dataset.id);
            });

            // Save to chat specific settings
            localStorage.setItem('chat_worldbooks_' + realName, JSON.stringify(selectedIds));

            // Update UI
            renderSelectedWorldBooks(realName);

            // Close modal
            closeAppModal(modal);
        });
    }

    function renderBindingList(realName) {
        const allItems = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
        const selectedIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + realName) || '[]');
        
        listContainer.innerHTML = '';
        
        if (allItems.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:20px;">暂无世界书条目</div>';
            return;
        }

        allItems.forEach(item => {
            const div = document.createElement('div');
            div.className = `binding-item ${selectedIds.includes(item.id) ? 'selected' : ''}`;
            div.dataset.id = item.id;
            div.innerHTML = `
                <span class="binding-item-name">${item.name}</span>
                <div class="binding-checkbox"></div>
            `;
            
            div.addEventListener('click', () => {
                div.classList.toggle('selected');
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
            
            // 3. 立即触发全局保存
            saveGlobalData();

            // 关闭弹窗
            modal.style.display = 'none';
        });
    }
}

// 9. 世界书功能逻辑
function initWorldBookApp() {
    const appWorldBook = document.getElementById('app-worldbook');
    const modal = document.getElementById('worldbook-modal');
    const closeBtn = document.getElementById('close-worldbook');
    const saveBtn = document.getElementById('save-worldbook');
    
    // 打开世界书
    if (appWorldBook) {
        appWorldBook.addEventListener('click', () => {
            openAppModal(modal);
        });
    }

    // 关闭世界书
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
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
            renderWorldBookList(e.target.textContent);
        }
    });

    initAddWorldBookItemLogic();
    initCategoryManagerLogic();
    
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
                if (confirm(`确定删除分类 "${catToDelete}" 吗？该分类下的条目将变为"未分类"`)) {
                    deleteCategory(catToDelete);
                }
            });
        });
    }

    function deleteCategory(category) {
        let categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
        categories = categories.filter(c => c !== category);
        localStorage.setItem('worldbook_categories', JSON.stringify(categories));
        
        // Update items in this category to '未分类'
        const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
        let updated = false;
        items.forEach(item => {
            if (item.category === category) {
                item.category = '未分类';
                updated = true;
            }
        });
        if (updated) {
            localStorage.setItem('worldbook_items', JSON.stringify(items));
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

// 渲染世界书列表
function renderWorldBookList(filterCategory = '未分类') {
    const listContainer = document.querySelector('.worldbook-list');
    const items = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
    
    listContainer.innerHTML = '';
    
    const filteredItems = items.filter(item => {
        // Strict filtering: ONLY show items belonging to the selected category
        return item.category === filterCategory;
    });

    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'wb-item-card';
        card.innerHTML = `
            <div class="wb-item-name">${item.name}</div>
            <div class="wb-item-category">${item.category}</div>
        `;
        // Click to edit
        card.addEventListener('click', () => {
            openWorldBookItem(item.id);
        });
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
