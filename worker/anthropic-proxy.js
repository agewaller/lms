/**
 * Cloudflare Worker - Anthropic API Proxy
 *
 * ブラウザから直接Anthropic APIを呼べない問題を解決するプロキシ。
 * ブラウザ → このWorker → Anthropic API の経路でリクエストを中継。
 *
 * デプロイ手順:
 * 1. https://dash.cloudflare.com/ にログイン（無料アカウントでOK）
 * 2. Workers & Pages → Create Worker
 * 3. このコードを貼り付けて Deploy
 * 4. 生成されたURL（例: https://lms-api-proxy.your-account.workers.dev）を
 *    LMS 管理パネル → APIキー → APIプロキシURL に設定
 *
 * もしくは GitHub Actions 経由で自動デプロイ:
 *   - リポジトリの Settings → Secrets → CLOUDFLARE_API_TOKEN を追加
 *   - main ブランチの worker/ 以下を更新すると自動デプロイされる
 */

// CORS headers - allow any origin (LMS may be on github.io or custom domain)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': '*'
};

export default {
  async fetch(request, env) {
    // CORS preflight - respond 204 No Content (more standard than 200)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // Health check / direct browser access
    if (request.method === 'GET') {
      return new Response('LMS Anthropic Proxy is running. Use POST to call.', {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' }
      });
    }

    // Only POST is accepted for actual API calls
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: CORS_HEADERS
      });
    }

    try {
      // Get the request body
      const body = await request.json();
      const apiKey = request.headers.get('x-api-key');

      if (!apiKey) {
        return jsonResponse({ error: 'x-api-key header required' }, 401);
      }

      // Forward to Anthropic API
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const responseData = await anthropicResponse.text();

      return new Response(responseData, {
        status: anthropicResponse.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        },
      });
    } catch (error) {
      return jsonResponse({ error: error.message || String(error) }, 500);
    }
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}
