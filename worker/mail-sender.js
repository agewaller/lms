/* ============================================================
   LMS - Mail Sender Worker (Cloudflare Workers + Resend)
   Receives POST requests from the LMS frontend and relays
   to the Resend API. RESEND_API_KEY must be set as a secret:
     wrangler secret put RESEND_API_KEY

   Routes:
     POST /send          – send a single email
     POST /send-welcome  – welcome email on first sign-up
   ============================================================ */

const ALLOWED_ORIGINS = [
  'https://agewaller.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

const FROM_ADDRESS = 'LMS <noreply@lms-life.com>';
const RESEND_URL = 'https://api.resend.com/emails';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse('', 204, origin);
    }

    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405, origin);
    }

    if (!env.RESEND_API_KEY) {
      return corsResponse(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), 503, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin);
    }

    const path = new URL(request.url).pathname;

    if (path === '/send-welcome') {
      return handleWelcome(body, env, origin);
    }
    if (path === '/send') {
      return handleSend(body, env, origin);
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404, origin);
  }
};

// ─── Generic send ───────────────────────────────────────────
async function handleSend(body, env, origin) {
  const { to, subject, html, text } = body;
  if (!to || !subject || (!html && !text)) {
    return corsResponse(JSON.stringify({ error: 'Missing to/subject/html' }), 400, origin);
  }
  return sendEmail({ to, subject, html: html || `<p>${text}</p>` }, env, origin);
}

// ─── Welcome email on first sign-up ─────────────────────────
async function handleWelcome(body, env, origin) {
  const { to, displayName } = body;
  if (!to) return corsResponse(JSON.stringify({ error: 'Missing to' }), 400, origin);

  const name = displayName || 'ようこそ';
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#6C63FF,#3b82f6);padding:40px 32px;text-align:center;">
      <div style="font-size:36px;font-weight:700;color:#fff;letter-spacing:-1px;">LMS</div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Life Management System</div>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b;">${name} さん、ようこそ！</h2>
      <p style="color:#475569;line-height:1.8;margin:0 0 24px;">
        LMSへのご登録ありがとうございます。<br>
        6つの人生領域（意識・健康・時間・仕事・関係・資産）を通じて、<br>
        あなたの毎日をより豊かにするお手伝いをします。
      </p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
        <div style="font-weight:600;color:#1e293b;margin-bottom:12px;">はじめの一歩</div>
        <ul style="margin:0;padding:0 0 0 20px;color:#475569;line-height:2;">
          <li>プロフィールを入力して、あなたに合った提案を受け取る</li>
          <li>「健康」領域から毎日の体調を記録してみる</li>
          <li>「相談する」で今の悩みを打ち明けてみる</li>
        </ul>
      </div>
      <a href="https://agewaller.github.io/lms/dashboard.html"
         style="display:block;background:#6C63FF;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:10px;font-weight:600;font-size:15px;">
        LMSを開く
      </a>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
      &copy; 2026 LMS - Life Management System<br>
      このメールはご登録のお知らせです。心当たりのない場合は無視してください。
    </div>
  </div>
</body>
</html>`;

  return sendEmail({ to, subject: '【LMS】ご登録ありがとうございます', html }, env, origin);
}

// ─── Resend API call ─────────────────────────────────────────
async function sendEmail({ to, subject, html }, env, origin) {
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: Array.isArray(to) ? to : [to], subject, html })
    });
    const data = await res.json();
    if (!res.ok) {
      return corsResponse(JSON.stringify({ error: data.message || 'Resend error', details: data }), res.status, origin);
    }
    return corsResponse(JSON.stringify({ ok: true, id: data.id }), 200, origin);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 500, origin);
  }
}

// ─── CORS helper ─────────────────────────────────────────────
function corsResponse(body, status, origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
