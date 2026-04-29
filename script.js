// ==========================================
// 统一大文件/大文本存储 (IndexedDB) + 内存缓存
// ==========================================
const APP_VERSION = '1.2.6';

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
    
    // 新增：启动所有聊天室的后台自动总结 Worker
    if (typeof startAllAutoSummaryWorkers === 'function') {
        startAllAutoSummaryWorkers();
    }
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

function normalizeCharWalletData(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const parsedBalance = Number(data.balance);
    return {
        balance: Number.isFinite(parsedBalance) ? Number(parsedBalance) : 0,
        bills: normalizeWalletBills(data.bills)
    };
}

function normalizeLoveJournalWalletData(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const parsedBalance = Number(data.balance);
    const parsedGeneratedBalance = Number(data.generatedBalance);
    return {
        balance: Number.isFinite(parsedBalance) ? Number(parsedBalance) : 0,
        generatedBalance: Number.isFinite(parsedGeneratedBalance) ? Number(parsedGeneratedBalance) : null,
        mainCards: Array.isArray(data.mainCards) ? data.mainCards : [],
        familyCards: Array.isArray(data.familyCards) ? data.familyCards : [],
        bills: normalizeWalletBills(data.bills)
    };
}

function readWalletStoreValue(key) {
    const raw = largeStore.get(key, null);
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }
    return raw;
}

function getLoveJournalWalletDataKey(chatId) {
    return `love_journal_wallet_data_${String(chatId || '').trim()}`;
}

function getLegacyCharWalletKey(chatId) {
    return `chat_char_wallet_${String(chatId || '').trim()}`;
}

function deriveWalletBaseBalance(balance, bills) {
    const safeBalance = Number.isFinite(Number(balance)) ? Number(balance) : 0;
    const safeBills = normalizeWalletBills(bills);
    const netChange = safeBills.reduce((sum, bill) => {
        const amount = Number.isFinite(Number(bill.amount)) ? Number(bill.amount) : 0;
        return sum + (bill.type === 'income' ? amount : -amount);
    }, 0);
    return Number((safeBalance - netChange).toFixed(2));
}

function readCharWalletByChatId(chatId) {
    const loveJournalWallet = readWalletStoreValue(getLoveJournalWalletDataKey(chatId));
    if (loveJournalWallet) {
        return normalizeCharWalletData(normalizeLoveJournalWalletData(loveJournalWallet));
    }
    const legacyWallet = readWalletStoreValue(getLegacyCharWalletKey(chatId));
    return normalizeCharWalletData(legacyWallet);
}

function saveCharWalletByChatId(chatId, wallet) {
    const safeChatId = String(chatId || '').trim();
    const nextCharWallet = normalizeCharWalletData(wallet);
    const existingWallet = normalizeLoveJournalWalletData(readWalletStoreValue(getLoveJournalWalletDataKey(safeChatId)));
    const resolvedGeneratedBalance = Number.isFinite(Number(existingWallet.generatedBalance))
        ? Number(existingWallet.generatedBalance)
        : deriveWalletBaseBalance(nextCharWallet.balance, nextCharWallet.bills);
    largeStore.put(getLoveJournalWalletDataKey(safeChatId), {
        ...existingWallet,
        balance: nextCharWallet.balance,
        generatedBalance: resolvedGeneratedBalance,
        bills: nextCharWallet.bills
    });
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
        if (cssPreview) cssPreview.value = String(theme.css || '');
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
            const css = String(theme.css || '');
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
            const css = cssInput ? cssInput.value : '';
            
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

function getTimeZoneSyncEnabledKey(chatId) {
    return `chat_time_zone_sync_${chatId}`;
}

function getUserTimeZoneKey(chatId) {
    return `chat_user_time_zone_${chatId}`;
}

function getCharTimeZoneKey(chatId) {
    return `chat_char_time_zone_${chatId}`;
}

function getUserCityKey(chatId) {
    return `chat_user_city_${chatId}`;
}

function getCharCityKey(chatId) {
    return `chat_char_city_${chatId}`;
}

function getWeatherMapEnabledKey(chatId) {
    return `chat_weather_map_enabled_${chatId}`;
}

function getUserWeatherPlaceKey(chatId) {
    return `chat_user_weather_place_${chatId}`;
}

function getUserWeatherRealKey(chatId) {
    return `chat_user_weather_real_${chatId}`;
}

function getCharWeatherPlaceKey(chatId) {
    return `chat_char_weather_place_${chatId}`;
}

function getCharWeatherRealKey(chatId) {
    return `chat_char_weather_real_${chatId}`;
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

function getDefaultTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
    } catch (_) {
        return 'Asia/Shanghai';
    }
}

