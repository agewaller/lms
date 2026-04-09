/* ============================================================
   LMS - Consciousness Integrations Module
   意識ドメイン専用: 録音・行動デバイス／アプリ連携

   対応デバイス / アプリ:
   - Plaud (AI Voice Recorder)      : email / file / audio upload
   - Otter.ai                        : email / .txt / .srt / .vtt
   - Limitless Pendant (Lifelogs)    : REST API (key)
   - Bee AI Wearable                 : REST API (key)
   - Rewind.ai                       : .json export
   - Humane AI Pin                   : email / .txt export
   - Rabbit R1 (Journal)             : .json / .md export
   - Zoom / Teams / Google Meet      : .vtt / .srt / .txt transcripts
   - Voice Memos (iOS/macOS)         : .m4a / .mp3 → Whisper transcription
   - Browser voice recording         : MediaRecorder + Whisper proxy
   - Notion / Obsidian journals      : .md / .json vault export
   - Whisper API                     : direct audio transcription
   - Apple Screen Time (behavior)    : .json via Shortcut
   - Android Digital Wellbeing       : .csv export

   すべての入力は以下の共通スキーマに正規化:
     ConsciousnessEvent {
       id, source, sourceLabel, type,
       content, parsedEntries[], wordCount, speakers[],
       duration, recordedAt, date, title, rawMetadata
     }

   正規化後、store.consciousness_transcript に保存 +
   AIEngine で七つの意識レイヤー分析を自動実行。
   ============================================================ */

