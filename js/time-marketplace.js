/* ============================================================
   LMS - Time Marketplace
   空き時間を販売・提供するシステム
   Google Calendar空き時間 + PayPal決済
   ============================================================ */
var TimeMarketplace = {

  // ─── ユーザーのサービス設定 ───
  getSettings() {
    return store.get('timeMarketplaceSettings') || {
      enabled: false,
      skills: [],         // [{ name, description, category }]
      location: {
        type: 'remote',   // 'remote' | 'onsite' | 'both'
        address: '',
        canTravel: false
      },
      rate: {
        amount: 3000,     // 1時間あたり（円）
        currency: 'JPY',
        minimumMinutes: 30
      },
      availability: {
        daysOfWeek: [1, 2, 3, 4, 5],  // 0=Sun, 1=Mon...
        startHour: 9,
        endHour: 17,
        bufferMinutes: 30   // 予定の前後に空ける時間
      },
      paypal: {
        email: ''  // PayPal.me or PayPal email
      },
      profile: {
        displayName: '',
        bio: '',
        experience: ''
      }
    };
  },

  saveSettings(settings) {
    store.set('timeMarketplaceSettings', settings);
  },

  // ─── カレンダーから空き時間を計算 ───
  calculateFreeSlots(date, daysAhead = 7) {
    const settings = this.getSettings();
    if (!settings.enabled) return [];

    const slots = [];
    const events = (typeof CalendarIntegration !== 'undefined') ?
      CalendarIntegration.events : (store.get('calendarEvents') || []);

    for (let d = 0; d < daysAhead; d++) {
      const day = new Date(date || new Date());
      day.setDate(day.getDate() + d);
      const dayOfWeek = day.getDay();

      // この曜日は対応可能か
      if (!settings.availability.daysOfWeek.includes(dayOfWeek)) continue;

      const dayStr = day.toISOString().slice(0, 10);
      const dayEvents = events
        .filter(e => (e.start || '').slice(0, 10) === dayStr && !e.allDay)
        .sort((a, b) => new Date(a.start) - new Date(b.start));

      // 営業時間内の空き時間を計算
      const startTime = new Date(day);
      startTime.setHours(settings.availability.startHour, 0, 0, 0);
      const endTime = new Date(day);
      endTime.setHours(settings.availability.endHour, 0, 0, 0);

      let cursor = new Date(startTime);
      const buffer = settings.availability.bufferMinutes * 60000;
      const minDuration = settings.rate.minimumMinutes * 60000;

      dayEvents.forEach(evt => {
        const evtStart = new Date(evt.start);
        const evtEnd = new Date(evt.end);

        // カーソルからイベント開始までが空き
        const slotEnd = new Date(evtStart.getTime() - buffer);
        if (slotEnd - cursor >= minDuration) {
          slots.push({
            date: dayStr,
            start: cursor.toISOString(),
            end: slotEnd.toISOString(),
            durationMinutes: Math.round((slotEnd - cursor) / 60000)
          });
        }
        // カーソルをイベント終了後に移動
        cursor = new Date(evtEnd.getTime() + buffer);
      });

      // 最後のイベント後から営業時間終了まで
      if (endTime - cursor >= minDuration) {
        slots.push({
          date: dayStr,
          start: cursor.toISOString(),
          end: endTime.toISOString(),
          durationMinutes: Math.round((endTime - cursor) / 60000)
        });
      }
    }

    return slots;
  },

  // ─── 空き時間の合計を計算 ───
  getTotalFreeHours(days = 7) {
    const slots = this.calculateFreeSlots(new Date(), days);
    const totalMin = slots.reduce((s, slot) => s + slot.durationMinutes, 0);
    return {
      totalMinutes: totalMin,
      totalHours: Math.round(totalMin / 60 * 10) / 10,
      slots: slots.length,
      potentialRevenue: Math.round(totalMin / 60 * (this.getSettings().rate?.amount || 0))
    };
  },

  // ─── PayPal決済リンク生成 ───
  generatePaymentLink(slot, durationMinutes) {
    const settings = this.getSettings();
    const amount = Math.round(durationMinutes / 60 * settings.rate.amount);

    if (settings.paypal.email) {
      // PayPal.me リンク
      return `https://paypal.me/${settings.paypal.email}/${amount}${settings.rate.currency}`;
    }
    return null;
  },

  // ─── 予約リクエスト管理 ───
  getBookings() {
    return store.get('timeMarketplaceBookings') || [];
  },

  addBooking(booking) {
    const bookings = this.getBookings();
    bookings.push({
      id: Date.now().toString(36),
      ...booking,
      status: 'pending',  // pending | confirmed | completed | cancelled
      createdAt: new Date().toISOString()
    });
    store.set('timeMarketplaceBookings', bookings);
    return bookings;
  },

  updateBookingStatus(id, status) {
    const bookings = this.getBookings();
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      booking.status = status;
      booking.updatedAt = new Date().toISOString();
      store.set('timeMarketplaceBookings', bookings);
    }
  },

  // ─── 設定画面のレンダリング ───
  renderSettings() {
    const s = this.getSettings();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    return `<div class="marketplace-settings">
      <h3>⏰ 空き時間の販売設定</h3>
      <p>カレンダーの空き時間を自動で計算し、あなたのスキルや経験を必要としている方に提供できます。</p>

      <div class="form-group">
        <label>サービスを有効にする</label>
        <label class="toggle">
          <input type="checkbox" id="mpEnabled" ${s.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="form-group">
        <label>あなたのお名前（表示名）</label>
        <input type="text" id="mpDisplayName" class="form-input" value="${s.profile.displayName || ''}" placeholder="例：山田花子">
      </div>

      <div class="form-group">
        <label>自己紹介・経験</label>
        <textarea id="mpBio" class="form-input" rows="3" placeholder="例：30年間の看護師経験があります。健康相談が得意です。">${s.profile.bio || ''}</textarea>
      </div>

      <div class="form-group">
        <label>提供できるスキル・サービス（カンマ区切り）</label>
        <input type="text" id="mpSkills" class="form-input" value="${(s.skills || []).map(sk => sk.name).join(', ')}" placeholder="例：健康相談, 料理教室, 英会話, 書道">
      </div>

      <div class="form-group">
        <label>提供方法</label>
        <select id="mpLocationType" class="form-input">
          <option value="remote" ${s.location.type === 'remote' ? 'selected' : ''}>オンライン（Zoom等）</option>
          <option value="onsite" ${s.location.type === 'onsite' ? 'selected' : ''}>対面のみ</option>
          <option value="both" ${s.location.type === 'both' ? 'selected' : ''}>どちらでも</option>
        </select>
      </div>

      <div class="form-group">
        <label>場所（対面の場合）</label>
        <input type="text" id="mpAddress" class="form-input" value="${s.location.address || ''}" placeholder="例：東京都渋谷区...">
      </div>

      <div class="form-group">
        <label>1時間あたりの料金（円）</label>
        <input type="number" id="mpRate" class="form-input" value="${s.rate.amount || 3000}" step="500" min="0">
      </div>

      <div class="form-group">
        <label>最低提供時間（分）</label>
        <select id="mpMinTime" class="form-input">
          <option value="30" ${s.rate.minimumMinutes == 30 ? 'selected' : ''}>30分</option>
          <option value="60" ${s.rate.minimumMinutes == 60 ? 'selected' : ''}>1時間</option>
          <option value="90" ${s.rate.minimumMinutes == 90 ? 'selected' : ''}>1時間30分</option>
        </select>
      </div>

      <div class="form-group">
        <label>対応可能な曜日</label>
        <div class="day-checkboxes">
          ${dayNames.map((name, i) => `
            <label class="day-check">
              <input type="checkbox" name="mpDays" value="${i}" ${s.availability.daysOfWeek.includes(i) ? 'checked' : ''}>
              ${name}
            </label>
          `).join('')}
        </div>
      </div>

      <div class="form-group" style="display:flex;gap:16px;">
        <div style="flex:1">
          <label>開始時刻</label>
          <select id="mpStartHour" class="form-input">
            ${Array.from({length:14}, (_,i) => i+6).map(h => `<option value="${h}" ${s.availability.startHour == h ? 'selected' : ''}>${h}:00</option>`).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label>終了時刻</label>
          <select id="mpEndHour" class="form-input">
            ${Array.from({length:14}, (_,i) => i+8).map(h => `<option value="${h}" ${s.availability.endHour == h ? 'selected' : ''}>${h}:00</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>PayPalメールアドレス（決済用）</label>
        <input type="email" id="mpPaypal" class="form-input" value="${s.paypal.email || ''}" placeholder="your-email@example.com">
      </div>

      <button class="btn btn-primary" onclick="app.saveMarketplaceSettings()">設定を保存</button>
    </div>`;
  },

  // ─── 空き時間ウィジェット（ホーム画面用） ───
  renderWidget() {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return `<div class="marketplace-widget">
        <h3>⏰ 空き時間の活用</h3>
        <p>あなたの経験やスキルを、空き時間を使って提供してみませんか？</p>
        <button class="btn btn-secondary" onclick="app.navigate('settings')">設定を見る</button>
      </div>`;
    }

    const free = this.getTotalFreeHours(7);
    const slots = this.calculateFreeSlots(new Date(), 7);

    let html = `<div class="marketplace-widget">
      <h3>⏰ 今週の空き時間</h3>
      <div class="mp-stats">
        ${Components.statCard('空き時間', free.totalHours + '時間', null, '🕐')}
        ${Components.statCard('空き枠', free.slots + '枠', null, '📅')}
        ${Components.statCard('見込み収入', free.potentialRevenue.toLocaleString() + '円', null, '💰')}
      </div>`;

    if (slots.length > 0) {
      html += `<div class="mp-slots">
        <h4>空き枠一覧</h4>`;
      slots.slice(0, 5).forEach(slot => {
        const date = new Date(slot.start);
        const dateStr = date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
        const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const endStr = new Date(slot.end).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        html += `<div class="mp-slot">
          <span class="slot-date">${dateStr}</span>
          <span class="slot-time">${timeStr} - ${endStr}</span>
          <span class="slot-duration">${slot.durationMinutes}分</span>
        </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  // ─── 公開予約ページ（共有可能なURL用） ───
  renderBookingPage() {
    const settings = this.getSettings();
    if (!settings.enabled) return '<p>現在、予約を受け付けていません。</p>';

    const slots = this.calculateFreeSlots(new Date(), 14);

    let html = `<div class="booking-page">
      <div class="booking-profile">
        <h2>${settings.profile.displayName || 'ユーザー'}さんのページ</h2>
        <p>${settings.profile.bio || ''}</p>
        <div class="booking-skills">
          ${(settings.skills || []).map(s => `<span class="skill-tag">${s.name}</span>`).join('')}
        </div>
        <div class="booking-meta">
          <span>📍 ${settings.location.type === 'remote' ? 'オンライン' : settings.location.type === 'both' ? 'オンライン/対面' : '対面'}</span>
          <span>💰 ${settings.rate.amount.toLocaleString()}円/時間</span>
        </div>
      </div>

      <h3>空き時間を選択</h3>
      <div class="booking-slots">`;

    if (slots.length === 0) {
      html += '<p>現在空いている時間帯がありません。</p>';
    } else {
      slots.forEach(slot => {
        const date = new Date(slot.start);
        const dateStr = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const endStr = new Date(slot.end).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const amount = Math.round(slot.durationMinutes / 60 * settings.rate.amount);

        html += `<div class="booking-slot">
          <div class="slot-info">
            <div class="slot-date">${dateStr}</div>
            <div class="slot-time">${timeStr} ~ ${endStr}（${slot.durationMinutes}分）</div>
          </div>
          <div class="slot-price">${amount.toLocaleString()}円</div>
          <button class="btn btn-primary btn-sm" onclick="TimeMarketplace.requestBooking('${slot.start}', '${slot.end}')">予約する</button>
        </div>`;
      });
    }

    html += `</div></div>`;
    return html;
  },

  // ─── 予約リクエスト ───
  requestBooking(start, end) {
    const settings = this.getSettings();
    const durationMin = Math.round((new Date(end) - new Date(start)) / 60000);
    const amount = Math.round(durationMin / 60 * settings.rate.amount);

    // PayPal決済リンクを開く
    const payLink = this.generatePaymentLink(null, durationMin);
    if (payLink) {
      window.open(payLink, '_blank');
    }

    this.addBooking({ start, end, durationMin, amount, currency: settings.rate.currency });
    Components.showToast('予約リクエストを送信しました', 'success');
  }
};