function isValidTimeZone(tz) {
    const zone = String(tz || '').trim();
    if (!zone) return false;
    try {
        Intl.DateTimeFormat('zh-CN', { timeZone: zone }).format(new Date());
        return true;
    } catch (_) {
        return false;
    }
}

function normalizeTimeZone(tz, fallback) {
    const safeFallback = isValidTimeZone(fallback) ? fallback : getDefaultTimeZone();
    return isValidTimeZone(tz) ? String(tz).trim() : safeFallback;
}

function readTimeZoneConfig(chatId) {
    const defaultTz = getDefaultTimeZone();
    const userTimeZone = normalizeTimeZone(localStorage.getItem(getUserTimeZoneKey(chatId)), defaultTz);
    const charTimeZone = normalizeTimeZone(localStorage.getItem(getCharTimeZoneKey(chatId)), defaultTz);
    const userCity = String(localStorage.getItem(getUserCityKey(chatId)) || '').trim();
    const charCity = String(localStorage.getItem(getCharCityKey(chatId)) || '').trim();
    const enabled = localStorage.getItem(getTimeZoneSyncEnabledKey(chatId)) === 'true';
    return { enabled, userTimeZone, charTimeZone, userCity, charCity };
}

function formatTimeInZone(timeZone, date = new Date()) {
    const safeZone = normalizeTimeZone(timeZone, getDefaultTimeZone());
    return new Intl.DateTimeFormat('zh-CN', {
        timeZone: safeZone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getTimeZoneOffsetMinutes(timeZone, date = new Date()) {
    const safeZone = normalizeTimeZone(timeZone, getDefaultTimeZone());
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: safeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((asUtc - date.getTime()) / 60000);
}

function getPeriodLabelByHour(hour) {
    if (hour >= 0 && hour < 5) return '深夜';
    if (hour < 8) return '清晨';
    if (hour < 12) return '上午';
    if (hour < 14) return '中午';
    if (hour < 18) return '下午';
    if (hour < 22) return '晚上';
    return '夜间';
}

function buildTimeZoneComputedData(chatId, date = new Date()) {
    const cfg = readTimeZoneConfig(chatId);
    const userOffset = getTimeZoneOffsetMinutes(cfg.userTimeZone, date);
    const charOffset = getTimeZoneOffsetMinutes(cfg.charTimeZone, date);
    const diffHours = (charOffset - userOffset) / 60;
    const charTime = formatTimeInZone(cfg.charTimeZone, date);
    const userTime = formatTimeInZone(cfg.userTimeZone, date);
    const charHour = Number(new Intl.DateTimeFormat('en-US', {
        timeZone: cfg.charTimeZone,
        hour12: false,
        hour: '2-digit'
    }).format(date));
    return {
        ...cfg,
        userTime,
        charTime,
        diffHours,
        diffLabel: `${diffHours >= 0 ? '+' : ''}${diffHours}h`,
        charPeriod: getPeriodLabelByHour(charHour)
    };
}

const weatherMapGeoCache = new Map();
const weatherMapWeatherCache = new Map();

function getWeatherCodeText(code) {
    const map = {
        0: '晴朗', 1: '大部晴朗', 2: '局部多云', 3: '阴天', 45: '有雾', 48: '雾凇',
        51: '毛毛雨', 53: '小雨', 55: '中雨', 56: '冻毛毛雨', 57: '冻雨',
        61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '强冻雨',
        71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '较强阵雨', 82: '强阵雨',
        85: '阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴伴冰雹', 99: '强雷暴伴冰雹'
    };
    return map[Number(code)] || '天气未知';
}

async function geocodeWeatherLocation(query) {
    const q = String(query || '').trim();
    if (!q) return null;
    if (weatherMapGeoCache.has(q)) return weatherMapGeoCache.get(q);
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=zh&format=json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('geocode failed');
        const data = await res.json();
        const item = data?.results?.[0];
        const result = item ? {
            name: item.name,
            country: item.country,
            admin1: item.admin1,
            latitude: item.latitude,
            longitude: item.longitude,
            display: [item.name, item.admin1, item.country].filter(Boolean).join('，')
        } : null;
        weatherMapGeoCache.set(q, result);
        return result;
    } catch (_) {
        weatherMapGeoCache.set(q, null);
        return null;
    }
}

async function fetchOpenMeteoWeather(lat, lon) {
    const key = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
    if (weatherMapWeatherCache.has(key)) return weatherMapWeatherCache.get(key);
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('weather failed');
        const data = await res.json();
        const current = data?.current || {};
        const result = current ? {
            temperature: current.temperature_2m,
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            code: current.weather_code,
            summary: getWeatherCodeText(current.weather_code)
        } : null;
        weatherMapWeatherCache.set(key, result);
        return result;
    } catch (_) {
        weatherMapWeatherCache.set(key, null);
        return null;
    }
}

async function buildWeatherMapComputedData(chatId) {
    const cfg = {
        enabled: localStorage.getItem(getWeatherMapEnabledKey(chatId)) === 'true',
        userPlace: String(localStorage.getItem(getUserWeatherPlaceKey(chatId)) || '').trim(),
        userReal: String(localStorage.getItem(getUserWeatherRealKey(chatId)) || '').trim(),
        charPlace: String(localStorage.getItem(getCharWeatherPlaceKey(chatId)) || '').trim(),
        charReal: String(localStorage.getItem(getCharWeatherRealKey(chatId)) || '').trim()
    };
    if (!cfg.enabled) return { ...cfg, ready: false };

    const resolveOne = async (place, real) => {
        const query = String(real || '').trim();
        if (!query) return { place, real: '', ok: false, status: '请填写真实地区' };
        const geo = await geocodeWeatherLocation(query);
        if (!geo) return { place, real: query, ok: false, status: '未找到地区坐标' };
        const weather = await fetchOpenMeteoWeather(geo.latitude, geo.longitude);
        if (!weather) return { place, real: query, ok: true, geo, status: '已识别地点，但天气获取失败' };
        return { place, real: query, ok: true, geo, weather, status: '已识别并获取天气' };
    };

    const [user, char] = await Promise.all([
        resolveOne(cfg.userPlace || '我方', cfg.userReal),
        resolveOne(cfg.charPlace || 'TA 方', cfg.charReal)
    ]);
    return { ...cfg, ready: true, user, char };
}

function buildWeatherMapPreviewText(data) {
    if (!data?.enabled) return '开启后可为双方虚构地名映射真实地区天气。';
    const user = data.user || {};
    const char = data.char || {};
    const render = (item) => {
        const lines = [`${item.place || '虚构地名'} → ${item.real || '真实地区'}`];
        if (item.geo) lines.push(`坐标：${Number(item.geo.latitude).toFixed(2)}, ${Number(item.geo.longitude).toFixed(2)}`);
        if (item.weather) lines.push(`天气：${item.weather.summary} / ${item.weather.temperature}°C / 湿度 ${item.weather.humidity ?? '未知'}% / 风速 ${item.weather.windSpeed ?? '未知'} km/h`);
        lines.push(`状态：${item.status || '未解析'}`);
        return lines.join('\n');
    };
    return `${render(user)}\n\n${render(char)}`;
}

async function buildWeatherMapPrompt(chatId) {
    const data = await buildWeatherMapComputedData(chatId);
    if (!data.enabled || !data.ready) return '';
    const formatItem = (item, label) => {
        const parts = [item.place || label, `真实地区：${item.real || '无'}`];
        if (item.geo) parts.push(`坐标：${Number(item.geo.latitude).toFixed(2)}, ${Number(item.geo.longitude).toFixed(2)}`);
        if (item.weather) parts.push(`天气：${item.weather.summary}，${item.weather.temperature}°C，湿度${item.weather.humidity ?? '未知'}%，风速${item.weather.windSpeed ?? '未知'} km/h`);
        return parts.join('；');
    };
    return `
[双方天气映射]
我方：${formatItem(data.user, '我方')}
TA 方：${formatItem(data.char, 'TA 方')}
请把“虚构地名”当作角色认知中的地点名称，但天气表现必须参考对应真实地区的实时天气；双方都要知道彼此当前天气，并自然体现在对话里。`;
}

function updateChatTimeZoneIndicator(chatId) {
    const indicatorEl = document.getElementById('chat-timezone-indicator');
    if (!indicatorEl) return;
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
        indicatorEl.style.display = 'none';
        indicatorEl.textContent = '';
        return;
    }
    const data = buildTimeZoneComputedData(safeChatId);
    if (!data.enabled) {
        indicatorEl.style.display = 'none';
        indicatorEl.textContent = '';
        return;
    }
    const charLabel = data.charCity || 'TA';
    indicatorEl.textContent = `${charLabel} ${data.charTime} (${data.diffLabel})`;
    indicatorEl.style.display = 'block';
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
    const diaries = getMemoryDiaries(chatId);
    const raw = localStorage.getItem(cursorKey);
    let parsed = parseInt(raw || '', 10);

    if (Number.isFinite(parsed)) {
        if (parsed > 0 && diaries.length === 0) {
            parsed = 0;
        }
        const clamped = Math.max(0, Math.min(parsed, historyLength));
        if (String(clamped) !== raw) {
            localStorage.setItem(cursorKey, String(clamped));
        }
        return clamped;
    }

    const fallback = 0;
    localStorage.setItem(cursorKey, String(fallback));
    return fallback;
}

