/* ============================================================
   LMS - Integrations Module (未病ダイアリー準拠)
   Plaud / Google Calendar / Fitbit / Apple Health / File import
   ============================================================ */

// ─── Unique email ingestion endpoint per user ───
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

function generateUserEmail() {
  const user = store.get('user');
  if (!user) return null;
  const hash = simpleHash(user.uid || user.email || 'anon');
  const domain = CONFIG?.emailIngestDomain || 'inbox.lms-life.com';
  return `data-${hash}@${domain}`;
}

// ─── Plaud Integration (未病ダイアリー準拠) ───
var plaud = {
  getIngestEmail() {
    return generateUserEmail();
  },

  // Parse Plaud transcript format: [HH:MM:SS] Speaker: text
  parseTranscript(text) {
    if (!text) return { entries: [], wordCount: 0, speakers: [] };

    const lines = text.split('\n').filter(l => l.trim());
    const entries = [];
    const speakerSet = new Set();
    let wordCount = 0;

    const pattern = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.+)$/;

    lines.forEach(line => {
      const m = line.match(pattern);
      if (m) {
        const [, timestamp, speaker, body] = m;
        const trimmedSpeaker = speaker.trim();
        const trimmedBody = body.trim();
        speakerSet.add(trimmedSpeaker);
        wordCount += trimmedBody.split(/\s+/).length;
        entries.push({ timestamp, speaker: trimmedSpeaker, text: trimmedBody });
      } else if (line.trim()) {
        // Plain text line - append to previous or create entry
        if (entries.length > 0) {
          entries[entries.length - 1].text += ' ' + line.trim();
        } else {
          entries.push({ timestamp: '00:00', speaker: 'unknown', text: line.trim() });
        }
        wordCount += line.trim().split(/\s+/).length;
      }
    });

    return {
      entries,
      wordCount,
      speakers: Array.from(speakerSet),
      speakerCount: speakerSet.size
    };
  },

  async saveTranscript(parsed, metadata = {}) {
    const id = Date.now().toString(36);
    const summary = parsed.entries.slice(0, 3).map(e => e.text).join(' / ').substring(0, 100);

    // Save to consciousness transcript category
    store.addDomainEntry('consciousness', 'transcript', {
      id,
      source: 'plaud',
      content: parsed.entries.map(e => `[${e.timestamp}] ${e.speaker}: ${e.text}`).join('\n'),
      wordCount: parsed.wordCount,
      speakers: parsed.speakers,
      summary,
      date: metadata.date || new Date().toISOString().slice(0, 10),
      title: metadata.title || '文字起こし'
    });

    // Also save to conversation history for chat context
    const history = store.get('conversationHistory') || [];
    parsed.entries.forEach(e => {
      history.push({
        role: e.speaker === 'あなた' || e.speaker === 'Me' ? 'user' : 'assistant',
        content: e.text,
        timestamp: new Date().toISOString(),
        source: 'plaud',
        speaker: e.speaker
      });
    });
    store.set('conversationHistory', history.slice(-500));

    return id;
  },

  // ─── Auto-ingest: poll the email ingest worker for new messages ───
  // Called on login and periodically. Fetches any pending emails sent to
  // this user's unique address, processes them, runs AI analysis,
  // and saves results to Firestore.
  async pollInbox() {
    const email = generateUserEmail();
    if (!email) return { fetched: 0, processed: 0 };

    const hash = simpleHash((store.get('user')?.uid || store.get('user')?.email || 'anon'));
    const endpoint = CONFIG.endpoints?.emailIngest;
    if (!endpoint) return { fetched: 0, processed: 0 };

    try {
      const res = await fetch(`${endpoint}/pending?hash=${hash}`, { method: 'GET' });
      if (!res.ok) return { fetched: 0, processed: 0 };

      const { messages } = await res.json();
      if (!messages || messages.length === 0) return { fetched: 0, processed: 0 };

      const processedIds = [];
      let analyzed = 0;

      for (const msg of messages) {
        try {
          // Parse the email body as a Plaud transcript
          const text = msg.text || msg.html?.replace(/<[^>]*>/g, '') || '';
          if (!text.trim()) { processedIds.push(msg.id); continue; }

          const parsed = this.parseTranscript(text);
          await this.saveTranscript(parsed, {
            date: msg.receivedAt?.slice(0, 10),
            title: msg.subject || 'Plaud自動取込',
            source: 'plaud_email'
          });

          // Auto-analyze with Zen Track prompt
          try {
            const result = await AIEngine.analyze('consciousness', 'transcript_analysis', {
              text: `<<<TRANSCRIPT_START\n${text}\nTRANSCRIPT_END>>>`
            });
            // Parse and save observation (7-layer analysis)
            if (typeof app !== 'undefined' && app.parseAndSaveObservation) {
              app.parseAndSaveObservation(result);
            }
            analyzed++;
          } catch (e) {
            console.warn('Auto-analysis failed for message', msg.id, e);
          }

          processedIds.push(msg.id);
        } catch (e) {
          console.warn('Process message error', e);
        }
      }

      // Acknowledge processed messages (delete from KV)
      if (processedIds.length > 0) {
        await fetch(`${endpoint}/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: processedIds })
        }).catch(() => {});
      }

      return { fetched: messages.length, processed: processedIds.length, analyzed };
    } catch (e) {
      console.warn('Inbox poll error:', e);
      return { fetched: 0, processed: 0, error: e.message };
    }
  }
};

// ─── Google Calendar Integration (未病ダイアリー準拠) ───
// Uses Google Calendar API via gapi.client when connected
var googleCalendar = {
  getClientId() {
    return localStorage.getItem('lms_gcal_client_id') || '';
  },

  setClientId(id) {
    localStorage.setItem('lms_gcal_client_id', id);
  },

  getToken() {
    return localStorage.getItem('lms_gcal_token') || '';
  },

  isConnected() {
    return !!this.getToken();
  },

  async connect() {
    const clientId = this.getClientId();
    if (!clientId) {
      Components.showToast('Google Calendar Client IDを設定してください', 'info');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=gcal`;
  },

  checkCallback() {
    const hash = window.location.hash;
    if (hash.includes('access_token=') && hash.includes('state=gcal')) {
      const token = hash.match(/access_token=([^&]+)/)?.[1];
      if (token) {
        localStorage.setItem('lms_gcal_token', token);
        window.location.hash = '';
        if (typeof Components !== 'undefined') Components.showToast('Googleカレンダーに接続しました', 'success');
        // Auto-sync after successful connection
        try { this.sync(); } catch (e) { /* best effort */ }
        return true;
      }
    }
    return false;
  },

  disconnect() {
    localStorage.removeItem('lms_gcal_token');
  },

  async fetchEvents(days = 30) {
    const token = this.getToken();
    if (!token) throw new Error('未接続');

    const now = new Date();
    const timeMax = new Date(now);
    timeMax.setDate(now.getDate() + days);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now.toISOString()}&timeMax=${timeMax.toISOString()}` +
      `&singleEvents=true&orderBy=startTime&maxResults=250`;

    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 401) {
      this.disconnect();
      throw new Error('トークン切れ。再接続してください');
    }
    if (!res.ok) throw new Error('カレンダー取得失敗');

    const data = await res.json();
    return data.items || [];
  },

  async sync() {
    const events = await this.fetchEvents(30);
    if (typeof CalendarIntegration !== 'undefined') {
      CalendarIntegration.saveEvents(events);
    }
    return events.length;
  }
};

// ─── Outlook Calendar Integration (Microsoft Graph API) ───
var outlookCalendar = {
  getClientId() {
    return localStorage.getItem('lms_outlook_client_id') || '';
  },

  setClientId(id) {
    localStorage.setItem('lms_outlook_client_id', id);
  },

  getToken() {
    return localStorage.getItem('lms_outlook_token') || '';
  },

  isConnected() {
    return !!this.getToken();
  },

  connect() {
    const clientId = this.getClientId();
    if (!clientId) {
      Components.showToast('Microsoft Client IDを設定してください', 'info');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = encodeURIComponent('Calendars.Read offline_access');
    window.location.href =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}` +
      `&scope=${scope}&state=outlook&prompt=consent`;
  },

  checkCallback() {
    const hash = window.location.hash;
    if (hash.includes('access_token=') && hash.includes('state=outlook')) {
      const token = hash.match(/access_token=([^&]+)/)?.[1];
      if (token) {
        localStorage.setItem('lms_outlook_token', token);
        window.location.hash = '';
        if (typeof Components !== 'undefined') Components.showToast('Outlookに接続しました', 'success');
        try { this.sync(); } catch (e) { /* best effort */ }
        return true;
      }
    }
    return false;
  },

  disconnect() {
    localStorage.removeItem('lms_outlook_token');
  },

  async fetchEvents(days = 30) {
    const token = this.getToken();
    if (!token) throw new Error('Outlook未接続');

    const now = new Date();
    const timeMax = new Date(now);
    timeMax.setDate(now.getDate() + days);

    const url =
      `https://graph.microsoft.com/v1.0/me/calendarview?` +
      `startDateTime=${now.toISOString()}&endDateTime=${timeMax.toISOString()}&$top=250`;

    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 401) {
      this.disconnect();
      throw new Error('トークン切れ。再接続してください');
    }
    if (!res.ok) throw new Error('Outlookカレンダー取得失敗');

    const data = await res.json();
    // Map Microsoft Graph format to our common event format
    return (data.value || []).map(e => ({
      id: e.id,
      summary: e.subject || '',
      start: e.start?.dateTime,
      end: e.end?.dateTime,
      location: e.location?.displayName || '',
      description: e.bodyPreview || '',
      source: 'outlook'
    }));
  },

  async sync() {
    const events = await this.fetchEvents(30);
    if (typeof CalendarIntegration !== 'undefined') {
      CalendarIntegration.saveEvents(events);
    }
    return events.length;
  }
};

