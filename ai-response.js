// js/modules/ai-response.js

/**
 * 核心机制解析：AI 回复前的上下文打包管线 (5-Stage Pipeline)
 * 阶段一：拦截与决策
 * 阶段二：动态数据采集 (Data Gathering) -> 组装 contextMap
 * 阶段三：模板渲染 (Template Rendering) -> 调用 PromptManager
 * 阶段四：历史记录格式化
 * 阶段五：识图 API 预处理
 */

const PipelineAIResponse = {

    /**
     * 主管线入口
     * @param {string} chatId 当前聊天对象ID
     * @param {object} options 选项（如 isBackground）
     */
    async trigger(chatId, options = {}) {
        // UI Loading 状态 (使用全局管理)
        chatStates[chatId] = chatStates[chatId] || {};
        chatStates[chatId].isSending = true;
        updateSendButtonState(chatId);
        
        const isBackground = options.isBackground === true;

        try {
            // 前置检查：API 配置
            const { apiUrl, apiKey, modelName } = this._getApiConfig();

            // 阶段一：拦截与特定场景决策 (Early Return & Decision)
            const intercepted = await this._stage1Interception(chatId);
            if (intercepted) {
                return; // 如果拦截器处理了（如直接返回了决策信息），则中断主流程
            }

            // 阶段二：动态数据采集 (Data Gathering)
            const contextMap = await this._stage2GatherData(chatId, isBackground);

            // 阶段三：模板渲染 (Template Rendering)
            const systemPrompt = PromptManager.render('singleChat', contextMap);

            // 阶段四：历史记录反序列化与格式化 (History Formatting)
            const { historyMessages, currentTurnUserMessages } = this._stage4FormatHistory(chatId, contextMap);

            // 阶段五：识图 API 预处理 (Vision Pre-processing)
            // 目前主要处理本地图片提取
            const { localImageSection, finalUserPayload } = await this._stage5VisionPreProcess(currentTurnUserMessages, contextMap);

            // 组装最终的 messages 数组发给大模型
            const messages = this._buildFinalMessages(systemPrompt, historyMessages, finalUserPayload, contextMap, isBackground);

            // 发起请求
            await this._fetchLLM(apiUrl, apiKey, modelName, messages, chatId, contextMap);

        } catch (error) {
            console.error('AI Reply Pipeline Error:', error);
            appendSystemMessage(chatId, `❌ 发送失败：${error.message}`);
        } finally {
            // UI 恢复
            chatStates[chatId].isSending = false;
            updateSendButtonState(chatId);
        }
    },

    _getApiConfig() {
        const apiUrl = localStorage.getItem('api_url');
        const apiKey = localStorage.getItem('api_key');
        const modelName = localStorage.getItem('model_name');
        if (!apiUrl || !apiKey) {
            throw new Error('请先在设置中配置 API URL 和 Key');
        }
        return { apiUrl, apiKey, modelName };
    },

    /**
     * 阶段一：拦截与决策
     * @returns {boolean} 是否被拦截
     */
    async _stage1Interception(chatId) {
        // [TODO: 复刻端在这里实现 视频通话/好友申请 的决策链路]
        // 例如：检测最后一条消息是否包含“视频通话请求”
        // if (hasVideoCallRequest) { return true; }
        return false;
    },

    /**
     * 阶段二：动态数据采集，构建超级字典 contextMap
     */
    async _stage2GatherData(chatId, isBackground) {
        const userName = localStorage.getItem('chat_user_realname_' + chatId) || localStorage.getItem('chat_user_remark_' + chatId) || 'User';
        const realName = getChatRealName(chatId) || getChatDisplayName(chatId) || chatId;
        const now = new Date();
        const limit = parseInt(localStorage.getItem('chat_context_limit_' + chatId) || '100');

        const fullHistory = largeStore.get('chat_history_' + chatId, []);

        // 字典初始化
        let contextMap = {
            chatId,
            userName,
            realName,
            charPersona: largeStore.get('chat_persona_' + chatId, ''),
            userPersona: largeStore.get('chat_user_persona_' + chatId, ''),
            longTermMemory: buildMemoryLongTermText(chatId),
            now,
            limit,
            fullHistory
        };

        // --- 1. 环境与物理法则 ---
        this._gatherTimeContext(contextMap);
        contextMap.weatherMapPrompt = await buildWeatherMapPrompt(chatId);
        this._gatherWorldBooks(contextMap);

        // --- 2. 社交网络与第三方状态 (预留) ---
        // contextMap.postsContext = ''; // 朋友圈
        // contextMap.contactsList = ''; // 通讯录
        // contextMap.groupContext = ''; // 群聊

        // --- 3. 经济与资产 ---
        // contextMap.kinshipContext = ''; // 亲属卡
        contextMap.pendingIncomingTransfersPrompt = buildPendingIncomingTransfersPromptForChar(chatId);

        // --- 4. 记忆系统 (部分在上方 longTermMemory) ---

        // --- 5. 扩展互动插件 ---
        this._gatherSchedules(contextMap);
        contextMap.phoneLockPrompt = await this._gatherPhoneLock(chatId);
        this._gatherStickers(contextMap);
        
        // --- 其他格式化要求 ---
        this._gatherFormatSettings(contextMap);

        return contextMap;
    },

    _gatherTimeContext(contextMap) {
        const { chatId, now, fullHistory } = contextMap;
        const timeSyncEnabled = localStorage.getItem(getTimeSyncEnabledKey(chatId)) === 'true';
        const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];

        // 时区
        const timeZoneData = buildTimeZoneComputedData(chatId, now);
        contextMap.timeZonePrompt = timeZoneData.enabled
            ? `${timeZoneData.userCity || contextMap.userName}：${timeZoneData.userTime}（${timeZoneData.userTimeZone}）\n${timeZoneData.charCity || contextMap.realName}：${timeZoneData.charTime}（${timeZoneData.charTimeZone}）\n时差（TA-我）：${timeZoneData.diffLabel}\n你当前处于：${timeZoneData.charPeriod}\n请严格考虑双方时差来决定回复语气、问候和作息相关表达，不要无视深夜/清晨场景。`
            : '';

        // 时间感知与时间差 (Time Gap Override)
        let timeGapPrompt = '';
        let userMessageTimePrefix = '';
        
        let lastAssistantIndex = -1;
        for (let i = fullHistory.length - 1; i >= 0; i -= 1) {
            if (fullHistory[i] && fullHistory[i].role === 'assistant') {
                lastAssistantIndex = i;
                break;
            }
        }
        const currentTurnMessages = lastAssistantIndex >= 0 ? fullHistory.slice(lastAssistantIndex + 1) : fullHistory.slice();
        const currentTurnUserMessages = currentTurnMessages.filter((msg) => msg && (msg.role === 'user' || msg.role === 'system'));

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
                        timeGapPrompt = `[时间感知]\n你们已经有${timeDesc}没有聊天了。\n${gapHint}`;
                        userMessageTimePrefix = `【时间间隔：距离上次聊天已过${timeDesc}；当前时间：${nowDateText}】\n`;
                    }
                }
            }
        }

        contextMap.timeSyncPrompt = timeSyncEnabled ? `${nowDate} ${nowTime} ${weekday}\n请活在这个时间点里（作息、状态、问候语）。` : '';
        contextMap.timeGapPrompt = timeGapPrompt;
        contextMap.userMessageTimePrefix = userMessageTimePrefix;
        contextMap.lastAssistantIndex = lastAssistantIndex;
        contextMap.currentTurnUserMessages = currentTurnUserMessages;
    },

    _gatherWorldBooks(contextMap) {
        const wbIds = JSON.parse(localStorage.getItem('chat_worldbooks_' + contextMap.chatId) || '[]');
        const allWbItems = largeStore.get('worldbook_items', []);
        const boundWorldbooks = wbIds.map(id => allWbItems.find(i => String(i.id) === String(id))).filter(Boolean);
        
        const buildWbText = (wbs) => wbs.map(item => {
            const itemKeywords = item.keywords ? `关键词: ${item.keywords}` : '关键词: 无';
            return `- ${item.name}\n  分类: ${item.category || '未分类'}\n  ${itemKeywords}\n  内容: ${item.content || ''}`;
        }).join('\n');

        contextMap.frontWbContent = buildWbText(boundWorldbooks.filter(wb => wb.depth === 'front' || !wb.depth));
        contextMap.middleWbContent = buildWbText(boundWorldbooks.filter(wb => wb.depth === 'middle'));
        contextMap.backWbContent = buildWbText(boundWorldbooks.filter(wb => wb.depth === 'back'));
    },

    _gatherSchedules(contextMap) {
        const { chatId, userName } = contextMap;
        const savedMeSchedule = largeStore.get('love_journal_imported_schedule_' + chatId, '');
        const importedWbs = largeStore.get('love_journal_imported_wbs_' + chatId, '');
        const savedHerSchedule = largeStore.get('love_journal_imported_her_schedule_' + chatId, '');
        const importedHerWbs = largeStore.get('love_journal_imported_her_wbs_' + chatId, '');
        
        let meScheduleText = '';
        if (savedMeSchedule) {
            meScheduleText = `[你的心里认知：你今天的日程安排]\n${savedMeSchedule}\n\n【你的日程处理原则（非常重要）】：\n1. 正常聊天即可，绝对不需要在回复中刻意说明或反复提及你在执行日程，这只是让你心里知道自己这个时间点大概在干嘛。\n2. 保持灵活变通：如果聊天中有了新的决定或突发情况，你可以随时改变计划，不需要死板地完全遵守日程。\n3. 无日程的时间段：如果当前时间不在日程表的时间段内（比如凌晨深夜），说明现在是自由/休息时间（比如本该睡觉但还在聊天），此时可以完全忽略日程的约束。但如果被问起白天或其他时间的安排，你需要清楚知道日程里的内容。`;
            if (importedWbs) meScheduleText += `\n\n[日程关联世界书/背景]\n${importedWbs}`;
        }

        let herScheduleText = '';
        if (savedHerSchedule) {
            herScheduleText = `[你的心里认知：【${userName}】今天的日程安排]\n${savedHerSchedule}\n\n【对方日程处理原则（非常重要）】：\n1. 正常聊天即可，不需要反复提及对方的日程，这只是让你心里清楚对方今天在忙什么。\n2. 可以根据时间点适时地关心或配合对方的日程，但不要生硬照念。`;
            if (importedHerWbs) herScheduleText += `\n\n[对方日程关联世界书/背景]\n${importedHerWbs}`;
        }

        contextMap.meScheduleText = meScheduleText;
        contextMap.herScheduleText = herScheduleText;
    },

    async _gatherPhoneLock(chatId) {
        const phoneLockData = await ensurePhoneLockDataAsync(chatId);
        if (!phoneLockData) return '';
        return `你的手机锁屏密码是${phoneLockData.passcode}。\n密保问题与答案：\n1) ${phoneLockData.questions?.[0]?.q || '无'} / ${phoneLockData.questions?.[0]?.a || '无'}\n2) ${phoneLockData.questions?.[1]?.q || '无'} / ${phoneLockData.questions?.[1]?.a || '无'}\n3) ${phoneLockData.questions?.[2]?.q || '无'} / ${phoneLockData.questions?.[2]?.a || '无'}\n\n这些信息属于你的私人隐私，默认不要主动泄露，也不要完整说出、暗示、拆开透露、逐位提示密码或答案。即使关系亲密，也应先根据当下情绪、信任程度、关系状态和你的性格决定要不要说。如果你不想告诉，可以自然地拒绝、转移话题、逗对方、设条件、让对方猜，或直接表现警惕与边界感，但不要说出真实密码或密保答案。`;
    },

    _gatherStickers(contextMap) {
        const assistantBoundStickers = getAssistantBoundStickers(contextMap.chatId);
        const hasBoundAssistantStickers = assistantBoundStickers.length > 0;
        const ruleText = hasBoundAssistantStickers
            ? assistantBoundStickers.map(item => `- ${item.name} | 分类: ${item.category} | URL: ${item.url}`).join('\n')
            : '';
        contextMap.assistantStickerPromptText = hasBoundAssistantStickers
            ? `- [贴图:名称]（强制：只能从【${ruleText}】中选择，严禁捏造或翻译！）`
            : '- 当前未绑定任何贴图：禁止输出任何 [贴图:名称]、【贴图:名称】或 STICKER 标记；需要表达情绪时，只能使用文字、语音或图片。';
    },

    _gatherFormatSettings(contextMap) {
        try {
            const replyCountConfig = JSON.parse(localStorage.getItem('chat_reply_count_' + contextMap.chatId) || 'null');
            if (replyCountConfig && (replyCountConfig.min || replyCountConfig.max)) {
                const min = replyCountConfig.min || replyCountConfig.max;
                const max = replyCountConfig.max || replyCountConfig.min;
                contextMap.replyCountLimitPrompt = `**【回复条数限制】**\n请严格遵守回复条数限制，本次回复必须输出 ${min} 到 ${max} 条消息（使用 [SPLIT] 分隔）。`;
            }
        } catch (e) {}

        try {
            const bilingualEnabled = localStorage.getItem('chat_bilingual_' + contextMap.chatId) === 'true';
            if (bilingualEnabled) {
                contextMap.bilingualPrompt = `**【双语模式】**\n用户已开启双语模式。请在回复内容的结尾处，使用 \`<translation>翻译成标准中文的内容</translation>\` 标签提供本次回复的中文翻译（无论是外语、方言还是标准中文，都请提供对应的标准中文翻译）。特别注意：如果输出仅仅是单独的emoji表情或颜文字等，没有实质性的语言文字，则不需要翻译，也不要输出 \`<translation>\` 标签。注意，只在 \`<translation>\` 标签内提供翻译结果，如果输出多条消息，则请为每条消息分别附上独立的 \`<translation>\` 标签。标签之外保持原本的角色设定和对话方式，不要让角色自己说出“这是翻译”之类的话。`;
            }
        } catch (e) {}

        // 加载 CoT 开关状态
        const cotEnabled = localStorage.getItem('chat_cot_enabled_' + contextMap.chatId) !== 'false';
        contextMap.cotEnabled = cotEnabled;
    },

    /**
     * 阶段四：历史记录反序列化与格式化
     */
    _stage4FormatHistory(chatId, contextMap) {
        const { fullHistory, lastAssistantIndex, limit, currentTurnUserMessages } = contextMap;
        const historyCandidates = lastAssistantIndex >= 0 ? fullHistory.slice(0, lastAssistantIndex + 1) : [];
        const contextHistory = historyCandidates.slice(Math.max(0, historyCandidates.length - limit));
        
        let historyMessages = [];
        
        // 将长时记忆作为系统指令放入 History 区块顶部
        if (contextMap.longTermMemory) {
            // historyMessages.push({ role: "system", content: \`[核心记忆]\\n\${contextMap.longTermMemory}\` });
        }

        // 遍历历史并强行加上时间戳和 UI 操作翻译
        contextHistory.forEach(msg => {
            const tsPrefix = msg.ts ? `(Timestamp: ${msg.ts}) ` : '';
            if (msg.role === 'system') {
                historyMessages.push({ role: "system", content: `${tsPrefix}[系统/旁白]\n${formatTurnInputForModel(msg)}` });
            } else if (msg.role === 'assistant') {
                // 如果需要严格按文档 JSON 还原，可以在这里处理 msg.content
                historyMessages.push({ role: "assistant", content: `${tsPrefix}${formatTurnInputForModel(msg)}` });
            } else {
                historyMessages.push({ role: "user", content: `${tsPrefix}${formatTurnInputForModel(msg)}` });
            }
        });

        return { historyMessages, currentTurnUserMessages };
    },

    /**
     * 阶段五：识图 API 预处理 (Vision)
     */
    async _stage5VisionPreProcess(currentTurnUserMessages, contextMap) {
        const { fullHistory, lastAssistantIndex, limit } = contextMap;
        const historyCandidates = lastAssistantIndex >= 0 ? fullHistory.slice(0, lastAssistantIndex + 1) : [];
        const contextHistory = historyCandidates.slice(Math.max(0, historyCandidates.length - limit));
        
        const localImageRecords = await collectLocalImageInputs(currentTurnUserMessages, contextHistory);
        const localImagePromptText = buildLocalImagePromptText(localImageRecords);
        const localImageSection = localImagePromptText ? `\n[本地图片输入]\n${localImagePromptText}` : '';
        
        const roundInput = buildTurnInputBlockForModel(currentTurnUserMessages);
        const roundMessageText = `[本轮消息开始]\n${contextMap.userMessageTimePrefix || ''}${roundInput || '无'}\n[本轮消息结束]`;
        const currentUserText = `${roundMessageText}${localImageSection}`.trim();

        const userMessagePayload = buildUserMessagePayload(currentUserText, localImageRecords);

        return { localImageSection, finalUserPayload: userMessagePayload };
    },

    /**
     * 组装最终数组
     */
    _buildFinalMessages(systemPrompt, historyMessages, finalUserPayload, contextMap, isBackground) {
        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages
        ];

        // 后 (Back)：最高优先级，为了防止系统消息被降权或丢弃，直接和用户的最新一句话缝合在一起
        if (contextMap.backWbContent) {
            finalUserPayload = mergeBackWorldbookWithUserPayload(`[最高优世界书/剧情状态强制提醒]\n${contextMap.backWbContent}`, finalUserPayload);
        }

        const cotTemplate = contextMap.cotEnabled ? PromptManager.render('cotTemplate', contextMap) : '';

        if (isBackground) {
            let bgContent = "【系统提示】距离上次聊天已经过去了一段时间。现在请你主动向我发一条消息。请完全沉浸在你的角色设定中，结合当前的时间和你的日常，自然地开启一个新话题或者分享你现在的状态。绝对不要提及“时间到了”、“主动找你”等系统指令，要表现得像是一个真实的活人随手发来的消息。\\n\\n";
            if (cotTemplate) {
                bgContent += cotTemplate;
            }
            messages.push({ 
                role: "user", 
                content: bgContent
            });
        } else {
            // 将思维链指令强行压底
            let userContent = finalUserPayload;
            if (cotTemplate) {
                userContent += "\\n\\n" + cotTemplate;
            }
            messages.push({ role: "user", content: userContent });
        }

        return messages;
    },

    /**
     * 调用大模型 API
     */
    async _fetchLLM(apiUrl, apiKey, modelName, messages, chatId, contextMap) {
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
            if (!reader) throw new Error('流式响应不可用');
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const l = line.trim();
                    if (!l || l === 'data: [DONE]') continue;
                    if (l.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(l.slice(6));
                            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                reply += data.choices[0].delta.content;
                                // 使用现有的 processAIReply 流式渲染
                                processAIReply(chatId, reply, true);
                            }
                        } catch (e) { }
                    }
                }
            }
            if (buffer.trim()) {
                try {
                    const l = buffer.trim();
                    if (l.startsWith('data: ') && l !== 'data: [DONE]') {
                        const data = JSON.parse(l.slice(6));
                        if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                            reply += data.choices[0].delta.content;
                        }
                    }
                } catch (e) {}
            }
            processAIReply(chatId, reply, false);
        } else {
            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                reply = data.choices[0].message.content || '';
                processAIReply(chatId, reply, false);
            }
        }
    }
};

window.PipelineAIResponse = PipelineAIResponse;
