/**
 * KeepSync - Notes, Snippets & Web Clipper for Google Keep
 * Automated Verification Test Suite
 * Tests: KeepStorage CRUD, Checklist toggling, Trash lifecycle, Tag extraction,
 *        Search & Filtering, Google Keep sync queue, JSON/MD/CSV Export and Import.
 */

// If running in Node.js environment, import dependencies
if (typeof require !== 'undefined') {
  const storageModule = require('../lib/storage.js');
  global.KeepStorage = storageModule.KeepStorage;
  global.KEEP_COLORS = storageModule.KEEP_COLORS;
  global.DEFAULT_SETTINGS = storageModule.DEFAULT_SETTINGS;
}

let passedTests = 0;
let failedTests = 0;
const testLogs = [];

function assert(condition, testName, details = '') {
  if (condition) {
    const msg = `  ✅ PASS: ${testName}`;
    console.log(msg);
    testLogs.push({ pass: true, name: testName });
    passedTests++;
  } else {
    const msg = `  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`;
    console.error(msg);
    testLogs.push({ pass: false, name: testName, details });
    failedTests++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('⚡ RUNNING KEEPSYNC COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  // Reset test storage
  if (typeof KeepStorage.set === 'function') {
    await KeepStorage.set({ notes: [], settings: null, syncQueue: [] });
  }

  // --- 1. Settings & Palette Verification ---
  console.log('--- 1. Testing Palette & Default Settings ---');
  const paletteKeys = Object.keys(KEEP_COLORS);
  assert(paletteKeys.length === 12, 'Google Keep 12-color palette complete', `Found ${paletteKeys.length}`);
  assert(KEEP_COLORS.sand && KEEP_COLORS.sand.bg === '#fff8b8', 'Sand color defined correctly');
  assert(KEEP_COLORS.mint && KEEP_COLORS.mint.darkBg === '#264d3b', 'Dark theme colors defined correctly');

  const settings = await KeepStorage.getSettings();
  assert(settings.theme === 'system', 'Default theme is system');
  assert(settings.showFloatingClipBubble === true, 'Floating clip bubble enabled by default');
  assert(settings.keepOpenInBackground === true, 'Keep open in background enabled by default');

  const updatedSettings = await KeepStorage.saveSettings({ theme: 'dark', showFloatingClipBubble: false });
  assert(updatedSettings.theme === 'dark', 'Theme setting saved');
  assert(updatedSettings.showFloatingClipBubble === false, 'Floating bubble setting saved');
  assert(updatedSettings.keepOpenInBackground === true, 'Preserves unedited settings');

  // --- 2. Note Creation (CRUD) ---
  console.log('\n--- 2. Testing Note Creation (saveNote) ---');
  const note1 = await KeepStorage.saveNote({
    title: 'Meeting Notes',
    content: 'Discuss quarterly targets and project roadmaps #planning #q4',
    type: 'note',
    color: 'sand'
  });

  assert(note1.id && note1.id.startsWith('keep_'), 'Generates valid ID with keep_ prefix');
  assert(note1.title === 'Meeting Notes', 'Title matches input');
  assert(note1.color === 'sand', 'Color saved correctly');
  assert(Array.isArray(note1.tags) && note1.tags.includes('planning') && note1.tags.includes('q4'), 'Auto-extracts hashtags into tags array');
  assert(note1.isTrash === false, 'Created note is not in trash');
  assert(note1.syncedToKeep === false, 'New note starts unsynced');

  // Empty title fallback
  const note2 = await KeepStorage.saveNote({
    title: '',
    content: 'First line of snippet is catchy\nSecond line has more details',
    type: 'snippet',
    color: 'mint'
  });
  assert(note2.title === 'First line of snippet is catchy', 'Generates title from first line when title empty');

  // Link type note
  const linkNote = await KeepStorage.saveNote({
    title: '',
    content: 'Documentation reference',
    type: 'link',
    url: 'https://developer.chrome.com/docs/extensions/mv3/',
    pageTitle: 'Chrome Extension MV3 Guide',
    color: 'fog'
  });
  assert(linkNote.title === 'Chrome Extension MV3 Guide', 'Uses page title for link note title');

  // --- 3. Note Updating ---
  console.log('\n--- 3. Testing Note Updating (updateNote) ---');
  const updatedNote1 = await KeepStorage.updateNote(note1.id, {
    title: 'Updated Meeting Notes',
    pinned: true,
    content: 'New content with revised tags #urgent #q4'
  });
  assert(updatedNote1.title === 'Updated Meeting Notes', 'Title updated');
  assert(updatedNote1.pinned === true, 'Pinned status updated');
  assert(updatedNote1.tags.includes('urgent'), 'Tags updated automatically from new content');
  assert(new Date(updatedNote1.updatedAt) >= new Date(note1.createdAt), 'UpdatedAt timestamp refreshed');

  // --- 4. Checklist Item Management ---
  console.log('\n--- 4. Testing Checklist Notes & Toggling ---');
  const checklistNote = await KeepStorage.saveNote({
    title: 'Sprint Checklist',
    type: 'checklist',
    items: [
      { id: 'c1', text: 'Write unit tests', completed: false },
      { id: 'c2', text: 'Generate icons', completed: false },
      { id: 'c3', text: 'Package zip', completed: false }
    ],
    color: 'peach'
  });

  assert(checklistNote.items.length === 3, 'Checklist created with 3 items');
  
  // Toggle item completion
  const toggled = await KeepStorage.toggleChecklistItem(checklistNote.id, 'c1', true);
  assert(toggled.items.find(i => i.id === 'c1').completed === true, 'Checklist item marked completed');

  const toggledOff = await KeepStorage.toggleChecklistItem(checklistNote.id, 'c1');
  assert(toggledOff.items.find(i => i.id === 'c1').completed === false, 'Checklist item toggled back to uncompleted');

  // --- 5. Trash Lifecycle (Soft Delete & Restore) ---
  console.log('\n--- 5. Testing Trash Lifecycle (trashNote & restoreNote) ---');
  const activeBeforeTrash = await KeepStorage.getNotes(false);
  const trashed = await KeepStorage.trashNote(note2.id);
  assert(trashed.isTrash === true, 'Note marked as trash');
  assert(trashed.trashedAt !== null, 'TrashedAt timestamp recorded');

  const activeAfterTrash = await KeepStorage.getNotes(false);
  assert(activeAfterTrash.length === activeBeforeTrash.length - 1, 'Active notes excludes trashed item');

  const trashList = await KeepStorage.getTrashNotes();
  assert(trashList.some(t => t.id === note2.id), 'Note appears in getTrashNotes()');

  // Restore note
  const restored = await KeepStorage.restoreNote(note2.id);
  assert(restored.isTrash === false, 'Note restored from trash');
  assert(restored.trashedAt === null, 'TrashedAt cleared');
  const activeAfterRestore = await KeepStorage.getNotes(false);
  assert(activeAfterRestore.some(n => n.id === note2.id), 'Restored note appears in active notes list');

  // --- 6. Bulk Trash & Permanent Delete ---
  console.log('\n--- 6. Testing Bulk Operations & Permanent Deletion ---');
  const tempNoteA = await KeepStorage.saveNote({ title: 'Temp A', content: 'Disposable' });
  const tempNoteB = await KeepStorage.saveNote({ title: 'Temp B', content: 'Disposable' });

  const bulkTrashedCount = await KeepStorage.bulkTrash([tempNoteA.id, tempNoteB.id]);
  assert(bulkTrashedCount === 2, 'bulkTrash trashed 2 notes');

  const permDeleted = await KeepStorage.deleteNotePermanently(tempNoteA.id);
  assert(permDeleted === true, 'Single note deleted permanently');
  const checkDeleted = await KeepStorage.getNoteById(tempNoteA.id);
  assert(checkDeleted === null, 'Deleted note cannot be found');

  // Empty trash
  const emptiedCount = await KeepStorage.emptyTrash();
  assert(emptiedCount >= 1, 'Empty trash cleared remaining trashed notes');
  const finalTrashList = await KeepStorage.getTrashNotes();
  assert(finalTrashList.length === 0, 'Trash bin is completely empty');

  // --- 7. Search & Filtering ---
  console.log('\n--- 7. Testing Search & Filtering Engine ---');
  const searchNote1 = await KeepStorage.saveNote({
    title: 'Quantum Computing Research',
    content: 'Qubits superposition and entanglement principles #physics #science',
    type: 'note',
    color: 'storm',
    pinned: true
  });

  const searchNote2 = await KeepStorage.saveNote({
    title: 'Recipe for Lasagna',
    content: 'Ricotta cheese, pasta sheets, marinara sauce #cooking',
    type: 'note',
    color: 'coral',
    pinned: false
  });

  const allActive = await KeepStorage.getNotes(false);

  // Query search
  const queryResult = KeepStorage.filterNotes(allActive, { query: 'superposition' });
  assert(queryResult.length === 1 && queryResult[0].id === searchNote1.id, 'Finds note by body content keyword');

  const titleResult = KeepStorage.filterNotes(allActive, { query: 'Lasagna' });
  assert(titleResult.length === 1 && titleResult[0].id === searchNote2.id, 'Finds note by title');

  const tagResult = KeepStorage.filterNotes(allActive, { query: 'physics' });
  assert(tagResult.length === 1 && tagResult[0].id === searchNote1.id, 'Finds note by hashtag query');

  // Filter by pinned
  const pinnedOnly = KeepStorage.filterNotes(allActive, { pinnedOnly: true });
  assert(pinnedOnly.every(n => n.pinned), 'pinnedOnly filter returns only pinned notes');

  // Filter by type
  const checklistFilter = KeepStorage.filterNotes(allActive, { type: 'checklist' });
  assert(checklistFilter.every(n => n.type === 'checklist'), 'Type filter returns only checklists');

  // --- 8. Hashtag Extraction ---
  console.log('\n--- 8. Testing Hashtag Extractor ---');
  const tagsExtracted = KeepStorage.extractTags('Here is a note with #JavaScript, #GoogleKeep, and #mv3_extension! Also duplicate #javascript');
  assert(tagsExtracted.length === 3, 'Extracts unique tags disregarding case and punctuation');
  assert(tagsExtracted.includes('javascript') && tagsExtracted.includes('googlekeep') && tagsExtracted.includes('mv3_extension'), 'Correct normalized tag list');

  // --- 9. Google Keep Sync Queue ---
  console.log('\n--- 9. Testing Google Keep Sync Queue ---');
  await KeepStorage.queueKeepSync(searchNote1);
  await KeepStorage.queueKeepSync(searchNote1); // Duplicate attempt
  
  const rawQueue = (await KeepStorage.get('syncQueue')).syncQueue;
  assert(rawQueue.length === 1, 'queueKeepSync prevents duplicate queueing of same note');

  const poppedJob = await KeepStorage.popKeepSyncQueue();
  assert(poppedJob && poppedJob.id === searchNote1.id, 'popKeepSyncQueue retrieves queued note');

  const emptyJob = await KeepStorage.popKeepSyncQueue();
  assert(emptyJob === null, 'Popping empty queue returns null');

  const syncedNote = await KeepStorage.markAsSynced(searchNote1.id);
  assert(syncedNote.syncedToKeep === true && syncedNote.syncedAt !== null, 'markAsSynced records sync state and timestamp');

  // --- 10. Backup & Export Engines ---
  console.log('\n--- 10. Testing Backup Export & Restore ---');
  // JSON Backup Export
  const jsonBackup = await KeepStorage.exportBackup();
  const parsedBackup = JSON.parse(jsonBackup);
  assert(parsedBackup.appName === 'KeepSync', 'JSON backup contains appName');
  assert(Array.isArray(parsedBackup.notes) && parsedBackup.notes.length > 0, 'JSON backup contains notes array');

  // Markdown Export
  const mdExport = await KeepStorage.exportMarkdown();
  assert(mdExport.includes('# KeepSync Notes & Snippets Export'), 'Markdown contains export header');
  assert(mdExport.includes('Sprint Checklist'), 'Markdown contains checklist title');
  assert(mdExport.includes('- [ ] Write unit tests'), 'Markdown renders checklist items with checkboxes');

  // CSV Export
  const csvExport = await KeepStorage.exportCSV();
  const csvLines = csvExport.split('\r\n');
  assert(csvLines[0] === 'ID,Title,Type,Content,URL,Tags,Pinned,Created At', 'CSV contains correct header columns');
  assert(csvLines.length >= 2, 'CSV contains note rows');

  // JSON Import (Merge Mode)
  const testImportData = {
    appName: 'KeepSync',
    notes: [
      {
        id: 'keep_imported_test_999',
        title: 'Imported Note from Cloud',
        content: 'Restored from JSON backup #restored',
        type: 'note',
        color: 'dusk',
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTrash: false
      }
    ]
  };
  const importResult = await KeepStorage.importBackup(JSON.stringify(testImportData), 'merge');
  assert(importResult.imported === 1, 'importBackup successfully parsed and merged 1 note');
  const foundImported = await KeepStorage.getNoteById('keep_imported_test_999');
  assert(foundImported && foundImported.title === 'Imported Note from Cloud', 'Imported note accessible in storage');

  // --- 11. Advanced Utilities & Multi-Snippet Stacking ---
  console.log('\n--- 11. Testing Advanced Utilities & Multi-Snippet Stacking ---');
  // Stacking (appendToNote & getRecentActiveNote)
  const stackBaseNote = await KeepStorage.saveNote({
    title: 'Research Topic',
    content: 'Snippet 1: Initial findings',
    type: 'note',
    color: 'sage'
  });
  const recentActive = await KeepStorage.getRecentActiveNote();
  assert(recentActive && recentActive.id === stackBaseNote.id, 'getRecentActiveNote returns latest active note');

  const stackedNote = await KeepStorage.appendToNote(
    stackBaseNote.id,
    'Snippet 2: Supplementary quote',
    'https://example.com/article2'
  );
  assert(stackedNote.content.includes('Snippet 1') && stackedNote.content.includes('Snippet 2'), 'appendToNote stacks snippets into content');
  assert(stackedNote.content.includes('https://example.com/article2'), 'appendToNote appends source reference link');

  // Action Items Extractor
  const sampleTextWithTasks = `
    Project planning discussion:
    TODO: Configure Google Keep alarms
    - [ ] Deploy manifest v3 update
    Action item: Verify forward slash zip packaging
    Check out the latest PR review
  `;
  const extractedTasks = KeepStorage.extractActionItems(sampleTextWithTasks);
  assert(extractedTasks.length === 4, 'extractActionItems correctly identifies 4 tasks');
  assert(extractedTasks[0].text.includes('Configure Google Keep alarms'), 'First action item parsed cleanly');
  assert(extractedTasks[1].text.includes('Deploy manifest v3 update'), 'Second action item parsed cleanly');
  assert(extractedTasks[2].text.includes('Verify forward slash zip packaging'), 'Third action item parsed cleanly');
  assert(extractedTasks[3].text.includes('Check out the latest PR review'), 'Fourth action item parsed cleanly');

  // Bullet Summary Generator
  const sampleLongText = `
    KeepSync is an offline-first browser extension for Google Chrome.
    It connects local notes and webpage clips directly to Google Keep.
    Users can organize snippets using tags, custom colors, and reminders.
    Everything stays completely private on local storage.
  `;
  const bulletSummary = KeepStorage.generateBulletSummary(sampleLongText);
  const bulletLines = bulletSummary.split('\n').filter(l => l.startsWith('• '));
  assert(bulletLines.length >= 3, 'generateBulletSummary formats multi-sentence text into clean bullet points');

  // Code Formatter
  const rawJsCode = `function calculateTotal(items) {
let total = 0;
for (const item of items) {
total += item.price;
}
return total;
}`;
  const formattedJs = KeepStorage.formatCodeSnippet(rawJsCode);
  assert(formattedJs.startsWith('```javascript\n') && formattedJs.endsWith('\n```'), 'formatCodeSnippet detects javascript and wraps with markdown syntax block');
  assert(formattedJs.includes('  let total = 0;'), 'formatCodeSnippet indents code properly');

  // Reminders & Vault Stats
  const reminderNote = await KeepStorage.saveNote({
    title: 'Call Accountant',
    content: 'Discuss quarterly taxes',
    type: 'note',
    reminderAt: new Date(Date.now() + 86400000).toISOString()
  });
  const activeWithReminders = await KeepStorage.getNotes(false);
  const reminderFiltered = KeepStorage.filterNotes(activeWithReminders, { remindersOnly: true });
  assert(reminderFiltered.some(n => n.id === reminderNote.id), 'filterNotes with remindersOnly finds note with reminderAt');
  assert(reminderFiltered.every(n => !!n.reminderAt), 'filterNotes with remindersOnly excludes notes without reminders');

  const stats = KeepStorage.getVaultStats(activeWithReminders);
  assert(stats.totalNotes >= 4, 'getVaultStats accurately calculates totalNotes');
  assert(stats.activeReminders >= 1, 'getVaultStats counts active reminders');
  assert(typeof stats.totalWords === 'number' && stats.totalWords > 0, 'getVaultStats calculates total word count');
  assert(typeof stats.syncRatePercent === 'number', 'getVaultStats calculates sync percentage');

  // --- Final Results Summary ---
  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    console.error(`💥 ${failedTests} test(s) failed.`);
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(1);
    }
  } else {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 100% PASS RATE.');
  }

  return { passed: passedTests, failed: failedTests, logs: testLogs };
}

// Auto-run when executed directly via Node.js
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('test-runner.js')) {
  runAllTests().catch(err => {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
  });
}

// Export for browser test page
if (typeof window !== 'undefined') {
  window.runAllTests = runAllTests;
}
