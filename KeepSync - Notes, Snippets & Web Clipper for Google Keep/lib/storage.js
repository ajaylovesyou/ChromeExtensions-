/**
 * KeepSync - Core Storage Management Layer
 * Handles permanent note persistence, CRUD operations, Trash bin, and Google Keep sync queue.
 */

// Google Keep Authentic Color Palette
const KEEP_COLORS = {
  default: { name: 'Default', bg: '#ffffff', darkBg: '#202124', border: '#e0e0e0', darkBorder: '#5f6368' },
  coral:   { name: 'Coral',   bg: '#faafa8', darkBg: '#77172e', border: '#f28b82', darkBorder: '#99223e' },
  peach:   { name: 'Peach',   bg: '#f39f76', darkBg: '#692b17', border: '#fbbc04', darkBorder: '#8a3e22' },
  sand:    { name: 'Sand',    bg: '#fff8b8', darkBg: '#7c4a03', border: '#fff475', darkBorder: '#9e6205' },
  mint:    { name: 'Mint',    bg: '#e2f6d3', darkBg: '#264d3b', border: '#ccff90', darkBorder: '#386c53' },
  sage:    { name: 'Sage',    bg: '#b4ddd3', darkBg: '#0c625d', border: '#a7ffeb', darkBorder: '#147e78' },
  fog:     { name: 'Fog',     bg: '#d4e4ed', darkBg: '#256377', border: '#cbf0f8', darkBorder: '#357d94' },
  storm:   { name: 'Storm',   bg: '#aeccdc', darkBg: '#284255', border: '#aecbfa', darkBorder: '#385a73' },
  dusk:    { name: 'Dusk',    bg: '#d3bfdb', darkBg: '#472e5b', border: '#d7aefb', darkBorder: '#5e3f78' },
  blossom: { name: 'Blossom', bg: '#f6e2dd', darkBg: '#6c394f', border: '#fdcfe8', darkBorder: '#8a4c66' },
  clay:    { name: 'Clay',    bg: '#e9e3d4', darkBg: '#4b443a', border: '#e6c9a8', darkBorder: '#61584c' },
  chalk:   { name: 'Chalk',   bg: '#efeff1', darkBg: '#2d2e30', border: '#e8eaed', darkBorder: '#3c4043' }
};

const DEFAULT_SETTINGS = {
  theme: 'system',                 // 'light' | 'dark' | 'system'
  showFloatingClipBubble: true,    // Floating "Clip to Keep" badge on text selection
  autoSyncToKeep: false,           // Automatically open Google Keep and inject note
  keepOpenInBackground: true,      // Open Keep in inactive background tab
  defaultColor: 'default',
  defaultView: 'grid',             // 'grid' | 'list'
  showBadgeCounter: true,
  autoExtractTags: true
};

