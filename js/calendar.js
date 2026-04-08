/* ============================================================
   LMS - Calendar Integration
   Google Calendar / Outlook / iCal connectivity
   Based on 未病ダイアリー calendar module
   ============================================================ */
var CalendarIntegration = {

  events: [],

  // ─── Save events from external calendar ───
  saveEvents(rawEvents) {
    if (!Array.isArray(rawEvents)) return;

    // Deduplicate and clean
    const seen = new Set();
    this.events = rawEvents.filter(e => {
      const key = (e.id || '') + (e.summary || '') + (e.start || '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(e => ({
      id: e.id || Date.now().toString(36),
      summary: (e.summary || '').replace(/<[^>]*>/g, ''),
      start: e.start?.dateTime || e.start?.date || e.start || '',
      end: e.end?.dateTime || e.end?.date || e.end || '',
      location: e.location || '',
      description: (e.description || '').replace(/<[^>]*>/g, ''),
      allDay: !!(e.start?.date),
      source: e.source || 'google'
    }));

    store.set('calendarEvents', this.events);
    return this.events;
  },

  // ─── Get today's events ───
  getToday() {
    const today = new Date().toISOString().slice(0, 10);
    return this.events.filter(e => {
      const eventDate = (e.start || '').slice(0, 10);
      return eventDate === today;
    }).sort((a, b) => new Date(a.start) - new Date(b.start));
  },

  // ─── Get this week's events ───
  getThisWeek() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return this.events.filter(e => {
      const d = new Date(e.start);
      return d >= weekStart && d < weekEnd;
    }).sort((a, b) => new Date(a.start) - new Date(b.start));
  },

  // ─── Analyze schedule load ───
  analyzeLoad() {
    const week = this.getThisWeek();
    let totalHours = 0;
    let meetings = 0;
    let allDay = 0;

    week.forEach(e => {
      if (e.allDay) {
        allDay++;
      } else if (e.start && e.end) {
        const hours = (new Date(e.end) - new Date(e.start)) / (1000 * 60 * 60);
        totalHours += hours;
        meetings++;
      }
    });

    const load = totalHours > 30 ? 'high' : totalHours > 15 ? 'medium' : 'low';

    return {
      totalEvents: week.length,
      meetings,
      allDayEvents: allDay,
      totalHours: Math.round(totalHours * 10) / 10,
      load,
      advice: this.getLoadAdvice(load, totalHours)
    };
  },

  getLoadAdvice(load, hours) {
    switch (load) {
      case 'high':
        return '今週は予定が多めです。無理をせず、合間に休憩を入れましょう。';
      case 'medium':
        return '今週はバランスの取れたスケジュールです。ゆとりの時間も大切にしてくださいね。';
      case 'low':
        return '今週はゆったりとした予定です。好きなことを楽しむ時間をつくりましょう。';
      default:
        return '';
    }
  },

  // ─── Render schedule widget for Time domain home ───
  renderWidget() {
    const today = this.getToday();
    const load = this.analyzeLoad();

    if (this.events.length === 0) {
      return `<div class="calendar-widget">
        <h3>📅 今日の予定</h3>
        <div class="calendar-empty">
          <p>カレンダーがまだ接続されていません</p>
          <button class="btn btn-secondary" onclick="app.navigate('settings')">カレンダーを接続する</button>
        </div>
      </div>`;
    }

    let html = `<div class="calendar-widget">
      <h3>📅 今日の予定（${today.length}件）</h3>
      <div class="calendar-events">`;

    if (today.length === 0) {
      html += '<p class="calendar-free">今日は予定がありません。のんびりお過ごしください。</p>';
    } else {
      today.forEach(e => {
        const time = e.allDay ? '終日' :
          new Date(e.start).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        html += `<div class="calendar-event">
          <span class="event-time">${time}</span>
          <span class="event-title">${e.summary}</span>
          ${e.location ? `<span class="event-location">📍 ${e.location}</span>` : ''}
        </div>`;
      });
    }

    // Weekly load indicator
    const loadColor = load.load === 'high' ? '#E74C3C' : load.load === 'medium' ? '#F39C12' : '#27AE60';
    html += `</div>
      <div class="calendar-load" style="border-left: 4px solid ${loadColor}; padding: 12px; margin-top: 12px; background: #f8f9fa; border-radius: 8px;">
        <strong>今週の活動量：</strong>${load.totalHours}時間（${load.meetings}件の予定）<br>
        <span style="color: ${loadColor}">${load.advice}</span>
      </div>
    </div>`;

    return html;
  },

  // ─── Calculate time usage from calendar ───
  calculateTimeUsage() {
    const week = this.getThisWeek();
    const categories = {};

    week.forEach(e => {
      const cat = this.categorizeEvent(e);
      if (!categories[cat]) categories[cat] = { hours: 0, count: 0 };
      categories[cat].count++;

      if (e.start && e.end && !e.allDay) {
        const hours = (new Date(e.end) - new Date(e.start)) / (1000 * 60 * 60);
        categories[cat].hours += hours;
      }
    });

    return categories;
  },

  categorizeEvent(event) {
    const text = ((event.summary || '') + ' ' + (event.description || '')).toLowerCase();
    if (/病院|医|クリニック|検診|歯|薬/.test(text)) return 'health';
    if (/会議|ミーティング|打ち合わせ|仕事|mtg/.test(text)) return 'work';
    if (/趣味|習い事|教室|レッスン|サークル/.test(text)) return 'leisure';
    if (/ランチ|食事|ディナー|お茶/.test(text)) return 'social';
    if (/ボランティア|地域|自治会/.test(text)) return 'contribution';
    if (/誕生日|記念日|お祝い/.test(text)) return 'family';
    if (/運動|散歩|ヨガ|プール|体操/.test(text)) return 'exercise';
    return 'other';
  },

  // ─── Google Calendar OAuth connection ───
  async connectGoogleCalendar() {
    // This requires Google Calendar API setup
    // For now, provide manual import instructions
    Components.showToast('Googleカレンダーの接続は設定画面から行えます', 'info');
  },

  // ─── Import from ICS file ───
  importICS(icsContent) {
    const events = [];
    const lines = icsContent.split('\n');
    let event = null;

    lines.forEach(line => {
      const l = line.trim();
      if (l === 'BEGIN:VEVENT') event = {};
      else if (l === 'END:VEVENT' && event) {
        events.push(event);
        event = null;
      } else if (event) {
        if (l.startsWith('SUMMARY:')) event.summary = l.substring(8);
        else if (l.startsWith('DTSTART')) event.start = this.parseICSDate(l);
        else if (l.startsWith('DTEND')) event.end = this.parseICSDate(l);
        else if (l.startsWith('LOCATION:')) event.location = l.substring(9);
        else if (l.startsWith('DESCRIPTION:')) event.description = l.substring(12);
      }
    });

    if (events.length > 0) {
      this.saveEvents(events.map(e => ({ ...e, source: 'ics' })));
      Components.showToast(`${events.length}件の予定を取り込みました`, 'success');
    }
    return events;
  },

  parseICSDate(line) {
    const match = line.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
    if (!match) return '';
    const [, y, m, d, h, min, s] = match;
    if (h) return `${y}-${m}-${d}T${h}:${min}:${s || '00'}`;
    return `${y}-${m}-${d}`;
  },

  // ─── Init from stored data ───
  init() {
    const stored = store.get('calendarEvents');
    if (Array.isArray(stored)) this.events = stored;
  }
};

document.addEventListener('DOMContentLoaded', () => CalendarIntegration.init());
