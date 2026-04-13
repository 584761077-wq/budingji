// ==========================================
// 统一大文件/大文本存储 (IndexedDB) + 内存缓存
// ==========================================
const APP_VERSION = '1.1.6';

const largeStore = (() => {
    const dbName = 'budingji_large_store';
    const storeName = 'large_data';
    const version = 1;
    let dbPromise = null;

    // 内存缓存，保证业务代码依然可以同步读写大文件
    const cache = new Map();

    function getDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName, version);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName);
                    }
                };
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        }
        return dbPromise;
    }

    async function initCache() {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAllKeys();
            req.onsuccess = () => {
                const keys = req.result;
                if (keys.length === 0) {
                    resolve();
                    return;
                }
                let loaded = 0;
                keys.forEach(k => {
                    const getReq = store.get(k);
                    getReq.onsuccess = () => {
                        cache.set(k, getReq.result);
                        loaded++;
                        if (loaded === keys.length) resolve();
                    };
                    getReq.onerror = () => {
                        loaded++;
                        if (loaded === keys.length) resolve();
                    };
                });
            };
            req.onerror = () => reject(req.error);
        });
    }

 async function put(key, value) {
    // 缓存所有数据，保证业务代码同步 get 正常工作
    cache.set(key, value);

    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('largeStore put error'));
        tx.onabort = () => reject(tx.error || new Error('largeStore put aborted'));
    });
}

function get(key, defaultVal = null) {
    if (cache.has(key)) return cache.get(key);
    return defaultVal;
}

async function getAll() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const result = {};
        const req = store.openCursor();
        req.onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
                result[cursor.key] = cursor.value;
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

function remove(key) {
    cache.delete(key);
    getDB().then(db => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
    }).catch(e => console.error('largeStore remove error', e));
}

return { initCache, put, get, getAll, remove };
})();

document.addEventListener('DOMContentLoaded', async () => {
    await largeStore.initCache();
    await runLargeStoreMigration();
    
    initHeroChatWidget();

    initStandWidget();
    initApiErrorModal();
    initSettings();
    runChatIdMigration();
    runMediaMigration();
    initLineApp();
    initStickerApp();
    // 新增：初始化 ThemeEngine
    ThemeEngine.init().then(() => {
        initThemeApp();
    });
    initAppearanceSettings();
    initTopProfileWidget();

    setInterval(checkBackgroundActivity, 60000);
});

async function runLargeStoreMigration() {
    const keysToMigrate = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const isSummaryContentKey =
            k && k.startsWith('chat_summary_') &&
            !k.startsWith('chat_summary_limit_') &&
            !k.startsWith('chat_summary_cursor_');
        if (k === 'worldbook_items' || 
            (k && k.startsWith('chat_history_')) || 
            (k && k.startsWith('chat_persona_')) || 
            (k && k.startsWith('chat_user_persona_')) || 
            (k && k.startsWith('chat_long_memory_')) || 
            isSummaryContentKey ||
            (k && k.startsWith('love_journal_line_chats_'))) {
            keysToMigrate.push(k);
        }
    }
    for (const key of keysToMigrate) {
        try {
            const raw = localStorage.getItem(key);
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch(e) {
                parsed = raw;
            }
            await largeStore.put(key, parsed);
            if (key.startsWith('chat_history_')) {
                const chatId = key.replace('chat_history_', '');
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const lastMsg = parsed[parsed.length - 1];
                    localStorage.setItem('chat_last_message_' + chatId, JSON.stringify({ message: lastMsg, ts: lastMsg.ts }));
                }
            }
            localStorage.removeItem(key);
            console.log(`[LargeStore] Migrated ${key} to IndexedDB`);
        } catch(e) {
            console.error(`[LargeStore] Failed to migrate ${key}:`, e);
        }
    }

    try {
        const all = await largeStore.getAll();
        const keys = Object.keys(all || {});
        for (const key of keys) {
            if (!key) continue;
            if (key.startsWith('chat_summary_limit_') || key.startsWith('chat_summary_cursor_')) {
                let needRestore = false;
                try {
                    needRestore = localStorage.getItem(key) === null;
                } catch (e) {
                    needRestore = false;
                }
                if (!needRestore) continue;
                const val = all[key];
                try {
                    localStorage.setItem(key, String(val));
                } catch (e) {}
            }
        }
    } catch (e) {}
}

async function checkBackgroundActivity() {
    const chatList = JSON.parse(localStorage.getItem('global_chat_list') || '[]');
    const now = Date.now();
    for (const chatId of chatList) {
        if (!chatId) continue;
        const isEnabled = localStorage.getItem(getBackgroundActivityEnabledKey(chatId)) === 'true';
        if (!isEnabled) continue;
        
        const intervalStr = localStorage.getItem(getBackgroundActivityIntervalKey(chatId)) || '10';
        const intervalMin = parseInt(intervalStr, 10) || 10;
        const intervalMs = intervalMin * 60 * 1000;
        
        const lastTriggerStr = localStorage.getItem(getBackgroundActivityLastTriggerKey(chatId));
        const lastTrigger = parseInt(lastTriggerStr, 10) || 0;
        
        // 如果是从未触发过，则设置当前时间为第一次并跳过本次
        if (lastTrigger === 0) {
            localStorage.setItem(getBackgroundActivityLastTriggerKey(chatId), String(now));
            continue;
        }

        if (now - lastTrigger >= intervalMs) {
            localStorage.setItem(getBackgroundActivityLastTriggerKey(chatId), String(now));
            console.log(`[Background Activity] Triggering for chat: ${chatId}`);
            try {
                // 向系统传递这是主动发起的请求，不用追加新的用户输入
                if (typeof window.triggerAIResponse === 'function') {
                    await window.triggerAIResponse(chatId, { isBackground: true });
                } else {
                    console.warn('[Background Activity] window.triggerAIResponse is not ready yet');
                }
            } catch (e) {
                console.error('[Background Activity] Failed:', e);
            }
        }
    }
}

function createChatId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseChatMeta(raw) {
    if (!raw) return { realName: '', remark: '' };
    try {
        const parsed = JSON.parse(raw);
        return {
            realName: String(parsed?.realName || '').trim(),
            remark: String(parsed?.remark || '').trim()
        };
    } catch (error) {
        return { realName: '', remark: '' };
    }
}

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

function normalizeCharWalletData(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const parsedBalance = Number(data.balance);
    return {
        balance: Number.isFinite(parsedBalance) ? Number(parsedBalance) : 0,
        bills: normalizeWalletBills(data.bills)
    };
}

function readCharWalletByChatId(chatId) {
    const key = `chat_char_wallet_${String(chatId || '').trim()}`;
    const raw = largeStore.get(key, null);
    if (!raw) return normalizeCharWalletData(null);
    if (typeof raw === 'string') {
        try {
            return normalizeCharWalletData(JSON.parse(raw));
        } catch (error) {
            return normalizeCharWalletData(null);
        }
    }
    return normalizeCharWalletData(raw);
}

function saveCharWalletByChatId(chatId, wallet) {
    const key = `chat_char_wallet_${String(chatId || '').trim()}`;
    largeStore.put(key, normalizeCharWalletData(wallet));
}

const budingjiNotificationIconUrl = 'https://img.heliar.top/file/1772810690199_IMG_6314.jpeg';
async function budingjiEnsureNotificationPermission() {
    if (!('Notification' in window)) {
        throw new Error('当前浏览器不支持系统通知');
    }
    if (Notification.permission === 'granted') {
        return 'granted';
    }
    if (Notification.permission === 'denied') {
        throw new Error('系统通知权限已被拒绝，请在浏览器设置里重新开启');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('未获得系统通知权限');
    }
    return permission;
}

function budingjiShouldTriggerBackgroundPush() {
    const pushEnabled = localStorage.getItem('background_push_enabled') === 'true';
    const pageVisible = document.visibilityState === 'visible';
    const pageFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
    return pushEnabled && (!pageVisible || !pageFocused);
}

async function budingjiShowSystemNotification({ title, body, tag, data = {} }) {
    await budingjiEnsureNotificationPermission();
    const options = {
        body: body || '你收到了一条新消息',
        icon: budingjiNotificationIconUrl,
        badge: budingjiNotificationIconUrl,
        tag: tag || 'budingji-notification',
        renotify: true,
        data: {
            url: './index.html',
            ...data
        }
    };
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration && typeof registration.showNotification === 'function') {
                await registration.showNotification(title, options);
                return true;
            }
        } catch (error) {
        }
    }
    new Notification(title, options);
    return true;
}

