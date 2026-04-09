/**
 * Cloudflare Worker - Broadcast Distribution Proxy
 *
 * ブラウザから直接叩けないプラットフォーム（CORS制約・OAuth code 交換・
 * SMTP メール送信・RSS フィード更新など）のためのプロキシ。
 *
 * ルート:
 *   POST /proxy          - 任意のURLにフォワード（platform.apiUrl で指定）
 *   POST /email          - SMTP 経由でメール送信 (MailChannels or SendGrid)
 *   POST /rss            - RSS フィードにエントリを追加（Durable Object / KV）
 *   POST /oauth/exchange - OAuth Authorization Code → Access Token 交換
 *   GET  /feed.xml       - 登録済み RSS フィードを返す
 *
 * デプロイ手順:
 * 1. https://dash.cloudflare.com/ にログイン
 * 2. Workers & Pages → Create Worker
 * 3. このコードを貼り付けて Deploy
 * 4. 生成された URL を js/broadcast-config.js の
 *    BROADCAST_CONFIG.endpoints.broadcastProxy に設定
 * 5. 必要な環境変数を Settings → Variables で登録:
 *    - SENDGRID_API_KEY         (メール送信用)
 *    - RSS_TITLE                (RSS フィードのタイトル)
 *    - RSS_LINK                 (サイト URL)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/' || path === '/health') {
        return text('Broadcast proxy running. See routes: /proxy, /email, /rss, /oauth/exchange, /feed.xml');
      }
      if (path === '/proxy'          && request.method === 'POST') return await handleProxy(request);
      if (path === '/email'          && request.method === 'POST') return await handleEmail(request, env);
      if (path === '/rss'            && request.method === 'POST') return await handleRssAdd(request, env);
      if (path === '/feed.xml'       && request.method === 'GET')  return await handleRssFeed(env);
      if (path === '/oauth/exchange' && request.method === 'POST') return await handleOAuthExchange(request);

      return json({ error: 'Not found', path }, 404);
    } catch (e) {
      return json({ error: e.message || String(e) }, 500);
    }
  }
};

// ─── /proxy - forward any request ───
async function handleProxy(request) {
  const body = await request.json();
  const { url, method, headers, body: payload } = body;
  if (!url) return json({ error: 'url required' }, 400);

  const res = await fetch(url, {
    method: method || 'POST',
    headers: headers || { 'Content-Type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload || {})
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { ...CORS_HEADERS, 'Content-Type': res.headers.get('content-type') || 'application/json' }
  });
}

// ─── /email - send via MailChannels (free on CF Workers) or SendGrid ───
async function handleEmail(request, env) {
  const { to, subject, body, from, fromName } = await request.json();
  if (!to || !body) return json({ error: 'to, body required' }, 400);

  const recipients = Array.isArray(to) ? to : [to];

  // Prefer SendGrid if API key present, otherwise MailChannels
  if (env.SENDGRID_API_KEY) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.SENDGRID_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map(e => ({ email: e })) }],
        from: { email: from || 'noreply@broadcast.local', name: fromName || 'Broadcast' },
        subject: subject || '(no subject)',
        content: [{ type: 'text/plain', value: body }]
      })
    });
    if (!res.ok) return json({ error: 'SendGrid: ' + await res.text() }, 500);
    return json({ ok: true, provider: 'sendgrid', sent: recipients.length });
  }

  // MailChannels (free from CF Workers)
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: recipients.map(e => ({ email: e })) }],
      from: { email: from || 'noreply@broadcast.local', name: fromName || 'Broadcast' },
      subject: subject || '(no subject)',
      content: [{ type: 'text/plain', value: body }]
    })
  });
  if (!res.ok) return json({ error: 'MailChannels: ' + await res.text() }, 500);
  return json({ ok: true, provider: 'mailchannels', sent: recipients.length });
}

// ─── /rss - append an item to the feed ───
// Stores items in KV (bind RSS_KV in wrangler.toml)
async function handleRssAdd(request, env) {
  if (!env.RSS_KV) return json({ error: 'RSS_KV not bound' }, 500);
  const { title, body, tags, link } = await request.json();
  const item = {
    id: Date.now().toString(36),
    title: title || '(untitled)',
    body: body || '',
    tags: tags || [],
    link: link || '',
    pubDate: new Date().toUTCString()
  };
  const existing = JSON.parse((await env.RSS_KV.get('items')) || '[]');
  existing.unshift(item);
  // Keep latest 200 items
  const trimmed = existing.slice(0, 200);
  await env.RSS_KV.put('items', JSON.stringify(trimmed));
  return json({ ok: true, id: item.id });
}

async function handleRssFeed(env) {
  if (!env.RSS_KV) return text('<rss><channel><title>RSS_KV not bound</title></channel></rss>', 500);
  const items = JSON.parse((await env.RSS_KV.get('items')) || '[]');
  const title = env.RSS_TITLE || 'Broadcast Feed';
  const link = env.RSS_LINK || 'https://broadcast.local/';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escape(title)}</title>
    <link>${escape(link)}</link>
    <description>Broadcast RSS feed</description>
    ${items.map(i => `
    <item>
      <guid isPermaLink="false">${escape(i.id)}</guid>
      <title>${escape(i.title)}</title>
      <link>${escape(i.link || link)}</link>
      <description>${escape(i.body)}</description>
      <pubDate>${i.pubDate}</pubDate>
      ${(i.tags || []).map(t => `<category>${escape(t)}</category>`).join('')}
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
}

// ─── /oauth/exchange - Authorization Code → Token ───
// OAuth 2.0 Authorization Code フローで code を token に交換する。
// ブラウザから直接叩くと client_secret を露出してしまうのでここで中継。
async function handleOAuthExchange(request) {
  const { provider, code, redirect_uri, client_id, client_secret } = await request.json();
  if (!provider || !code) return json({ error: 'provider, code required' }, 400);

  // Map provider → token URL
  const tokenUrls = {
    twitter:  'https://api.twitter.com/2/oauth2/token',
    linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
    reddit:   'https://www.reddit.com/api/v1/access_token',
    tumblr:   'https://api.tumblr.com/v2/oauth2/token',
    pinterest:'https://api.pinterest.com/v5/oauth/token',
    threads:  'https://graph.threads.net/oauth/access_token'
  };
  const url = tokenUrls[provider];
  if (!url) return json({ error: 'Unknown provider: ' + provider }, 400);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect_uri || '',
    client_id: client_id || ''
  });
  if (client_secret) body.set('client_secret', client_secret);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Reddit requires HTTP Basic auth
      ...(provider === 'reddit' && client_id && client_secret
          ? { 'Authorization': 'Basic ' + btoa(client_id + ':' + client_secret) }
          : {})
    },
    body
  });
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

// ─── Helpers ───
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
function text(s, status = 200) {
  return new Response(s, { status, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } });
}
function escape(s) {
  return String(s || '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[c]);
}
