/**
 * Cloudflare Worker - Rakuten API Proxy
 *
 * 楽天ウェブサービス（レシピ・市場検索）の API キー（applicationId）を
 * ブラウザに露出させずに中継するための薄いプロキシ。フロントは JSONP でも
 * 動かせるが、本番では当 Worker 経由で applicationId を秘匿する。
 *
 * ルーティング:
 *   GET /                          → ヘルスチェック
 *   GET /recipe/category/ranking   → /services/api/Recipe/CategoryRanking/20170426
 *   GET /ichiba/item/search        → /services/api/IchibaItem/Search/20220601
 *
 * 必要な Worker Secret / 変数:
 *   RAKUTEN_APPLICATION_ID  ... 必須
 *   RAKUTEN_AFFILIATE_ID    ... 任意（あれば自動で付与）
 *
 * デプロイ:
 *   wrangler deploy --name lms-rakuten-proxy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

const RECIPE_RANKING = 'https://app.rakuten.co.jp/services/api/Recipe/CategoryRanking/20170426';
const ICHIBA_SEARCH  = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      return text('LMS Rakuten Proxy is running. GET /recipe/category/ranking or /ichiba/item/search');
    }

    if (!env.RAKUTEN_APPLICATION_ID) {
      return jsonError('RAKUTEN_APPLICATION_ID not configured on this Worker', 500);
    }

    let target;
    if (url.pathname === '/recipe/category/ranking') target = RECIPE_RANKING;
    else if (url.pathname === '/ichiba/item/search') target = ICHIBA_SEARCH;
    else return jsonError('Unknown path: ' + url.pathname, 404);

    const upstream = new URL(target);
    // クライアントが付けたパラメータを引き継ぎ
    url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    // Worker 側の applicationId / affiliateId で上書き（秘匿）
    upstream.searchParams.set('applicationId', env.RAKUTEN_APPLICATION_ID);
    if (env.RAKUTEN_AFFILIATE_ID) {
      upstream.searchParams.set('affiliateId', env.RAKUTEN_AFFILIATE_ID);
    }
    upstream.searchParams.set('formatVersion', '2');

    try {
      const res = await fetch(upstream.toString());
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return jsonError(e.message || String(e), 502);
    }
  }
};

function text(s) {
  return new Response(s, { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } });
}
function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