// ─── Fitbit Integration (未病ダイアリー準拠) ───
var fitbit = {
  getClientId() {
    return localStorage.getItem('lms_fitbit_client_id') || '';
  },

  setClientId(id) {
    localStorage.setItem('lms_fitbit_client_id', id);
  },

  getToken() {
    return localStorage.getItem('lms_fitbit_token') || '';
  },

  isConnected() {
    return !!this.getToken();
  },

  connect() {
    const clientId = this.getClientId();
    if (!clientId) {
      Components.showToast('Fitbit Client IDを設定してください', 'info');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = encodeURIComponent('activity heartrate sleep profile weight nutrition');
    window.location.href = `https://www.fitbit.com/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&expires_in=31536000&state=fitbit`;
  },

  checkCallback() {
    // Only claim the hash if the state is explicitly "fitbit".
    // Previously this would grab any access_token without state=gcal,
    // stealing the Google Calendar callback.
    const hash = window.location.hash;
    if (hash.includes('access_token=') && hash.includes('state=fitbit')) {
      const token = hash.match(/access_token=([^&]+)/)?.[1];
      if (token) {
        localStorage.setItem('lms_fitbit_token', token);
        window.location.hash = '';
        if (typeof Components !== 'undefined') Components.showToast('Fitbitに接続しました', 'success');
        return true;
      }
    }
    return false;
  },

  disconnect() {
    localStorage.removeItem('lms_fitbit_token');
  },

  async fetchData(endpoint) {
    const token = this.getToken();
    if (!token) throw new Error('未接続');

    const res = await fetch(`https://api.fitbit.com${endpoint}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 401) {
      this.disconnect();
      throw new Error('トークン切れ');
    }
    if (!res.ok) throw new Error('データ取得失敗');

    return res.json();
  },

  async fetchDailySummary(date) {
    const results = await Promise.allSettled([
      this.fetchData(`/1/user/-/activities/date/${date}.json`),
      this.fetchData(`/1.2/user/-/sleep/date/${date}.json`),
      this.fetchData(`/1/user/-/activities/heart/date/${date}/1d.json`)
    ]);

    return {
      activity: results[0].status === 'fulfilled' ? results[0].value : null,
      sleep:    results[1].status === 'fulfilled' ? results[1].value : null,
      heart:    results[2].status === 'fulfilled' ? results[2].value : null
    };
  },

  async importToday() {
    const today = new Date().toISOString().slice(0, 10);
    return this.importDate(today);
  },

  async importDate(date) {
    const data = await this.fetchDailySummary(date);
    let count = 0;

    if (data.activity?.summary) {
      const s = data.activity.summary;
      store.addDomainEntry('health', 'activityData', {
        activity_type: 'walking',
        source: 'fitbit',
        steps: s.steps,
        calories_burned: s.caloriesOut,
        duration: (s.fairlyActiveMinutes || 0) + (s.veryActiveMinutes || 0),
        date
      });
      count++;
    }

    if (data.sleep?.sleep?.[0]) {
      const main = data.sleep.sleep[0];
      const stages = main.levels?.summary || {};
      store.addDomainEntry('health', 'sleepData', {
        source: 'fitbit',
        quality: Math.round((main.efficiency || 80) / 10),
        duration_minutes: main.duration ? Math.round(main.duration / 60000) : 0,
        deep_minutes: stages.deep?.minutes || 0,
        rem_minutes: stages.rem?.minutes || 0,
        sleep_time: main.startTime,
        wake_time: main.endTime,
        date
      });
      count++;
    }

    if (data.heart?.['activities-heart']?.[0]?.value?.restingHeartRate) {
      store.addDomainEntry('health', 'vitals', {
        heart_rate: data.heart['activities-heart'][0].value.restingHeartRate,
        source: 'fitbit',
        date
      });
      count++;
    }

    return count;
  },

  async importHistory(days = 7) {
    let total = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      try {
        total += await this.importDate(date);
        await new Promise(r => setTimeout(r, 500)); // rate limit
      } catch (e) {
        console.warn('Fitbit import error for', date, e);
      }
    }
    return total;
  }
};

// ─── Apple Health Integration (未病ダイアリー準拠) ───
var appleHealth = {
  parseExport(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const records = doc.querySelectorAll('Record');

    const parsed = {
      vitals: [],
      activity: [],
      sleep: [],
      nutrition: []
    };

    records.forEach(r => {
      const type = r.getAttribute('type') || '';
      const value = parseFloat(r.getAttribute('value')) || 0;
      const date = r.getAttribute('startDate') || '';
      const unit = r.getAttribute('unit') || '';

      if (type.includes('HeartRate') && value > 0) {
        parsed.vitals.push({ heart_rate: value, date, unit, source: 'apple_health' });
      } else if (type.includes('BloodPressureSystolic')) {
        parsed.vitals.push({ bp_systolic: value, date, unit, source: 'apple_health' });
      } else if (type.includes('BloodPressureDiastolic')) {
        parsed.vitals.push({ bp_diastolic: value, date, unit, source: 'apple_health' });
      } else if (type.includes('BodyTemperature')) {
        parsed.vitals.push({ temperature: value, date, unit, source: 'apple_health' });
      } else if (type.includes('OxygenSaturation')) {
        parsed.vitals.push({ spo2: value, date, unit, source: 'apple_health' });
      } else if (type.includes('BodyMass') && value > 0) {
        parsed.vitals.push({ weight: value, date, unit, source: 'apple_health' });
      } else if (type.includes('StepCount') && value > 0) {
        parsed.activity.push({ activity_type: 'walking', steps: value, date, source: 'apple_health' });
      } else if (type.includes('ActiveEnergyBurned')) {
        parsed.activity.push({ calories_burned: value, date, source: 'apple_health' });
      } else if (type.includes('HeartRateVariability')) {
        parsed.vitals.push({ hrv: value, date, unit, source: 'apple_health' });
      } else if (type.includes('RespiratoryRate')) {
        parsed.vitals.push({ respiratory_rate: value, date, unit, source: 'apple_health' });
      }
    });

    return parsed;
  },

  importData(parsed) {
    let count = 0;
    parsed.vitals.forEach(v => {
      store.addDomainEntry('health', 'vitals', v);
      count++;
    });
    parsed.activity.forEach(a => {
      store.addDomainEntry('health', 'activityData', a);
      count++;
    });
    parsed.sleep.forEach(s => {
      store.addDomainEntry('health', 'sleepData', s);
      count++;
    });
    return count;
  },

  getShortcutInstructions() {
    return [
      'iPhoneの「ショートカット」アプリを開く',
      '新規ショートカットを作成',
      '「ヘルスケアサンプル」を追加',
      '「すべてのデータを取得」を選択',
      '「メールを送信」を追加',
      `送信先に「${generateUserEmail() || 'your-ingest-email'}」を設定`,
      '「自動化」で毎日実行するよう設定',
    ];
  }
};

// ─── File Import (auto-detect) ───
var fileImport = {
  parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((h, i) => {
        const v = values[i] || '';
        obj[h] = isNaN(v) || v === '' ? v : Number(v);
      });
      return obj;
    });
  },

  parseJSON(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  },

  async importFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        let result = { type: 'unknown', count: 0 };

        try {
          if (file.name.endsWith('.xml') || content.startsWith('<?xml')) {
            const parsed = appleHealth.parseExport(content);
            result.type = 'apple_health';
            result.count = appleHealth.importData(parsed);
          } else if (file.name.endsWith('.csv')) {
            const rows = this.parseCSV(content);
            result.type = 'csv';
            result.count = rows.length;
            rows.forEach(row => {
              store.addDomainEntry('health', 'vitals', { ...row, source: 'csv_import' });
            });
          } else if (file.name.endsWith('.json')) {
            const data = this.parseJSON(content);
            result.type = 'json';
            if (Array.isArray(data)) {
              result.count = data.length;
              data.forEach(row => {
                store.addDomainEntry('health', 'vitals', { ...row, source: 'json_import' });
              });
            }
          } else if (file.name.endsWith('.ics')) {
            if (typeof CalendarIntegration !== 'undefined') {
              const events = CalendarIntegration.importICS(content);
              result.type = 'calendar';
              result.count = events?.length || 0;
            }
          } else {
            // Treat as plain text transcript
            const parsed = plaud.parseTranscript(content);
            plaud.saveTranscript(parsed, { title: file.name });
            result.type = 'transcript';
            result.count = parsed.entries.length;
          }
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};

// ─── Withings Health Mate Integration ───
// Withings uses OAuth2 with code grant flow, which requires a backend
// for token exchange. For browser-only operation, we support:
//   1. CSV/JSON export import (primary path)
//   2. OAuth authorization flow that stores the auth code in localStorage
//      for manual copy to a backend or direct browser use if Withings adds
//      PKCE support in the future.
var withings = {
  getClientId() {
    return localStorage.getItem('lms_withings_client_id') || '';
  },

  setClientId(id) {
    localStorage.setItem('lms_withings_client_id', id);
  },

  getToken() {
    return localStorage.getItem('lms_withings_token') || '';
  },

  setToken(token) {
    localStorage.setItem('lms_withings_token', token);
  },

  isConnected() {
    return !!this.getToken();
  },

  disconnect() {
    localStorage.removeItem('lms_withings_token');
  },

  startAuth() {
    const clientId = this.getClientId();
    if (!clientId) {
      if (typeof Components !== 'undefined') Components.showToast('Withings Client IDを設定してください', 'info');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = encodeURIComponent('user.metrics,user.activity,user.sleepevents');
    window.location.href =
      `https://account.withings.com/oauth2_user/authorize2?` +
      `response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}` +
      `&scope=${scope}&state=withings`;
  },

  checkCallback() {
    // Withings returns an auth code (not access_token) in query string
    const params = new URLSearchParams(window.location.search);
    if (params.get('state') === 'withings' && params.get('code')) {
      const code = params.get('code');
      localStorage.setItem('lms_withings_auth_code', code);
      // Clear query string
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
      if (typeof Components !== 'undefined') {
        Components.showToast('Withingsの認証コードを保存しました。アクセストークンへの交換にはサーバーが必要です。', 'info');
      }
      return true;
    }
    return false;
  },

  // Parse Withings CSV export (weight, activity, sleep)
  parseCSV(text) {
    const rows = (typeof fileImport !== 'undefined' && fileImport.parseCSV)
      ? fileImport.parseCSV(text)
      : [];
    let count = 0;
    rows.forEach(row => {
      const lower = {};
      Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k]; });

      const date = lower['date'] || lower['time'] || lower['start'] || '';
      const weight = parseFloat(lower['weight (kg)'] || lower['weight'] || 0);
      const fat = parseFloat(lower['fat mass (%)'] || lower['fat ratio'] || 0);
      const muscle = parseFloat(lower['muscle mass (%)'] || 0);
      const bmi = parseFloat(lower['bmi'] || 0);
      const hr = parseFloat(lower['average heart rate (bpm)'] || lower['heart rate'] || 0);
      const steps = parseFloat(lower['steps'] || 0);
      const sleep = parseFloat(lower['light (s)'] || 0) + parseFloat(lower['deep (s)'] || 0) + parseFloat(lower['rem (s)'] || 0);

      if (weight > 0) {
        store.addDomainEntry('health', 'vitals', {
          weight, fat_ratio: fat, muscle_mass: muscle, bmi, source: 'withings', date
        });
        count++;
      }
      if (hr > 0) {
        store.addDomainEntry('health', 'vitals', { heart_rate: hr, source: 'withings', date });
        count++;
      }
      if (steps > 0) {
        store.addDomainEntry('health', 'activityData', {
          activity_type: 'walking', steps, source: 'withings', date
        });
        count++;
      }
      if (sleep > 0) {
        store.addDomainEntry('health', 'sleepData', {
          source: 'withings', duration_minutes: Math.round(sleep / 60), date
        });
        count++;
      }
    });
    return count;
  }
};

