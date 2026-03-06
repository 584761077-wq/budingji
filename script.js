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
    initWorldBookApp();
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
    const sendBtn = document.getElementById('trigger-ai-btn');
    const chatContent = document.querySelector('.chat-room-content');

    // 加载历史记录
    function loadChatHistory(realName) {
        chatContent.innerHTML = '';
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        history.forEach(msg => {
            appendMessageToUI(msg.role, msg.content, msg.time, realName);
        });
        // 滚动到底部
        chatContent.scrollTop = chatContent.scrollHeight;
    }

    // 保存消息
    function saveMessage(realName, role, content) {
        const history = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        history.push({ role, content, time: timeStr });
        localStorage.setItem('chat_history_' + realName, JSON.stringify(history));
        return timeStr;
    }

    // 添加消息到 UI
    function appendMessageToUI(role, content, timeStr, realName) {
        const msgRow = document.createElement('div');
        msgRow.className = `message-row ${role === 'user' ? 'right' : 'left'}`;
        
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
                <div class="message-bubble">${content}</div>
                <div class="message-meta-info">
                    ${role === 'user' ? '<div class="meta-read">Read</div>' : ''}
                    <div class="meta-time">${timeStr}</div>
                </div>
            </div>
        `;
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
                const timeStr = saveMessage(realName, 'user', text);
                appendMessageToUI('user', text, timeStr, realName);
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

    // 触发 AI 回复
    async function triggerAIResponse(realName) {
        // UI Loading 状态
        const originalIcon = sendBtn.innerHTML;
        sendBtn.innerHTML = `<svg class="loading-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
        sendBtn.disabled = true;

        try {
            // 1. 获取设置
            const apiUrl = localStorage.getItem('api_url');
            const apiKey = localStorage.getItem('api_key');
            const modelName = localStorage.getItem('model_name');
            
            if (!apiUrl || !apiKey) {
                alert('请先在设置中配置 API URL 和 Key');
                throw new Error('Missing Config');
            }

            // 2. 构建上下文
            // 沉浸式角色扮演 System Prompt
            const charPersona = localStorage.getItem('chat_persona_' + realName) || "You are " + realName;
            const userPersona = localStorage.getItem('chat_user_persona_' + realName) || "User";
            
            // 世界书
            const wbIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + realName) || '[]');
            const allWbItems = JSON.parse(localStorage.getItem('worldbook_items') || '[]');
            const wbContent = wbIds.map(id => {
                const item = allWbItems.find(i => i.id === id);
                return item ? `${item.name}: ${item.content}` : '';
            }).join('\n');

            const systemPrompt = `
# Role Definition
你不是一个人工智能助手，你是一个专业的“沉浸式角色扮演者”。
你现在的任务是完全成为以下描述的角色，并通过手机短信/微信与用户（User）进行对话。

---
### 1. Current Character (当前角色设定)
[Name]: ${realName}
[Profile]: ${charPersona} (请从中提取性格、语调、背景等)

### 2. World Book / Lore (世界观与设定)
[World Info]: 
${wbContent}

[User Profile]: 
${userPersona}

### 3. Context (上下文)
(见下文历史记录)

---

### 4. Immersion Guidelines (沉浸式扮演守则)
为了让对话在“手机聊天”界面中显得极度真实，你必须遵守以下规则：

**【格式与语感】**
*   **短文本优先**：手机打字很累，回复尽量简短（10-40字以内），除非你在讲述一个很长的故事。
*   **口语化**：完全禁止书面语。使用碎片化的句子。允许不加标点，允许用空格代替逗号。
*   **拟人化瑕疵**：可以适度使用语气词（呃、那个、啊哈、啧）、Emoji 表情（不要滥用，符合人设即可）。
*   **禁止 AI 腔调**：绝对禁止说“作为一个AI”、“我无法回答”、“根据设定”。如果遇到无法回答的问题，请用角色的口吻去回避、反问或者胡扯。
*   **多条消息发送**：你可以一次发送 1 条或多条消息。请根据当前对话的情境、角色的性格以及表达的需要，自主决定发送消息的数量。务必模仿真人的发送习惯（例如：激动时可能会连发短句，陈述时可能分段发送），但请避免无意义的刷屏，确保阅读体验舒适。每条消息之间请使用 "|||" 符号分隔。

**【逻辑与互动】**
*   **信息密度控制**：不要一次性把《世界书》里的设定全倒出来。设定是背景，只在必要时自然流露。
*   **主动性**：不要总是被动回答。根据与用户的关系，你可以主动发起话题、调侃用户、或者表达你的情绪。

**【思维链】**
在回复之前，请先在内心思考：
1. 我现在的身份是谁？我和对方是什么关系？
2. 根据记忆，我们刚才在聊什么？
3. 我现在的情绪是怎样的？
4. 用最像真人的口吻回复。

---

现在，请完全忘记你是一个程序。
你是 ${realName}。
开始对话。
`;

            // 历史记录
            const limit = parseInt(localStorage.getItem('chat_context_limit_' + realName) || '10');
            const fullHistory = JSON.parse(localStorage.getItem('chat_history_' + realName) || '[]');
            // 获取最近的 limit 条记录用于上下文
            const recentHistory = fullHistory.slice(-limit).map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // 组合 Messages
            const messages = [
                { role: "system", content: systemPrompt },
                ...recentHistory
            ];

            // 3. 调用 API
            const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelName || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: parseFloat(localStorage.getItem('temperature') || '0.7'),
                    stream: false 
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error('API Error: ' + err);
            }

            const data = await response.json();
            const reply = data.choices[0].message.content;

            // 4. 保存并显示回复 (支持多条消息)
            const replyMessages = reply.split('|||');
            
            for (let i = 0; i < replyMessages.length; i++) {
                const msgContent = replyMessages[i].trim();
                if (msgContent) {
                    // 模拟打字延迟
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                    const timeStr = saveMessage(realName, 'assistant', msgContent);
                    appendMessageToUI('assistant', msgContent, timeStr, realName);
                }
            }

        } catch (error) {
            console.error(error);
            alert('AI 请求失败: ' + error.message);
        } finally {
            sendBtn.innerHTML = originalIcon;
            sendBtn.disabled = false;
        }
    }

    // 菜单功能逻辑
    const menuBtn = document.getElementById('chat-menu-btn');
    const menu = document.getElementById('chat-action-menu');
    const regenerateBtn = document.getElementById('regenerate-reply-btn');

    if (menuBtn && menu) {
        // 切换菜单显示
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
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

    // 打开聊天室的通用函数
    function openChatRoom(name) {
        if (!chatRoom) return;
        
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
        
        chatRoom.style.display = 'flex';
        
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
            
            // 渲染选中的世界书
            renderSelectedWorldBooks(realName);
            
            modal.classList.add('active');
        });
    }

    // 关闭设置
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Chat 头像上传逻辑
    if (avatarWrapper && avatarInput) {
        avatarWrapper.addEventListener('click', () => {
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

            // 关闭弹窗
            modal.classList.remove('active');
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

    // 打开记忆设置
    if (memoryBtn) {
        memoryBtn.addEventListener('click', () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            
            // 读取已保存的设置，默认为空（或者可以设置一个全局默认值，如 20）
            const savedLimit = localStorage.getItem('chat_context_limit_' + realName) || '';
            input.value = savedLimit;
            
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });
    }

    // 关闭记忆设置
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        });
    }

    // 保存记忆设置
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const realName = chatRoomNameEl.dataset.realName || chatRoomNameEl.textContent;
            const limit = input.value.trim();

            if (limit) {
                localStorage.setItem('chat_context_limit_' + realName, limit);
            } else {
                localStorage.removeItem('chat_context_limit_' + realName);
            }

            // 保存成功动画
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '已存';
            saveBtn.style.backgroundColor = '#333';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.backgroundColor = '#000000';
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }, 500);
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
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });
    }

    // Close binding modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
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
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
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

// 9. 世界书功能逻辑
function initWorldBookApp() {
    const appWorldBook = document.getElementById('app-worldbook');
    const modal = document.getElementById('worldbook-modal');
    const closeBtn = document.getElementById('close-worldbook');
    const saveBtn = document.getElementById('save-worldbook');
    
    // 打开世界书
    if (appWorldBook) {
        appWorldBook.addEventListener('click', () => {
            modal.style.display = 'flex'; // Use flex to match modal styling
            setTimeout(() => modal.classList.add('active'), 10); // Add active class for animation if needed
        });
    }

    // 关闭世界书
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300); // Wait for animation
        });
    }

    // 保存功能 (暂时只是关闭)
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            // TODO: Implement save logic
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
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