const autoSummaryRunningByChat = Object.create(null);
const autoSummaryRetryCount = Object.create(null);
const autoSummaryStatusMessage = Object.create(null);

function updateManualSummaryUI(chatId) {
    const chatRoomNameEl = document.getElementById('chat-room-name');
    if (!chatRoomNameEl) return;
    const currentChatId = chatRoomNameEl.dataset.chatId || chatRoomNameEl.textContent;
    if (currentChatId !== chatId) return;

    const manualSummaryInfo = document.getElementById('manual-summary-info');
    if (manualSummaryInfo) {
        const history = largeStore.get('chat_history_' + chatId, []);
        const total = Array.isArray(history) ? history.length : 0;
        const cursor = ensureSummaryCursor(chatId);
        const pending = Math.max(0, total - cursor);
        const statusText = autoSummaryStatusMessage[chatId] || '等待中';
        
        manualSummaryInfo.innerHTML = `共 ${total} 条消息，已确认总结 ${cursor} 条，待总结 ${pending} 条。<br><span style="font-size: 0.9em; color: #888; margin-top: 4px; display: inline-block;">自动总结状态：${statusText}</span>`;
    }
}

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

function startAllAutoSummaryWorkers() {
    const chatList = JSON.parse(localStorage.getItem('global_chat_list') || '[]');
    chatList.forEach(chatId => {
        if (!chatId) return;
        const status = getAutoSummaryStatus(chatId);
        if (status.enabled && status.ready) {
            startAutoSummaryWorker(chatId);
        }
    });
}

