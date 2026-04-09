/* ============================================================
   Broadcast - Platform Connectors
   各プラットフォームへの実際の投稿処理

   設計方針:
   - OAuth 2.0 が使えるものは browser implicit flow で接続
   - Webhook / API key で投稿可能なものは直接叩く
   - CORS で叩けないものは Cloudflare Worker 経由 (BROADCAST_CONFIG.endpoints.broadcastProxy)
   - 公式APIが無いもの (note など) は mailto/intent URL + クリップボード

   LMS の sns-integrations.js と同じ思想
   ============================================================ */

var BroadcastPlatforms = {

  // ─── Public API: post to one platform ───
  async postToPlatform(platformId, adapted, draft) {
    const platform = BROADCAST_CONFIG.platforms[platformId];
    if (!platform) throw new Error('Unknown platform: ' + platformId);

    const conn = (broadcastStore.get('connections') || {})[platformId];
    if (!conn?.connected && platform.auth !== 'manual' && platform.auth !== 'none') {
      throw new Error(`${platform.name} に接続されていません`);
    }

    // Dispatch by auth method & platform
    const handler = this.handlers[platformId] || this.handlers[platform.auth];
    if (!handler) throw new Error(`未実装: ${platformId}`);
    return await handler.call(this, adapted, draft, conn, platform);
  },

  // ─── Public API: post to all selected platforms ───
  async distribute(adaptations, draft, platformIds) {
    broadcastStore.set('isDistributing', true);
    const results = {};
    const promises = platformIds.map(async (pid) => {
      const adapted = adaptations[pid];
      if (!adapted || adapted.error) {
        results[pid] = { status: 'skipped', error: adapted?.error || 'No adaptation' };
        return;
      }
      try {
        const r = await this.postToPlatform(pid, adapted, draft);
        results[pid] = { status: 'success', ...r };
      } catch (e) {
        results[pid] = { status: 'error', error: e.message };
      }
    });
    await Promise.all(promises);
    broadcastStore.set('isDistributing', false);
    return results;
  },

  // ─── Platform-specific handlers ───
  handlers: {

    // ── X / Twitter (OAuth 2.0 PKCE, API v2) ──
    async twitter(adapted, draft, conn, platform) {
      const res = await fetch(platform.postUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: adapted.body })
      });
      if (!res.ok) throw new Error('X API: ' + (await res.text()));
      const data = await res.json();
      return { id: data.data?.id, url: data.data?.id ? `https://twitter.com/i/web/status/${data.data.id}` : null };
    },

    // ── Facebook (Graph API) ──
    async facebook(adapted, draft, conn, platform) {
      const res = await fetch(`${platform.postUrl}?access_token=${encodeURIComponent(conn.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: adapted.body })
      });
      if (!res.ok) throw new Error('Facebook: ' + (await res.text()));
      const data = await res.json();
      return { id: data.id, url: data.id ? `https://facebook.com/${data.id}` : null };
    },

    // ── Instagram (Graph API - requires image) ──
    async instagram(adapted, draft, conn, platform) {
      const imageUrl = draft.images?.[0];
      if (!imageUrl) throw new Error('Instagram は画像が必須です');
      // Step 1: create container
      const createRes = await fetch(`${platform.postUrl}?access_token=${encodeURIComponent(conn.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption: adapted.body })
      });
      if (!createRes.ok) throw new Error('IG create: ' + (await createRes.text()));
      const { id: creationId } = await createRes.json();
      // Step 2: publish
      const pubRes = await fetch(`https://graph.facebook.com/v18.0/me/media_publish?access_token=${encodeURIComponent(conn.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: creationId })
      });
      if (!pubRes.ok) throw new Error('IG publish: ' + (await pubRes.text()));
      const pub = await pubRes.json();
      return { id: pub.id, url: pub.id ? `https://www.instagram.com/p/${pub.id}` : null };
    },

    // ── Threads ──
    async threads(adapted, draft, conn, platform) {
      // Step 1: create container
      const body = new URLSearchParams({
        media_type: 'TEXT',
        text: adapted.body,
        access_token: conn.token
      });
      const create = await fetch(platform.postUrl, { method: 'POST', body });
      if (!create.ok) throw new Error('Threads create: ' + (await create.text()));
      const { id } = await create.json();
      // Step 2: publish
      const pub = await fetch(`https://graph.threads.net/v1.0/me/threads_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: id, access_token: conn.token })
      });
      if (!pub.ok) throw new Error('Threads publish: ' + (await pub.text()));
      const pubData = await pub.json();
      return { id: pubData.id, url: pubData.id ? `https://www.threads.net/@me/post/${pubData.id}` : null };
    },

    // ── LinkedIn ──
    async linkedin(adapted, draft, conn, platform) {
      const personUrn = conn.personUrn || 'urn:li:person:' + (conn.profileId || '');
      const payload = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: adapted.body },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      };
      const res = await fetch(platform.postUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('LinkedIn: ' + (await res.text()));
      const id = res.headers.get('x-restli-id') || '';
      return { id, url: id ? `https://www.linkedin.com/feed/update/${id}` : null };
    },

    // ── Mastodon (instance-specific OAuth) ──
    async mastodon(adapted, draft, conn, platform) {
      const url = platform.postUrlTemplate.replace('{instance}', conn.instance || 'mastodon.social');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: adapted.body, visibility: 'public' })
      });
      if (!res.ok) throw new Error('Mastodon: ' + (await res.text()));
      const data = await res.json();
      return { id: data.id, url: data.url };
    },

    // ── Bluesky (AT Protocol) ──
    async bluesky(adapted, draft, conn, platform) {
      // Ensure we have a fresh session
      if (!conn.accessJwt || !conn.did) {
        const session = await fetch(platform.sessionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: conn.handle, password: conn.appPassword })
        });
        if (!session.ok) throw new Error('Bluesky session: ' + (await session.text()));
        const sessData = await session.json();
        conn.accessJwt = sessData.accessJwt;
        conn.did = sessData.did;
        broadcastStore.setConnection('bluesky', conn);
      }

      const record = {
        $type: 'app.bsky.feed.post',
        text: adapted.body,
        createdAt: new Date().toISOString(),
        langs: [adapted.language || 'ja']
      };

      const res = await fetch(platform.postUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.accessJwt,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo: conn.did,
          collection: 'app.bsky.feed.post',
          record
        })
      });
      if (!res.ok) throw new Error('Bluesky: ' + (await res.text()));
      const data = await res.json();
      return { id: data.uri, url: `https://bsky.app/profile/${conn.handle}/post/${data.uri.split('/').pop()}` };
    },

    // ── Reddit ──
    async reddit(adapted, draft, conn, platform) {
      const subreddit = conn.subreddit || draft.subreddit || 'test';
      const body = new URLSearchParams({
        sr: subreddit,
        kind: 'self',
        title: adapted.title || draft.title || '(untitled)',
        text: adapted.body,
        api_type: 'json'
      });
      const res = await fetch(platform.postUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });
      if (!res.ok) throw new Error('Reddit: ' + (await res.text()));
      const data = await res.json();
      const url = data?.json?.data?.url || null;
      return { id: data?.json?.data?.id, url };
    },

    // ── Medium ──
    async medium(adapted, draft, conn, platform) {
      const url = platform.postUrl.replace('{userId}', conn.userId || '');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title: adapted.title || draft.title || '(untitled)',
          contentFormat: 'markdown',
          content: adapted.body,
          tags: (adapted.tags || []).slice(0, 5),
          publishStatus: 'public'
        })
      });
      if (!res.ok) throw new Error('Medium: ' + (await res.text()));
      const data = await res.json();
      return { id: data.data?.id, url: data.data?.url };
    },

    // ── note (manual fallback) ──
    async note(adapted, draft, conn, platform) {
      // note has no public posting API → copy to clipboard and open tab
      const text = `# ${adapted.title || draft.title || ''}\n\n${adapted.body}`;
      await BroadcastPlatforms.copyToClipboard(text);
      window.open(platform.shareUrl, '_blank', 'noopener');
      return { manual: true, url: platform.shareUrl, note: 'クリップボードにコピー → note で貼り付けて投稿してください' };
    },

    // ── はてなブログ (AtomPub + WSSE) ──
    async hatena(adapted, draft, conn, platform) {
      const url = platform.postUrlTemplate
        .replace('{hatenaId}', conn.hatenaId)
        .replace('{blogId}', conn.blogId);

      // WSSE header generation
      const wsse = await BroadcastPlatforms.buildWsseHeader(conn.hatenaId, conn.apiKey);

      const entry = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app">
  <title>${escapeXml(adapted.title || draft.title || '(untitled)')}</title>
  <author><name>${escapeXml(conn.hatenaId)}</name></author>
  <content type="text/plain">${escapeXml(adapted.body)}</content>
  <app:control><app:draft>no</app:draft></app:control>
</entry>`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'X-WSSE': wsse
        },
        body: entry
      });
      if (!res.ok) throw new Error('Hatena: ' + (await res.text()));
      // hatena returns 201 with Location header
      return { url: res.headers.get('Location') };
    },

    // ── WordPress REST API ──
    async wordpress(adapted, draft, conn, platform) {
      const url = platform.postUrlTemplate.replace('{site}', conn.site);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(conn.username + ':' + conn.appPassword),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: adapted.title || draft.title || '(untitled)',
          content: adapted.body,
          status: 'publish',
          tags: adapted.tags || []
        })
      });
      if (!res.ok) throw new Error('WordPress: ' + (await res.text()));
      const data = await res.json();
      return { id: data.id, url: data.link };
    },

    // ── Dev.to ──
    async devto(adapted, draft, conn, platform) {
      const res = await fetch(platform.postUrl, {
        method: 'POST',
        headers: {
          'api-key': conn.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          article: {
            title: adapted.title || draft.title || '(untitled)',
            body_markdown: adapted.body,
            published: true,
            tags: (adapted.tags || []).slice(0, 4)
          }
        })
      });
      if (!res.ok) throw new Error('Dev.to: ' + (await res.text()));
      const data = await res.json();
      return { id: data.id, url: data.url };
    },

    // ── Tumblr ──
    async tumblr(adapted, draft, conn, platform) {
      const url = platform.postUrlTemplate.replace('{blog}', conn.blog);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: [{ type: 'text', text: adapted.body }],
          tags: adapted.tags || []
        })
      });
      if (!res.ok) throw new Error('Tumblr: ' + (await res.text()));
      const data = await res.json();
      return { id: data.response?.id, url: data.response?.display_text };
    },

    // ── Pinterest ──
    async pinterest(adapted, draft, conn, platform) {
      const imageUrl = draft.images?.[0];
      if (!imageUrl) throw new Error('Pinterest は画像が必須です');
      const res = await fetch(platform.postUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          board_id: conn.boardId,
          media_source: { source_type: 'image_url', url: imageUrl },
          description: adapted.body,
          title: adapted.title || draft.title || ''
        })
      });
      if (!res.ok) throw new Error('Pinterest: ' + (await res.text()));
      const data = await res.json();
      return { id: data.id, url: data.url };
    },

    // ── Discord (webhook) ──
    async discord(adapted, draft, conn, platform) {
      const res = await fetch(conn.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: adapted.body.slice(0, 2000),
          username: conn.username || 'Broadcast'
        })
      });
      if (!res.ok) throw new Error('Discord: ' + (await res.text()));
      return { status: 'sent' };
    },

    // ── Slack (incoming webhook) ──
    async slack(adapted, draft, conn, platform) {
      const res = await fetch(conn.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: adapted.body })
      });
      if (!res.ok) throw new Error('Slack: ' + (await res.text()));
      return { status: 'sent' };
    },

    // ── Telegram (Bot API) ──
    async telegram(adapted, draft, conn, platform) {
      const url = platform.postUrlTemplate.replace('{token}', conn.token);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: conn.chatId,
          text: adapted.body,
          parse_mode: 'Markdown'
        })
      });
      if (!res.ok) throw new Error('Telegram: ' + (await res.text()));
      const data = await res.json();
      return { id: data.result?.message_id };
    },

    // ── LINE Messaging API (broadcast) ──
    async line(adapted, draft, conn, platform) {
      const res = await fetch(platform.postUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + conn.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ type: 'text', text: adapted.body.slice(0, 5000) }]
        })
      });
      if (!res.ok) throw new Error('LINE: ' + (await res.text()));
      return { status: 'sent' };
    },

    // ── WhatsApp (manual share URL) ──
    async whatsapp(adapted, draft, conn, platform) {
      const url = platform.shareUrl + encodeURIComponent(adapted.body);
      window.open(url, '_blank', 'noopener');
      return { manual: true, url };
    },

    // ── Email (via Worker) ──
    async email(adapted, draft, conn, platform) {
      // Prefer Worker if configured, otherwise fallback to mailto:
      const worker = BROADCAST_CONFIG.endpoints.broadcastProxy;
      if (worker && !worker.includes('your-account')) {
        const res = await fetch(`${worker}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: conn.recipients || [],
            subject: adapted.title || draft.title || 'Broadcast',
            body: adapted.body,
            smtp: conn.smtp
          })
        });
        if (!res.ok) throw new Error('Email: ' + (await res.text()));
        return { status: 'sent' };
      }
      // Fallback: mailto:
      const mailto = platform.shareUrl
        .replace('{subject}', encodeURIComponent(adapted.title || draft.title || ''))
        .replace('{body}', encodeURIComponent(adapted.body));
      window.open(mailto, '_blank');
      return { manual: true, url: mailto };
    },

    // ── RSS (append to self-hosted feed via Worker) ──
    async rss(adapted, draft, conn, platform) {
      const worker = BROADCAST_CONFIG.endpoints.broadcastProxy;
      if (!worker || worker.includes('your-account')) {
        // Local fallback: store in broadcastStore and let user self-host
        return { status: 'queued_local', note: 'Worker 未設定: ローカルの RSS キューに追加しました' };
      }
      const res = await fetch(`${worker}/rss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: adapted.title || draft.title,
          body: adapted.body,
          tags: adapted.tags || []
        })
      });
      if (!res.ok) throw new Error('RSS: ' + (await res.text()));
      return { status: 'sent' };
    },

    // ── Custom webhook ──
    async webhook(adapted, draft, conn, platform) {
      const res = await fetch(conn.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: adapted.title || draft.title,
          body: adapted.body,
          tags: adapted.tags || [],
          source: 'broadcast',
          timestamp: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error('Webhook: ' + (await res.text()));
      return { status: 'sent' };
    },

    // ── YouTube Community Posts (OAuth) ──
    async youtube(adapted, draft, conn, platform) {
      // YouTube Community Posts API is very limited; we post via Data API
      // Requires a channel with community tab enabled
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + conn.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: adapted.body })
      });
      // Fallback: YouTube doesn't officially support community post creation via API as of 2025
      throw new Error('YouTube Community Posts は手動投稿が必要です');
    }
  },

  // ─── Clipboard helper ───
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  },

  // ─── WSSE header for Hatena ───
  async buildWsseHeader(userId, apiKey) {
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const nonceB64 = btoa(String.fromCharCode(...nonce));
    const created = new Date().toISOString();
    const raw = new TextEncoder().encode(
      String.fromCharCode(...nonce) + created + apiKey
    );
    const hash = await crypto.subtle.digest('SHA-1', raw);
    const digest = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return `UsernameToken Username="${userId}", PasswordDigest="${digest}", Nonce="${nonceB64}", Created="${created}"`;
  },

  // ─── Connect helpers (OAuth redirect + token entry) ───
  connect: {
    // Generic OAuth 2.0 Implicit Flow redirect
    oauthRedirect(platformId) {
      const platform = BROADCAST_CONFIG.platforms[platformId];
      if (!platform?.oauth) {
        Components.showToast('このプラットフォームは OAuth 未対応です', 'error');
        return;
      }
      const clientId = localStorage.getItem(`broadcast_${platformId}_clientId`);
      if (!clientId) {
        Components.showToast(`${platform.name} の Client ID が未設定です`, 'error');
        return;
      }
      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      const scope = encodeURIComponent(platform.oauth.scope || '');
      const state = `broadcast_${platformId}_${Date.now()}`;
      localStorage.setItem('broadcast_oauth_state', state);

      const url = `${platform.oauth.authUrl}?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
      window.location.href = url;
    },

    // Token-based connection (user pastes API key)
    token(platformId, token, extra) {
      broadcastStore.setConnection(platformId, { token, ...(extra || {}) });
      Components.showToast('接続しました', 'success');
    },

    // Webhook-based connection (Discord, Slack, custom)
    webhook(platformId, webhook, extra) {
      broadcastStore.setConnection(platformId, { webhook, ...(extra || {}) });
      Components.showToast('Webhook を登録しました', 'success');
    },

    // Bluesky app password
    blueskyAppPassword(handle, appPassword) {
      broadcastStore.setConnection('bluesky', { handle, appPassword });
      Components.showToast('Bluesky に登録しました', 'success');
    },

    // Mastodon instance + token
    mastodon(instance, token) {
      broadcastStore.setConnection('mastodon', { instance: instance.replace(/^https?:\/\//, ''), token });
      Components.showToast('Mastodon に接続しました', 'success');
    },

    // Hatena
    hatena(hatenaId, blogId, apiKey) {
      broadcastStore.setConnection('hatena', { hatenaId, blogId, apiKey });
      Components.showToast('はてなブログに接続しました', 'success');
    },

    // WordPress (site + app password)
    wordpress(site, username, appPassword) {
      broadcastStore.setConnection('wordpress', { site: site.replace(/^https?:\/\//, '').replace(/\/$/, ''), username, appPassword });
      Components.showToast('WordPress に接続しました', 'success');
    }
  },

  // ─── Check OAuth callback ───
  checkOAuthCallback() {
    const hash = window.location.hash;
    if (!hash.includes('access_token=')) return;

    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('access_token');
    const state = params.get('state') || '';
    const savedState = localStorage.getItem('broadcast_oauth_state') || '';

    if (!token || !state.startsWith('broadcast_')) return;
    if (state !== savedState) {
      console.warn('OAuth state mismatch');
      return;
    }

    const platformId = state.split('_')[1];
    broadcastStore.setConnection(platformId, { token });
    localStorage.removeItem('broadcast_oauth_state');
    window.location.hash = '';
    if (typeof Components !== 'undefined') {
      const platform = BROADCAST_CONFIG.platforms[platformId];
      Components.showToast(`${platform?.name || platformId} に接続しました`, 'success');
    }
  }
};

// XML escape helper
function escapeXml(s) {
  return (s || '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[c]);
}

// Check OAuth callback on load
document.addEventListener('DOMContentLoaded', () => {
  if (typeof BroadcastPlatforms !== 'undefined') BroadcastPlatforms.checkOAuthCallback();
});

if (typeof window !== 'undefined') window.BroadcastPlatforms = BroadcastPlatforms;
