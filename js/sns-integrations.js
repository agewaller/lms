/* ============================================================
   LMS - SNS Integrations
   Facebook / Instagram / X (Twitter) / Gmail / LinkedIn

   設計方針:
   - Gmail: OAuth2 で公式 API を叩き、頻繁にやり取りしている人を
     連絡先として relationship ドメインに追加
   - Facebook / Instagram / X: 公式APIの利用が制限的なので、
     手動エクスポート（各サービスのデータダウンロード）取り込みに対応
   - LinkedIn: 手動エクスポート取り込み（connections.csv）

   すべてのSNSで「連絡先リスト」「やり取りの記録」を統合して
   relationship ドメインに反映できる。
   ============================================================ */

// ─── Gmail Integration (Google OAuth2) ───
var gmailIntegration = {
  getClientId() {
    return localStorage.getItem('lms_gmail_client_id') || localStorage.getItem('lms_gcal_client_id') || '';
  },

  setClientId(id) {
    localStorage.setItem('lms_gmail_client_id', id);
  },

  getToken() {
    return localStorage.getItem('lms_gmail_token') || '';
  },

  isConnected() {
    return !!this.getToken();
  },

  async connect() {
    const clientId = this.getClientId();
    if (!clientId) {
      Components.showToast('Google Client IDを設定してください', 'info');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/contacts.readonly');
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=gmail&prompt=consent`;
  },

  checkCallback() {
    const hash = window.location.hash;
    if (hash.includes('access_token=') && hash.includes('state=gmail')) {
      const token = hash.match(/access_token=([^&]+)/)?.[1];
      if (token) {
        localStorage.setItem('lms_gmail_token', token);
        window.location.hash = '';
        if (typeof Components !== 'undefined') Components.showToast('Gmailに接続しました', 'success');
        return true;
      }
    }
    return false;
  },

  disconnect() {
    localStorage.removeItem('lms_gmail_token');
  },

  // Extract frequently contacted people from Gmail and add to relationship contacts
  async importFrequentContacts(monthsBack = 6) {
    const token = this.getToken();
    if (!token) throw new Error('Gmail未接続');

    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);
    const query = encodeURIComponent(`after:${since.toISOString().slice(0, 10)}`);

    // List recent messages (up to 500)
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500`,
      { headers: { 'Authorization': 'Bearer ' + token } }
    );

    if (listRes.status === 401) {
      this.disconnect();
      throw new Error('トークン切れ。再接続してください。');
    }
    if (!listRes.ok) throw new Error('Gmail取得失敗');

    const listData = await listRes.json();
    const messages = listData.messages || [];

    // Tally senders/recipients by frequency
    const contactTally = {};

    for (const msg of messages.slice(0, 200)) {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To`,
          { headers: { 'Authorization': 'Bearer ' + token } }
        );
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();
        const headers = detail.payload?.headers || [];

        headers.forEach(h => {
          if (h.name === 'From' || h.name === 'To') {
            // Parse "Name <email>" format
            const match = h.value.match(/"?([^"<]+?)"?\s*<([^>]+)>/) || [null, null, h.value];
            const name = (match[1] || '').trim();
            const email = (match[2] || h.value).trim();
            if (!email || email.includes('noreply') || email.includes('no-reply')) return;

            if (!contactTally[email]) {
              contactTally[email] = { name, email, count: 0, source: 'gmail' };
            }
            contactTally[email].count++;
            if (name && !contactTally[email].name) contactTally[email].name = name;
          }
        });

        // Rate limit courtesy
        await new Promise(r => setTimeout(r, 50));
      } catch (e) { /* skip broken messages */ }
    }

    // Filter to frequently contacted (3+ messages) and add to relationship
    const frequent = Object.values(contactTally)
      .filter(c => c.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Deduplicate against existing contacts
    const existing = store.get('relationship_contacts') || [];
    const existingEmails = new Set(existing.map(c => (c.email || '').toLowerCase()));

    let added = 0;
    frequent.forEach(c => {
      if (existingEmails.has(c.email.toLowerCase())) return;
      store.addDomainEntry('relationship', 'contacts', {
        name: c.name || c.email,
        email: c.email,
        distance: c.count >= 10 ? '2' : c.count >= 5 ? '3' : '4',
        relationship: 'other',
        source: 'gmail',
        interactionCount: c.count,
        notes: `Gmailで過去${monthsBack}ヶ月間に${c.count}回やり取り`
      });
      added++;
    });

    return { total: frequent.length, added, skipped: frequent.length - added };
  }
};

// ─── Facebook / Instagram / X / LinkedIn: Manual Export Import ───
// 各SNSは公式APIの制約が厳しいため、ユーザー自身がダウンロードした
// エクスポートファイルを取り込む形式にする。
var snsImport = {

  // Facebook: JSON または HTML アーカイブ
  parseFacebookFriends(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      const friends = data.friends_v2 || data.friends || [];
      return friends.map(f => ({
        name: f.name || '',
        source: 'facebook',
        addedAt: f.timestamp ? new Date(f.timestamp * 1000).toISOString() : null
      }));
    } catch (e) {
      return [];
    }
  },

  // Instagram: JSON アーカイブ (followers_1.json, following.json)
  parseInstagramFollowing(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      const list = data.relationships_following || data.following || [];
      return list.map(item => {
        const entry = item.string_list_data?.[0];
        return {
          name: entry?.value || '',
          sns_account: entry?.value || '',
          url: entry?.href || '',
          source: 'instagram',
          addedAt: entry?.timestamp ? new Date(entry.timestamp * 1000).toISOString() : null
        };
      }).filter(c => c.name);
    } catch (e) {
      return [];
    }
  },

  // X (Twitter): JSON アーカイブ (following.js)
  parseTwitterFollowing(text) {
    try {
      // X archives have format: window.YTD.following.part0 = [ {...}, ... ]
      const cleaned = text.replace(/^window\.YTD\.[^=]+=\s*/, '');
      const data = JSON.parse(cleaned);
      return data.map(item => {
        const f = item.following || {};
        return {
          name: f.accountId || '',
          sns_account: f.userLink || '',
          url: f.userLink || '',
          source: 'twitter',
          followedAt: f.timestamp || null
        };
      }).filter(c => c.name);
    } catch (e) {
      return [];
    }
  },

  // LinkedIn: connections.csv
  parseLinkedInConnections(csvText) {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Find header row (LinkedIn prefixes notes before the CSV data)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      if (lines[i].toLowerCase().includes('first name')) { headerIdx = i; break; }
    }

    const headers = lines[headerIdx].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    return lines.slice(headerIdx + 1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return {
        name: [obj['first name'], obj['last name']].filter(Boolean).join(' '),
        email: obj['email address'] || '',
        company: obj['company'] || '',
        title: obj['position'] || '',
        source: 'linkedin',
        connectedAt: obj['connected on'] || ''
      };
    }).filter(c => c.name);
  },

  // Generic: import any SNS parser result to relationship_contacts
  importContacts(contacts, sourceName) {
    if (!Array.isArray(contacts) || contacts.length === 0) return 0;

    const existing = store.get('relationship_contacts') || [];
    const existingKeys = new Set(
      existing.map(c => (c.name || '').toLowerCase() + '::' + (c.email || c.sns_account || ''))
    );

    let added = 0;
    contacts.forEach(c => {
      const key = (c.name || '').toLowerCase() + '::' + (c.email || c.sns_account || '');
      if (existingKeys.has(key)) return;
      store.addDomainEntry('relationship', 'contacts', {
        ...c,
        distance: '4',
        relationship: 'other',
        notes: `${sourceName}から取り込み`
      });
      added++;
    });
    return added;
  },

  // Read a file and auto-detect format
  async importFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const name = file.name.toLowerCase();
        let contacts = [];
        let source = 'unknown';

        try {
          if (name.includes('friends') && name.endsWith('.json')) {
            contacts = this.parseFacebookFriends(content);
            source = 'facebook';
          } else if (name.includes('following') && name.endsWith('.json')) {
            contacts = this.parseInstagramFollowing(content);
            source = 'instagram';
          } else if (name.startsWith('following') && name.endsWith('.js')) {
            contacts = this.parseTwitterFollowing(content);
            source = 'twitter';
          } else if (name.includes('connection') && name.endsWith('.csv')) {
            contacts = this.parseLinkedInConnections(content);
            source = 'linkedin';
          } else if (name.endsWith('.json')) {
            // Try Facebook first, then Instagram
            contacts = this.parseFacebookFriends(content);
            source = 'facebook';
            if (contacts.length === 0) {
              contacts = this.parseInstagramFollowing(content);
              source = 'instagram';
            }
          } else if (name.endsWith('.csv')) {
            contacts = this.parseLinkedInConnections(content);
            source = 'linkedin';
          }

          const added = this.importContacts(contacts, source);
          resolve({ source, total: contacts.length, added });
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
  if (typeof gmailIntegration !== 'undefined') gmailIntegration.checkCallback();
});
