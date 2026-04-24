/* ============================================================
   LMS - Daily Cron Worker (Cloudflare Workers Cron Triggers)
   Runs daily at 06:00 JST (21:00 UTC prev day).

   What it does:
   1. Fetches all active users from Firestore (via REST API)
   2. For users who opted into daily digest (profile.dailyDigest=true)
      and have had activity in the past 7 days, sends an HTML email
      summarising their 6-domain scores via Resend.

   Required secrets (wrangler secret put):
     FIREBASE_API_KEY        – Firebase Web API key
     FIREBASE_PROJECT_ID     – Firebase project ID (e.g. lms-life-com)
     ANTHROPIC_API_KEY       – for AI-generated daily tip
     RESEND_API_KEY          – for sending emails
     MAIL_SENDER_URL         – URL of lms-mail-sender worker (optional; uses Resend directly)
   ============================================================ */

export default {
  // Cron handler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyDigest(env));
  },

  // Allow manual trigger via GET /trigger (admin only)
  async fetch(request, env) {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== env.CRON_TRIGGER_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
    const result = await runDailyDigest(env);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// ─── Main digest runner ──────────────────────────────────────
async function runDailyDigest(env) {
  const log = [];

  if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) {
    return { error: 'Firebase env vars missing' };
  }

  // Fetch users from Firestore REST API
  let users = [];
  try {
    users = await fetchFirestoreUsers(env);
    log.push(`Fetched ${users.length} users`);
  } catch (e) {
    return { error: 'Firestore fetch failed', detail: e.message };
  }

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      if (!user.email) { skipped++; continue; }
      if (!user.dailyDigest) { skipped++; continue; }
      if (!hasRecentActivity(user)) { skipped++; continue; }

      const tip = await generateDailyTip(user, env);
      await sendDigestEmail(user, tip, env);
      sent++;
    } catch (e) {
      log.push(`Skip ${user.uid}: ${e.message}`);
      skipped++;
    }
  }

  return { ok: true, sent, skipped, log };
}

// ─── Firestore REST: list users ──────────────────────────────
async function fetchFirestoreUsers(env) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users`;
  const res = await fetch(`${base}?pageSize=200&key=${env.FIREBASE_API_KEY}`);
  if (!res.ok) throw new Error(`Firestore ${res.status}`);

  const json = await res.json();
  const docs = json.documents || [];

  return docs.map(doc => {
    const uid = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const profile = firestoreValue(fields.userProfile) || {};
    const scores = firestoreValue(fields.domainScores) || {};
    const updatedAt = fields.updatedAt?.timestampValue || null;

    return {
      uid,
      email: profile.email || '',
      displayName: profile.displayName || profile.name || '',
      dailyDigest: profile.dailyDigest === true || profile.dailyDigest === 'true',
      domainScores: scores,
      updatedAt
    };
  });
}

// ─── Firestore value extractor (handles typed value format) ──
function firestoreValue(v) {
  if (!v) return null;
  if (v.stringValue  !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue  !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue    !== undefined) return null;
  if (v.mapValue) {
    const out = {};
    for (const [k, fv] of Object.entries(v.mapValue.fields || {})) {
      out[k] = firestoreValue(fv);
    }
    return out;
  }
  if (v.arrayValue) {
    return (v.arrayValue.values || []).map(firestoreValue);
  }
  return null;
}

// ─── Activity check: was user active in last 7 days? ─────────
function hasRecentActivity(user) {
  if (!user.updatedAt) return false;
  const lastActive = new Date(user.updatedAt);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return lastActive > sevenDaysAgo;
}

// ─── AI daily tip via Anthropic ──────────────────────────────
async function generateDailyTip(user, env) {
  if (!env.ANTHROPIC_API_KEY) return null;

  const scores = user.domainScores || {};
  const domainLines = Object.entries(scores)
    .map(([d, s]) => `${d}: ${s}/100`)
    .join(', ');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `あなたは65歳以上の高齢者の生活アドバイザーです。
今日の一言アドバイスを日本語で60字以内で書いてください。
ユーザーの6領域スコア: ${domainLines || '（データなし）'}
専門用語ゼロ、温かく前向きなトーンで。改行なし。`
        }]
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

// ─── Send digest email via Resend ────────────────────────────
async function sendDigestEmail(user, tip, env) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');

  const today = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric'
  });

  const DOMAIN_LABELS = {
    consciousness: { label: '意識', icon: '一', color: '#6C63FF' },
    health:        { label: '健康', icon: '二', color: '#10b981' },
    time:          { label: '時間', icon: '三', color: '#f59e0b' },
    work:          { label: '仕事', icon: '四', color: '#3b82f6' },
    relationship:  { label: '関係', icon: '五', color: '#ef4444' },
    assets:        { label: '資産', icon: '六', color: '#d97706' }
  };

  const scores = user.domainScores || {};
  const scoreRows = Object.entries(DOMAIN_LABELS).map(([id, cfg]) => {
    const score = scores[id] ?? '-';
    const barWidth = typeof score === 'number' ? Math.max(4, score) : 0;
    return `<tr>
      <td style="padding:6px 0;width:60px;font-size:13px;color:#475569;">${cfg.icon} ${cfg.label}</td>
      <td style="padding:6px 8px;">
        <div style="background:#e2e8f0;border-radius:4px;height:10px;width:100%;">
          <div style="background:${cfg.color};border-radius:4px;height:10px;width:${barWidth}%;"></div>
        </div>
      </td>
      <td style="padding:6px 0;width:40px;text-align:right;font-size:13px;font-weight:600;color:#1e293b;">${score}</td>
    </tr>`;
  }).join('');

  const tipHtml = tip
    ? `<div style="background:#f0f9ff;border-left:4px solid #6C63FF;border-radius:0 8px 8px 0;padding:14px 16px;margin:20px 0;font-size:14px;color:#1e293b;line-height:1.7;">${tip}</div>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#6C63FF,#3b82f6);padding:32px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#fff;">LMS</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:2px;">${today} の記録</div>
    </div>
    <div style="padding:32px;">
      <p style="color:#475569;margin:0 0 20px;font-size:14px;">
        ${user.displayName || 'ユーザー'} さん、今日もお疲れ様です。<br>
        6領域の現在のスコアをお届けします。
      </p>
      <table style="width:100%;border-collapse:collapse;">${scoreRows}</table>
      ${tipHtml}
      <div style="margin-top:24px;text-align:center;">
        <a href="https://agewaller.github.io/lms/dashboard.html"
           style="display:inline-block;background:#6C63FF;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
          今日の記録をする
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
      &copy; 2026 LMS &nbsp;|&nbsp;
      <a href="https://agewaller.github.io/lms/dashboard.html?action=unsubscribe" style="color:#94a3b8;">配信停止</a>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'LMS <noreply@lms-life.com>',
      to: [user.email],
      subject: `【LMS】${today} の6領域レポート`,
      html
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Resend ${res.status}`);
  }
}