const mediaDBName = 'budingji-media';
const mediaStoreName = 'images';
const mediaUrlCache = new Map();
function openMediaDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(mediaDBName, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(mediaStoreName)) {
                db.createObjectStore(mediaStoreName, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('db error'));
    });
}
function dataUrlToBlob(dataUrl) {
    const idx = dataUrl.indexOf(',');
    if (idx === -1) return null;
    const header = dataUrl.slice(0, idx);
    const base64 = dataUrl.slice(idx + 1);
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bin = atob(base64);
    const len = bin.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
}
function isMediaRef(value) {
    return typeof value === 'string' && value.startsWith('media:');
}
async function mediaPut(id, blob) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([mediaStoreName], 'readwrite');
        const store = tx.objectStore(mediaStoreName);
        store.put({ id, blob });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('tx error'));
    });
}
async function mediaGet(id) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([mediaStoreName], 'readonly');
        const store = tx.objectStore(mediaStoreName);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => reject(req.error || new Error('get error'));
    });
}
async function mediaSaveFromDataUrl(lsKey, dataUrl) {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) throw new Error('invalid data url');
    const id = encodeURIComponent(lsKey);
    await mediaPut(id, blob);
    if (mediaUrlCache.has(id)) {
        URL.revokeObjectURL(mediaUrlCache.get(id));
        mediaUrlCache.delete(id);
    }
    return 'media:' + id;
}
async function mediaResolveRef(ref) {
    if (!isMediaRef(ref)) return ref;
    const id = ref.slice(6);
    if (mediaUrlCache.has(id)) return mediaUrlCache.get(id);
    const blob = await mediaGet(id);
    if (!blob) return '';
    const url = URL.createObjectURL(blob);
    mediaUrlCache.set(id, url);
    return url;
}
async function runMediaMigration() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        keys.push(k);
    }
    for (const key of keys) {
        if (!key) continue;
        const isTarget = key === 'top_profile_avatar'
            || key === 'hero_stand_image'
            || key === 'home_wallpaper'
            || key.startsWith('chat_avatar_')
            || key.startsWith('chat_user_avatar_')
            || key.startsWith('chat_wallpaper_')
            || key.startsWith('friend_feed_wallpaper_')
            || key.startsWith('love_journal_wallpaper_');
        if (!isTarget) continue;
        let val = null;
        try { val = localStorage.getItem(key); } catch (e) {}
        if (typeof val === 'string' && val.startsWith('data:')) {
            try {
                const ref = await mediaSaveFromDataUrl(key, val);
                localStorage.setItem(key, ref);
            } catch (e) {}
        }
    }
    // Migrate data URLs inside chat histories to media refs
    for (const key of keys) {
        if (!key || !key.startsWith('chat_history_')) continue;
        let raw = null;
        try { raw = localStorage.getItem(key); } catch (e) {}
        if (!raw) continue;
        let history = [];
        try { history = JSON.parse(raw) || []; } catch (e) { history = []; }
        if (!Array.isArray(history) || history.length === 0) continue;
        let changed = false;
        for (let i = 0; i < history.length; i += 1) {
            const msg = history[i];
            if (!msg || typeof msg.content !== 'string') continue;
            if (!/src=["']data:image\//i.test(msg.content)) continue;
            const temp = document.createElement('div');
            temp.innerHTML = msg.content;
            const imgs = temp.querySelectorAll('img');
            let innerChanged = false;
            let idx = 0;
            for (const img of imgs) {
                const src = String(img.getAttribute('src') || '').trim();
                if (!/^data:image\//i.test(src)) continue;
                try {
                    const idBase = `${key}_${msg.id || i}_${idx}`;
                    const ref = await mediaSaveFromDataUrl(idBase, src);
                    img.setAttribute('src', ref);
                    const cls = String(img.getAttribute('class') || '').trim();
                    if (!/\bchat-inline-local-image\b/i.test(cls)) {
                        img.setAttribute('class', (cls ? cls + ' ' : '') + 'chat-inline-local-image');
                    }
                    innerChanged = true;
                } catch (e) {
                    // skip this image
                }
                idx += 1;
            }
            if (innerChanged) {
                msg.content = temp.innerHTML;
                changed = true;
            }
        }
        if (changed) {
            try { localStorage.setItem(key, JSON.stringify(history)); } catch (e) {}
        }
    }
}

function getChatMeta(chatId) {
    return parseChatMeta(localStorage.getItem('chat_meta_' + chatId));
}

function setChatMeta(chatId, meta) {
    const normalized = {
        realName: String(meta?.realName || '').trim(),
        remark: String(meta?.remark || '').trim()
    };
    localStorage.setItem('chat_meta_' + chatId, JSON.stringify(normalized));
}

function getChatRemark(chatId) {
    return String(localStorage.getItem('chat_remark_' + chatId) || '').trim();
}

function setChatRemark(chatId, remark) {
    const normalized = String(remark || '').trim();
    if (normalized) {
        localStorage.setItem('chat_remark_' + chatId, normalized);
    } else {
        localStorage.removeItem('chat_remark_' + chatId);
    }
    const meta = getChatMeta(chatId);
    setChatMeta(chatId, { realName: meta.realName, remark: normalized });
}

function getChatDisplayName(chatId) {
    const remark = getChatRemark(chatId);
    if (remark) return remark;
    const meta = getChatMeta(chatId);
    return meta.remark || meta.realName || '';
}

function getChatRealName(chatId) {
    return getChatMeta(chatId).realName || '';
}

function getPhoneLockKey(chatId) {
    return 'love_journal_phone_lock_' + chatId;
}

function ensurePhoneLockData(chatId) {
    if (!chatId) return null;
    try {
        const raw = localStorage.getItem(getPhoneLockKey(chatId));
        if (raw) return JSON.parse(raw);
    } catch (e) {
    }
    return null;
}

async function requestPhoneLockDataFromApi(chatId) {
    const apiUrl = localStorage.getItem('api_url');
    const apiKey = localStorage.getItem('api_key');
    const modelName = localStorage.getItem('model_name') || 'gpt-3.5-turbo';
    if (!apiUrl || !apiKey) {
        throw new Error('请先在设置中配置 API URL 和 Key');
    }
    const displayName = getChatDisplayName(chatId) || getChatRealName(chatId) || 'TA';
    const persona = largeStore.get('chat_persona_' + chatId, '');
    const longMemory = largeStore.get('chat_long_memory_' + chatId, '');
    const summary = largeStore.get('chat_summary_' + chatId, '');
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
            temperature: 0.8,
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
    if (!jsonMatch) {
        throw new Error('生成结果格式错误');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!/^\d{4}$/.test(parsed.passcode || '')) {
        throw new Error('密码格式错误');
    }
    if (!Array.isArray(parsed.questions) || parsed.questions.length !== 3) {
        throw new Error('问题数量错误');
    }
    return {
        passcode: String(parsed.passcode),
        questions: parsed.questions.map(item => ({
            q: String(item.q || '').trim(),
            a: String(item.a || '').trim()
        }))
    };
}

async function ensurePhoneLockDataAsync(chatId) {
    const existing = ensurePhoneLockData(chatId);
    if (existing) return existing;
    const generated = await requestPhoneLockDataFromApi(chatId);
    localStorage.setItem(getPhoneLockKey(chatId), JSON.stringify(generated));
    return generated;
}

function runChatIdMigration() {
    const migrationKey = 'chat_id_migration_v1_done';
    if (localStorage.getItem(migrationKey) === 'true') return;

    const existingMap = new Map();
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('chat_meta_')) continue;
        const chatId = key.slice('chat_meta_'.length);
        const meta = getChatMeta(chatId);
        if (meta.realName) {
            existingMap.set(meta.realName, chatId);
        }
    }

    const realNames = new Set();
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('chat_history_')) continue;
        const realName = key.slice('chat_history_'.length);
        if (realName) realNames.add(realName);
    }
    ['global_friends_list', 'global_chat_list'].forEach((listKey) => {
        const raw = JSON.parse(localStorage.getItem(listKey) || '[]');
        if (!Array.isArray(raw)) return;
        raw.forEach((name) => {
            const normalized = String(name || '').trim();
            if (normalized) realNames.add(normalized);
        });
    });

    const mapping = new Map(existingMap);
    const ensureChatId = (realName) => {
        const normalized = String(realName || '').trim();
        if (!normalized) return '';
        if (mapping.has(normalized)) return mapping.get(normalized);
        const newId = createChatId();
        mapping.set(normalized, newId);
        return newId;
    };

    const migrateValue = (oldKey, newKey) => {
        const value = localStorage.getItem(oldKey);
        if (value === null) return;
        if (localStorage.getItem(newKey) === null) {
            localStorage.setItem(newKey, value);
        }
    };

    realNames.forEach((realName) => {
        const chatId = ensureChatId(realName);
        if (!chatId) return;
        const remark = localStorage.getItem('chat_remark_' + realName) || '';
        const meta = getChatMeta(chatId);
        const nextMeta = {
            realName: meta.realName || realName,
            remark: meta.remark || remark
        };
        setChatMeta(chatId, nextMeta);
        if (remark && !localStorage.getItem('chat_remark_' + chatId)) {
            localStorage.setItem('chat_remark_' + chatId, remark);
        }

        migrateValue('chat_history_' + realName, 'chat_history_' + chatId);
        migrateValue('chat_persona_' + realName, 'chat_persona_' + chatId);
        migrateValue('chat_avatar_' + realName, 'chat_avatar_' + chatId);
        migrateValue('chat_remark_' + realName, 'chat_remark_' + chatId);
        migrateValue('chat_worldbooks_' + realName, 'chat_worldbooks_' + chatId);
        migrateValue('chat_wallpaper_' + realName, 'chat_wallpaper_' + chatId);
        migrateValue('chat_time_sync_' + realName, 'chat_time_sync_' + chatId);
        migrateValue('chat_time_sync_enabled_' + realName, 'chat_time_sync_' + chatId);
        migrateValue('chat_summary_' + realName, 'chat_summary_' + chatId);
        migrateValue('chat_long_memory_' + realName, 'chat_long_memory_' + chatId);
        migrateValue('chat_long_term_memory_' + realName, 'chat_long_memory_' + chatId);
        migrateValue('chat_user_realname_' + realName, 'chat_user_realname_' + chatId);
        migrateValue('chat_user_remark_' + realName, 'chat_user_remark_' + chatId);
        migrateValue('chat_user_persona_' + realName, 'chat_user_persona_' + chatId);
        migrateValue('chat_user_avatar_' + realName, 'chat_user_avatar_' + chatId);
        migrateValue('chat_signature_' + realName, 'chat_signature_' + chatId);
        migrateValue('chat_context_limit_' + realName, 'chat_context_limit_' + chatId);
        migrateValue('chat_memory_diary_' + realName, 'chat_memory_diary_' + chatId);
        migrateValue('chat_summary_limit_' + realName, 'chat_summary_limit_' + chatId);
        migrateValue('chat_auto_summary_enabled_' + realName, 'chat_auto_summary_enabled_' + chatId);
        migrateValue('chat_summary_cursor_' + realName, 'chat_summary_cursor_' + chatId);
        migrateValue('chat_unread_count_' + realName, 'chat_unread_count_' + chatId);
    });

    ['global_friends_list', 'global_chat_list'].forEach((listKey) => {
        const raw = JSON.parse(localStorage.getItem(listKey) || '[]');
        if (!Array.isArray(raw)) return;
        const next = raw.map((name) => ensureChatId(name)).filter(Boolean);
        localStorage.setItem(listKey, JSON.stringify(next));
    });

    const targetMap = JSON.parse(localStorage.getItem('sticker_category_targets_v1') || '{}');
    if (targetMap && typeof targetMap === 'object') {
        Object.keys(targetMap).forEach((categoryId) => {
            const targets = Array.isArray(targetMap[categoryId]) ? targetMap[categoryId] : [];
            const nextTargets = targets.map((target) => {
                const raw = String(target || '').trim();
                if (!raw) return '';
                if (raw === '我') return raw;
                if (mapping.has(raw)) return mapping.get(raw);
                if (localStorage.getItem('chat_meta_' + raw)) return raw;
                return raw;
            }).filter(Boolean);
            targetMap[categoryId] = nextTargets;
        });
        localStorage.setItem('sticker_category_targets_v1', JSON.stringify(targetMap));
    }

    localStorage.setItem(migrationKey, 'true');
}

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
        if (isMediaRef(savedAvatar)) {
            mediaResolveRef(savedAvatar).then((url) => {
                if (url) avatarContainer.innerHTML = `<img src="${url}" alt="Profile Avatar">`;
            });
        } else {
            avatarContainer.innerHTML = `<img src="${savedAvatar}" alt="Profile Avatar">`;
        }
    }

    avatarContainer.addEventListener('click', () => {
        avatarInput.click();
    });

    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const result = event.target.result;
            if (typeof result === 'string' && result) {
                try {
                    const ref = await mediaSaveFromDataUrl('top_profile_avatar', result);
                    localStorage.setItem('top_profile_avatar', ref);
                    const url = await mediaResolveRef(ref);
                    if (url) avatarContainer.innerHTML = `<img src="${url}" alt="Profile Avatar">`;
                } catch (e) {}
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

function showApiErrorModal(error) {
    const overlay = document.getElementById('api-error-modal');
    const messageEl = document.getElementById('api-error-message');
    if (!overlay || !messageEl) {
        alert(error?.message || error || 'API 报错');
        return;
    }

    let simpleMsgHtml = '';
    let detailMsg = '';
    
    const errMsg = error?.message || String(error);
    
    let status = null;
    const statusMatch = errMsg.match(/\b(400|401|402|403|404|413|429|500|502|503|504)\b/);
    if (statusMatch) {
        status = parseInt(statusMatch[1]);
    }
    
    if (!status) {
        if (errMsg.includes('upstream_capacity_exhausted') || errMsg.includes('service_unavailable')) status = 503;
        else if (errMsg.includes('insufficient_quota')) status = 429;
        else if (errMsg.includes('invalid_api_key')) status = 401;
        else if (errMsg.includes('model_not_found')) status = 404;
        else if (errMsg.includes('context_length_exceeded')) status = 413;
        else if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Failed to load resource')) status = '网络错误';
        else if (errMsg.includes('未返回可显示文字')) status = '内容为空';
    }
    
    let cnDesc = '发生了一个错误，请查看下方详细报错。';
    if (status === 400) cnDesc = '请求参数或格式不正确，模型无法理解。';
    else if (status === 401) cnDesc = 'API Key 无效或未授权，请检查设置。';
    else if (status === 402) cnDesc = 'API 账户余额不足或未绑定支付方式。';
    else if (status === 403) cnDesc = 'API Key 没有权限访问该模型或服务。';
    else if (status === 404) cnDesc = '找不到请求的模型或资源，请检查模型名称。';
    else if (status === 413) cnDesc = '发送的上下文太长了，超过了模型限制。';
    else if (status === 429) cnDesc = '请求太频繁或额度已耗尽，请稍等一会儿。';
    else if (status === 500) cnDesc = '服务器发生了内部错误，请稍后重试。';
    else if (status === 502) cnDesc = '网关错误，API 服务提供商当前网络存在问题。';
    else if (status === 503) cnDesc = '服务不可用或上游容量耗尽（如请求人数过多），请稍后再试。';
    else if (status === 504) cnDesc = '请求超时，模型响应太慢了，请稍后重试。';
    else if (status === '网络错误') cnDesc = '无法连接到 API，可能是网络不通或 API 地址不正确。';
    else if (status === '内容为空') cnDesc = '模型成功返回了结果，但未能生成任何可显示的文字。';
    else {
        status = 'Error';
        cnDesc = 'API 调用失败或发生未知错误，详见下方原始报错信息。';
        
        // 尝试从 JSON 中提取更友好的信息
        try {
            const parsed = JSON.parse(errMsg);
            if (parsed.error && parsed.error.code) {
                status = parsed.error.code;
            } else if (parsed.error && parsed.error.type) {
                status = parsed.error.type;
            }
        } catch(e) {
            const errMatch = errMsg.match(/"code":\s*"([^"]+)"/);
            if (errMatch) status = errMatch[1];
        }
    }

    simpleMsgHtml = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 2px;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #ff3b30;">${status}</div>
            <div style="font-size: 0.85rem; color: #1d1d1f; font-weight: 600; line-height: 1.3; text-align: left;">${cnDesc}</div>
        </div>
    `;
    
    try {
        const parts = [];
        if (error instanceof Error && typeof error.stack === 'string' && error.stack.includes('\n')) {
            parts.push(error.stack);
        }
        if (typeof error === 'string' && error.includes('\n') && (error.includes('at ') || error.includes('Error:'))) {
            parts.push(error);
        }
        if (error && typeof error === 'object') {
            if (typeof error.detail === 'string' && error.detail.trim()) parts.push(error.detail);
            if (typeof error.cause === 'string' && error.cause.trim()) parts.push(error.cause);
            const respData = error.response && error.response.data;
            if (respData) {
                parts.push(typeof respData === 'string' ? respData : JSON.stringify(respData, null, 2));
            }
        }
        detailMsg = parts.join('\n').trim();
        if (detailMsg.length > 8000) {
            detailMsg = detailMsg.slice(0, 8000) + '\n...(已截断)';
        }
    } catch (_) {
        detailMsg = '';
    }
    if (!detailMsg) {
        const normalized = (errMsg || '').trim();
        if (normalized) {
            detailMsg = normalized.length > 8000 ? normalized.slice(0, 8000) + '\n...(已截断)' : normalized;
        }
    }
    
    const simpleEl = document.getElementById('api-error-simple');
    const detailWrapEl = document.getElementById('api-error-detail-wrap');
    const detailEl = document.getElementById('api-error-detail');
    if (simpleEl && detailWrapEl && detailEl) {
        simpleEl.innerHTML = simpleMsgHtml;
        if (detailMsg) {
            detailEl.textContent = detailMsg;
            detailWrapEl.style.display = 'block';
        } else {
            detailEl.textContent = '';
            detailWrapEl.style.display = 'none';
        }
    } else {
        messageEl.innerHTML = `
            ${simpleMsgHtml}
            <div style="font-size: 0.85rem; color: #666; background: #f5f5f7; padding: 10px; border-radius: 8px; margin-bottom: 12px; max-height: 150px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">${detailMsg}</div>
        `;
    }
    
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
        if (value && isMediaRef(value)) {
            mediaResolveRef(value).then((url) => {
                if (url) {
                    standFigure.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
                    if (placeholder) placeholder.style.display = 'none';
                }
            });
            return;
        }
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
        reader.onload = async (event) => {
            const result = event.target.result;
            if (typeof result === 'string' && result) {
                try {
                    const ref = await mediaSaveFromDataUrl('hero_stand_image', result);
                    localStorage.setItem('hero_stand_image', ref);
                } catch (e) {
                    localStorage.setItem('hero_stand_image', result);
                }
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
    
    // Background keep-alive and push
    const keepAliveToggle = document.getElementById('keep-alive-toggle');
    const backgroundPushToggle = document.getElementById('background-push-toggle');
    const backgroundPushTestBtn = document.getElementById('background-push-test-btn');
    const backgroundPushTestHint = document.getElementById('background-push-test-hint');

    // System Settings: Keep-Alive variables
    let wakeLock = null;
    let silentAudio = null;

    function isBackgroundPushEnabled() {
        return !!backgroundPushToggle?.checked;
    }

    function updateBackgroundPushTestState() {
        if (backgroundPushTestHint) {
            backgroundPushTestHint.textContent = isBackgroundPushEnabled()
                ? '点一下会发一条系统通知，用来确认权限与弹窗是否正常。'
                : '先打开上面的后台推送开关，再测试系统通知。';
        }
        if (backgroundPushTestBtn) {
            backgroundPushTestBtn.disabled = !isBackgroundPushEnabled();
            backgroundPushTestBtn.style.opacity = backgroundPushTestBtn.disabled ? '0.45' : '1';
            backgroundPushTestBtn.style.cursor = backgroundPushTestBtn.disabled ? 'not-allowed' : 'pointer';
        }
    }

    async function applySystemSettings(isUserInteraction = false) {
        const keepAliveEnabled = localStorage.getItem('keep_alive_enabled') === 'true';

        if (keepAliveEnabled) {
            // 1. Screen Wake Lock
            if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock active');
                } catch (err) {
                    console.log('Wake Lock error:', err);
                }
            }

            // 2. Silent Audio Loop Hack for JS background execution
            if (!silentAudio) {
                silentAudio = document.createElement('audio');
                silentAudio.loop = true;
                // Minimal silent WAV file in base64
                silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            }
            if (isUserInteraction || silentAudio.paused) {
                silentAudio.play().catch(e => console.log('Audio autoplay prevented', e));
            }
        } else {
            // Disable Keep-Alive
            if (wakeLock) {
                wakeLock.release().then(() => { wakeLock = null; });
            }
            if (silentAudio) {
                silentAudio.pause();
            }
        }

        // Push Notifications Permission Request
        const pushEnabled = localStorage.getItem('background_push_enabled') === 'true';
        if (pushEnabled && isUserInteraction && 'Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }
    }

    // Re-acquire wake lock on visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            applySystemSettings(false);
        }
    });

    // 数据管理
    const backupBtn = document.getElementById('backup-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-data-file');
    const checkUpdateBtn = document.getElementById('check-update-btn');

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
        keepAliveToggle.checked = localStorage.getItem('keep_alive_enabled') === 'true';
        backgroundPushToggle.checked = localStorage.getItem('background_push_enabled') === 'true';
        updateBackgroundPushTestState();
        
        const savedTemp = localStorage.getItem('temperature') || '0.7';
        tempSlider.value = savedTemp;
        tempValue.textContent = savedTemp;
    }

    // 温度滑块实时显示
    tempSlider.addEventListener('input', () => {
        tempValue.textContent = tempSlider.value;
    });

    if (backgroundPushToggle) {
        backgroundPushToggle.addEventListener('change', () => {
            updateBackgroundPushTestState();
        });
    }

    if (backgroundPushTestBtn) {
        backgroundPushTestBtn.addEventListener('click', async () => {
            if (!isBackgroundPushEnabled()) {
                updateBackgroundPushTestState();
                alert('请先打开后台推送，再进行测试');
                return;
            }
            const originalText = backgroundPushTestBtn.textContent;
            backgroundPushTestBtn.textContent = '发送中...';
            backgroundPushTestBtn.disabled = true;
            try {
                await budingjiShowSystemNotification({
                    title: '后台推送测试',
                    body: '如果你看到了这条通知，说明后台推送弹窗已经正常工作。',
                    tag: 'budingji-background-push-test',
                    data: {
                        source: 'background-push-test',
                        url: './index.html'
                    }
                });
                alert('测试推送已发送，请查看系统通知。');
            } catch (error) {
                alert(error?.message || '测试推送失败');
            } finally {
                backgroundPushTestBtn.textContent = originalText;
                updateBackgroundPushTestState();
            }
        });
    }

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
        localStorage.setItem('keep_alive_enabled', keepAliveToggle.checked);
        localStorage.setItem('background_push_enabled', backgroundPushToggle.checked);
        localStorage.setItem('temperature', tempSlider.value);
        modelListContainer.style.display = 'none';
        if (modelSelectTrigger) modelSelectTrigger.classList.remove('open');
        
        applySystemSettings(true); // 应用系统设置并传递 true 表示存在用户交互
        
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

    // 数据备份/导入
    function collectAllLocalStorage() {
        const storage = {};
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key) continue;
            try {
                storage[key] = localStorage.getItem(key);
            } catch (e) {
                // skip
            }
        }
        return {
            __meta: {
                app: 'budingji',
                version: 1,
                exportedAt: new Date().toISOString()
            },
            storage
        };
    }
    async function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('read error'));
            reader.readAsDataURL(blob);
        });
    }
    async function mediaGetAll() {
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([mediaStoreName], 'readonly');
            const store = tx.objectStore(mediaStoreName);
            if (store.getAll) {
                const req = store.getAll();
                req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                req.onerror = () => reject(req.error || new Error('getAll error'));
            } else {
                const result = [];
                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        result.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(result);
                    }
                };
                cursorReq.onerror = () => reject(cursorReq.error || new Error('cursor error'));
            }
        });
    }
    async function collectAllDataWithMedia() {
        const base = collectAllLocalStorage();
        
        // 合并 largeStore 中的数据
        const largeData = await largeStore.getAll();
        for (const key of Object.keys(largeData)) {
            base.storage[key] = largeData[key];
        }

        const mediaRecords = await mediaGetAll();
        const media = {};
        for (const rec of mediaRecords) {
            if (!rec || !rec.id || !rec.blob) continue;
            try {
                media[rec.id] = await blobToDataUrl(rec.blob);
            } catch (e) {
            }
        }
        return { ...base, __media: media };
    }
    function downloadJson(obj, filename) {
        const dataStr = JSON.stringify(obj, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
        async function importFromObject(obj) {
        const payload = obj && obj.storage && typeof obj.storage === 'object' ? obj.storage : obj;
        if (!payload || typeof payload !== 'object') {
            showApiErrorModal('导入的数据格式不正确');
            return;
        }
        if (!confirm('导入将覆盖同名数据，确定继续吗？')) return;
        const mediaPayload = obj && obj.__media && typeof obj.__media === 'object' ? obj.__media : null;
        const prevMedia = new Map();
        const writtenMedia = [];
        if (mediaPayload) {
            try {
                for (const id of Object.keys(mediaPayload)) {
                    const dataUrl = mediaPayload[id];
                    let oldBlob = null;
                    try {
                        oldBlob = await mediaGet(id);
                    } catch (e) {
                        oldBlob = null;
                    }
                    prevMedia.set(id, oldBlob);
                    const blob = dataUrlToBlob(String(dataUrl || ''));
                    if (!blob) throw new Error('媒体数据无效: ' + id);
                    await mediaPut(id, blob);
                    writtenMedia.push(id);
                }
            } catch (e) {
                try {
                    for (const id of writtenMedia) {
                        const oldBlob = prevMedia.get(id);
                        if (oldBlob) {
                            await mediaPut(id, oldBlob);
                        } else {
                            const db = await openMediaDB();
                            await new Promise((resolve, reject) => {
                                const tx = db.transaction([mediaStoreName], 'readwrite');
                                const store = tx.objectStore(mediaStoreName);
                                const req = store.delete(id);
                                req.onsuccess = () => resolve(true);
                                req.onerror = () => reject(req.error || new Error('delete error'));
                            });
                        }
                    }
                } catch (_) {}
                showApiErrorModal('导入媒体失败：' + (e && e.message ? e.message : '写入失败'));
                return;
            }
        }
        const prev = new Map();
        const written = [];
               try {
            for (const key of Object.keys(payload)) {
                const newVal = payload[key];
                let prevVal = null;

                // 这些大字段统一走 largeStore，不再写 localStorage
                const isSummaryContentKey =
                    key && key.startsWith('chat_summary_') &&
                    !key.startsWith('chat_summary_limit_') &&
                    !key.startsWith('chat_summary_cursor_');
                const shouldUseLargeStore =
                    key === 'worldbook_items' ||
                    (key && key.startsWith('chat_history_')) ||
                    (key && key.startsWith('chat_persona_')) ||
                    (key && key.startsWith('chat_user_persona_')) ||
                    (key && key.startsWith('chat_long_memory_')) ||
                    isSummaryContentKey ||
                    (key && key.startsWith('love_journal_line_chats_'));

                if (shouldUseLargeStore) {
                    prevVal = largeStore.get(key, null);
                    prev.set(key, { storage: 'largeStore', value: prevVal });
                    
                    let parsedVal = newVal;
                    if (typeof newVal === 'string') {
                        try {
                            parsedVal = JSON.parse(newVal);
                        } catch (e) {
                            // ignore parse error, keep as string
                        }
                    }
                    
                    await largeStore.put(key, parsedVal);
                } else {
                    try {
                        prevVal = localStorage.getItem(key);
                    } catch (e) {}
                    prev.set(key, { storage: 'localStorage', value: prevVal });
                    let valueToSet = typeof newVal === 'string' ? newVal : JSON.stringify(newVal);
                    
                    // 自动将大容量 base64 图片转换为 media DB 引用
                    if (typeof valueToSet === 'string' && valueToSet.startsWith('data:')) {
                        try {
                            const ref = await mediaSaveFromDataUrl(key, valueToSet);
                            valueToSet = ref;
                        } catch (err) {
                            console.warn('导入时转换媒体数据失败', err);
                        }
                    }

                    try {
                        localStorage.setItem(key, valueToSet);
                    } catch (err) {
                        if (err.name === 'QuotaExceededError' || err.message.includes('quota')) {
                            throw new Error(`存储空间不足！字段 [${key}] 太大，请清理后再试。`);
                        }
                        throw err;
                    }
                }

                written.push(key);
            }
        } catch (e) {
                       try {
                for (const key of written) {
                    const oldEntry = prev.get(key);
                    if (!oldEntry) continue;

                    if (oldEntry.storage === 'largeStore') {
                        if (oldEntry.value === null || typeof oldEntry.value === 'undefined') {
                            largeStore.remove(key);
                        } else {
                            await largeStore.put(key, oldEntry.value);
                        }
                    } else {
                        if (oldEntry.value === null || typeof oldEntry.value === 'undefined') {
                            localStorage.removeItem(key);
                        } else {
                            localStorage.setItem(key, oldEntry.value);
                        }
                    }
                }
                if (writtenMedia.length > 0) {
                    for (const id of writtenMedia) {
                        const oldBlob = prevMedia.get(id);
                        if (oldBlob) {
                            await mediaPut(id, oldBlob);
                        } else {
                            const db = await openMediaDB();
                            await new Promise((resolve, reject) => {
                                const tx = db.transaction([mediaStoreName], 'readwrite');
                                const store = tx.objectStore(mediaStoreName);
                                const req = store.delete(id);
                                req.onsuccess = () => resolve(true);
                                req.onerror = () => reject(req.error || new Error('delete error'));
                            });
                        }
                    }
                }
            } catch (_) {}
            showApiErrorModal('导入失败：' + (e && e.message ? e.message : '写入失败'));
            return;
        }
        alert('导入完成，页面将刷新以应用新数据');
        location.reload();
    }
    if (backupBtn) {
        backupBtn.addEventListener('click', async () => {
            try {
                const data = await collectAllDataWithMedia();
                const ts = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const filename = `budingji-backup-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
                downloadJson(data, filename);
            } catch (e) {
                showApiErrorModal('导出失败');
            }
        });
    }
    if (importBtn && importFileInput) {
        importBtn.addEventListener('click', () => {
            importFileInput.value = '';
            importFileInput.click();
        });
        importFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const json = JSON.parse(text);
                await importFromObject(json);
            } catch (err) {
                showApiErrorModal('解析导入文件失败，请确认是有效的 JSON，或者文件是否过大。');
            }
        });
    }
 if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async () => {
        try {
            const res = await fetch(`./version.json?ts=${Date.now()}`, {
                cache: 'no-store'
            });

            if (!res.ok) {
                throw new Error('无法获取远程版本信息');
            }

            const remote = await res.json();
            const remoteVersion = String(remote.version || '').trim();
            const remoteUpdatedAt = String(remote.updatedAt || '').trim();
            const remoteNotes = String(remote.notes || '').trim();

            if (!remoteVersion) {
                throw new Error('远程版本信息无效');
            }

            if (remoteVersion === APP_VERSION) {
                alert(`当前已是最新版本\n版本号：${APP_VERSION}`);
                return;
            }

            const shouldUpdate = confirm(
                `发现新版本\n\n当前版本：${APP_VERSION}\n远程版本：${remoteVersion}\n更新时间：${remoteUpdatedAt || '未知'}\n更新说明：${remoteNotes || '无'}\n\n是否立即更新并刷新？`
            );

            if (!shouldUpdate) return;

            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) {
                    try {
                        await reg.update();
                    } catch (e) {
                        console.warn('service worker update failed:', e);
                    }
                }
            }

            alert('正在刷新到新版本...');
            location.reload();
        } catch (e) {
            alert('检查更新失败：' + (e?.message || e));
        }
    });
}
}

