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
  return `data-${hash}@inbox.lms-life.com`;
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
        Components.showToast('Googleカレンダーに接続しました', 'success');
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
    const hash = window.location.hash;
    if (hash.includes('access_token=') && (hash.includes('state=fitbit') || !hash.includes('state=gcal'))) {
      const token = hash.match(/access_token=([^&]+)/)?.[1];
      if (token) {
        localStorage.setItem('lms_fitbit_token', token);
        window.location.hash = '';
        Components.showToast('Fitbitに接続しました', 'success');
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

// ─── Check OAuth callbacks on page load ───
document.addEventListener('DOMContentLoaded', () => {
  if (typeof fitbit !== 'undefined') fitbit.checkCallback();
  if (typeof googleCalendar !== 'undefined') googleCalendar.checkCallback();
});
