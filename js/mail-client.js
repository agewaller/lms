/**
 * LMS Mail Client
 * mail-sender Worker を呼び出してメールを送信する。
 * Worker URL は CONFIG.endpoints.mailSender に設定（管理パネルで設定）。
 *
 * 使用例:
 *   MailClient.sendTemplate('welcome', user.email, { name: user.displayName })
 *   MailClient.sendRaw(to, subject, html)
 */
var MailClient = {
  get workerUrl() {
    return CONFIG.endpoints?.mailSender || store.get('mailSenderUrl') || '';
  },

  isConfigured() {
    return !!this.workerUrl;
  },

  async sendRaw(to, subject, html) {
    if (!this.isConfigured()) {
      console.warn('[MailClient] mailSender Worker URL not configured');
      return { skipped: true };
    }
    const res = await fetch(this.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async sendTemplate(template, to, data = {}) {
    if (!this.isConfigured()) {
      console.warn('[MailClient] mailSender Worker URL not configured');
      return { skipped: true };
    }
    const res = await fetch(this.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, to, data })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // ─── Convenience wrappers ───

  async sendWelcome(to, name) {
    return this.sendTemplate('welcome', to, { name });
  },

  async sendDailyReminder(to, name, streak = 0, date = '') {
    return this.sendTemplate('daily', to, { name, streak, date });
  },

  async sendBirthdayReminder(to, userName, personName, daysLeft) {
    return this.sendTemplate('birthday', to, { name: userName, personName, daysLeft });
  },

  async sendIsolationAlert(to, name) {
    return this.sendTemplate('isolation', to, { name });
  },

  // ─── Notification triggers (called from app lifecycle) ───

  // Call on new user registration
  async onUserRegistered(user) {
    if (!user?.email) return;
    try {
      await this.sendWelcome(user.email, user.displayName || user.email.split('@')[0]);
    } catch (e) {
      console.warn('[MailClient] welcome email failed:', e.message);
    }
  },

  // Call daily (from firebase-backend onAuthStateChanged or a scheduled check)
  async checkDailyReminder(user) {
    if (!user?.email) return;
    const today = new Date().toISOString().slice(0, 10);
    const sentKey = 'lms_mail_daily_' + today;
    if (localStorage.getItem(sentKey)) return; // already sent today

    // Only send if user hasn't recorded anything today
    const profile = store.get('userProfile') || {};
    const streak = this._readStreak();
    if (streak.last === today) return; // already recorded today

    // Send reminder between 10:00–11:00 local time
    const hour = new Date().getHours();
    if (hour < 10 || hour >= 11) return;

    try {
      await this.sendDailyReminder(user.email, profile.name || profile.displayName || '', streak.count, today);
      localStorage.setItem(sentKey, '1');
    } catch (e) {
      console.warn('[MailClient] daily reminder failed:', e.message);
    }
  },

  // Call when relationship data is loaded/updated
  async checkBirthdayReminders(user) {
    if (!user?.email) return;
    const profile = store.get('userProfile') || {};
    const relationships = store.get('relationship_contacts') || [];
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    for (const contact of relationships) {
      if (!contact.birthday) continue;
      const bday = new Date(contact.birthday);
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const diff = Math.round((thisYear - today) / 86400000);
      const daysLeft = diff >= 0 ? diff : Math.round((new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate()) - today) / 86400000);

      if (daysLeft !== 30 && daysLeft !== 3) continue;

      const sentKey = `lms_mail_bday_${contact.id || contact.name}_${daysLeft}_${todayStr}`;
      if (localStorage.getItem(sentKey)) continue;

      try {
        await this.sendBirthdayReminder(user.email, profile.name || '', contact.name, daysLeft);
        localStorage.setItem(sentKey, '1');
      } catch (e) {
        console.warn('[MailClient] birthday reminder failed:', e.message);
      }
    }
  },

  // Call when isolation score is computed
  async checkIsolationAlert(user, isolationScore) {
    if (!user?.email) return;
    if (isolationScore < 70) return; // only alert at high scores

    const today = new Date().toISOString().slice(0, 10);
    const sentKey = 'lms_mail_isolation_' + today;
    if (localStorage.getItem(sentKey)) return;

    const profile = store.get('userProfile') || {};
    try {
      await this.sendIsolationAlert(user.email, profile.name || '');
      localStorage.setItem(sentKey, '1');
    } catch (e) {
      console.warn('[MailClient] isolation alert failed:', e.message);
    }
  },

  _readStreak() {
    try {
      const raw = localStorage.getItem('lms_streak');
      return raw ? JSON.parse(raw) : { last: '', count: 0 };
    } catch { return { last: '', count: 0 }; }
  }
};
