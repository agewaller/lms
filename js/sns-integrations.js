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
  // Priority: admin-shared CONFIG.oauthClientIds.google > legacy localStorage
  // Gmail and Google Calendar use the same Google Cloud project, so we
  // reuse the same `google` slot in oauthClientIds.
  getClientId() {
    return (typeof CONFIG !== 'undefined' && CONFIG.oauthClientIds && CONFIG.oauthClientIds.google) ||
      localStorage.getItem('lms_gmail_client_id') ||
      localStorage.getItem('lms_gcal_client_id') || '';
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

  // WhatsApp: チャットエクスポート (.txt)
  // Format: [日付, 時刻] 名前: メッセージ
  // または 日付, 時刻 - 名前: メッセージ
  parseWhatsAppChat(text) {
    const contactFreq = {};
    const lines = text.split('\n');

    // Common patterns across WhatsApp exports:
    // [2026/04/09, 12:34:56] 山田太郎: こんにちは
    // 09/04/2026, 12:34 - 山田太郎: こんにちは
    const patterns = [
      /^\[\d{2,4}[/.-]\d{1,2}[/.-]\d{1,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]\s+([^:]+?):/,
      /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s+[-–]\s+([^:]+?):/
    ];

    lines.forEach(line => {
      for (const pattern of patterns) {
        const m = line.match(pattern);
        if (m) {
          const name = m[1].trim();
          // Skip system messages / self
          if (!name || name.length > 50 || /joined|left|changed/i.test(name)) continue;
          contactFreq[name] = (contactFreq[name] || 0) + 1;
          break;
        }
      }
    });

    return Object.entries(contactFreq)
      .filter(([n, c]) => c >= 3) // 3+ messages to qualify
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([name, count]) => ({
        name,
        source: 'whatsapp',
        interactionCount: count,
        distance: count >= 20 ? '2' : count >= 10 ? '3' : '4',
        notes: `WhatsAppで${count}回やり取り`
      }));
  },

  // LINE: チャットエクスポート (.txt)
  // LINEの公式エクスポート形式はトーク単位なので、1ファイル=1人との会話
  // フォーマット: [LINE] 山田太郎とのトーク 保存日時：...
  // 日時 名前 メッセージ
  parseLINEChat(text) {
    const contactFreq = {};
    const lines = text.split('\n');

    // First line usually: "[LINE] 山田太郎とのトーク履歴" or "[LINE] Chat with 山田太郎"
    let primaryContact = null;
    const header = lines[0] || '';
    const headerMatch = header.match(/\[LINE\]\s*(.+?)とのトーク|\[LINE\]\s*Chat with\s*(.+)/);
    if (headerMatch) {
      primaryContact = (headerMatch[1] || headerMatch[2] || '').trim();
    }

    // Tally names from message lines
    // Format: "12:34\t名前\tメッセージ" or "12:34  名前  メッセージ"
    const msgPattern = /^\d{1,2}:\d{2}[\s\t]+([^\s\t]+)[\s\t]+/;
    lines.forEach(line => {
      const m = line.match(msgPattern);
      if (m) {
        const name = m[1].trim();
        if (!name) return;
        contactFreq[name] = (contactFreq[name] || 0) + 1;
      }
    });

    const results = [];
    if (primaryContact) {
      const count = contactFreq[primaryContact] || lines.length;
      results.push({
        name: primaryContact,
        source: 'line',
        interactionCount: count,
        distance: count >= 50 ? '2' : '3',
        notes: `LINEで${count}回やり取り（トークファイルから取り込み）`
      });
    }

    // Also add other contacts found in the log (for group chats)
    Object.entries(contactFreq)
      .filter(([n]) => n !== primaryContact)
      .filter(([n, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .forEach(([name, count]) => {
        results.push({
          name,
          source: 'line',
          interactionCount: count,
          distance: count >= 20 ? '3' : '4',
          notes: `LINEで${count}回やり取り`
        });
      });

    return results;
  },

  // Telegram: JSON export from Telegram Desktop
  parseTelegramExport(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      const results = [];

      // Contacts list
      if (data.contacts?.list) {
        data.contacts.list.forEach(c => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
          if (!name) return;
          results.push({
            name,
            phone: c.phone_number || '',
            source: 'telegram',
            addedAt: c.date || null
          });
        });
      }

      // Chat participants (if this is a chats export)
      if (data.chats?.list) {
        const chatFreq = {};
        data.chats.list.forEach(chat => {
          if (chat.type === 'personal_chat' && chat.name) {
            chatFreq[chat.name] = (chat.messages || []).length;
          }
        });
        Object.entries(chatFreq).forEach(([name, count]) => {
          if (!results.find(r => r.name === name)) {
            results.push({
              name,
              source: 'telegram',
              interactionCount: count,
              distance: count >= 50 ? '2' : count >= 10 ? '3' : '4',
              notes: `Telegramで${count}回やり取り`
            });
          }
        });
      }

      return results;
    } catch (e) {
      return [];
    }
  },

  // WeChat: チャット履歴エクスポート (.txt)
  // WeChatの公式エクスポートはモバイルからメール送信 (.html または .txt)
  // フォーマット: 2026-04-09 12:34:56 山田太郎\nメッセージ本文
  parseWeChatChat(text) {
    const contactFreq = {};
    const lines = text.split('\n');
    const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s+(.+?)(?:\s|$)/;

    lines.forEach(line => {
      const m = line.match(datePattern);
      if (m) {
        const name = m[1].trim();
        if (!name || name.length > 30) return;
        if (/system|通知|提示/i.test(name)) return;
        contactFreq[name] = (contactFreq[name] || 0) + 1;
      }
    });

    return Object.entries(contactFreq)
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([name, count]) => ({
        name,
        source: 'wechat',
        interactionCount: count,
        distance: count >= 20 ? '2' : count >= 10 ? '3' : '4',
        notes: `WeChatで${count}回やり取り`
      }));
  },

  // KakaoTalk: チャット履歴エクスポート (.txt)
  // フォーマット: [山田太郎] [午後 3:45] メッセージ本文
  // または: 2026-04-09 15:45:00, 山田太郎 : メッセージ
  parseKakaoChat(text) {
    const contactFreq = {};
    const lines = text.split('\n');

    // Multiple format patterns for Kakao exports
    const patterns = [
      /^\[([^\]]+?)\]\s*\[/,          // [名前] [時刻]
      /^\d{4}[-/]\d{2}[-/]\d{2}[,\s]+([^:,]+?)\s*:/,  // 日付時刻 名前 :
      /^---------------\s*(.+?)\s*---------------/    // 日付ヘッダー (skip)
    ];

    lines.forEach(line => {
      // Try each pattern
      for (const pattern of patterns) {
        const m = line.match(pattern);
        if (m && m[1]) {
          const name = m[1].trim();
          if (!name || name.length > 30) continue;
          if (/^\d+$/.test(name)) continue;
          if (/kakao|알림|公式|system/i.test(name)) continue;
          contactFreq[name] = (contactFreq[name] || 0) + 1;
          break;
        }
      }
    });

    return Object.entries(contactFreq)
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([name, count]) => ({
        name,
        source: 'kakao',
        interactionCount: count,
        distance: count >= 20 ? '2' : count >= 10 ? '3' : '4',
        notes: `KakaoTalkで${count}回やり取り`
      }));
  },

  // Discord: data export JSON (friends.json / messages/*.json)
  parseDiscordExport(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      const results = [];

      // Friend list format (friends.json)
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.user?.username) {
            const name = item.user.global_name || item.user.username;
            results.push({
              name,
              sns_account: item.user.username + (item.user.discriminator ? '#' + item.user.discriminator : ''),
              source: 'discord',
              relationship: item.type === 1 ? 'friend' : 'other',
              addedAt: item.since || null
            });
          } else if (item.username) {
            // Alternate format
            results.push({
              name: item.global_name || item.username,
              sns_account: item.username,
              source: 'discord'
            });
          }
        });
      }

      // Messages index format: { "channel_id": { "name": "...", "type": ... } }
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.values(data).forEach(channel => {
          if (channel?.recipients) {
            (channel.recipients || []).forEach(r => {
              if (r && typeof r === 'string') {
                // User ID only
              } else if (r?.username) {
                results.push({
                  name: r.global_name || r.username,
                  sns_account: r.username,
                  source: 'discord'
                });
              }
            });
          }
        });
      }

      // Dedupe by name
      const seen = new Set();
      return results.filter(r => {
        const key = (r.name || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return !!r.name;
      });
    } catch (e) {
      return [];
    }
  },

  // Generic: import any SNS parser result to relationship_contacts
  // Preserves per-entry distance/notes if provided by the parser,
  // falls back to defaults otherwise.
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
        distance: '4',
        relationship: 'other',
        notes: `${sourceName}から取り込み`,
        ...c  // parser-provided values override defaults
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
          // Explicit filename-based detection (11 platforms)
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
          } else if (name.includes('whatsapp') && name.endsWith('.txt')) {
            contacts = this.parseWhatsAppChat(content);
            source = 'whatsapp';
          } else if ((name.includes('line') || name.includes('トーク')) && name.endsWith('.txt')) {
            contacts = this.parseLINEChat(content);
            source = 'line';
          } else if (name.includes('telegram') && name.endsWith('.json')) {
            contacts = this.parseTelegramExport(content);
            source = 'telegram';
          } else if (name.includes('wechat') || name.includes('微信')) {
            contacts = this.parseWeChatChat(content);
            source = 'wechat';
          } else if (name.includes('kakao') || name.includes('카카오')) {
            contacts = this.parseKakaoChat(content);
            source = 'kakao';
          } else if (name.includes('discord') && (name.endsWith('.json') || name.endsWith('.js'))) {
            contacts = this.parseDiscordExport(content);
            source = 'discord';
          } else if (name.endsWith('.json')) {
            // Try multiple JSON formats in order of specificity
            const tries = [
              { parser: 'parseTelegramExport', source: 'telegram' },
              { parser: 'parseDiscordExport', source: 'discord' },
              { parser: 'parseFacebookFriends', source: 'facebook' },
              { parser: 'parseInstagramFollowing', source: 'instagram' }
            ];
            for (const t of tries) {
              contacts = this[t.parser](content);
              if (contacts.length > 0) { source = t.source; break; }
            }
          } else if (name.endsWith('.txt')) {
            // Generic text: try WhatsApp → LINE → WeChat → Kakao
            const tries = [
              { parser: 'parseWhatsAppChat', source: 'whatsapp' },
              { parser: 'parseLINEChat', source: 'line' },
              { parser: 'parseWeChatChat', source: 'wechat' },
              { parser: 'parseKakaoChat', source: 'kakao' }
            ];
            for (const t of tries) {
              contacts = this[t.parser](content);
              if (contacts.length > 0) { source = t.source; break; }
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
