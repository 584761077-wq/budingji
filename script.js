document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initStandee();
    initSettings();
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
