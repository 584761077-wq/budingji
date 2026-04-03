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

    // --- 数据压缩与解压 ---
    // 简单的字符串字典压缩 (LZW) 以减小 CSS 体积
    const LZW = {
        compress: function (uncompressed) {
            if (!uncompressed) return uncompressed;
            let i, dictionary = {}, c, wc, w = "", result = [], dictSize = 256;
            for (i = 0; i < 256; i += 1) { dictionary[String.fromCharCode(i)] = i; }
            for (i = 0; i < uncompressed.length; i += 1) {
                c = uncompressed.charAt(i);
                wc = w + c;
                if (dictionary.hasOwnProperty(wc)) { w = wc; }
                else {
                    result.push(String.fromCharCode(dictionary[w]));
                    dictionary[wc] = dictSize++;
                    w = String(c);
                }
            }
            if (w !== "") { result.push(String.fromCharCode(dictionary[w])); }
            return result.join("");
        },
        decompress: function (compressed) {
            if (!compressed) return compressed;
            let i, dictionary = [], w, result, k, entry = "", dictSize = 256;
            for (i = 0; i < 256; i += 1) { dictionary[i] = String.fromCharCode(i); }
            w = String.fromCharCode(compressed.charCodeAt(0));
            result = w;
            for (i = 1; i < compressed.length; i += 1) {
                k = compressed.charCodeAt(i);
                if (dictionary[k]) { entry = dictionary[k]; }
                else {
                    if (k === dictSize) { entry = w + w.charAt(0); }
                    else { return null; }
                }
                result += entry;
                dictionary[dictSize++] = w + entry.charAt(0);
                w = entry;
            }
            return result;
        }
    };

    // --- 核心 API ---

    async function init() {
        const db = await getDB();
        // 加载 Themes
        await new Promise((resolve) => {
            const tx = db.transaction(STORE_THEMES, 'readonly');
            const req = tx.objectStore(STORE_THEMES).getAll();
            req.onsuccess = () => {
                req.result.forEach(t => {
                    t.css = LZW.decompress(t.cssCompressed) || t.css; // 解压
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
        
        // 压缩 CSS
        const themeToSave = { ...theme };
        if (themeToSave.css) {
            themeToSave.cssCompressed = LZW.compress(themeToSave.css);
            delete themeToSave.css; // 不存明文
        }

        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_THEMES, 'readwrite');
            tx.objectStore(STORE_THEMES).put(themeToSave);
            tx.oncomplete = () => {
                cache.themes.set(theme.id, theme);
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
            
            const reqAll = store.getAll();
            reqAll.onsuccess = () => {
                const allBindings = reqAll.result;
                
                // 1. 先从所有 chatId 中移除当前 themeId，确保旧绑定被清理
                allBindings.forEach(b => {
                    b.themeIds = (b.themeIds || []).filter(id => id !== themeId);
                });
                
                // 2. 将选中的 chatIds 绑定到这个 themeId
                chatIds.forEach(chatId => {
                    let b = allBindings.find(x => x.chatId === chatId);
                    if (!b) {
                        b = { chatId, themeIds: [] };
                        allBindings.push(b);
                    }
                    // 【核心修改】：一个窗口只能绑定一个主题，直接覆盖 themeIds 数组
                    b.themeIds = [themeId];
                });

                // 3. 保存回库
                allBindings.forEach(b => {
                    store.put(b);
                    cache.bindings.set(b.chatId, b.themeIds);
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

    // --- 动态 CSS 变量注入 ---
    function applyThemeToChatRoom(chatId) {
        const chatRoom = document.getElementById('chat-room');
        if (!chatRoom) return;

        const themes = getThemesForChat(chatId);
        if (themes.length === 0) {
            // 清除变量
            chatRoom.style.cssText = '';
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
        
        // 只有内容改变才重新渲染，避免重排
        if (styleTag.dataset.hash !== combinedCss) {
            styleTag.textContent = combinedCss;
            styleTag.dataset.hash = combinedCss;
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