function startAutoSummaryWorker(chatId) {
    if (!chatId || autoSummaryRunningByChat[chatId]) return;

    async function workerLoop() {
        if (!chatId) return;
        const status = getAutoSummaryStatus(chatId);
        
        if (!status.enabled) {
            autoSummaryRunningByChat[chatId] = false;
            autoSummaryStatusMessage[chatId] = '未开启自动总结';
            if (typeof updateManualSummaryUI === 'function') updateManualSummaryUI(chatId);
            return;
        }

        if (!status.ready) {
            autoSummaryRunningByChat[chatId] = false;
            autoSummaryStatusMessage[chatId] = '等待新消息';
            if (typeof updateManualSummaryUI === 'function') updateManualSummaryUI(chatId);
            return;
        }

        autoSummaryRunningByChat[chatId] = true;
        autoSummaryStatusMessage[chatId] = '总结中...';
        if (typeof updateManualSummaryUI === 'function') updateManualSummaryUI(chatId);

        try {
            // 每次只处理1个批次，避免长时间阻塞
            const processed = await runAutoSummaryBatches(chatId, status.batchSize, 1);
            autoSummaryRetryCount[chatId] = 0; // 重置重试计数
            
            if (processed > 0) {
                autoSummaryStatusMessage[chatId] = '总结成功';
                if (typeof updateManualSummaryUI === 'function') updateManualSummaryUI(chatId);
                // 立刻继续循环处理下一批
                setTimeout(workerLoop, 500);
            } else {
                autoSummaryRunningByChat[chatId] = false;
                autoSummaryStatusMessage[chatId] = '暂无需要总结的消息';
                if (typeof updateManualSummaryUI === 'function') updateManualSummaryUI(chatId);
            }
        } catch (error) {
            console.error('Auto summary worker failed:', error);
            const retries = (autoSummaryRetryCount[chatId] || 0) + 1;
            autoSummaryRetryCount[chatId] = retries;
            
            // 指数退避，最大120秒
            const backoff = Math.min(120, Math.pow(2, retries - 1) * 5);
            autoSummaryStatusMessage[chatId] = `总结失败，${backoff}秒后重试 (${error.message || '未知错误'})`;
            if (typeof updateManualSummaryUI === 'function') updateManualSummaryUI(chatId);
            
            // 定时重试
            setTimeout(workerLoop, backoff * 1000);
        }
    }

    workerLoop();
}