class KeepStorage {
  static _getStorage() {
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        return localStorage;
      }
    } catch (e) {}
    if (!globalThis.__keepsync_mem) {
      const store = {};
      globalThis.__keepsync_mem = {
        getItem: (k) => store[k] !== undefined ? store[k] : null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
      };
    }
    return globalThis.__keepsync_mem;
  }

  /**
   * Read raw keys from chrome.storage.local
   */
  static async get(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        // Fallback for non-extension preview / test environment
        const storage = this._getStorage();
        const result = {};
        const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
        keyList.forEach(k => {
          const val = storage.getItem('keepsync_' + k);
          if (val) {
            try { result[k] = JSON.parse(val); } catch(e) { result[k] = val; }
          }
        });
        resolve(result);
      }
    });
  }

  /**
   * Set keys to chrome.storage.local
   */
  static async set(items) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(items, resolve);
      } else {
        const storage = this._getStorage();
        Object.keys(items).forEach(k => {
          storage.setItem('keepsync_' + k, JSON.stringify(items[k]));
        });
        resolve();
      }
    });
  }

  /**
   * Get user settings with defaults merged
   */
  static async getSettings() {
    const data = await this.get('settings');
    return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  }

  /**
   * Save user settings
   */
  static async saveSettings(newSettings) {
    const current = await this.getSettings();
    const merged = { ...current, ...newSettings };
    await this.set({ settings: merged });
    return merged;
  }

  /**
   * Get all notes from storage
   * @param {boolean} includeTrash - Whether to include soft-deleted notes (default false)
   */
  static async getNotes(includeTrash = false) {
    const data = await this.get('notes');
    const notes = Array.isArray(data.notes) ? data.notes : [];
    if (includeTrash) {
      return notes;
    }
    return notes.filter(n => !n.isTrash);
  }

  /**
   * Get notes currently in the Trash bin
   */
  static async getTrashNotes() {
    const data = await this.get('notes');
    const notes = Array.isArray(data.notes) ? data.notes : [];
    return notes.filter(n => !!n.isTrash);
  }

  /**
   * Find a note by its ID
   */
  static async getNoteById(id) {
    const notes = await this.getNotes(true);
    return notes.find(n => n.id === id) || null;
  }

  /**
   * Save a new note permanently to local storage
   * @param {Object} noteData 
   */
  static async saveNote(noteData) {
    const notes = await this.getNotes(true);
    const now = new Date().toISOString();

    const newNote = {
      id: 'keep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: (noteData.title || '').trim(),
      content: (noteData.content || '').trim(),
      type: noteData.type || 'note', // 'note' | 'snippet' | 'link' | 'checklist'
      url: noteData.url || '',
      pageTitle: noteData.pageTitle || '',
      favicon: noteData.favicon || '',
      color: noteData.color || 'default',
      pinned: !!noteData.pinned,
      tags: Array.isArray(noteData.tags) ? noteData.tags : this.extractTags(noteData.content + ' ' + (noteData.title || '')),
      items: Array.isArray(noteData.items) ? noteData.items : [], // For checklists: [{ id, text, completed }]
      createdAt: now,
      updatedAt: now,
      isTrash: false,
      trashedAt: null,
      reminderAt: noteData.reminderAt || null,
      syncedToKeep: !!noteData.syncedToKeep,
      syncedAt: noteData.syncedToKeep ? now : null
    };

    // If title is empty, generate from first line of content or url
    if (!newNote.title) {
      if (newNote.type === 'link' && newNote.pageTitle) {
        newNote.title = newNote.pageTitle;
      } else if (newNote.content) {
        newNote.title = newNote.content.split('\n')[0].substring(0, 50);
      } else if (newNote.url) {
        newNote.title = newNote.url;
      } else {
        newNote.title = 'Untitled Note';
      }
    }

    notes.unshift(newNote); // Prepend so latest appears first
    await this.set({ notes });
    await this.updateBadge();

    return newNote;
  }

  /**
   * Update an existing note
   */
  static async updateNote(id, patch) {
    const notes = await this.getNotes(true);
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return null;

    const current = notes[index];
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    // If content/title updated, refresh tags if requested
    if (patch.content !== undefined || patch.title !== undefined) {
      if (!patch.tags) {
        updated.tags = this.extractTags((updated.content || '') + ' ' + (updated.title || ''));
      }
    }

    notes[index] = updated;
    await this.set({ notes });
    return updated;
  }

  /**
   * Toggle a checklist item's completion status
   */
  static async toggleChecklistItem(noteId, itemId, completed) {
    const note = await this.getNoteById(noteId);
    if (!note || !Array.isArray(note.items)) return null;

    const item = note.items.find(i => i.id === itemId);
    if (item) {
      item.completed = (completed !== undefined) ? completed : !item.completed;
      return await this.updateNote(noteId, { items: note.items });
    }
    return null;
  }

  /**
   * Get the most recently created or updated active note
   */
  static async getRecentActiveNote() {
    const active = await this.getNotes(false);
    if (active.length === 0) return null;
    active.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return active[0];
  }

  /**
   * Append content to an existing note (multi-snippet stacking)
   */
  static async appendToNote(noteId, additionalContent, sourceUrl = '') {
    const note = await this.getNoteById(noteId);
    if (!note) return null;

    let newBody = note.content || '';
    const divider = '\n\n---\n📌 Excerpt:\n';
    newBody += divider + additionalContent.trim();
    if (sourceUrl && !newBody.includes(sourceUrl)) {
      newBody += `\n(Source: ${sourceUrl})`;
    }

    const updated = await this.updateNote(noteId, {
      content: newBody,
      syncedToKeep: false // Mark unsynced since it has new appended content
    });
    return updated;
  }

  /**
   * Move note to Trash (Soft delete)
   */
  static async trashNote(id) {
    const updated = await this.updateNote(id, {
      isTrash: true,
      trashedAt: new Date().toISOString()
    });
    await this.updateBadge();
    return updated;
  }

  /**
   * Restore a note from Trash
   */
  static async restoreNote(id) {
    const updated = await this.updateNote(id, {
      isTrash: false,
      trashedAt: null
    });
    await this.updateBadge();
    return updated;
  }

  /**
   * Permanently delete a single note
   */
  static async deleteNotePermanently(id) {
    const notes = await this.getNotes(true);
    const filtered = notes.filter(n => n.id !== id);
    await this.set({ notes: filtered });
    await this.updateBadge();
    return true;
  }

  /**
   * Empty entire Trash bin permanently
   */
  static async emptyTrash() {
    const notes = await this.getNotes(true);
    const retained = notes.filter(n => !n.isTrash);
    const deletedCount = notes.length - retained.length;
    await this.set({ notes: retained });
    await this.updateBadge();
    return deletedCount;
  }

  /**
   * Batch permanently delete specific note IDs
   */
  static async bulkDeletePermanently(ids) {
    const idSet = new Set(ids);
    const notes = await this.getNotes(true);
    const filtered = notes.filter(n => !idSet.has(n.id));
    await this.set({ notes: filtered });
    await this.updateBadge();
    return notes.length - filtered.length;
  }

  /**
   * Batch move specific note IDs to Trash
   */
  static async bulkTrash(ids) {
    const idSet = new Set(ids);
    const notes = await this.getNotes(true);
    const now = new Date().toISOString();
    let count = 0;

    const updatedNotes = notes.map(n => {
      if (idSet.has(n.id)) {
        count++;
        return { ...n, isTrash: true, trashedAt: now, updatedAt: now };
      }
      return n;
    });

    await this.set({ notes: updatedNotes });
    await this.updateBadge();
    return count;
  }

  /**
   * Mark a note as successfully synced to Google Keep
   */
  static async markAsSynced(id) {
    return await this.updateNote(id, {
      syncedToKeep: true,
      syncedAt: new Date().toISOString()
    });
  }

  /**
   * Add a note to the pending Keep sync queue
   */
  static async queueKeepSync(note) {
    const data = await this.get('syncQueue');
    const queue = Array.isArray(data.syncQueue) ? data.syncQueue : [];
    // Avoid duplicate queueing
    if (!queue.find(q => q.id === note.id)) {
      queue.push({
        id: note.id,
        title: note.title,
        content: note.content,
        url: note.url,
        items: note.items || [],
        type: note.type,
        queuedAt: Date.now()
      });
      await this.set({ syncQueue: queue });
    }
  }

  /**
   * Get and pop next note from Keep sync queue
   */
  static async popKeepSyncQueue() {
    const data = await this.get('syncQueue');
    const queue = Array.isArray(data.syncQueue) ? data.syncQueue : [];
    if (queue.length === 0) return null;

    const item = queue.shift();
    await this.set({ syncQueue: queue });
    return item;
  }

  /**
   * Extract hashtags from text (e.g. #ideas #work)
   */
  static extractTags(text) {
    if (!text) return [];
    const matches = text.match(/#([a-zA-Z0-9_\u00C0-\u017F]+)/g);
    if (!matches) return [];
    const cleanTags = matches.map(m => m.slice(1).toLowerCase());
    return Array.from(new Set(cleanTags));
  }

  /**
   * Search and filter notes
   */
  static filterNotes(notes, { query = '', type = 'all', color = 'all', tag = 'all', pinnedOnly = false, remindersOnly = false }) {
    const q = query.trim().toLowerCase();

    return notes.filter(n => {
      // Pinned check
      if (pinnedOnly && !n.pinned) return false;

      // Reminders check
      if (remindersOnly && !n.reminderAt) return false;

      // Type filter
      if (type !== 'all' && n.type !== type) return false;

      // Color filter
      if (color !== 'all' && n.color !== color) return false;

      // Tag filter
      if (tag !== 'all' && (!Array.isArray(n.tags) || !n.tags.includes(tag))) return false;

      // Query search
      if (q) {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        const urlMatch = (n.url || '').toLowerCase().includes(q);
        const tagMatch = Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(q));
        const itemMatch = Array.isArray(n.items) && n.items.some(i => (i.text || '').toLowerCase().includes(q));
        return titleMatch || contentMatch || urlMatch || tagMatch || itemMatch;
      }

      return true;
    });
  }

  /**
   * Intelligently extract action items / tasks from arbitrary text
   */
  static extractActionItems(text) {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split(/\r?\n/);
    const items = [];
    const seen = new Set();

    const actionKeywords = /^(todo|task|action item|must|should|need to|check|review|send|email|call|buy|fix|prepare|update|follow up|schedule|verify|test|submit|finish|clean|implement)\b/i;
    const taskPrefixes = /^(\s*[-*•]\s*(\[[ xX]\])?\s*|\s*\d+[\.)]\s*|\s*TODO:?\s*|\s*TASK:?\s*)/i;

    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line || line.length < 3) return;

      let candidate = '';
      if (taskPrefixes.test(line)) {
        candidate = line.replace(taskPrefixes, '').trim();
      } else if (actionKeywords.test(line)) {
        candidate = line;
      }

      if (candidate && candidate.length >= 3 && !seen.has(candidate.toLowerCase())) {
        seen.add(candidate.toLowerCase());
        items.push({
          id: 'chk_' + Math.random().toString(36).substr(2, 7),
          text: candidate,
          completed: false
        });
      }
    });

    // If no line-based task was found, look for sentence-based action triggers
    if (items.length === 0) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      sentences.forEach(s => {
        const sentence = s.trim();
        if (actionKeywords.test(sentence) && sentence.length >= 5 && sentence.length <= 150) {
          const cleanSentence = sentence.replace(/[.!?]+$/, '');
          if (!seen.has(cleanSentence.toLowerCase())) {
            seen.add(cleanSentence.toLowerCase());
            items.push({
              id: 'chk_' + Math.random().toString(36).substr(2, 7),
              text: cleanSentence,
              completed: false
            });
          }
        }
      });
    }

    return items;
  }

  /**
   * Smart key takeaways bullet generator
   */
  static generateBulletSummary(text) {
    if (!text || typeof text !== 'string') return '';
    const clean = text.replace(/#\w+/g, '').trim();
    if (clean.length < 50) return clean;

    const sentences = clean.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 20 && s.length < 250);
    if (sentences.length <= 2) return clean;

    // Score sentences by keyword relevance & position
    const scored = sentences.map((sent, index) => {
      let score = 0;
      if (index === 0) score += 3;
      if (index === sentences.length - 1) score += 1.5;
      if (/\b(key|important|crucial|significant|main|primary|result|conclude|findings|benefit|reason)\b/i.test(sent)) score += 2;
      if (/\d+/.test(sent)) score += 1;
      if (sent.length > 40 && sent.length < 180) score += 1;
      return { sent, score, originalIndex: index };
    });

    scored.sort((a, b) => b.score - a.score);
    const topSentences = scored.slice(0, Math.min(4, sentences.length));
    topSentences.sort((a, b) => a.originalIndex - b.originalIndex);

    return topSentences.map(item => `• ${item.sent}`).join('\n');
  }

  /**
   * Detect and format code snippets in markdown
   */
  static formatCodeSnippet(text) {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();

    // Already in code block
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) return trimmed;

    let lang = '';
    if (/^(<!DOCTYPE|<html|<div|<span|<svg)/i.test(trimmed) || /<\/[a-z]+>/i.test(trimmed)) {
      lang = 'html';
    } else if (/\b(const|let|var|function|=>|async|await|console\.log)\b/.test(trimmed)) {
      lang = 'javascript';
    } else if (/\b(def|elif|import\s+[a-z_]+|print\(|__name__)\b/.test(trimmed)) {
      lang = 'python';
    } else if (/\b(SELECT\s+.+\s+FROM\s+|INSERT\s+INTO\s+|UPDATE\s+.+\s+SET\s+)/i.test(trimmed)) {
      lang = 'sql';
    } else if (/^\{[\s\S]*\}$|^\[[\s\S]*\]$/.test(trimmed) && /":\s*/.test(trimmed)) {
      lang = 'json';
    } else if (/^[.#][a-z0-9_-]+\s*\{[^}]+\}/i.test(trimmed)) {
      lang = 'css';
    } else if (/^(curl|git|npm|yarn|docker|pip|pnpm)\s+/i.test(trimmed)) {
      lang = 'bash';
    }

    // Smart indent lines if block brackets exist
    const lines = trimmed.split(/\r?\n/);
    let indentLevel = 0;
    const formattedLines = lines.map(line => {
      const trimmedLine = line.trim();
      if (/^[}\])]/.test(trimmedLine)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      const indented = (trimmedLine.length > 0 ? '  '.repeat(indentLevel) : '') + trimmedLine;
      if (/[{[(]$/.test(trimmedLine)) {
        indentLevel++;
      }
      return indented;
    });

    return `\`\`\`${lang}\n${formattedLines.join('\n')}\n\`\`\``;
  }

  /**
   * Calculate comprehensive Vault statistics (sync if notes passed, async if omitted)
   */
  static getVaultStats(notesInput = null) {
    if (!notesInput) {
      return this.getNotes(false).then(notes => this._calculateVaultStats(notes));
    }
    return this._calculateVaultStats(notesInput);
  }

  static _calculateVaultStats(active) {
    const tagCountMap = {};
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    let totalWords = 0;

    active.forEach(n => {
      if (Array.isArray(n.tags)) {
        n.tags.forEach(t => {
          tagCountMap[t] = (tagCountMap[t] || 0) + 1;
        });
      }
      const rawText = (n.title || '') + ' ' + (n.content || '') + ' ' + (Array.isArray(n.items) ? n.items.map(i => i.text || '').join(' ') : '');
      const words = rawText.trim().match(/\S+/g);
      if (words) {
        totalWords += words.length;
      }
    });

    const topTags = Object.keys(tagCountMap)
      .map(tag => ({ tag, count: tagCountMap[tag] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const snippets = active.filter(n => n.type === 'snippet').length;
    const links = active.filter(n => n.type === 'link').length;
    const checklists = active.filter(n => n.type === 'checklist').length;
    const regularNotes = active.filter(n => n.type === 'note').length;
    const pinned = active.filter(n => n.pinned).length;
    const activeReminders = active.filter(n => !!n.reminderAt).length;
    const synced = active.filter(n => n.syncedToKeep).length;
    const offline = active.filter(n => !n.syncedToKeep).length;
    const syncRatePercent = active.length > 0 ? Math.round((synced / active.length) * 100) : 0;

    return {
      totalNotes: active.length,
      totalWords,
      snippets,
      links,
      checklists,
      regularNotes,
      byType: {
        note: regularNotes,
        snippet: snippets,
        link: links,
        checklist: checklists
      },
      pinned,
      reminders: activeReminders,
      activeReminders,
      synced,
      offline,
      syncRatePercent,
      topTags,
      recent7DaysCount: active.filter(n => (now - new Date(n.createdAt).getTime()) <= oneWeekMs).length
    };
  }

  /**
   * Update browser extension action badge
   */
  static async updateBadge() {
    if (typeof chrome === 'undefined' || !chrome.action) return;

    try {
      const settings = await this.getSettings();
      if (!settings.showBadgeCounter) {
        chrome.action.setBadgeText({ text: '' });
        return;
      }

      const activeNotes = await this.getNotes(false);
      const count = activeNotes.length;
      chrome.action.setBadgeText({ text: count > 0 ? (count > 99 ? '99+' : count.toString()) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Warm Keep Amber
    } catch (e) {
      // Ignore background context issues
    }
  }

  /**
   * Export all notes as JSON backup string
   */
  static async exportBackup() {
    const notes = await this.getNotes(true);
    const settings = await this.getSettings();
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      appName: 'KeepSync',
      notesCount: notes.length,
      settings,
      notes
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Export notes as Markdown document
   */
  static async exportMarkdown() {
    const notes = await this.getNotes(false);
    let md = `# KeepSync Notes & Snippets Export\nExported on: ${new Date().toLocaleString()}\nTotal Notes: ${notes.length}\n\n---\n\n`;

    notes.forEach((note, idx) => {
      md += `## ${note.title || 'Untitled Note'}\n`;
      md += `**Date:** ${new Date(note.createdAt).toLocaleString()} | **Type:** ${note.type} | **Color:** ${note.color}\n`;
      if (note.url) {
        md += `**Source URL:** [${note.pageTitle || note.url}](${note.url})\n`;
      }
      if (note.tags && note.tags.length > 0) {
        md += `**Tags:** ${note.tags.map(t => '#' + t).join(' ')}\n`;
      }
      md += `\n`;

      if (note.type === 'checklist' && Array.isArray(note.items)) {
        note.items.forEach(i => {
          md += `- [${i.completed ? 'x' : ' '}] ${i.text}\n`;
        });
      } else {
        md += `${note.content || ''}\n`;
      }

      md += `\n---\n\n`;
    });

    return md;
  }

  /**
   * Export notes as CSV format
   */
  static async exportCSV() {
    const notes = await this.getNotes(false);
    const headers = ['ID', 'Title', 'Type', 'Content', 'URL', 'Tags', 'Pinned', 'Created At'];
    
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = notes.map(n => {
      let body = n.content || '';
      if (n.type === 'checklist' && Array.isArray(n.items)) {
        body = n.items.map(i => `[${i.completed ? 'x' : ' '}] ${i.text}`).join(' | ');
      }
      return [
        escapeCsv(n.id),
        escapeCsv(n.title),
        escapeCsv(n.type),
        escapeCsv(body),
        escapeCsv(n.url),
        escapeCsv((n.tags || []).join('; ')),
        escapeCsv(n.pinned ? 'Yes' : 'No'),
        escapeCsv(n.createdAt)
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Import notes from JSON backup string
   */
  static async importBackup(jsonString, mergeMode = 'merge') {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.notes)) {
      throw new Error('Invalid backup file format: missing notes array');
    }

    const currentNotes = await this.getNotes(true);
    let finalNotes = [];

    if (mergeMode === 'overwrite') {
      finalNotes = data.notes;
    } else {
      // Merge by ID
      const existingMap = new Map(currentNotes.map(n => [n.id, n]));
      data.notes.forEach(importedNote => {
        if (!existingMap.has(importedNote.id)) {
          existingMap.set(importedNote.id, importedNote);
        } else {
          // Keep newest updated
          const existing = existingMap.get(importedNote.id);
          const importedDate = new Date(importedNote.updatedAt || importedNote.createdAt || 0);
          const existingDate = new Date(existing.updatedAt || existing.createdAt || 0);
          if (importedDate > existingDate) {
            existingMap.set(importedNote.id, importedNote);
          }
        }
      });
      finalNotes = Array.from(existingMap.values());
    }

    await this.set({ notes: finalNotes });
    if (data.settings) {
      await this.saveSettings(data.settings);
    }
    await this.updateBadge();
    return { total: finalNotes.length, imported: data.notes.length };
  }
}

// Export for ES modules and standard script inclusion
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KeepStorage, KEEP_COLORS, DEFAULT_SETTINGS };
}