// ─── Device Registry (UI用カタログ) ───
var CONSCIOUSNESS_DEVICES = [
  {
    id: 'plaud',
    label: 'Plaud',
    icon: '🎙️',
    category: 'recorder',
    kind: 'audio_recorder',
    description: 'AI音声レコーダー。録音すると文字起こし付きでメール送信',
    connectVia: ['email', 'file', 'audio'],
    autoIngest: true,
    aliases: ['plaud', 'plaud note', 'plaud.ai']
  },
  {
    id: 'otter',
    label: 'Otter.ai',
    icon: '🦦',
    category: 'meeting',
    kind: 'meeting_transcriber',
    description: '会議の自動文字起こしサービス。共有メールで自動取込',
    connectVia: ['email', 'file'],
    autoIngest: true,
    aliases: ['otter', 'otter.ai']
  },
  {
    id: 'limitless',
    label: 'Limitless Pendant',
    icon: '🪪',
    category: 'wearable',
    kind: 'lifelog',
    description: '常時録音ウェアラブルペンダント。Lifelogs APIで同期',
    connectVia: ['api'],
    apiEndpoint: 'https://api.limitless.ai/v1/lifelogs',
    apiDocsUrl: 'https://www.limitless.ai/developers',
    autoIngest: true,
    aliases: ['limitless', 'limitless ai', 'pendant']
  },
  {
    id: 'bee',
    label: 'Bee AI',
    icon: '🐝',
    category: 'wearable',
    kind: 'conversation_logger',
    description: '会話を自動記録するウェアラブル。Conversations APIで取得',
    connectVia: ['api'],
    apiEndpoint: 'https://api.bee.computer/v1/conversations',
    apiDocsUrl: 'https://developer.bee.computer',
    autoIngest: true,
    aliases: ['bee', 'bee computer', 'bee ai']
  },
  {
    id: 'rewind',
    label: 'Rewind.ai',
    icon: '⏪',
    category: 'desktop',
    kind: 'lifelog',
    description: 'Macの画面・音声を常時記録。Askログを書き出して取込',
    connectVia: ['file'],
    fileFormats: ['.json', '.txt', '.md'],
    aliases: ['rewind', 'rewind.ai']
  },
  {
    id: 'humane',
    label: 'Humane AI Pin',
    icon: '📌',
    category: 'wearable',
    kind: 'ai_assistant',
    description: 'AI Pinの会話履歴（.center）を書き出して取込',
    connectVia: ['email', 'file'],
    fileFormats: ['.txt', '.json', '.md'],
    aliases: ['humane', 'humane pin', 'ai pin']
  },
  {
    id: 'rabbit',
    label: 'Rabbit R1',
    icon: '🐇',
    category: 'device',
    kind: 'ai_assistant',
    description: 'Rabbit R1のジャーナル履歴を取込',
    connectVia: ['file'],
    fileFormats: ['.json', '.md'],
    aliases: ['rabbit', 'r1', 'rabbit r1']
  },
  {
    id: 'zoom',
    label: 'Zoom / Teams / Meet',
    icon: '💻',
    category: 'meeting',
    kind: 'meeting_transcriber',
    description: '会議録の字幕ファイル (.vtt/.srt/.txt)を取込',
    connectVia: ['file'],
    fileFormats: ['.vtt', '.srt', '.txt'],
    aliases: ['zoom', 'teams', 'meet', 'google meet', 'microsoft teams']
  },
  {
    id: 'voice_memo',
    label: 'ボイスメモ (iOS/macOS)',
    icon: '🎤',
    category: 'recorder',
    kind: 'audio_recorder',
    description: 'iPhoneのボイスメモ音声を Whisper で文字起こし',
    connectVia: ['audio', 'file'],
    fileFormats: ['.m4a', '.mp3', '.wav', '.txt'],
    aliases: ['voice memo', 'voicememo', 'ボイスメモ']
  },
  {
    id: 'browser_voice',
    label: 'ブラウザ録音',
    icon: '🔴',
    category: 'recorder',
    kind: 'audio_recorder',
    description: 'このブラウザで直接録音。Whisperで自動文字起こし',
    connectVia: ['browser_audio'],
    aliases: ['browser', 'web recorder']
  },
  {
    id: 'notion',
    label: 'Notion ジャーナル',
    icon: '📓',
    category: 'journal',
    kind: 'journal_sync',
    description: 'Notionから書き出した日記Markdownを取込',
    connectVia: ['file'],
    fileFormats: ['.md', '.zip', '.csv'],
    aliases: ['notion']
  },
  {
    id: 'obsidian',
    label: 'Obsidian Vault',
    icon: '🪨',
    category: 'journal',
    kind: 'journal_sync',
    description: 'Obsidian Vaultのデイリーノートを一括取込',
    connectVia: ['file'],
    fileFormats: ['.md'],
    aliases: ['obsidian']
  },
  {
    id: 'screen_time',
    label: 'Apple スクリーンタイム',
    icon: '📱',
    category: 'behavior',
    kind: 'behavior_signal',
    description: 'iOSスクリーンタイムを行動信号として取込',
    connectVia: ['email', 'file'],
    fileFormats: ['.json', '.csv', '.txt'],
    aliases: ['screen time', 'screentime']
  },
  {
    id: 'digital_wellbeing',
    label: 'Android Digital Wellbeing',
    icon: '🤖',
    category: 'behavior',
    kind: 'behavior_signal',
    description: 'Androidの利用状況を行動信号として取込',
    connectVia: ['file'],
    fileFormats: ['.csv', '.json'],
    aliases: ['digital wellbeing', 'wellbeing']
  },
  {
    id: 'whisper',
    label: 'Whisper API (OpenAI)',
    icon: '🗣️',
    category: 'transcription',
    kind: 'transcription_service',
    description: '任意の音声ファイルをOpenAI Whisperで文字起こし',
    connectVia: ['audio'],
    fileFormats: ['.m4a', '.mp3', '.wav', '.ogg', '.flac', '.webm'],
    aliases: ['whisper', 'openai whisper']
  },
  {
    id: 'generic_transcript',
    label: '汎用 文字起こし',
    icon: '📝',
    category: 'generic',
    kind: 'manual',
    description: '任意のテキスト・ファイルを貼り付けて分析',
    connectVia: ['paste', 'file'],
    fileFormats: ['.txt', '.md', '.srt', '.vtt'],
    aliases: ['manual', 'text', 'generic']
  }
];

