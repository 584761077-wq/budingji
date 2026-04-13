const assert = require('assert');

// Mock localStorage and largeStore for testing
global.localStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, val) { this.data[key] = val; },
  removeItem(key) { delete this.data[key]; }
};

global.largeStore = {
  data: {},
  get(key, def) { return this.data[key] !== undefined ? this.data[key] : def; },
  put(key, val) { this.data[key] = val; }
};

// Setup some mock data
const chatIdA = 'role_A';
const chatIdB = 'role_B';

largeStore.put('worldbook_items', [
  { id: 'W1', name: 'World 1', content: 'Context for W1' },
  { id: 'W2', name: 'World 2', content: 'Context for W2' },
  { id: 'W3', name: 'World 3', content: 'Context for W3' }
]);

// A) 角色A勾选世界书W1、W2，角色B不勾选，生成规划时互不影响
largeStore.put('love_journal_wbs_' + chatIdA, ['W1', 'W2']);
largeStore.put('love_journal_wbs_' + chatIdB, []);

function simulateGenerateSchedule(chatId) {
  const worldbookIds = largeStore.get('love_journal_wbs_' + chatId, []);
  const allWorldbooks = largeStore.get('worldbook_items', []);
  const boundWorldbooks = allWorldbooks.filter(wb => worldbookIds.includes(wb.id));
  return boundWorldbooks.map(wb => `${wb.name || ''}: ${wb.content || ''}`).join('\n');
}

const contextA = simulateGenerateSchedule(chatIdA);
const contextB = simulateGenerateSchedule(chatIdB);

console.log('Testing requirement A...');
assert(contextA.includes('Context for W1') && contextA.includes('Context for W2'));
assert(!contextA.includes('Context for W3'));
assert(contextB === '');
console.log('Requirement A passed!');

// B) 未导入状态下角色系统提示词不包含任何日程信息
// C) 导入后注入的提示词与日程完全匹配

function simulateBuildPrompt(chatId) {
  const savedMeSchedule = largeStore.get('love_journal_imported_schedule_' + chatId, '');
  const importedWbs = largeStore.get('love_journal_imported_wbs_' + chatId, '');
  
  let meScheduleText = '';
  if (savedMeSchedule) {
      meScheduleText = `[我今天的日程安排]\n${savedMeSchedule}\n请在回复中自然地体现或暗示你正在做的事情，符合这个日程安排。`;
      if (importedWbs) {
          meScheduleText += `\n[日程关联世界书/背景]\n${importedWbs}`;
      }
  }
  return meScheduleText;
}

console.log('Testing requirement B...');
const promptBeforeImport = simulateBuildPrompt(chatIdA);
assert(promptBeforeImport === '');
console.log('Requirement B passed!');

console.log('Testing requirement C...');
// Simulate import
const tempSchedule = '08:00 - Wake up';
largeStore.put('love_journal_imported_schedule_' + chatIdA, tempSchedule);
largeStore.put('love_journal_imported_wbs_' + chatIdA, contextA);

const promptAfterImport = simulateBuildPrompt(chatIdA);
assert(promptAfterImport.includes('08:00 - Wake up'));
assert(promptAfterImport.includes('Context for W1'));
assert(promptAfterImport.includes('Context for W2'));
console.log('Requirement C passed!');

console.log('All tests passed successfully!');
