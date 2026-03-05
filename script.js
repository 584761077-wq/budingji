document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initStandee();
    initSettings();
    initLineApp();
});

// 1. 时间和日期功能
function initClock() {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');

    function updateTime() {
        const now = new Date();
        
        // 更新时间 HH:MM
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${hours}:${minutes}`;

        // 更新日期 YYYY年MM月DD日
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateEl.textContent = `${year}年${month}月${day}日`;
    }

    updateTime();
    setInterval(updateTime, 1000);
}

// 2. 亚克力立牌功能
function initStandee() {
    const standeeContainer = document.querySelector('.standee-container');
    const standee = document.getElementById('standee');
    const standeeBase = document.querySelector('.standee-base');
    const fileInput = document.getElementById('file-input');
    const standeeImg = document.getElementById('standee-img');

    // 点击底座触发上传
    standeeBase.addEventListener('click', (e) => {
        e.stopPropagation(); 
        fileInput.click();
    });
    
    // 点击容器空白处（div）触发上传
    standee.addEventListener('click', (e) => {
        // 如果点击的是图片本身，不要触发上传（由图片的点击事件处理旋转）
        if (e.target.id === 'standee-img' && standeeImg.src !== '') {
            return;
        }
        fileInput.click();
    });

    // 点击图片触发旋转
    standeeImg.addEventListener('click', (e) => {
        if (standeeImg.src !== '') {
            e.stopPropagation(); // 阻止冒泡到容器（防止触发上传）
            rotateStandee();
        }
    });

    // 文件选择处理
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                standeeImg.src = event.target.result;
                standeeImg.style.display = 'block';
                // 隐藏占位符
                const placeholder = document.querySelector('.placeholder-icon');
                if (placeholder) placeholder.style.display = 'none';
                
                // 上传后自动旋转一下展示效果
                rotateStandee();
            };
            reader.readAsDataURL(file);
        }
    });

    // 旋转函数
    function rotateStandee() {
        // 移除class以允许重新触发动画
        standee.classList.remove('rotating');
        // 强制重绘
        void standee.offsetWidth;
        standee.classList.add('rotating');
    }
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
    const modelListContainer = document.getElementById('model-list-container');
    const modelList = document.getElementById('model-list');
    
    // 新增设置项
    const streamToggle = document.getElementById('stream-toggle');
    const tempSlider = document.getElementById('temperature-slider');
    const tempValue = document.getElementById('temp-value');

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

    // 打开设置
    dockSettings.addEventListener('click', () => {
        loadSettings();
        modal.classList.add('active');
    });

    // 关闭设置
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // 保存设置
    saveBtn.addEventListener('click', () => {
        localStorage.setItem('api_url', apiUrlInput.value);
        localStorage.setItem('api_key', apiKeyInput.value);
        localStorage.setItem('model_name', modelNameInput.value);
        localStorage.setItem('stream_enabled', streamToggle.checked);
        localStorage.setItem('temperature', tempSlider.value);
        
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
            alert('请先填写 API 地址和 Key');
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

            if (!response.ok) throw new Error('Failed to fetch');

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
                };
                modelList.appendChild(div);
            });

            if (models.length > 0) {
                modelListContainer.style.display = 'block';
            } else {
                alert('未找到可用模型');
            }

        } catch (error) {
            console.error(error);
            alert('拉取失败，请检查配置');
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
}

// 5. 聊天室功能逻辑
function initChatRoomLogic() {
    const chatRoom = document.getElementById('chat-room');
    const chatRoomName = document.getElementById('chat-room-name');
    const backBtn = document.getElementById('chat-room-back');
    const chatList = document.getElementById('line-chat-list');
    
    // 输入相关元素
    const inputCapsule = document.querySelector('.chat-input-capsule');
    const inputField = inputCapsule ? inputCapsule.querySelector('.chat-input-field') : null;
    const aaIcon = inputCapsule ? inputCapsule.querySelector('.input-aa-icon') : null;
    const chatContent = document.querySelector('.chat-room-content');

    // 处理输入框 Aa 图标显示逻辑
    if (inputField && aaIcon) {
        const toggleAaIcon = () => {
            if (inputField.value.trim() !== '' || document.activeElement === inputField) {
                aaIcon.classList.add('hidden');
            } else {
                aaIcon.classList.remove('hidden');
            }
        };

        inputField.addEventListener('focus', toggleAaIcon);
        inputField.addEventListener('blur', toggleAaIcon);
        inputField.addEventListener('input', toggleAaIcon);

        // 回车发送消息
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // 发送消息函数
    function sendMessage() {
        const text = inputField.value.trim();
        if (!text) return;

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // 创建右侧消息（自己发送）
        const msgRow = document.createElement('div');
        msgRow.className = 'message-row right';
        
        // 使用固定的用户头像（或从设置中获取）
        // 这里暂时使用默认的灰色人像SVG
        const avatarSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        msgRow.innerHTML = `
            <div class="message-avatar">${avatarSvg}</div>
            <div class="message-container">
                <div class="message-bubble">${text}</div>
                <div class="message-meta-info">
                    <div class="meta-read">Read</div>
                    <div class="meta-time">${timeStr}</div>
                </div>
            </div>
        `;

        chatContent.appendChild(msgRow);
        inputField.value = '';
        aaIcon.classList.remove('hidden'); // 重置图标显示
        
        // 滚动到底部
        chatContent.scrollTop = chatContent.scrollHeight;

        // 模拟对方回复（可选）
        // setTimeout(() => receiveMessage("Hello!", timeStr), 1000);
    }

    // 接收消息函数（模拟）
    function receiveMessage(text, timeStr) {
        const msgRow = document.createElement('div');
        msgRow.className = 'message-row left';
        const avatarSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        // 检查是否有自定义头像
        // 关键修复：使用 chatRoomName.dataset.realName 而不是 textContent
        // 因为 textContent 可能是备注名，而头像 key 是基于真名的
        const realName = chatRoomName.dataset.realName || chatRoomName.textContent;
        const currentAvatar = localStorage.getItem('chat_avatar_' + realName);
        
        const avatarContent = currentAvatar ? `<img src="${currentAvatar}" alt="avatar">` : avatarSvg;

        msgRow.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-container">
                <div class="message-bubble">${text}</div>
                <div class="message-meta-info">
                    <div class="meta-time">${timeStr}</div>
                </div>
            </div>
        `;
        chatContent.appendChild(msgRow);
        chatContent.scrollTop = chatContent.scrollHeight;
    }

    // 打开聊天室的通用函数
    function openChatRoom(name) {
        if (!chatRoom) return;
        
        // 查找对应的 chat-list-item 以获取 dataset.realName
        // 这是一个补丁：因为 openChatRoom 的参数 name 可能是显示名（备注名）
        // 我们需要找到它对应的真名，才能正确加载头像和历史记录
        // 遍历聊天列表找到匹配的项
        let realName = name;
        const chatItems = document.querySelectorAll('#line-chat-list .chat-list-item');
        for (const item of chatItems) {
            const itemName = item.querySelector('.chat-item-name').textContent;
            if (itemName === name) {
                // 优先使用 dataset.realName，如果没有则回退到 name
                realName = item.dataset.realName || name;
                break;
            }
        }
        
        // 更新聊天室标题和数据集
        chatRoomName.textContent = name;
        chatRoomName.dataset.realName = realName; // 关键：保存真名到标题元素供设置页使用
        
        chatRoom.style.display = 'flex';
        // 清空之前的消息（演示用，实际应加载历史记录）
        chatContent.innerHTML = '';
        
        // 模拟一条对方的消息
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        receiveMessage("你好！", timeStr);
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
    
    const avatarWrapper = document.querySelector('.chat-profile-avatar-wrapper');
    const avatarInput = document.getElementById('chat-avatar-input');
    const avatarDisplay = document.getElementById('chat-settings-avatar');
    
    const realNameInput = document.getElementById('chat-settings-realname');
    const remarkInput = document.getElementById('chat-settings-remark');

    // 打开设置
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const currentName = chatRoomNameEl.textContent;
            
            // 尝试获取存储的真名，如果没有则假设当前显示的标题就是真名（如果没设备注）
            // 或者更复杂的逻辑：需要一个ID来对应用户，这里简单用名字做key
            // 实际上应该在打开聊天室时就传递 ID 或 RealName
            // 这里简化处理：从 localStorage 读取 'realname_for_' + currentName
            // 如果读取不到，就默认 currentName 是真名
            
            // 但是如果当前显示的是备注名，我们怎么知道真名？
            // 我们可以在 localStorage 存一个映射: 'realname_of_displayed_' + currentName -> realName
            // 或者简单点，我们假设用户在好友列表点击时，我们知道是谁
            
            // 为了简化演示，我们假设 localStorage 存储了 'chat_realname_' + currentName
            // 如果没有，就用 currentName
            
            // 更好的方式：在 openChatRoom 时把 realName 存到一个 data 属性上
            // 这里先简化：
            
            // 读取之前保存的真名和备注名
            // 注意：key 的使用需要统一。这里建议以“显示的名称”作为入口是不太严谨的，但对于演示足够
            // 我们统一使用 chatRoomNameEl.dataset.realName (需要在 openChatRoom 设置)
            
            const realName = chatRoomNameEl.dataset.realName || currentName;
            const remarkName = localStorage.getItem('chat_remark_' + realName) || '';

            realNameInput.value = realName;
            remarkInput.value = remarkName;
            
            // 加载头像
            const savedAvatar = localStorage.getItem('chat_avatar_' + realName);
            if (savedAvatar) {
                avatarDisplay.innerHTML = `<img src="${savedAvatar}">`;
            } else {
                avatarDisplay.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }

            modal.classList.add('active');
        });
    }

    // 关闭设置
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // 头像上传
    if (avatarWrapper && avatarInput) {
        avatarWrapper.addEventListener('click', () => {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    avatarDisplay.innerHTML = `<img src="${event.target.result}">`;
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
            
            if (!newRealName) {
                alert('真名不能为空');
                return;
            }

            // 1. 更新真名逻辑 (如果真名变了，需要迁移数据，比较复杂，这里暂只允许修改显示)
            // 简单处理：更新 dataset
            chatRoomNameEl.dataset.realName = newRealName;

            // 2. 保存备注名
            if (newRemark) {
                localStorage.setItem('chat_remark_' + newRealName, newRemark);
                chatRoomNameEl.textContent = newRemark; // 聊天室标题显示备注
            } else {
                localStorage.removeItem('chat_remark_' + newRealName);
                chatRoomNameEl.textContent = newRealName; // 没有备注显示真名
            }

            // 3. 保存头像 (使用新真名作为 key)
            const img = avatarDisplay.querySelector('img');
            if (img) {
                localStorage.setItem('chat_avatar_' + newRealName, img.src);
            }

            // 4. 同步更新好友列表和聊天列表
            updateLists(oldRealName, newRealName, newRemark, img ? img.src : null);

            // 5. 特别更新当前聊天室顶部的头像（如果有的话，目前顶栏没有头像，只有名字）
            // 如果未来顶栏加了头像，在这里更新
            // chatRoomHeaderAvatar.src = ...

            // 6. 更新当前聊天记录中的头像 (所有左侧的消息)
            const chatMessages = document.querySelectorAll('.message-row.left .message-avatar');
            chatMessages.forEach(avatarDiv => {
                // Only update if it's an img tag, or if we are switching from svg to img
                if (img) {
                     avatarDiv.innerHTML = `<img src="${img.src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            });
            
            // 7. 触发全局保存，确保修改被写入 storage
            saveGlobalData();

            // 关闭弹窗
            modal.classList.remove('active');
        });
    }

    function updateLists(oldName, newName, newRemark, newAvatarSrc) {
        const displayName = newRemark || newName;
        
        // 更新好友列表
        const friendItems = document.querySelectorAll('#friends-list .group-subitem');
        friendItems.forEach(item => {
            const span = item.querySelector('span');
            const currentItemName = span.textContent;
            
            const oldRemark = localStorage.getItem('chat_remark_' + oldName);
            const oldDisplayName = oldRemark || oldName;

            if (currentItemName === oldDisplayName) {
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
            const currentItemName = nameDiv.textContent;
            const oldRemark = localStorage.getItem('chat_remark_' + oldName);
            const oldDisplayName = oldRemark || oldName;

            if (currentItemName === oldDisplayName) {
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
        
        // 如果改了真名，需要迁移旧数据的 key
        if (oldName !== newName) {
            // 迁移备注
            const remark = localStorage.getItem('chat_remark_' + oldName);
            if (remark) {
                localStorage.setItem('chat_remark_' + newName, remark);
                localStorage.removeItem('chat_remark_' + oldName);
            }
            // 迁移头像
            const avatar = localStorage.getItem('chat_avatar_' + oldName);
            if (avatar) {
                localStorage.setItem('chat_avatar_' + newName, avatar);
                localStorage.removeItem('chat_avatar_' + oldName);
            }
        }
        
        saveGlobalData();
    }
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
    // 1. 恢复好友列表
    const savedFriends = JSON.parse(localStorage.getItem('global_friends_list'));
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
    const savedChats = JSON.parse(localStorage.getItem('global_chat_list'));
    const chatListContainer = document.getElementById('line-chat-list');
    
    if (savedChats && chatListContainer) {
        const emptyPlaceholder = chatListContainer.querySelector('.empty-chat-placeholder');
        if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';
        
        if (savedChats.length > 0) {
            chatListContainer.innerHTML = ''; 
            savedChats.forEach(realName => {
                const remark = localStorage.getItem('chat_remark_' + realName);
                const avatar = localStorage.getItem('chat_avatar_' + realName);
                const displayName = remark || realName;
                
                const item = document.createElement('div');
                item.className = 'chat-list-item';
                item.dataset.realName = realName;
                
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
                `;
                chatListContainer.appendChild(item);
            });
        }
    }
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

function getRandomColor() {
    const colors = ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#AC8E68', '#64D2FF'];
    return colors[Math.floor(Math.random() * colors.length)];
}
