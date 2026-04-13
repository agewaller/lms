/* ============================================================
   LMS Email Forwarder Worker (Cloudflare Email Worker)

   概要:
     ひとつのメールアドレスに届いたメールを、設定した複数の
     メールアドレスに転送するシンプルなフォワーダー。

   動作:
     1. Cloudflare Email Routing が受信メールをこの Worker に渡す
     2. Worker は環境変数 FORWARD_TO に設定された宛先リストに転送
     3. 追加で FORWARD_MAP (JSON) を設定すれば、受信アドレスごとに
        転送先を振り分けることも可能

   必要な設定 (wrangler.toml):
     - Email Routing: receive-address@your-domain → この Worker
     - vars.FORWARD_TO = "a@example.com,b@example.com"
       もしくは
     - vars.FORWARD_MAP = '{"info@lms-life.com":["a@x.com","b@x.com"]}'

   注意:
     Cloudflare Email Routing では、転送先アドレスは事前に
     "Destination addresses" として検証済みである必要があります。
   ============================================================ */

export default {
  async email(message, env, ctx) {
    const destinations = resolveDestinations(message.to, env);

    if (destinations.length === 0) {
      console.warn(`No forwarding destinations for ${message.to}`);
      message.setReject('No forwarding destinations configured');
      return;
    }

    // 重複排除 & 自分自身への転送ループを防ぐ
    const unique = [...new Set(destinations)].filter(
      (addr) => addr && addr.toLowerCase() !== (message.to || '').toLowerCase()
    );

    const results = await Promise.allSettled(
      unique.map((addr) => message.forward(addr))
    );

    let failed = 0;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        failed++;
        console.error(`Forward failed: ${unique[i]} ->`, r.reason);
      }
    });

    if (failed === unique.length) {
      // すべて失敗した場合のみ reject して送信者に通知
      message.setReject('All forwarding attempts failed');
    }
  }
};

// ─── Helpers ───

/**
 * 転送先アドレスのリストを決定する。
 *   1. FORWARD_MAP (JSON) に受信アドレスのエントリがあればそれを使う
 *   2. なければ FORWARD_TO (カンマ区切り) を使う
 */
function resolveDestinations(to, env) {
  const recipient = (to || '').toLowerCase().trim();

  // 1. アドレス別ルーティング
  if (env.FORWARD_MAP) {
    try {
      const map = typeof env.FORWARD_MAP === 'string'
        ? JSON.parse(env.FORWARD_MAP)
        : env.FORWARD_MAP;
      const entry = map[recipient] || map['*'];
      if (entry) {
        const list = Array.isArray(entry) ? entry : String(entry).split(',');
        return list.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch (e) {
      console.error('Invalid FORWARD_MAP JSON:', e);
    }
  }

  // 2. フォールバック: 単一の転送先リスト
  if (env.FORWARD_TO) {
    return String(env.FORWARD_TO)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}