var ConsciousnessIntegrations = {
  // ─── Device catalog access ───
  devices: CONSCIOUSNESS_DEVICES,

  getDevice(id) {
    return CONSCIOUSNESS_DEVICES.find(d => d.id === id) || null;
  },

  detectSource(filenameOrText) {
    if (!filenameOrText) return 'generic_transcript';
    const lc = String(filenameOrText).toLowerCase();
    for (const dev of CONSCIOUSNESS_DEVICES) {
      if (dev.aliases && dev.aliases.some(a => lc.includes(a))) return dev.id;
    }
    return 'generic_transcript';
  },

  // ─── Normalizer: 共通スキーマに揃える ───
  normalize(raw, sourceId = 'generic_transcript', metadata = {}) {
    const dev = this.getDevice(sourceId) || this.getDevice('generic_transcript');
    const text = typeof raw === 'string' ? raw : (raw?.text || raw?.content || '');

    // Prefer Plaud-style parser if text contains [HH:MM] Speaker: pattern.
    let parsed = { entries: [], wordCount: 0, speakers: [] };
    if (typeof plaud !== 'undefined' && plaud.parseTranscript) {
      parsed = plaud.parseTranscript(text);
    } else {
      parsed.entries = (text || '').split('\n').filter(Boolean)
        .map(line => ({ timestamp: '', speaker: 'unknown', text: line.trim() }));
      parsed.wordCount = (text || '').split(/\s+/).filter(Boolean).length;
    }

    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      source: sourceId,
      sourceLabel: dev?.label || sourceId,
      type: metadata.type || 'transcript',
      content: text,
      parsedEntries: parsed.entries,
      wordCount: parsed.wordCount,
      speakers: parsed.speakers || [],
      speakerCount: (parsed.speakers || []).length,
      duration: metadata.duration || Math.round(parsed.wordCount / 150), // ~150wpm
      recordedAt: metadata.recordedAt || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      date: metadata.date || new Date().toISOString().slice(0, 10),
      title: metadata.title || `${dev?.label || 'Transcript'} - ${new Date().toLocaleString('ja-JP')}`,
      rawMetadata: metadata.raw || null
    };
  },

  // ─── Save + optional AI analysis ───
  async saveEvent(event, { analyze = true } = {}) {
    // Store to consciousness_transcript category
    store.addDomainEntry('consciousness', 'transcript', {
      id: event.id,
      source: event.source,
      sourceLabel: event.sourceLabel,
      content: event.content,
      wordCount: event.wordCount,
      speakers: event.speakers,
      speakerCount: event.speakerCount,
      duration: event.duration,
      recordedAt: event.recordedAt,
      date: event.date,
      title: event.title,
      summary: event.content.slice(0, 120)
    });

    // Mirror relevant entries into conversation history for chat context
    try {
      const history = store.get('conversationHistory') || [];
      (event.parsedEntries || []).forEach(e => {
        history.push({
          role: (e.speaker === 'あなた' || e.speaker === 'Me' || e.speaker === 'user')
            ? 'user' : 'assistant',
          content: e.text,
          timestamp: new Date().toISOString(),
          source: event.source,
          speaker: e.speaker
        });
      });
      store.set('conversationHistory', history.slice(-500));
    } catch (_) {/* best-effort */}

    if (!analyze) return { event, analysis: null };

    // Run 7-layer analysis via AIEngine
    try {
      const result = await AIEngine.analyze('consciousness', 'transcript_analysis', {
        text: `<<<TRANSCRIPT_START(source=${event.source})\n${event.content}\nTRANSCRIPT_END>>>`
      });
      // Let app.js parseAndSaveObservation extract the JSON observation
      if (typeof app !== 'undefined' && app.parseAndSaveObservation) {
        app.parseAndSaveObservation(result);
      }
      return { event, analysis: result };
    } catch (e) {
      console.warn('Consciousness analysis failed:', e);
      return { event, analysis: null, error: e.message };
    }
  },

  // ─── Unified text ingest (for paste / file / email) ───
  async ingestText(text, sourceId, metadata = {}) {
    if (!text || !text.trim()) throw new Error('テキストが空です');
    const event = this.normalize(text, sourceId, metadata);
    return this.saveEvent(event);
  },

  // ─── File ingest: detects format and dispatches ───
  async ingestFile(file, sourceHint) {
    if (!file) throw new Error('ファイルがありません');
    const name = (file.name || '').toLowerCase();
    const ext = name.split('.').pop();

    // Audio → Whisper transcription
    const audioExts = ['m4a', 'mp3', 'wav', 'ogg', 'flac', 'webm', 'aac', 'mp4'];
    if (audioExts.includes(ext)) {
      return this.transcribeAudioFile(file, sourceHint);
    }

    // Text-like: read and dispatch
    const text = await this._readAsText(file);

    // Subtitle formats
    if (ext === 'vtt' || ext === 'srt') {
      const cleaned = this.cleanSubtitles(text, ext);
      return this.ingestText(cleaned, sourceHint || this.detectSource(name), {
        title: file.name,
        raw: { format: ext }
      });
    }

    // JSON: try source-specific parsers
    if (ext === 'json') {
      const parsed = this._safeJson(text);
      if (parsed) {
        const hint = sourceHint || this.detectSource(name);
        const flat = this.flattenJsonTranscript(parsed, hint);
        return this.ingestText(flat, hint, { title: file.name, raw: { format: 'json' } });
      }
    }

    // Markdown / plain text / csv
    return this.ingestText(text, sourceHint || this.detectSource(name), {
      title: file.name,
      raw: { format: ext }
    });
  },

  _readAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsText(file);
    });
  },

  _readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });
  },

  _safeJson(text) {
    try { return JSON.parse(text); } catch (_) { return null; }
  },

  // ─── Subtitle cleaner: removes timestamps/indices from .vtt/.srt ───
  cleanSubtitles(text, format) {
    if (!text) return '';
    const lines = text.split(/\r?\n/);
    const out = [];
    lines.forEach(line => {
      // Skip: WEBVTT header, empty lines, numeric indices, timestamps
      if (/^WEBVTT/i.test(line)) return;
      if (/^\d+$/.test(line.trim())) return;
      if (/-->/.test(line)) return;
      if (!line.trim()) return;
      out.push(line.trim());
    });
    return out.join('\n');
  },

  // ─── JSON flattener: handles Rewind / Bee / Limitless / Rabbit shapes ───
  flattenJsonTranscript(json, sourceId) {
    if (!json) return '';
    // Common array shapes
    const arr = Array.isArray(json) ? json :
                Array.isArray(json.lifelogs) ? json.lifelogs :
                Array.isArray(json.conversations) ? json.conversations :
                Array.isArray(json.entries) ? json.entries :
                Array.isArray(json.transcripts) ? json.transcripts :
                Array.isArray(json.items) ? json.items :
                Array.isArray(json.data) ? json.data : null;

    if (!arr) {
      // Single object: try common fields
      return json.transcript || json.text || json.content ||
             json.body || JSON.stringify(json).slice(0, 5000);
    }

    // Flatten entries to [HH:MM] Speaker: text lines
    return arr.map(item => {
      const ts = item.timestamp || item.startTime || item.start || item.time ||
                 item.createdAt || '';
      const hhmm = ts ? new Date(ts).toLocaleTimeString('ja-JP', {
        hour: '2-digit', minute: '2-digit', hour12: false
      }) : '';
      const speaker = item.speaker || item.author || item.user || item.from || 'unknown';
      const text = item.text || item.transcript || item.content || item.body ||
                   item.summary || item.title || '';
      if (!text) return '';
      return `[${hhmm}] ${speaker}: ${text}`;
    }).filter(Boolean).join('\n');
  },

  // ═════════════════════════════════════════════════════════
  //  Limitless Lifelogs API
  // ═════════════════════════════════════════════════════════
  limitless: {
    getKey() { return localStorage.getItem('lms_limitless_key') || ''; },
    setKey(k) { localStorage.setItem('lms_limitless_key', k || ''); },
    isConnected() { return !!this.getKey(); },
    disconnect() { localStorage.removeItem('lms_limitless_key'); },

    async fetchLifelogs(hoursBack = 24) {
      const key = this.getKey();
      if (!key) throw new Error('Limitless APIキー未設定');
      const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
      const url = `https://api.limitless.ai/v1/lifelogs?start=${encodeURIComponent(since)}&limit=50`;
      const res = await fetch(url, {
        headers: { 'X-API-Key': key, 'Accept': 'application/json' }
      });
      if (res.status === 401) { this.disconnect(); throw new Error('APIキー無効'); }
      if (!res.ok) throw new Error(`Limitless取得失敗 (${res.status})`);
      const data = await res.json();
      return data.data?.lifelogs || data.lifelogs || data.data || [];
    },

    async sync(hoursBack = 24) {
      const items = await this.fetchLifelogs(hoursBack);
      let count = 0;
      for (const item of items) {
        const flat = ConsciousnessIntegrations.flattenJsonTranscript(
          { entries: item.contents || item.entries || [item] }, 'limitless'
        );
        if (!flat) continue;
        await ConsciousnessIntegrations.ingestText(flat, 'limitless', {
          title: item.title || 'Limitless Lifelog',
          date: (item.startTime || item.createdAt || '').slice(0, 10) || undefined,
          recordedAt: item.startTime || item.createdAt,
          raw: item
        });
        count++;
      }
      return count;
    }
  },

  // ═════════════════════════════════════════════════════════
  //  Bee AI Conversations API
  // ═════════════════════════════════════════════════════════
  bee: {
    getKey() { return localStorage.getItem('lms_bee_key') || ''; },
    setKey(k) { localStorage.setItem('lms_bee_key', k || ''); },
    isConnected() { return !!this.getKey(); },
    disconnect() { localStorage.removeItem('lms_bee_key'); },

    async fetchConversations(limit = 20) {
      const key = this.getKey();
      if (!key) throw new Error('Bee APIキー未設定');
      const url = `https://api.bee.computer/v1/conversations?limit=${limit}`;
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + key, 'Accept': 'application/json' }
      });
      if (res.status === 401) { this.disconnect(); throw new Error('APIキー無効'); }
      if (!res.ok) throw new Error(`Bee取得失敗 (${res.status})`);
      const data = await res.json();
      return data.conversations || data.data || [];
    },

    async sync() {
      const items = await this.fetchConversations();
      let count = 0;
      for (const conv of items) {
        const flat = ConsciousnessIntegrations.flattenJsonTranscript(
          { entries: conv.utterances || conv.transcript || [conv] }, 'bee'
        );
        if (!flat) continue;
        await ConsciousnessIntegrations.ingestText(flat, 'bee', {
          title: conv.summary || 'Bee Conversation',
          date: (conv.startTime || conv.createdAt || '').slice(0, 10) || undefined,
          recordedAt: conv.startTime || conv.createdAt,
          raw: conv
        });
        count++;
      }
      return count;
    }
  },

  // ═════════════════════════════════════════════════════════
  //  Whisper API (OpenAI) — audio → transcript
  //  優先順: (1) Cloudflare Worker proxy  (2) direct with user key
  // ═════════════════════════════════════════════════════════
  whisper: {
    getKey() { return localStorage.getItem('lms_whisper_key') || ''; },
    setKey(k) { localStorage.setItem('lms_whisper_key', k || ''); },
    isConnected() { return !!this.getKey() || !!this.getProxyUrl(); },
    getProxyUrl() {
      return (CONFIG?.endpoints?.whisper) || localStorage.getItem('lms_whisper_proxy') || '';
    },
    disconnect() { localStorage.removeItem('lms_whisper_key'); },

    async transcribeBlob(blob, filename = 'audio.webm', language = 'ja') {
      const proxy = this.getProxyUrl();
      const key = this.getKey();
      if (!proxy && !key) {
        throw new Error('Whisper未設定 (APIキーまたはプロキシURL)');
      }

      const form = new FormData();
      form.append('file', blob, filename);
      form.append('model', 'whisper-1');
      form.append('language', language);
      form.append('response_format', 'verbose_json');

      const url = proxy || 'https://api.openai.com/v1/audio/transcriptions';
      const headers = proxy ? {} : { 'Authorization': 'Bearer ' + key };

      const res = await fetch(url, { method: 'POST', headers, body: form });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(`Whisper失敗: ${res.status} ${msg.slice(0, 200)}`);
      }
      const data = await res.json();
      return {
        text: data.text || '',
        language: data.language,
        duration: data.duration,
        segments: data.segments || []
      };
    }
  },

  // ═════════════════════════════════════════════════════════
  //  Audio file → Whisper → normalize → save
  // ═════════════════════════════════════════════════════════
  async transcribeAudioFile(file, sourceHint) {
    if (!this.whisper.isConnected()) {
      throw new Error('音声を文字起こしするにはWhisperのAPIキーまたはプロキシURLを設定してください');
    }
    Components.showToast('音声を文字起こし中...', 'info');
    const result = await this.whisper.transcribeBlob(file, file.name);

    // Build a Plaud-style script using segments if available
    let scripted = result.text;
    if (Array.isArray(result.segments) && result.segments.length) {
      scripted = result.segments.map(s => {
        const t = typeof s.start === 'number'
          ? new Date(s.start * 1000).toISOString().substr(14, 5)
          : '';
        return `[${t}] speaker: ${s.text.trim()}`;
      }).join('\n');
    }

    return this.ingestText(scripted, sourceHint || this.detectSource(file.name), {
      title: file.name,
      duration: result.duration,
      raw: { whisper: { language: result.language } }
    });
  },

  // ═════════════════════════════════════════════════════════
  //  Browser voice recording (MediaRecorder)
  // ═════════════════════════════════════════════════════════
  recorder: {
    _mediaRecorder: null,
    _chunks: [],
    _stream: null,
    _startedAt: null,

    isRecording() { return !!this._mediaRecorder && this._mediaRecorder.state === 'recording'; },

    async start() {
      if (this.isRecording()) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('このブラウザは録音に対応していません');
      }
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      this._mediaRecorder = new MediaRecorder(this._stream, mime ? { mimeType: mime } : undefined);
      this._chunks = [];
      this._startedAt = Date.now();
      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this._chunks.push(e.data);
      };
      this._mediaRecorder.start();
    },

    async stop() {
      return new Promise((resolve, reject) => {
        if (!this._mediaRecorder) return reject(new Error('録音が開始されていません'));
        this._mediaRecorder.onstop = () => {
          const blob = new Blob(this._chunks, { type: this._mediaRecorder.mimeType || 'audio/webm' });
          const duration = Math.round((Date.now() - this._startedAt) / 1000);
          try { this._stream.getTracks().forEach(t => t.stop()); } catch (_) {}
          this._mediaRecorder = null;
          this._stream = null;
          this._chunks = [];
          resolve({ blob, duration });
        };
        this._mediaRecorder.stop();
      });
    },

    async cancel() {
      try {
        if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
          this._mediaRecorder.stop();
        }
        if (this._stream) this._stream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this._mediaRecorder = null;
      this._stream = null;
      this._chunks = [];
    }
  },

  async stopAndTranscribe() {
    const { blob, duration } = await this.recorder.stop();
    if (!this.whisper.isConnected()) {
      // Save audio as transcript with note; user can add Whisper later
      const name = `browser-recording-${Date.now()}.webm`;
      store.addDomainEntry('consciousness', 'transcript', {
        source: 'browser_voice',
        sourceLabel: 'ブラウザ録音',
        content: '(音声のみ - Whisper未設定のため文字起こし未実行)',
        duration,
        title: name,
        date: new Date().toISOString().slice(0, 10)
      });
      return { event: null, analysis: null, audioOnly: true, duration };
    }
    const filename = `recording-${Date.now()}.webm`;
    const fileLike = new File([blob], filename, { type: blob.type });
    return this.transcribeAudioFile(fileLike, 'browser_voice');
  },

  // ═════════════════════════════════════════════════════════
  //  Auto-detect inbox pollers: route by sender / subject
  //  Called from app.js inbox polling alongside plaud.pollInbox
  // ═════════════════════════════════════════════════════════
  async pollAll() {
    const results = { plaud: 0, limitless: 0, bee: 0 };
    // Plaud email inbox (existing)
    if (typeof plaud !== 'undefined' && plaud.pollInbox) {
      try {
        const r = await plaud.pollInbox();
        results.plaud = r?.processed || 0;
      } catch (e) { console.warn('Plaud poll failed', e); }
    }
    // Limitless (API)
    if (this.limitless.isConnected()) {
      try { results.limitless = await this.limitless.sync(6); }
      catch (e) { console.warn('Limitless sync failed', e); }
    }
    // Bee AI (API)
    if (this.bee.isConnected()) {
      try { results.bee = await this.bee.sync(); }
      catch (e) { console.warn('Bee sync failed', e); }
    }
    return results;
  },

  // ─── Human-readable summary of connected services ───
  connectionSummary() {
    return {
      plaud: !!(typeof plaud !== 'undefined' && plaud.getIngestEmail?.()),
      limitless: this.limitless.isConnected(),
      bee: this.bee.isConnected(),
      whisper: this.whisper.isConnected(),
      browser_voice: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    };
  }
};

// Expose short alias for UI handlers
var consciousness = ConsciousnessIntegrations;
