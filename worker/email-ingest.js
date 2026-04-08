/* ============================================================
   LMS Email Ingest Worker (Cloudflare Email Worker + HTTP API)

   受信フロー:
   1. Plaud → メール送信 → data-{hash}@inbox.lms-life.com
   2. Cloudflare Email Routing → このWorkerで受信
   3. メール本文を解析し、Cloudflare KVに保存（hashキー）
   4. フロントエンドが定期的にKVを確認して取り込み
   5. 取り込み後、Firestoreに保存 + AI分析実行

   必要な設定（wrangler.toml）:
   - kv_namespaces = [{ binding = "EMAIL_INBOX", id = "..." }]
   - Email Routing: data-*@lms-life.com → このWorker

   ============================================================ */

export default {
  // ─── HTTP API (フロントエンドからのpull) ───
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    // GET /pending?hash=xxx - その hash 宛の未取得メッセージを返す
    if (url.pathname === '/pending' && request.method === 'GET') {
      const hash = url.searchParams.get('hash');
      if (!hash) return corsResponse({ error: 'hash required' }, 400);

      try {
        const list = await env.EMAIL_INBOX.list({ prefix: `inbox:${hash}:` });
        const messages = [];
        for (const key of list.keys) {
          const value = await env.EMAIL_INBOX.get(key.name);
          if (value) {
            messages.push({ id: key.name, ...JSON.parse(value) });
          }
        }
        return corsResponse({ messages });
      } catch (e) {
        return corsResponse({ error: e.message }, 500);
      }
    }

    // POST /acknowledge - 取り込み済みメッセージを削除
    if (url.pathname === '/acknowledge' && request.method === 'POST') {
      try {
        const { ids } = await request.json();
        if (!Array.isArray(ids)) return corsResponse({ error: 'ids required' }, 400);

        await Promise.all(ids.map(id => env.EMAIL_INBOX.delete(id)));
        return corsResponse({ acknowledged: ids.length });
      } catch (e) {
        return corsResponse({ error: e.message }, 500);
      }
    }

    return corsResponse({ error: 'not found' }, 404);
  },

  // ─── Email Receiver (Cloudflare Email Worker) ───
  async email(message, env, ctx) {
    try {
      // Extract user hash from "to" address: data-{hash}@inbox.lms-life.com
      const to = message.to || '';
      const match = to.match(/data-([a-z0-9]+)@/i);
      if (!match) {
        message.setReject('Invalid recipient format');
        return;
      }
      const hash = match[1];

      // Read email body
      const rawEmail = await new Response(message.raw).text();
      const parsed = parseEmail(rawEmail);

      // Save to KV with TTL (7 days)
      const id = `inbox:${hash}:${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const payload = {
        from: message.from,
        to: message.to,
        subject: parsed.subject || '',
        text: parsed.text || '',
        html: parsed.html || '',
        receivedAt: new Date().toISOString(),
        size: rawEmail.length
      };

      await env.EMAIL_INBOX.put(id, JSON.stringify(payload), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });
    } catch (e) {
      console.error('Email processing error:', e);
    }
  }
};

// ─── Helpers ───

function corsResponse(data, status = 200) {
  const body = data === null ? null : JSON.stringify(data);
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// Simple email parser (extracts subject, text body, html body)
function parseEmail(raw) {
  const result = { subject: '', text: '', html: '' };
  const lines = raw.split(/\r?\n/);

  let inHeaders = true;
  let headerBuf = '';
  const headers = {};
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    if (inHeaders) {
      if (lines[i] === '') {
        inHeaders = false;
        bodyStart = i + 1;
        if (headerBuf) {
          const [key, ...rest] = headerBuf.split(':');
          headers[key.toLowerCase().trim()] = rest.join(':').trim();
        }
        continue;
      }
      if (lines[i].startsWith(' ') || lines[i].startsWith('\t')) {
        headerBuf += ' ' + lines[i].trim();
      } else {
        if (headerBuf) {
          const [key, ...rest] = headerBuf.split(':');
          headers[key.toLowerCase().trim()] = rest.join(':').trim();
        }
        headerBuf = lines[i];
      }
    }
  }

  // Decode subject (RFC 2047 basic)
  result.subject = decodeMimeHeader(headers['subject'] || '');

  // Body extraction (very basic, handles plain text and simple multipart)
  const body = lines.slice(bodyStart).join('\n');
  const contentType = headers['content-type'] || '';

  if (contentType.includes('multipart/')) {
    // Extract boundary
    const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split(`--${boundary}`);
      for (const part of parts) {
        if (part.includes('Content-Type: text/plain')) {
          const partBody = part.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();
          result.text = decodeBody(partBody, part);
        } else if (part.includes('Content-Type: text/html')) {
          const partBody = part.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();
          result.html = decodeBody(partBody, part);
        }
      }
    }
  } else {
    result.text = decodeBody(body, raw);
  }

  // Strip HTML if we only have HTML
  if (!result.text && result.html) {
    result.text = result.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return result;
}

function decodeBody(body, fullPart) {
  // Detect transfer encoding
  if (/Content-Transfer-Encoding: base64/i.test(fullPart)) {
    try {
      return atob(body.replace(/\s/g, ''));
    } catch (e) { return body; }
  }
  if (/Content-Transfer-Encoding: quoted-printable/i.test(fullPart)) {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return body;
}

function decodeMimeHeader(str) {
  // Basic RFC 2047 decoder for subject lines like =?UTF-8?B?...?=
  return str.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, encoding, data) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const decoded = atob(data);
        // Convert to UTF-8
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
        return new TextDecoder(charset).decode(bytes);
      } else {
        // Q encoding
        return data
          .replace(/_/g, ' ')
          .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      }
    } catch (e) { return str; }
  });
}