// ─── Muse Headband Integration (CSV import) ───
// Muse app exports sessions as CSV. Columns typically:
// timestamp, session_duration, calm_percentage, meditation_type, etc.
var muse = {
  parseCSV(text) {
    const rows = (typeof fileImport !== 'undefined' && fileImport.parseCSV)
      ? fileImport.parseCSV(text)
      : [];
    let count = 0;
    rows.forEach(row => {
      const lower = {};
      Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k]; });

      const date = lower['timestamp'] || lower['date'] || lower['session start'] || '';
      const duration = parseFloat(lower['session duration (s)'] || lower['duration'] || 0);
      const calmPercent = parseFloat(lower['calm percentage'] || lower['calm %'] || lower['calm'] || 0);
      const meditationType = lower['meditation type'] || lower['type'] || 'meditation';

      if (duration > 0 || calmPercent > 0) {
        store.addDomainEntry('consciousness', 'practices', {
          practice_type: 'meditation',
          source: 'muse',
          duration_minutes: Math.round(duration / 60),
          quality: calmPercent > 0 ? Math.round(calmPercent / 10) : 5,
          notes: `Muse Headband: ${meditationType}${calmPercent ? ` - 落ち着き度 ${calmPercent}%` : ''}`,
          date
        });
        count++;
      }
    });
    return count;
  }
};

