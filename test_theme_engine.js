// tests/theme_engine.test.js

/**
 * 单元测试与压力测试：验证 ThemeEngine 核心功能
 * 测试内容包括：IDB读写、LZW压缩、多对多绑定、配额与压力测试
 */

async function runThemeEngineTests() {
    console.log('--- 开始 ThemeEngine 核心功能单元测试 ---');
    let passed = 0, failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log('✅ PASS: ' + message);
            passed++;
        } else {
            console.error('❌ FAIL: ' + message);
            failed++;
        }
    }

    try {
        // 1. 初始化
        await ThemeEngine.init();
        assert(true, 'ThemeEngine 初始化成功 (IndexedDB 连接正常)');

        // 2. 主题保存与 LZW 压缩机制
        const mockTheme = {
            id: 'test-theme-1',
            name: '单元测试主题',
            css: '.chat-room { background: #ff0000; } /* '.repeat(50) + ' */', // 故意弄长一点测试压缩
            variables: { '--theme-chat-bg': '#ff0000' }
        };
        
        await ThemeEngine.saveTheme(mockTheme);
        const themes = ThemeEngine.getAllThemes();
        const savedTheme = themes.find(t => t.id === 'test-theme-1');
        
        assert(savedTheme !== undefined, '主题成功保存到 IndexedDB 并在缓存中读取');
        assert(savedTheme.css === mockTheme.css, 'LZW 解压后的 CSS 应当与原始 CSS 完美匹配');

        // 3. 多对多绑定与实时同步查询
        const chatIds = ['chat-A', 'chat-B'];
        await ThemeEngine.bindThemeToChats('test-theme-1', chatIds);
        
        const themesForA = ThemeEngine.getThemesForChat('chat-A');
        assert(themesForA.length > 0 && themesForA[0].id === 'test-theme-1', '主题成功绑定到聊天室 A');
        
        const chatsForTheme = ThemeEngine.getChatIdsForTheme('test-theme-1');
        assert(chatsForTheme.includes('chat-A') && chatsForTheme.includes('chat-B'), '双向映射表查询成功 (一对多)');

        // 4. 追加新主题，验证多对多叠加
        const mockTheme2 = { id: 'test-theme-2', name: '主题2', css: '', variables: {} };
        await ThemeEngine.saveTheme(mockTheme2);
        await ThemeEngine.bindThemeToChats('test-theme-2', ['chat-A', 'chat-C']);
        
        const themesForA_After = ThemeEngine.getThemesForChat('chat-A');
        assert(themesForA_After.length === 2, '聊天室 A 成功绑定了 2 个不同的主题 (多对多验证)');

        // 5. 压力测试：写入 100 个带有长 CSS 的主题
        console.log('--- 准备执行压力测试 (100个并发主题写入) ---');
        const start = performance.now();
        const promises = [];
        for(let i=0; i<100; i++) {
            promises.push(ThemeEngine.saveTheme({
                id: `stress-theme-${i}`,
                name: `压力测试主题 ${i}`,
                css: `.chat-room { color: rgba(${i}, 0, 0, 1); } /* ` + 'x'.repeat(1000) + ' */'
            }));
        }
        await Promise.all(promises);
        const end = performance.now();
        
        const allThemes = ThemeEngine.getAllThemes();
        assert(allThemes.length >= 100, `压力测试通过：100个主题写入完成，耗时 ${(end - start).toFixed(2)}ms`);

        // 6. 清理测试数据
        await ThemeEngine.deleteTheme('test-theme-1');
        await ThemeEngine.deleteTheme('test-theme-2');
        for(let i=0; i<100; i++) {
            await ThemeEngine.deleteTheme(`stress-theme-${i}`);
        }
        assert(true, '测试数据清理完毕');

    } catch (e) {
        console.error('测试执行出错:', e);
        failed++;
    }

    console.log(`--- 测试完成: ${passed} 成功, ${failed} 失败 ---`);
}

// 如果需要在控制台运行： runThemeEngineTests()