// 4. LINE App 功能
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
    
    // 打开 LINE
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
        const merged = [...friends, ...chats];
        const unique = [];
        const seen = new Set();

        merged.forEach((chatId) => {
            const trimmed = String(chatId || '').trim();
            if (!trimmed || seen.has(trimmed)) return;
            seen.add(trimmed);
            const label = getChatDisplayName(trimmed) || getChatRealName(trimmed) || trimmed;
            unique.push({ id: trimmed, label });
        });

        return [{ id: '我', label: '我' }, ...unique];
    };

    const openTargetModal = (categoryId) => {
        activeTargetCategoryId = categoryId;
        const targetMap = getTargetMap();
        const selectedTargets = new Set(targetMap[categoryId] || []);
        const allTargets = getChatTargets();

        targetList.innerHTML = allTargets.map((target) => `
            <label class="sticker-target-item">
                <span class="sticker-target-name">${target.label}</span>
                <input type="checkbox" class="sticker-target-checkbox" value="${target.id}" ${selectedTargets.has(target.id) ? 'checked' : ''}>
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
        const normalizeUrl = (value) => String(value || '')
            .trim()
            .replace(/^[<\(\[【]+/g, '')
            .replace(/[>\)\]】]+$/g, '')
            .replace(/[，。,.!?！？]+$/g, '');
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
            if (!trimmed) return;
            const spaceMatch = trimmed.match(/^(.+?)\s+(https?:\/\/\S+)(?:\s+.*)?$/);
            if (spaceMatch) {
                pushEmoji(spaceMatch[1], spaceMatch[2]);
                return;
            }
            const inlineUrlMatch = trimmed.match(/(https?:\/\/[^\s`，,。!！?？<>]+|www\.[^\s`，,。!！?？<>]+)/i);
            if (!inlineUrlMatch) return;
            const name = trimmed.slice(0, inlineUrlMatch.index).trim();
            if (!name) return;
            let url = inlineUrlMatch[1];
            if (/^www\./i.test(url)) {
                url = `https://${url}`;
            }
            pushEmoji(name, url);
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

function initThemeApp() {
    const themeBtn = document.getElementById('theme-icon-btn');
    const modal = document.getElementById('theme-modal');
    const closeBtn = document.getElementById('close-theme');
    const saveBtn = document.getElementById('save-theme');
    const openAddBtn = document.getElementById('open-add-theme-modal');
    const overlay = document.getElementById('add-theme-overlay');
    const cancelAddBtn = document.getElementById('cancel-add-theme');
    const confirmAddBtn = document.getElementById('confirm-add-theme');
    const nameInput = document.getElementById('theme-name-input');
    const cssInput = document.getElementById('theme-css-input');
    
    const varToggle = document.getElementById('theme-var-toggle');
    const varContainer = document.getElementById('theme-var-container');
    const varBg = document.getElementById('theme-var-bg');
    const varRemoteBg = document.getElementById('theme-var-remote-bg');
    const varRemoteColor = document.getElementById('theme-var-remote-color');
    const varLocalBg = document.getElementById('theme-var-local-bg');
    const varLocalColor = document.getElementById('theme-var-local-color');

    const categoryGrid = document.getElementById('theme-category-grid');
    const detailView = document.getElementById('theme-detail-view');
    const detailBackBtn = document.getElementById('theme-detail-back');
    const detailTitle = document.getElementById('theme-detail-title');
    const cssPreview = document.getElementById('theme-css-preview');
    const detailSaveBtn = document.getElementById('theme-detail-save');
    const detailDeleteBtn = document.getElementById('theme-detail-delete');
    const targetOverlay = document.getElementById('theme-target-overlay');
    const cancelTargetBtn = document.getElementById('cancel-theme-target');
    const saveTargetBtn = document.getElementById('save-theme-target');
    const targetList = document.getElementById('theme-target-list');

    if (!themeBtn || !modal) return;

    let activeTargetThemeId = null;
    const escapeThemeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getThemes = () => ThemeEngine.getAllThemes();

    const notifyThemeChanged = () => {
        window.dispatchEvent(new CustomEvent('theme-binding-updated'));
    };

    const getChatTargets = () => {
        const friends = JSON.parse(localStorage.getItem('global_friends_list') || '[]');
        const chats = JSON.parse(localStorage.getItem('global_chat_list') || '[]');
        const merged = [...friends, ...chats];
        const unique = [];
        const seen = new Set();
        merged.forEach((chatId) => {
            const trimmed = String(chatId || '').trim();
            if (!trimmed || seen.has(trimmed)) return;
            seen.add(trimmed);
            const label = getChatDisplayName(trimmed) || getChatRealName(trimmed) || trimmed;
            unique.push({ id: trimmed, label });
        });
        return [{ id: '我', label: '我' }, ...unique];
    };

    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    };

    const openModal = () => {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        renderThemes();
        showThemeList();
    };

    const openAddModal = () => {
        if (nameInput) nameInput.value = '';
        if (cssInput) cssInput.value = '';
        
        if (varToggle) {
            varToggle.checked = false;
            if (varContainer) varContainer.style.display = 'none';
        }

        if (varBg) varBg.value = '#f5f5f7';
        if (varRemoteBg) varRemoteBg.value = '#1d1d1f';
        if (varRemoteColor) varRemoteColor.value = '#ffffff';
        if (varLocalBg) varLocalBg.value = '#e5e5ea';
        if (varLocalColor) varLocalColor.value = '#1d1d1f';
        if (overlay) overlay.style.display = 'flex';
    };

    const closeAddModal = () => {
        if (overlay) overlay.style.display = 'none';
    };

    const closeTargetModal = () => {
        if (targetOverlay) targetOverlay.style.display = 'none';
        activeTargetThemeId = null;
    };

    let activeThemeIdForEdit = null;

    const showThemeList = () => {
        if (detailView) detailView.style.display = 'none';
        if (categoryGrid) categoryGrid.style.display = 'grid';
        activeThemeIdForEdit = null;
    };

    const showThemeDetail = (themeId) => {
        const theme = getThemes().find((item) => item.id === themeId);
        if (!theme) return;
        activeThemeIdForEdit = themeId;
        if (detailTitle) detailTitle.textContent = theme.name;
        if (cssPreview) cssPreview.value = String(theme.css || '').trim();
        if (categoryGrid) categoryGrid.style.display = 'none';
        if (detailView) detailView.style.display = 'flex';
    };

    const openTargetModal = (themeId) => {
        if (!targetOverlay || !targetList) return;
        activeTargetThemeId = themeId;
        const selectedTargets = new Set(ThemeEngine.getChatIdsForTheme(themeId) || []);
        const allTargets = getChatTargets();
        targetList.innerHTML = allTargets.map((target) => `
            <label class="theme-target-item">
                <span class="theme-target-name">${escapeThemeHtml(target.label)}</span>
                <input type="checkbox" class="theme-target-checkbox" value="${escapeThemeHtml(target.id)}" ${selectedTargets.has(target.id) ? 'checked' : ''}>
            </label>
        `).join('');
        targetOverlay.style.display = 'flex';
    };

    const renderThemes = () => {
        if (!categoryGrid) return;
        const themes = getThemes();
        if (themes.length === 0) {
            categoryGrid.innerHTML = '<div class="theme-empty">还没有主题，先点上面的 + 添加</div>';
            return;
        }
        categoryGrid.innerHTML = themes.map((theme) => {
            const css = String(theme.css || '').trim();
            const snippet = css ? css.slice(0, 140) : '自定义颜色变量';
            return `
                <div class="theme-folder-card" data-id="${escapeThemeHtml(theme.id)}">
                    <div class="theme-folder-title">${escapeThemeHtml(theme.name)}</div>
                    <pre class="theme-folder-snippet">${escapeThemeHtml(snippet)}</pre>
                    <div class="theme-folder-footer">
                        <button class="theme-folder-view-btn" type="button" data-view-id="${escapeThemeHtml(theme.id)}">编辑CSS</button>
                        <button class="theme-folder-add-btn" type="button" data-bind-id="${escapeThemeHtml(theme.id)}">绑定到...</button>
                    </div>
                </div>
            `;
        }).join('');
    };

    themeBtn.addEventListener('click', openModal);

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (saveBtn) saveBtn.addEventListener('click', closeModal);

    if (openAddBtn) openAddBtn.addEventListener('click', openAddModal);
    if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeAddModal);

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeAddModal();
        });
    }

    if (varToggle && varContainer) {
        varToggle.addEventListener('change', (e) => {
            varContainer.style.display = e.target.checked ? 'grid' : 'none';
        });
    }

    if (confirmAddBtn) {
        confirmAddBtn.addEventListener('click', async () => {
            const name = nameInput ? nameInput.value.trim() : '';
            const css = cssInput ? cssInput.value.trim() : '';
            
            // 提取变量
            let vars = {};
            if (varToggle && varToggle.checked) {
                vars = {
                    '--theme-chat-bg': varBg ? varBg.value : '#f5f5f7',
                    '--theme-remote-bubble-bg': varRemoteBg ? varRemoteBg.value : '#1d1d1f',
                    '--theme-remote-bubble-color': varRemoteColor ? varRemoteColor.value : '#ffffff',
                    '--theme-local-bubble-bg': varLocalBg ? varLocalBg.value : '#e5e5ea',
                    '--theme-local-bubble-color': varLocalColor ? varLocalColor.value : '#1d1d1f'
                };
            }

            if (!name) {
                showApiErrorModal('请填写主题名称');
                return;
            }
            
            const themeToSave = {
                id: crypto.randomUUID(),
                name,
                css,
                variables: vars
            };
            
            try {
                await ThemeEngine.saveTheme(themeToSave);
                renderThemes();
                closeAddModal();
                notifyThemeChanged();
            } catch (e) {
                showApiErrorModal('保存主题失败: ' + e.message);
            }
        });
    }

    if (categoryGrid) {
        categoryGrid.addEventListener('click', (e) => {
            const bindBtn = e.target.closest('.theme-folder-add-btn');
            if (bindBtn) {
                const themeId = String(bindBtn.dataset.bindId || '').trim();
                if (themeId) openTargetModal(themeId);
                return;
            }
            const viewBtn = e.target.closest('.theme-folder-view-btn');
            if (viewBtn) {
                const themeId = String(viewBtn.dataset.viewId || '').trim();
                if (themeId) showThemeDetail(themeId);
                return;
            }
            const card = e.target.closest('.theme-folder-card');
            if (!card) return;
            const themeId = String(card.dataset.id || '').trim();
            if (themeId) showThemeDetail(themeId);
        });
    }

    if (detailBackBtn) detailBackBtn.addEventListener('click', showThemeList);

    if (detailSaveBtn) {
        detailSaveBtn.addEventListener('click', async () => {
            if (!activeThemeIdForEdit) return;
            const theme = getThemes().find(t => t.id === activeThemeIdForEdit);
            if (theme) {
                theme.css = cssPreview ? cssPreview.value : '';
                await ThemeEngine.saveTheme(theme);
                renderThemes();
                notifyThemeChanged();
                showThemeList();
            }
        });
    }

    if (detailDeleteBtn) {
        detailDeleteBtn.addEventListener('click', async () => {
            if (!activeThemeIdForEdit) return;
            if (confirm('确定要删除这个主题吗？')) {
                await ThemeEngine.deleteTheme(activeThemeIdForEdit);
                renderThemes();
                notifyThemeChanged();
                showThemeList();
            }
        });
    }

    if (cancelTargetBtn) cancelTargetBtn.addEventListener('click', closeTargetModal);

    if (targetOverlay) {
        targetOverlay.addEventListener('click', (e) => {
            if (e.target === targetOverlay) closeTargetModal();
        });
    }

    if (saveTargetBtn) {
        saveTargetBtn.addEventListener('click', async () => {
            if (!activeTargetThemeId || !targetList) return;
            const checkedTargets = Array.from(targetList.querySelectorAll('.theme-target-checkbox:checked')).map((input) => input.value);
            
            try {
                await ThemeEngine.bindThemeToChats(activeTargetThemeId, checkedTargets);
                closeTargetModal();
            } catch (e) {
                showApiErrorModal('绑定失败: ' + e.message);
            }
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

        const realName = charData.name;
        if (!realName) {
            alert('导入失败：找不到角色名字');
            return;
        }
        const chatId = createChatId();
        setChatMeta(chatId, { realName, remark: '' });

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

        largeStore.put('chat_persona_' + chatId, persona);
        
        // 2. 保存头像
        if (avatarSrc) {
            localStorage.setItem('chat_avatar_' + chatId, avatarSrc);
        }

        // 3. 处理世界书 (Character Book)
        if (charData.character_book && charData.character_book.entries) {
            importWorldBook(chatId, realName, charData.character_book);
        }

        // 4. 处理开场白 (First Message)
        if (charData.first_mes) {
            // 检查是否已有历史记录，没有才添加
            const history = largeStore.get('chat_history_' + chatId, []);
            if (history.length === 0) {
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const msgObj = {
                    role: 'assistant',
                    content: charData.first_mes,
                    time: timeStr,
                    ts: now.getTime()
                };
                history.push(msgObj);
                largeStore.put('chat_history_' + chatId, history);
                localStorage.setItem('chat_last_message_' + chatId, JSON.stringify({ message: msgObj, ts: msgObj.ts }));
            }
        }

        // 5. 添加到好友列表和聊天列表 (如果不存在)
        addCharacterToLists(chatId, realName, avatarSrc);

        alert(`角色 "${realName}" 导入成功！`);
    }

    function importWorldBook(chatId, realName, bookData) {
        const allItems = largeStore.get('worldbook_items', []);
        const categories = JSON.parse(localStorage.getItem('worldbook_categories') || '[]');
        const safeCategories = Array.isArray(categories) ? categories : [];
        
        const baseCategoryName = `导入-${realName}`;
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

        largeStore.put('worldbook_items', allItems);

        // 自动绑定到该角色
        const existingBindings = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
        const updatedBindings = [...new Set([...existingBindings, ...newIds])];
        localStorage.setItem('chat_worldbooks_' + chatId, JSON.stringify(updatedBindings));
    }

    function addCharacterToLists(chatId, realName, avatarSrc) {
        // 检查是否已在好友列表
        const friendsList = JSON.parse(localStorage.getItem('global_friends_list') || '[]');
        if (!friendsList.includes(chatId)) {
            friendsList.unshift(chatId);
            localStorage.setItem('global_friends_list', JSON.stringify(friendsList));
        }

        // 检查是否已在聊天列表
        const chatList = JSON.parse(localStorage.getItem('global_chat_list') || '[]');
        if (!chatList.includes(chatId)) {
            chatList.unshift(chatId);
            localStorage.setItem('global_chat_list', JSON.stringify(chatList));
        }

        if (realName) {
            setChatMeta(chatId, { realName, remark: getChatRemark(chatId) });
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

function getMemoryDiaryKey(chatId) {
    return `chat_memory_diary_${chatId}`;
}

function getSummaryLimitKey(chatId) {
    return `chat_summary_limit_${chatId}`;
}

function getAutoSummaryEnabledKey(chatId) {
    return `chat_auto_summary_enabled_${chatId}`;
}

function getTimeSyncEnabledKey(chatId) {
    return `chat_time_sync_${chatId}`;
}

function getSummaryCursorKey(chatId) {
    return `chat_summary_cursor_${chatId}`;
}

function getBackgroundActivityEnabledKey(chatId) {
    return `chat_bg_activity_enabled_${chatId}`;
}

function getBackgroundActivityIntervalKey(chatId) {
    return `chat_bg_activity_interval_${chatId}`;
}

function getBackgroundActivityLastTriggerKey(chatId) {
    return `chat_bg_activity_last_trigger_${chatId}`;
}

function getMemoryDiaries(chatId) {
    return JSON.parse(localStorage.getItem(getMemoryDiaryKey(chatId)) || '[]');
}

function setMemoryDiaries(chatId, diaries) {
    localStorage.setItem(getMemoryDiaryKey(chatId), JSON.stringify(diaries));
}

function normalizeMemorySummaryInput(value) {
    return Math.max(1, parseInt(String(value || '').trim() || '30', 10) || 30);
}

function normalizeSummaryTimestamp(rawTs) {
    const value = Number(rawTs);
    if (!Number.isFinite(value)) return null;
    return value > 1e12 ? value : value * 1000;
}

function formatSummaryDateTime(ts) {
    const ms = normalizeSummaryTimestamp(ts);
    if (!ms) return '';
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

function buildSummaryTimeTitle(messages) {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const timestamps = safeMessages
        .map((msg) => normalizeSummaryTimestamp(msg?.ts))
        .filter((ts) => Number.isFinite(ts));
    if (timestamps.length === 0) {
        return '【聊天时间：时间未知】';
    }
    const startTs = Math.min(...timestamps);
    const endTs = Math.max(...timestamps);
    const startText = formatSummaryDateTime(startTs);
    const endText = formatSummaryDateTime(endTs);
    if (!startText || !endText) {
        return '【聊天时间：时间未知】';
    }
    return startTs === endTs
        ? `【聊天时间：${startText}】`
        : `【聊天时间：${startText} - ${endText}】`;
}

function isLocalImageTag(imgTag) {
    if (typeof imgTag !== 'string') return false;
    const classMatch = imgTag.match(/class=["']([^"']*)["']/i);
    const classes = classMatch ? classMatch[1] : '';
    if (/\bchat-inline-local-image\b/i.test(classes)) return true;
    const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
    const src = String(srcMatch ? srcMatch[1] : '').trim();
    if (!src) return false;
    return /^data:image\//i.test(src) || /^blob:/i.test(src) || /^media:/i.test(src);
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
            return /\bchat-inline-local-image\b/i.test(className) || /^data:image\//i.test(src) || /^blob:/i.test(src) || /^media:/i.test(src);
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

function buildMemoryLongTermText(chatId, maxItems = 20) {
    const diaries = getMemoryDiaries(chatId).sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
    return diaries
        .slice(-maxItems)
        .map((item, idx) => `${idx + 1}. ${(item.content || '').replace(/\s+/g, ' ').trim()}`)
        .filter(Boolean)
        .join('\n');
}

function syncMemoryLongTerm(chatId) {
    largeStore.put('chat_long_memory_' + chatId, buildMemoryLongTermText(chatId));
}

function ensureSummaryCursor(chatId) {
    const cursorKey = getSummaryCursorKey(chatId);
    const history = largeStore.get('chat_history_' + chatId, []);
    const historyLength = Array.isArray(history) ? history.length : 0;
    const parsed = parseInt(localStorage.getItem(cursorKey) || '', 10);
    if (Number.isFinite(parsed)) {
        const clamped = Math.max(0, Math.min(parsed, historyLength));
        if (clamped !== parsed) {
            localStorage.setItem(cursorKey, String(clamped));
        }
        return clamped;
    }
    const hasDiary = getMemoryDiaries(chatId).length > 0;
    const fallback = hasDiary ? historyLength : 0;
    localStorage.setItem(cursorKey, String(fallback));
    return fallback;
}

const autoSummaryRunningByChat = Object.create(null);

function getAutoSummaryStatus(chatId) {
    const enabled = localStorage.getItem(getAutoSummaryEnabledKey(chatId)) === 'true';
    const batchSize = normalizeMemorySummaryInput(
        localStorage.getItem(getSummaryLimitKey(chatId)) || '30'
    );
    const history = largeStore.get('chat_history_' + chatId, []);
    const total = Array.isArray(history) ? history.length : 0;
    const cursor = ensureSummaryCursor(chatId);
    const pendingCount = Math.max(0, total - cursor);

    return {
        enabled,
        batchSize,
        total,
        cursor,
        pendingCount,
        ready: enabled && pendingCount >= batchSize
    };
}

function formatAutoSummaryError(chatId, status, error) {
    const detail = error instanceof Error
        ? (error.message || '未知错误')
        : String(error || '未知错误');

    const displayName =
        getChatDisplayName(chatId) ||
        getChatRealName(chatId) ||
        `聊天 ${chatId}`;

    return [
        '聊天自动总结失败',
        `聊天对象：${displayName}`,
        `总结阈值：${status?.batchSize ?? '-' } 条`,
        `未总结消息：${status?.pendingCount ?? '-' } 条`,
        `游标位置：${status?.cursor ?? '-' } / ${status?.total ?? '-' }`,
        `错误详情：${detail}`
    ].join('\n');
}

async function triggerAutoSummaryIfNeeded(chatId) {
    if (!chatId) return 0;
    if (autoSummaryRunningByChat[chatId]) return 0;

    const status = getAutoSummaryStatus(chatId);
    if (!status.enabled) return 0;
    if (!status.ready) return 0;

    autoSummaryRunningByChat[chatId] = true;

    try {
        return await runAutoSummaryBatches(chatId, status.batchSize);
    } catch (error) {
        console.error('Auto summary failed:', error);
        showApiErrorModal(formatAutoSummaryError(chatId, status, error));
        throw error;
    } finally {
        autoSummaryRunningByChat[chatId] = false;
    }
}


async function requestMemoryDiarySummary(chatId, messages) {
    const apiUrl = localStorage.getItem('api_url');
    const apiKey = localStorage.getItem('api_key');
    const modelName = localStorage.getItem('model_name') || 'gpt-3.5-turbo';
    if (!apiUrl || !apiKey) {
        throw new Error('请先在设置中配置 API URL 和 Key');
    }
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('当前没有可总结的聊天记录');
    }

    const userName = localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || '用户';
    const charPersona = largeStore.get('chat_persona_' + chatId, '');
    const realName = getChatRealName(chatId) || chatId;
    const chatText = messages.map((msg) => {
        const speaker = msg.role === 'assistant' ? realName : userName;
        return `${speaker}: ${normalizeMemoryMessageContent(msg.content)}`;
    }).join('\n');
    const summaryTimeTitle = buildSummaryTimeTitle(messages);

    const prompt = `
你不是在写普通聊天摘要，而是在为角色长期记忆提炼“未来必须记住的信息”。

请根据下面的聊天记录，只保留对未来互动真正重要的内容，重点提炼：
- 双方关系的变化与推进
- 重要事件、冲突、安慰、和好、承诺、约定
- ${userName}或${realName}明确表现出的偏好、习惯、边界、雷点、称呼方式
- 对后续互动有影响的情绪变化、在意点和依赖感
- 会影响后续剧情和角色连续性的关键信息

请忽略：
- 普通寒暄
- 重复表达
- 没有长期意义的碎片内容
- 空泛的总结套话

输出要求：
第一行必须是：${summaryTimeTitle}
第二行开始写正文。
直接输出整理后的记忆内容，不要标题，不要分点。
语言自然、简洁、具体。
不要写成流水账，也不要写“双方聊到了”“这段对话中”。
优先写清楚“发生了什么、关系怎么变化、以后该记住什么”。
避免“感情升温”“聊天愉快”这类空话。
正文控制在100-200字。
如果没有值得保留的长期信息，只输出：无重要长期记忆

参考资料：
你的人设：${charPersona || '无'}
对方信息：${localStorage.getItem('chat_user_persona_' + chatId) || '无'}

待整理的聊天记录：
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

async function createMemoryDiaryEntry(chatId, messages) {
    const content = await requestMemoryDiarySummary(chatId, messages);
    const diaries = getMemoryDiaries(chatId);
    diaries.push({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        content
    });
    setMemoryDiaries(chatId, diaries);
    syncMemoryLongTerm(chatId);
    largeStore.put('chat_summary_' + chatId, content);
    return content;
}

async function runManualSummary(chatId, batchSize) {
    const history = largeStore.get('chat_history_' + chatId, []);
    if (!Array.isArray(history) || history.length === 0) {
        throw new Error('当前没有可总结的聊天记录');
    }
    const cursor = ensureSummaryCursor(chatId);
    const pendingCount = history.length - cursor;
    if (pendingCount <= 0) {
        throw new Error('当前没有新的聊天记录可总结');
    }
    const normalizedBatch = normalizeMemorySummaryInput(batchSize);
    const end = Math.min(cursor + normalizedBatch, history.length);
    const messages = history.slice(cursor, end);
    const content = await createMemoryDiaryEntry(chatId, messages);
    localStorage.setItem(getSummaryCursorKey(chatId), String(end));
    return content;
}

async function runRangeSummary(chatId, start, end) {
    const history = largeStore.get('chat_history_' + chatId, []);
    if (!Array.isArray(history) || history.length === 0) {
        throw new Error('当前没有可总结的聊天记录');
    }
    
    // Validate range
    if (start < 1) start = 1;
    if (end > history.length) end = history.length;
    if (start > end) {
         throw new Error('起始条数不能大于结束条数');
    }

    // Convert 1-based index to 0-based index for slice
    const startIndex = start - 1;
    const endIndex = end;

    const messages = history.slice(startIndex, endIndex);
    if (messages.length === 0) {
        throw new Error('选定范围内没有消息');
    }

    const content = await createMemoryDiaryEntry(chatId, messages);
    
    // Update cursor if we summarized past the current cursor
    const currentCursor = ensureSummaryCursor(chatId);
    if (endIndex > currentCursor) {
        localStorage.setItem(getSummaryCursorKey(chatId), String(endIndex));
    }
    
    return content;
}

async function runAutoSummaryBatches(chatId, batchSize) {
    const normalizedBatch = normalizeMemorySummaryInput(batchSize);
    let summarized = 0;

    while (true) {
        const history = largeStore.get('chat_history_' + chatId, []);
        if (!Array.isArray(history) || history.length === 0) break;

        const cursor = ensureSummaryCursor(chatId);
        const pendingCount = history.length - cursor;

        if (pendingCount < normalizedBatch) break;

        const end = Math.min(cursor + normalizedBatch, history.length);
        const messages = history.slice(cursor, end);

        if (!Array.isArray(messages) || messages.length === 0) {
            break;
        }

        await createMemoryDiaryEntry(chatId, messages);
        localStorage.setItem(getSummaryCursorKey(chatId), String(end));
        summarized += 1;
    }

    return summarized;
}

const tempChatWallpapers = {};

function getChatWallpaperStorageKey(chatId) {
    return 'chat_wallpaper_' + chatId;
}

function setTempChatWallpaper(chatId, src) {
    const prev = tempChatWallpapers[chatId];
    if (prev && prev.startsWith('blob:') && prev !== src) {
        URL.revokeObjectURL(prev);
    }
    if (src) {
        tempChatWallpapers[chatId] = src;
    } else {
        delete tempChatWallpapers[chatId];
    }
}

function applyChatWallpaper(chatId) {
    const chatRoom = document.getElementById('chat-room');
    const wallpaperLayer = document.querySelector('.chat-room-wallpaper');
    if (!chatRoom || !wallpaperLayer) return;

    const wallpaper = localStorage.getItem(getChatWallpaperStorageKey(chatId));
    const fallback = tempChatWallpapers[chatId] || '';
    const applied = wallpaper || fallback;

    if (!applied) {
        wallpaperLayer.style.backgroundImage = 'none';
        wallpaperLayer.style.opacity = '0';
        return;
    }

    // 先清空旧状态，避免切换时残留
    wallpaperLayer.style.backgroundImage = 'none';
    wallpaperLayer.style.opacity = '0';

    if (isMediaRef(applied)) {
        mediaResolveRef(applied).then((url) => {
            if (!url) {
                wallpaperLayer.style.backgroundImage = 'none';
                wallpaperLayer.style.opacity = '0';
                return;
            }
            wallpaperLayer.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
            wallpaperLayer.style.opacity = '1';

            // 强制浏览器重绘，提升即时显示稳定性
            void wallpaperLayer.offsetHeight;
        }).catch(() => {
            wallpaperLayer.style.backgroundImage = 'none';
            wallpaperLayer.style.opacity = '0';
        });
    } else {
        wallpaperLayer.style.backgroundImage = `url("${applied.replace(/"/g, '\\"')}")`;
        wallpaperLayer.style.opacity = '1';

        // 强制浏览器重绘
        void wallpaperLayer.offsetHeight;
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
        window.visualViewport.addEventListener('resize', () => {
            if (chatRoomFooter && chatRoomFooter.classList.contains('keyboard-open')) {
                // 实时同步可视区高度，让底栏完美贴紧键盘上方
                const vh = window.visualViewport.height + 'px';
                document.body.style.height = vh;
                if (chatRoom) {
                    chatRoom.style.height = vh;
                }
                window.scrollTo(0, 0); // 确保不会产生偏移
                if (chatContent) {
                    chatContent.scrollTop = chatContent.scrollHeight;
                }
            }
        });
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
        triggerAutoSummaryIfNeeded(chatId).catch((error) => {
            console.error('Auto summary trigger failed:', error);
        });
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
        msgRow.className = `message-row ${role === 'user' ? 'right' : 'left'}`;
        if (quote) msgRow.classList.add('has-quote');
        msgRow.dataset.id = id;
        msgRow.dataset.time = String(timeStr || '');
        msgRow.dataset.ts = currentMeta.ts ? String(currentMeta.ts) : '';
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
                bubbleContent += `<hr style="border:none; border-top: 1px solid rgba(0,0,0,0.1); margin: 8px 0;" /><span style="font-size:0.85em; color:#86868b;">${escapeHtml(translationText).replace(/\n/g, '<br>')}</span>`;
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
                appendMessageToUI('user', text, newMsg.time, chatId, newMsg.id, newMsg);
                inputField.value = '';
                clearPendingQuote();
            }
        });
    }

    // 点击发送按钮触发 AI
    if (sendBtn) {
        sendBtn.addEventListener('click', async () => {
            const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
            await triggerAIResponse(chatId);
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

  function buildTurnInputBlockForModel(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return '';

    const parts = messages.map((msg) => {
        if (!msg || msg.role !== 'user') return '';

        const blocks = [];
        const quote = msg.quote || (msg.extra && msg.extra.quote) || null;

        if (quote && quote.text) {
            blocks.push('[用户当前正在引用一条消息]');
            blocks.push(`引用内容：${String(quote.text).trim()}`);
        }

        blocks.push(formatTurnInputForModel(msg));

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
            const currentTurnUserMessages = currentTurnMessages.filter((msg) => msg && msg.role === 'user');
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

            const wbIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
            const allWbItems = largeStore.get('worldbook_items', []);
            const boundWorldbooks = wbIds.map(id => allWbItems.find(i => String(i.id) === String(id))).filter(Boolean);
            const wbContent = boundWorldbooks.map(item => {
                const itemKeywords = item.keywords ? `关键词: ${item.keywords}` : '关键词: 无';
                return `- ${item.name}\n  分类: ${item.category || '未分类'}\n  ${itemKeywords}\n  内容: ${item.content || ''}`;
            }).join('\n');

            const assistantBoundStickers = getAssistantBoundStickers(chatId);
            const hasBoundAssistantStickers = assistantBoundStickers.length > 0;
            const assistantStickerRuleText = hasBoundAssistantStickers
                ? assistantBoundStickers.map(item => `- ${item.name} | 分类: ${item.category} | URL: ${item.url}`).join('\n')
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
            const contextText = contextHistory.map(msg => {
                const speaker = msg.role === 'assistant' ? realName : userName;
                return formatHistoryMessageForModel(msg, speaker);
            }).join('\n');
            const pendingIncomingTransfersPrompt = buildPendingIncomingTransfersPromptForChar(chatId);

             const systemPrompt = `
严格执行以下高阶沉浸式角色扮演规则。你是${realName}，你现在正在与${userName}通过手机聊天软件（Line）进行线上聊天。
要求是真实有趣的对话，营造合适的氛围。

**【你的人设】**
${charPersona || '无'}
**【人设补充、世界设定】**
${wbContent || '无'}
**【你和${userName}之间的重要记忆】**
${longTermMemory || '无'}
**【${userName}的信息】**
${userPersona || '无'}
**【当前现实信息】**
${phoneLockPrompt || '无'}
${timeSyncPrompt}

**【可用附加功能】**（根据人设、场景需要自然使用）
${assistantStickerPromptText}
- [语音]内容[/语音]
- [图片:描述]
- [转账:金额|备注]（仅在你要主动给 ${userName} 转账时使用，必须独立成条）
- [转账处理:收款|转账ID] 或 [转账处理:拒绝|转账ID]（仅用于处理 ${userName} 发给你的待收款转账，必须独立成条）
- <quote>原文</quote>

**【待你处理的入账转账】**
${pendingIncomingTransfersPrompt}
若为“无”，你禁止输出任何 [转账处理:...] 标签。

**【输出格式与排版要求】**
1. 多条消息拆分：回复多条消息时必须用 [SPLIT] 严格分隔。禁止每轮条数一样。
2. 贴图/图片/转账排版：如果要发贴图、图片或转账标签，该标签必须**独立成条**（例如：\`文字[SPLIT][贴图:开心][SPLIT][转账:66|晚饭AA][SPLIT][转账处理:收款|transfer_xxx][SPLIT]文字\`），绝不能和文字挤在同一条内！
3. 贴图发送时机：像真人聊天一样，贴图的时机和位置要自然多变（随机开头、中间、结尾皆可），禁止每次都机械化地放在同一个位置。

**【扮演准则与禁止项】**
1.** 绝对沉浸**：永远以“我 = ${realName}”的第一人称说话。
2.** 设定铁律**：上述提供的信息必须严格遵守，禁止凭空添加新的设定或不存在的记忆。
3.** 情绪动机**：读懂 ${userName} 的情绪，再基于人设、记忆、情绪给出反应；禁止 OOC。

**【生动表达技巧】**
1. **回复**：你的回复必须生活、真实，有人味、有烟火气，但一切建立在人设的基础上。
2. **活人感**：有自己的生活、兴趣爱好、朋友社交、情绪等，不是全天都围绕着${userName}。

现在，你是${realName}，开始回复，每次回复必须严格按照以下格式和顺序输出：

<think>
1. 洞察：对方的潜台词和真实情绪是什么？
2. 反应：基于我的人设，我的真实情绪是什么？
3. 策略：我该怎么回复？是否需要使用功能？
</think>
消息1[SPLIT]消息2
<mood_sprite mood="核心情绪" color="#RRGGBB">
这里写你没发出去的真实内心可以短到一句话也可以长到一大段（吐槽/纠结/爱意/碎碎念）。
---
绝对不能让对方知道的一个念头（直白/可爱/真实/，可使用颜文字）。
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
`.trim();

            // 1. 准备各个模块的内容，去除空值污染，增强“活人感”
            const historyUserText = contextText ? `[历史上下文，仅作回复参考]\n${contextText}` : '';
            const userMessagePayload = buildUserMessagePayload(currentUserText, localImageRecords);
            const personaUserText = charPersona ? `[角色人设]\n${charPersona}` : '';
            const worldbookUserText = wbContent ? `[世界书/背景]\n${wbContent}` : '';
            const longTermMemoryText = longTermMemory ? `[核心记忆]\n${longTermMemory}` : '';
            const userPersonaText = userPersona ? `[${userName}是谁]\n${userPersona}` : '';
            const timeUserText = String(timeSyncPrompt || '').trim();

            const savedMeSchedule = largeStore.get('love_journal_imported_schedule_' + chatId, '');
            const importedWbs = largeStore.get('love_journal_imported_wbs_' + chatId, '');
            const savedHerSchedule = largeStore.get('love_journal_imported_her_schedule_' + chatId, '');
            const importedHerWbs = largeStore.get('love_journal_imported_her_wbs_' + chatId, '');
            
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

            // 2. 定义各个插入区域 (Zones) 模仿 SillyTavern 结构
            let topSystemBlocks = [systemPrompt]; // 顶部系统设定池
            let historyMessages = [];             // 历史消息池
            let bottomMessages = [];              // 底部最新消息前的池

            // 基础设定放入 System (越往上全局约束力越强)
            if (personaUserText) topSystemBlocks.push(personaUserText);
            if (userPersonaText) topSystemBlocks.push(userPersonaText);
            if (timeUserText) topSystemBlocks.push(`[当前时间]\n${timeUserText}`);

            // 记忆与历史放入 History 区块
            // 采用 system role 传递记忆和历史，可以避免模型将它们误认为是 User 的当次对话指令
            if (longTermMemoryText) historyMessages.push({ role: "system", content: longTermMemoryText });
            if (historyUserText) historyMessages.push({ role: "system", content: historyUserText });

            // 日程安排更靠近当前，放入 Bottom 区块
            if (meScheduleText) bottomMessages.push({ role: "system", content: meScheduleText });
            if (herScheduleText) bottomMessages.push({ role: "system", content: herScheduleText });

            // 3. 世界书的动态插入逻辑 (预留未来的配置项，方便后期做 UI 让用户自选)
            const wbInsertPosition = 'system_bottom'; // 可选值: system_top, system_bottom, before_history, before_latest
            
            if (worldbookUserText) {
                switch (wbInsertPosition) {
                    case 'system_top':
                        topSystemBlocks.splice(1, 0, worldbookUserText); 
                        break;
                    case 'system_bottom':
                    default:
                        topSystemBlocks.push(worldbookUserText);
                        break;
                    case 'before_history':
                        historyMessages.unshift({ role: "system", content: worldbookUserText });
                        break;
                    case 'before_latest':
                        bottomMessages.unshift({ role: "system", content: worldbookUserText });
                        break;
                }
            }

            try {
                const replyCountConfig = JSON.parse(localStorage.getItem('chat_reply_count_' + chatId) || 'null');
                if (replyCountConfig && (replyCountConfig.min || replyCountConfig.max)) {
                    const min = replyCountConfig.min || replyCountConfig.max;
                    const max = replyCountConfig.max || replyCountConfig.min;
                    topSystemBlocks.push(`\n**【回复条数限制】**\n请严格遵守回复条数限制，本次回复必须输出 ${min} 到 ${max} 条消息（使用 [SPLIT] 分隔）。`);
                }
            } catch (e) {}

            try {
                const bilingualEnabled = localStorage.getItem('chat_bilingual_' + chatId) === 'true';
                if (bilingualEnabled) {
                    topSystemBlocks.push(`\n**【双语模式】**\n用户已开启双语模式。请在回复内容的结尾处，使用 \`<translation>翻译成标准中文的内容</translation>\` 标签提供本次回复的中文翻译（无论是外语、方言还是标准中文，都请提供对应的标准中文翻译）。特别注意：如果输出仅仅是单独的emoji表情或颜文字等，没有实质性的语言文字，则不需要翻译，也不要输出 \`<translation>\` 标签。注意，只在 \`<translation>\` 标签内提供翻译结果，如果输出多条消息，则请为每条消息分别附上独立的 \`<translation>\` 标签。标签之外保持原本的角色设定和对话方式，不要让角色自己说出“这是翻译”之类的话。`);
                }
            } catch (e) {}

            // 4. 最终合并打包
            const messages = [
                { role: "system", content: topSystemBlocks.join('\n\n') },
                ...historyMessages,
                ...bottomMessages
            ];

            // 5. 压入最新一条用户指令 (必须放最后，模型对最后一条消息的指令服从度最高)
            if (isBackground) {
                messages.push({ role: "user", content: "【系统提示】距离上次聊天已经过去了一段时间。现在请你主动向我发一条消息。请完全沉浸在你的角色设定中，结合当前的时间和你的日常，自然地开启一个新话题或者分享你现在的状态。绝对不要提及“时间到了”、“主动找你”等系统指令，要表现得像是一个真实的活人随手发来的消息。" });
            } else {
                messages.push({ role: "user", content: userMessagePayload });
            }

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
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }

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
                            appendMessageToUI('assistant', failText, failMsg.time, chatId, failMsg.id, failMsg);
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

                const newMsg = saveMessage(chatId, 'assistant', msgContent, extra);
                const shouldUnread = !isChatRoomOpenFor(chatId);
                if (shouldUnread) {
                    increaseUnread(chatId);
                    showIncomingMessageToast(chatId, parsedVoice ? '发送了一条语音消息' : msgContent);
                }
                appendMessageToUI('assistant', msgContent, newMsg.time, chatId, newMsg.id, extra);
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
    const cameraActionBtn = document.getElementById('camera-action-btn');
    const transferActionBtn = document.getElementById('transfer-action-btn');
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
            ? (role === 'assistant' ? '来自 TA 的转账' : 'TA 向你转账')
            : (role === 'user' ? '转账给 TA' : '来自 User 的转账');
        return `
            <div
                class="transfer-card${safeTransfer.senderType === 'char' ? ' sender-char' : ''}${canOperate ? ' is-operable' : ''}"
                data-transfer-card="1"
                data-transfer-id="${escapeHtml(safeTransfer.id)}"
                data-msg-id="${escapeHtml(msgId || '')}"
                data-transfer-operable="${canOperate ? '1' : '0'}"
            >
                <div class="transfer-card-title">${title}</div>
                <div class="transfer-card-amount">¥${safeTransfer.amount.toFixed(2)}</div>
                <div class="transfer-card-note">备注：${note}</div>
                <div class="transfer-card-status">${statusLabel}</div>
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
        appendMessageToUI('user', text, newMsg.time, chatId, newMsg.id, newMsg);
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

    function buildCameraPlaceholderHtml(text) {
        const safeText = escapeHtml(text);
        return `<div class="camera-photo-placeholder" data-photo-text="${safeText}"><div class="camera-photo-icon"></div><div class="camera-photo-label">照片</div></div>`;
    }

    function sendCameraMessage(text) {
        const chatId = chatRoomName.dataset.chatId || chatRoomName.textContent;
        const content = buildCameraPlaceholderHtml(text);
        const extra = pendingQuote ? { quote: { id: pendingQuote.id, text: pendingQuote.text } } : {};
        const newMsg = saveMessage(chatId, 'user', content, extra);
        appendMessageToUI('user', content, newMsg.time, chatId, newMsg.id, newMsg);
        clearPendingQuote();
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
                    appendMessageToUI('user', imageContent, newMsg.time, chatId, newMsg.id, newMsg);
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
            appendMessageToUI('user', transferText, newMsg.time, chatId, newMsg.id, newMsg);
            clearPendingQuote();
            closeTransferModal();
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
            appendMessageToUI('user', rawText, newMsg.time, chatId, newMsg.id, newMsg);

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
            if (stickerBtn.classList.contains('send-mode')) {
                sendInputToScreen();
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
            appendMessageToUI('user', stickerContent, newMsg.time, chatId, newMsg.id, newMsg);
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
            const chatId = chatRoomNameEl.dataset.chatId || '';
            if (!chatId) return;
            const meta = getChatMeta(chatId);
            const remarkName = getChatRemark(chatId);
            const persona = largeStore.get('chat_persona_' + chatId, '');
            const avatarSrc = localStorage.getItem('chat_avatar_' + chatId);

            realNameInput.value = meta.realName || '';
            remarkInput.value = remarkName;
            personaInput.value = persona;
            
            // 显示 Chat 当前头像
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
                // 默认头像
                avatarDisplay.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }

            // 获取 User 已保存的数据 (针对当前聊天室)
            // Key 格式: chat_user_{field}_{realName}
            const userRealName = localStorage.getItem('chat_user_realname_' + chatId) || '';
            const userRemark = localStorage.getItem('chat_user_remark_' + chatId) || '';
            const userPersona = largeStore.get('chat_user_persona_' + chatId, '');
            const userAvatarSrc = localStorage.getItem('chat_user_avatar_' + chatId);

            userRealNameInput.value = userRealName;
            userRemarkInput.value = userRemark;
            userPersonaInput.value = userPersona;
            renderUserPresetOptions();

            // 显示 User 当前头像
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
            
            // 渲染选中的世界书
            renderSelectedWorldBooks(chatId);
            
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

            // --- 保存 Chat 设置 ---
            setChatRemark(chatId, newRemark);
            setChatMeta(chatId, { realName: newRealName, remark: newRemark });

            // 保存人设
            if (newPersona) {
                largeStore.put('chat_persona_' + chatId, newPersona);
            } else {
                largeStore.remove('chat_persona_' + chatId);
            }

            // 保存 Chat 头像
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

            // --- 保存 User 设置 ---
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

            // 保存 User 头像
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
            
            // 更新当前聊天室标题
            chatRoomNameEl.textContent = newRemark || newRealName;
            chatRoomNameEl.dataset.chatId = chatId;
            applyChatWallpaper(chatId);

            // 更新列表
            updateLists(chatId, newRealName, newRemark, newAvatarSrc);
            
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

    function updateLists(chatId, newRealName, newRemark, newAvatarSrc) {
        const displayName = newRemark || newRealName || getChatDisplayName(chatId) || getChatRealName(chatId) || chatId;
        
        // 更新好友列表
        const friendItems = document.querySelectorAll('#friends-list .group-subitem');
        friendItems.forEach(item => {
            if (item.dataset.chatId === chatId) {
                const span = item.querySelector('span');
                span.textContent = displayName;
                if (newAvatarSrc) {
                    const avatarDiv = item.querySelector('.subitem-avatar');
                    avatarDiv.innerHTML = `<img src="${newAvatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            }
        });

        // 更新聊天列表
        const chatItems = document.querySelectorAll('#line-chat-list .chat-list-item');
        chatItems.forEach(item => {
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
                localStorage.setItem('chat_reply_count_' + chatId, JSON.stringify({min: minVal, max: maxVal}));
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
            
            // 重置最后触发时间，以便立刻重新计算
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

    if (!timeSettingsBtn || !modal || !syncToggle) return;

    const syncFromStorage = () => {
        const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
        syncToggle.checked = localStorage.getItem(getTimeSyncEnabledKey(chatId)) === 'true';
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
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            localStorage.setItem(getTimeSyncEnabledKey(chatId), syncToggle.checked ? 'true' : 'false');
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
            const chatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
            renderBindingList(chatId);
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

function renderSelectedWorldBooks(chatId) {
    const display = document.getElementById('selected-worldbooks-display');
    const placeholder = document.querySelector('.selector-placeholder');
    const selectedIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + chatId) || '[]');
    const allItems = largeStore.get('worldbook_items', []);
    
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
    // 优先从独立的 meta 里拿，不再加载完整历史记录（大对象）
    const metaRaw = localStorage.getItem('chat_last_message_' + chatId);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw);
            return meta;
        } catch (e) {}
    }
    return { message: null, ts: 0 };
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

// 保存全局数据（好友列表和聊天列表的结构）
function saveGlobalData() {
    // 保存好友列表
    const friendsList = [];
    document.querySelectorAll('#friends-list .group-subitem').forEach(item => {
        const chatId = item.dataset.chatId || '';
        if (chatId) friendsList.push(chatId);
    });
    localStorage.setItem('global_friends_list', JSON.stringify(friendsList));

    // 保存聊天列表
    const chatList = [];
    document.querySelectorAll('#line-chat-list .chat-list-item').forEach(item => {
        const chatId = item.dataset.chatId || '';
        if (chatId) chatList.push(chatId);
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
        savedFriends.forEach(chatId => {
            const remark = getChatRemark(chatId);
            const realName = getChatRealName(chatId) || chatId;
            const avatarRef = localStorage.getItem('chat_avatar_' + chatId);
            const displayName = remark || realName;
            
            const item = document.createElement('div');
            item.className = 'group-subitem';
            item.dataset.chatId = chatId; // 关键：存储 chatId
            
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
        // 如果没有保存过（第一次运行），则初始化 dataset.realName 为当前静态 HTML 的内容
        friendsListContainer.querySelectorAll('.group-subitem').forEach(item => {
            const span = item.querySelector('span');
            const realName = span.textContent.trim();
            const chatId = createChatId();
            item.dataset.chatId = chatId;
            setChatMeta(chatId, { realName, remark: '' });
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
            savedChats.forEach(chatId => {
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

            const displayName = remark || name;
            const chatId = createChatId();
            setChatMeta(chatId, { realName: name, remark });
            if (remark) {
                localStorage.setItem('chat_remark_' + chatId, remark);
            }

            // 1. 添加到好友列表
            const friendItem = document.createElement('div');
            friendItem.className = 'group-subitem';
            friendItem.dataset.chatId = chatId;
            
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
    const items = largeStore.get('worldbook_items', []);
    const remaining = items.filter(item => !idSet.has(String(item.id)));
    largeStore.put('worldbook_items', remaining);

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
        
        const items = largeStore.get('worldbook_items', []);
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

        const items = largeStore.get('worldbook_items', []);
        items.push({
            id: crypto.randomUUID(),
            name: worldbookName,
            category: categoryName,
            content: pendingImport.content
        });
        largeStore.put('worldbook_items', items);

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
    const items = largeStore.get('worldbook_items', []);
    
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

            const items = largeStore.get('worldbook_items', []);
            
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

            largeStore.put('worldbook_items', items);

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

    const items = largeStore.get('worldbook_items', []);
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
        wallpaperFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const imageDataUrl = event.target.result;
                applyWallpaper(imageDataUrl);

                try {
                    if (typeof mediaSaveFromDataUrl !== 'undefined') {
                        const ref = await mediaSaveFromDataUrl('home_wallpaper', imageDataUrl);
                        localStorage.setItem('home_wallpaper', ref);
                    } else {
                        localStorage.setItem('home_wallpaper', imageDataUrl);
                    }
                } catch (err) {
                    console.error('Failed to save wallpaper:', err);
                    alert('图片太大，无法保存到本地存储，但本次会话有效。');
                }
            };
            reader.readAsDataURL(file);
            wallpaperFileInput.value = '';
        });
    }

    const savedWallpaper = localStorage.getItem('home_wallpaper');
    if (savedWallpaper) {
        if (typeof isMediaRef !== 'undefined' && isMediaRef(savedWallpaper)) {
            mediaResolveRef(savedWallpaper).then(url => {
                if (url) applyWallpaper(url);
            });
        } else {
            applyWallpaper(savedWallpaper);
        }
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