// ─── Garmin Connect Integration (CSV + TCX import) ───
// Garmin's consumer OAuth is restricted to Connect IQ partners.
// For personal use, CSV/TCX/FIT export is the supported path.
var garmin = {
  parseCSV(text) {
    const rows = (typeof fileImport !== 'undefined' && fileImport.parseCSV)
      ? fileImport.parseCSV(text)
      : [];
    let count = 0;
    rows.forEach(row => {
      const lower = {};
      Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k]; });

      const date = lower['date'] || lower['timestamp'] || '';
      const activityType = lower['activity type'] || lower['type'] || 'walking';
      const distance = parseFloat(lower['distance (km)'] || lower['distance'] || 0);
      const duration = parseFloat(lower['duration (s)'] || lower['moving time (s)'] || 0);
      const calories = parseFloat(lower['calories'] || 0);
      const avgHr = parseFloat(lower['avg hr'] || lower['average heart rate'] || 0);
      const steps = parseFloat(lower['steps'] || 0);

      if (distance > 0 || duration > 0 || steps > 0) {
        store.addDomainEntry('health', 'activityData', {
          activity_type: activityType.toLowerCase().replace(/\s/g, '_'),
          source: 'garmin',
          distance_km: distance,
          duration_minutes: Math.round(duration / 60),
          calories_burned: calories,
          steps, date
        });
        count++;
      }
      if (avgHr > 0) {
        store.addDomainEntry('health', 'vitals', {
          heart_rate: avgHr, source: 'garmin', date
        });
        count++;
      }
    });
    return count;
  }
};

