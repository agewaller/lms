/**
 * Cloudflare Worker - メール送信 (Resend API)
 *
 * LMS からのメール送信をすべてここで処理する。
 * APIキー（RESEND_API_KEY）は Cloudflare Worker の Secrets に設定。
 *
 * デプロイ手順:
 * 1. Resend (resend.com) でアカウント作成 → APIキー取得
 * 2. Cloudflare Workers → Secretsに RESEND_API_KEY を登録
 * 3. このファイルを新しい Worker として Deploy
 * 4. 生成されたURL を LMS 管理パネル → 設定 → メール送信Worker URL に設定
 *
 * リクエスト形式:
 * POST /  { to, subject, html, [from], [replyTo] }
 * POST /template  { to, template: 'welcome'|'daily'|'birthday'|'isolation', data: {...} }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-lms-token',
  'Access-Control-Max-Age': '86400'
};

const FROM_ADDRESS = 'LMS <noreply@lms-life.com>';

// HTML email templates
const TEMPLATES = {
  welcome: (data) => ({
    subject: `${data.name || 'ようこそ'}さん、LMSへようこそ！`,
    html: `
      <div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
        <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:32px;font-weight:700;color:#6C63FF;">◈ LMS</span>
          </div>
          <h1 style="color:#1e293b;font-size:22px;margin:0 0 16px;">はじめまして、${escapeHtmlTemplate(data.name || 'ゲスト')}さん！</h1>
          <p style="color:#475569;line-height:1.8;">LMS（ライフマネジメントシステム）へようこそ。<br>
          毎日の記録から、あなたにぴったりのアドバイスをお届けします。</p>
          <div style="margin:24px 0;padding:20px;background:#f1f5f9;border-radius:12px;">
            <p style="margin:0;color:#334155;font-weight:600;">まずはここから始めましょう</p>
            <ul style="color:#475569;line-height:2;margin:8px 0 0;">
              <li>今日の体調・気分を記録する</li>
              <li>6つの領域から気になるものを選ぶ</li>
              <li>毎日続けると詳しいアドバイスが届く</li>
            </ul>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="https://agewaller.github.io/lms/dashboard.html"
               style="display:inline-block;background:#6C63FF;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;">
              LMSを開く
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          © 2026 LMS - Life Management System<br>
          <a href="https://agewaller.github.io/lms/" style="color:#94a3b8;">配信停止</a>
        </p>
      </div>
    `
  }),

  daily: (data) => ({
    subject: `今日の記録はお済みですか？ [${data.date || ''}]`,
    html: `
      <div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
        <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:32px;font-weight:700;color:#6C63FF;">◈ LMS</span>
          </div>
          <h1 style="color:#1e293b;font-size:20px;margin:0 0 8px;">こんにちは、${escapeHtmlTemplate(data.name || 'ゲスト')}さん</h1>
          <p style="color:#475569;line-height:1.8;">今日の記録はもうされましたか？<br>毎日の小さな記録が、大きな気づきにつながります。</p>
          ${data.streak > 1 ? `<div style="margin:16px 0;padding:12px 16px;background:#fff7ed;border-radius:10px;border-left:4px solid #f59e0b;">
            🔥 ${data.streak}日連続で記録中！この調子で続けましょう
          </div>` : ''}
          <div style="text-align:center;margin-top:24px;">
            <a href="https://agewaller.github.io/lms/dashboard.html"
               style="display:inline-block;background:#6C63FF;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;">
              今日の記録をする
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          © 2026 LMS - Life Management System
        </p>
      </div>
    `
  }),

  birthday: (data) => ({
    subject: `${escapeHtmlTemplate(data.personName || 'お知り合い')}さんのお誕生日が近づいています`,
    html: `
      <div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
        <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:32px;font-weight:700;color:#6C63FF;">◈ LMS</span>
          </div>
          <h1 style="color:#1e293b;font-size:20px;margin:0 0 8px;">🎂 お誕生日リマインダー</h1>
          <p style="color:#475569;line-height:1.8;">
            <strong>${escapeHtmlTemplate(data.personName || 'お知り合い')}</strong>さんのお誕生日まで
            あと <strong>${data.daysLeft || '?'}日</strong> です。<br>
            ひと言メッセージを送ってみませんか？
          </p>
          <div style="text-align:center;margin-top:24px;">
            <a href="https://agewaller.github.io/lms/dashboard.html?domain=relationship"
               style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;">
              関係を確認する
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          © 2026 LMS - Life Management System
        </p>
      </div>
    `
  }),

  isolation: (data) => ({
    subject: '最近、人と会えていますか？',
    html: `
      <div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
        <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:32px;font-weight:700;color:#6C63FF;">◈ LMS</span>
          </div>
          <h1 style="color:#1e293b;font-size:20px;margin:0 0 8px;">こんにちは、${escapeHtmlTemplate(data.name || 'ゲスト')}さん</h1>
          <p style="color:#475569;line-height:1.8;">
            最近、人と話す機会が少なくなっていませんか？<br>
            誰かと話すだけで、気持ちがずいぶん楽になるものです。
          </p>
          <div style="margin:16px 0;padding:16px;background:#fef2f2;border-radius:10px;border-left:4px solid #ef4444;">
            <p style="margin:0;color:#7f1d1d;">孤立スコアが高めです。大切な人に連絡してみましょう。</p>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="https://agewaller.github.io/lms/dashboard.html?domain=relationship"
               style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;">
              今日連絡する
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
          © 2026 LMS - Life Management System
        </p>
      </div>
    `
  })
};

function escapeHtmlTemplate(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET') {
      return new Response('LMS Mail Sender is running.', {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    if (!env.RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    let to, subject, html;

    if (body.template) {
      // Template mode
      const tplFn = TEMPLATES[body.template];
      if (!tplFn) {
        return new Response(JSON.stringify({ error: `Unknown template: ${body.template}` }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      const rendered = tplFn(body.data || {});
      to = body.to;
      subject = rendered.subject;
      html = rendered.html;
    } else {
      // Raw mode
      to = body.to;
      subject = body.subject;
      html = body.html;
    }

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'to, subject, html are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: body.from || FROM_ADDRESS,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          reply_to: body.replyTo || undefined
        })
      });

      const result = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: result.message || 'Resend error', detail: result }), {
          status: res.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, id: result.id }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }
};