async function triggerAutoSummaryIfNeeded(chatId) {
    startAutoSummaryWorker(chatId);
    return 0;
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
作为${realName}，你需要为这段聊天记录写一份“极简但不失忆”的总结备忘。

请以你的第一人称视角，用最精炼的语言（符合你的人设）提炼出所有关键信息。在记录时直接称呼对方（${userName}）。

重点提取以下内容（每一项都必须明确总结，严禁遗漏，如无新进展可简要概括当前状态）：
1. 核心事件与话题：发生了什么重要的事情或聊了什么核心话题。
2. 约定与待办：我们作出了什么承诺、约定，或者未来要做的待办事项。
3. 喜恶与习惯：${userName}暴露出的新偏好、生活习惯、雷点禁忌。
4. 情感与关系：情感有何实质性进展或转折，彼此的态度变化。
5. 关键新知与细节：新出现的专属梗、重要日期、特殊状态或设定补充等。

输出要求：
第一行必须是：${summaryTimeTitle}
第二行开始正文。
拒绝流水账和过度情绪抒发！用高度浓缩的语言把核心信息压缩在最短的篇幅内。
字数尽量少，全是“干货”，确保未来无论何时回顾都不会丢失关键记忆。

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

async function runAutoSummaryBatches(chatId, batchSize, maxBatches = Infinity) {
    const normalizedBatch = normalizeMemorySummaryInput(batchSize);
    let summarized = 0;

    while (summarized < maxBatches) {
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
    const depthSelect = document.getElementById('wb-item-depth');

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
            depthSelect.value = 'front'; // 默认初始位置
            
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
            const depth = depthSelect.value || 'front';

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
                        depth,
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
                    depth,
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
    const depthSelect = document.getElementById('wb-item-depth');

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
        depthSelect.value = item.depth || 'front';

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