// ─── Plaud Pro: email auto-send reminder ───
// Plaud does not have a public OAuth API. The supported path is their
// existing "auto-send to email" feature which we already handle via
// the email ingest worker. This module exposes setup guidance only.
var plaudPro = {
  getIngestEmail() {
    return typeof generateUserEmail === 'function' ? generateUserEmail() : null;
  },

  getSetupInstructions() {
    return [
      'Plaud アプリを開く',
      '設定（歯車）→「自動送信」または Auto Sync',
      '送信先メールアドレスにあなた専用の取込アドレスを設定',
      '送信フォーマット：テキストまたは文字起こしのみ',
      '自動送信を有効化'
    ];
  }
};

// ─── Sony Reon Pocket (UI only - no public data API) ───
// Reon Pocket has no public API for temperature/body cooling data.
// We expose a manual log interface so users can still track usage.
var reonPocket = {
  logSession(data) {
    store.addDomainEntry('health', 'activityData', {
      activity_type: 'cooling_session',
      source: 'reon_pocket',
      duration_minutes: data.duration || 0,
      notes: data.notes || 'Reon Pocket 使用',
      date: data.date || new Date().toISOString().slice(0, 10)
    });
  }
};

// ─── ZIP Bulk Import ───
// Uses JSZip (loaded via CDN in dashboard.html) to unpack common
// archive formats: Facebook, Instagram, Google Takeout, Discord.
// Routes each file to the appropriate parser in sns-integrations
// or fileImport module.
var zipImport = {
  async importZip(file) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZipライブラリが読み込まれていません');
    }

    const zip = await JSZip.loadAsync(file);
    const results = {
      processed: 0,
      contactsAdded: 0,
      calendarEvents: 0,
      healthRecords: 0,
      transcripts: 0,
      skipped: 0,
      files: []
    };

    // Iterate through ZIP entries
    const entries = Object.values(zip.files).filter(f => !f.dir);

    for (const entry of entries) {
      const name = entry.name.toLowerCase();
      const basename = name.split('/').pop();
      results.files.push(basename);

      try {
        // Skip unsupported binary / huge files
        if (/\.(jpg|jpeg|png|gif|mp4|mov|mp3|wav|pdf|zip)$/i.test(basename)) {
          results.skipped++;
          continue;
        }

        const content = await entry.async('string');

        // SNS parsers (Facebook/Instagram/Discord/Telegram/LinkedIn)
        if (basename === 'friends.json' || basename === 'your_friends.json') {
          const c = snsImport.parseFacebookFriends(content);
          results.contactsAdded += snsImport.importContacts(c, 'facebook');
          results.processed++;
        } else if (basename === 'following.json' || basename.includes('following_accounts')) {
          const c = snsImport.parseInstagramFollowing(content);
          results.contactsAdded += snsImport.importContacts(c, 'instagram');
          results.processed++;
        } else if (basename === 'following.js' || basename.startsWith('following-')) {
          const c = snsImport.parseTwitterFollowing(content);
          results.contactsAdded += snsImport.importContacts(c, 'twitter');
          results.processed++;
        } else if (basename === 'connections.csv' || basename.includes('linkedin')) {
          const c = snsImport.parseLinkedInConnections(content);
          results.contactsAdded += snsImport.importContacts(c, 'linkedin');
          results.processed++;
        } else if (basename.includes('discord') || basename === 'messages.json' || basename === 'friends.json') {
          const c = snsImport.parseDiscordExport(content);
          results.contactsAdded += snsImport.importContacts(c, 'discord');
          results.processed++;
        } else if (basename === 'result.json' || basename.includes('telegram')) {
          const c = snsImport.parseTelegramExport(content);
          results.contactsAdded += snsImport.importContacts(c, 'telegram');
          results.processed++;
        }
        // Calendar (.ics)
        else if (basename.endsWith('.ics') && typeof CalendarIntegration !== 'undefined') {
          const events = CalendarIntegration.importICS(content);
          results.calendarEvents += (events?.length || 0);
          results.processed++;
        }
        // Apple Health XML (export.xml)
        else if (basename === 'export.xml' && typeof appleHealth !== 'undefined') {
          const parsed = appleHealth.parseExport(content);
          results.healthRecords += appleHealth.importData(parsed);
          results.processed++;
        }
        // Generic CSV/JSON → try fileImport
        else if ((basename.endsWith('.csv') || basename.endsWith('.json')) &&
                 typeof fileImport !== 'undefined') {
          // Best-effort: try SNS parsers
          if (basename.endsWith('.txt')) {
            const c = snsImport.parseWhatsAppChat(content);
            if (c.length > 0) {
              results.contactsAdded += snsImport.importContacts(c, 'whatsapp');
              results.processed++;
            }
          }
          results.skipped++;
        } else {
          results.skipped++;
        }
      } catch (e) {
        console.warn('ZIP entry processing error:', basename, e);
        results.skipped++;
      }
    }

    return results;
  }
};

// ─── Check OAuth callbacks on page load ───
document.addEventListener('DOMContentLoaded', () => {
  if (typeof fitbit !== 'undefined') fitbit.checkCallback();
  if (typeof googleCalendar !== 'undefined') googleCalendar.checkCallback();
  if (typeof outlookCalendar !== 'undefined') outlookCalendar.checkCallback();
  if (typeof withings !== 'undefined') withings.checkCallback();
});
