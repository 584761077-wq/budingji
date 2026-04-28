// theme_engine.js

/**
 * Candy OS Theme Engine
 * 负责主题的 IndexedDB 存储、压缩、绑定、CSS 变量注入与实时同步
 */

const ThemeEngine = (() => {
    const DB_NAME = 'budingji_theme_db';
    const DB_VERSION = 1;
    const STORE_THEMES = 'themes';
    const STORE_BINDINGS = 'bindings';

    let dbPromise = null;
    // 内存缓存
    const cache = {
        themes: new Map(), // id -> theme object
        bindings: new Map() // chatId -> array of themeIds
    };

    function getDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_THEMES)) {
                        db.createObjectStore(STORE_THEMES, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(STORE_BINDINGS)) {
                        db.createObjectStore(STORE_BINDINGS, { keyPath: 'chatId' });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => reject(req.error);
            });
        }
        return dbPromise;
    }

    // --- 原文保留 ---
    // 主题 CSS 直接按原文保存，避免中文注释、换行和空白被破坏。
    function normalizeThemeCss(theme) {
        if (!theme || typeof theme !== 'object') return theme;
        if (typeof theme.css !== 'string' && typeof theme.rawCss === 'string') {
            theme.css = theme.rawCss;
        }
        return theme;
    }

    // --- 核心 API ---

    async function init() {
        const db = await getDB();
        // 加载 Themes
        await new Promise((resolve) => {
            const tx = db.transaction(STORE_THEMES, 'readonly');
            const req = tx.objectStore(STORE_THEMES).getAll();
            req.onsuccess = () => {
                req.result.forEach(t => {
                    normalizeThemeCss(t);
                    cache.themes.set(t.id, t);
                });
                resolve();
            };
        });
        // 加载 Bindings
        await new Promise((resolve) => {
            const tx = db.transaction(STORE_BINDINGS, 'readonly');
            const req = tx.objectStore(STORE_BINDINGS).getAll();
            req.onsuccess = () => {
                req.result.forEach(b => {
                    cache.bindings.set(b.chatId, b.themeIds || []);
                });
                resolve();
            };
        });

        // 配额检查
        checkQuota();
    }

    async function checkQuota() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const usagePercent = (estimate.usage / estimate.quota) * 100;
            if (usagePercent > 80) {
                console.warn(`[ThemeEngine] Storage quota is running high: ${usagePercent.toFixed(2)}%`);
                // 触发清理策略：如果可以清理未绑定的过老主题
            }
        }
    }

    async function saveTheme(theme) {
        if (!theme.id) theme.id = crypto.randomUUID();
        
        // 直接保存原文，确保中文注释、换行、空格都不丢失
        const themeToSave = { ...theme };
        if (typeof themeToSave.css === 'string') {
            themeToSave.rawCss = themeToSave.css;
        }

        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_THEMES, 'readwrite');
            tx.objectStore(STORE_THEMES).put(themeToSave);
            tx.oncomplete = () => {
                cache.themes.set(theme.id, normalizeThemeCss(theme));
                resolve(theme.id);
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    function getAllThemes() {
        return Array.from(cache.themes.values());
    }

    async function deleteTheme(themeId) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_THEMES, STORE_BINDINGS], 'readwrite');
            tx.objectStore(STORE_THEMES).delete(themeId);
            
            // 清理绑定
            const bindStore = tx.objectStore(STORE_BINDINGS);
            const req = bindStore.getAll();
            req.onsuccess = () => {
                req.result.forEach(b => {
                    const newThemeIds = (b.themeIds || []).filter(id => id !== themeId);
                    if (newThemeIds.length !== b.themeIds.length) {
                        b.themeIds = newThemeIds;
                        bindStore.put(b);
                        cache.bindings.set(b.chatId, newThemeIds);
                    }
                });
            };

            tx.oncomplete = () => {
                cache.themes.delete(themeId);
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    // 绑定主题到多个聊天窗口 (一对多关系：一个窗口只能有一个主题)
    async function bindThemeToChats(themeId, chatIds) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_BINDINGS, 'readwrite');
            const store = tx.objectStore(STORE_BINDINGS);

            const normalizedChatIds = Array.from(new Set((chatIds || []).map(id => String(id || '').trim()).filter(Boolean)));
            
            const reqAll = store.getAll();
            reqAll.onsuccess = () => {
                const allBindings = reqAll.result;
                const selectedSet = new Set(normalizedChatIds);
                
                // 1. 先从所有 chatId 中移除当前 themeId，确保旧绑定被清理
                allBindings.forEach(b => {
                    const currentThemeIds = Array.isArray(b.themeIds) ? b.themeIds : [];
                    b.themeIds = currentThemeIds.filter(id => id !== themeId);
                });
                
                // 2. 将选中的 chatIds 绑定到这个 themeId
                normalizedChatIds.forEach(chatId => {
                    let b = allBindings.find(x => x.chatId === chatId);
                    if (!b) {
                        b = { chatId, themeIds: [] };
                        allBindings.push(b);
                    }
                    // 一个窗口只能绑定一个主题
                    b.themeIds = [themeId];
                });

                // 3. 没有被选中的窗口，只保留其他主题绑定
                allBindings.forEach(b => {
                    if (!selectedSet.has(b.chatId) && Array.isArray(b.themeIds)) {
                        b.themeIds = b.themeIds.filter(id => id !== themeId);
                    }
                });

                // 4. 保存回库
                allBindings.forEach(b => {
                    store.put(b);
                    cache.bindings.set(b.chatId, Array.isArray(b.themeIds) ? b.themeIds : []);
                });
            };

            tx.oncomplete = () => {
                window.dispatchEvent(new CustomEvent('theme-binding-updated'));
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    function getThemesForChat(chatId) {
        const themeIds = cache.bindings.get(chatId) || [];
        return themeIds.map(id => cache.themes.get(id)).filter(Boolean);
    }

    function getChatIdsForTheme(themeId) {
        const chatIds = [];
        for (const [chatId, themeIds] of cache.bindings.entries()) {
            if (themeIds.includes(themeId)) chatIds.push(chatId);
        }
        return chatIds;
    }

    function scopeThemeCss(css, scopeSelector) {
        const input = String(css || '').trim();
        if (!input) return '';

        return input.replace(/(^|\})(\s*)([^@}{][^{}]*?)\s*\{/g, (match, brace, space, selector) => {
            const scoped = selector
                .split(',')
                .map(part => `${scopeSelector} ${part.trim()}`)
                .join(', ');
            return `${brace}${space}${scoped} {`;
        });
    }

    // --- 动态 CSS 变量注入 ---
    function applyThemeToChatRoom(chatId) {
        const chatRoom = document.getElementById('chat-room');
        if (!chatRoom) return;

        const safeChatId = String(chatId || '').trim();
        if (safeChatId) {
            chatRoom.dataset.themeChatId = safeChatId;
        }

        const themes = getThemesForChat(chatId);
        if (themes.length === 0) {
            // 清除变量
            chatRoom.style.cssText = '';
            const styleTag = document.getElementById('theme-engine-style');
            if (styleTag) {
                styleTag.textContent = '';
                styleTag.dataset.hash = '';
            }
            return;
        }

        // 合并多个主题的变量和 CSS (后绑定的优先级高)
        let combinedCss = '';
        let mergedVars = {};

        themes.forEach(theme => {
            if (theme.variables) {
                Object.assign(mergedVars, theme.variables);
            }
            if (theme.css) {
                combinedCss += theme.css + '\n';
            }
        });

        // 清除旧的变量，防止残留
        chatRoom.style.cssText = '';

        // 注入 CSS 变量
        for (const [key, value] of Object.entries(mergedVars)) {
            chatRoom.style.setProperty(key, value);
        }

        // 注入 Raw CSS (懒加载/缓存策略)
        let styleTag = document.getElementById('theme-engine-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'theme-engine-style';
            document.head.appendChild(styleTag);
        }

        const scopeSelector = safeChatId ? `#chat-room[data-theme-chat-id="${safeChatId.replace(/"/g, '\\"')}"]` : '#chat-room';
        const scopedCss = scopeThemeCss(combinedCss, scopeSelector);
        
        // 只有内容改变才重新渲染，避免重排
        if (styleTag.dataset.hash !== scopedCss) {
            styleTag.textContent = scopedCss;
            styleTag.dataset.hash = scopedCss;
        }
    }

    // 暴露 API
    return {
        init,
        saveTheme,
        getAllThemes,
        deleteTheme,
        bindThemeToChats,
        getThemesForChat,
        getChatIdsForTheme,
        applyThemeToChatRoom
    };
})();
