/* ============================================================
   LMS - Affiliate Engine + PayPal Subscription
   ============================================================ */
var AffiliateEngine = {
  tracking: [],

  init() {
    try {
      this.tracking = JSON.parse(localStorage.getItem('lms_affiliate_tracking') || '[]');
    } catch (e) { this.tracking = []; }
  },

  // ─── Generate affiliate link ───
  generateLink(store_name, productUrl, productId) {
    const config = CONFIG.affiliate[store_name] || {};
    let url = productUrl;

    switch (store_name) {
      case 'amazon_jp':
        if (config.tag) url += (url.includes('?') ? '&' : '?') + 'tag=' + config.tag;
        break;
      case 'rakuten':
        if (config.id) url += (url.includes('?') ? '&' : '?') + 'affiliateId=' + config.id;
        break;
      case 'iherb':
        if (config.code) url += (url.includes('?') ? '&' : '?') + 'rcode=' + config.code;
        break;
    }
    return url;
  },

  // ─── Track click ───
  trackClick(store_name, productId, domain) {
    const event = {
      timestamp: new Date().toISOString(),
      store: store_name,
      productId,
      domain,
      userId: store.get('user')?.uid || 'anon'
    };
    this.tracking.push(event);
    localStorage.setItem('lms_affiliate_tracking', JSON.stringify(this.tracking.slice(-500)));
  },

  // ─── Render product card with affiliate links ───
  productCard(product) {
    const links = (product.stores || []).map(s => {
      const url = this.generateLink(s.store, s.url, product.id);
      return `<a href="${url}" target="_blank" rel="noopener" class="affiliate-link"
        onclick="AffiliateEngine.trackClick('${s.store}','${product.id}','${product.domain || ''}')">${s.store}</a>`;
    }).join('');

    return `<div class="product-card">
      ${product.image ? `<img src="${product.image}" alt="${product.name}" class="product-img">` : ''}
      <div class="product-info">
        <h4>${product.name}</h4>
        <p>${product.description || ''}</p>
        ${product.price ? `<div class="product-price">${product.price}</div>` : ''}
        <div class="product-links">${links}</div>
      </div>
    </div>`;
  },

  // ─── Admin: update config ───
  updateConfig(store_name, config) {
    CONFIG.affiliate[store_name] = { ...CONFIG.affiliate[store_name], ...config };
    store.set('affiliateConfig', CONFIG.affiliate);
  },

  // ─── Revenue report (admin) ───
  getReport(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const recent = this.tracking.filter(t => new Date(t.timestamp) >= cutoff);

    const byStore = {};
    recent.forEach(t => {
      if (!byStore[t.store]) byStore[t.store] = { clicks: 0 };
      byStore[t.store].clicks++;
    });

    return { period: days, totalClicks: recent.length, byStore };
  }
};

/* ============================================================
   PayPal Subscription Manager
   ============================================================ */
var PayPalManager = {

  // ─── Load PayPal SDK ───
  async loadSDK() {
    if (window.paypal) return;
    if (!CONFIG.paypal.clientId) {
      console.warn('PayPal not configured');
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${CONFIG.paypal.clientId}&vault=true&intent=subscription`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  // ─── Render subscription buttons ───
  async renderButtons(containerId, planKey) {
    await this.loadSDK();
    if (!window.paypal) return;

    const plan = CONFIG.paypal.plans[planKey];
    if (!plan || !plan.id) return;

    paypal.Buttons({
      style: { shape: 'rect', color: 'blue', layout: 'vertical', label: 'subscribe' },
      createSubscription: (data, actions) => {
        return actions.subscription.create({ plan_id: plan.id });
      },
      onApprove: (data) => {
        store.set('subscription', {
          plan: planKey,
          status: 'active',
          paypalId: data.subscriptionID,
          startedAt: new Date().toISOString()
        });
        Components.showToast(i18n.t('saved'), 'success');
      },
      onError: (err) => {
        console.error('PayPal error:', err);
        Components.showToast(i18n.t('error'), 'error');
      }
    }).render('#' + containerId);
  },

  // ─── Check subscription status ───
  isActive() {
    const sub = store.get('subscription');
    return sub?.status === 'active';
  },

  getPlan() {
    const sub = store.get('subscription');
    return sub?.plan || null;
  },

  // ─── Subscription info display ───
  renderStatus() {
    const sub = store.get('subscription');
    if (!sub || sub.status !== 'active') {
      return `<div class="subscription-status">
        <p>${i18n.t('subscription')}: Free</p>
        <div class="plan-cards">
          ${Object.entries(CONFIG.paypal.plans).map(([key, plan]) => `
            <div class="plan-card">
              <h3>${plan.name}</h3>
              <div class="plan-price">${plan.currency} ${plan.price}/月</div>
              <ul>${plan.features.map(f => `<li>${i18n.t(f)}</li>`).join('')}</ul>
              <div id="paypal-btn-${key}"></div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    return `<div class="subscription-status active">
      <p>${i18n.t('subscription')}: ${CONFIG.paypal.plans[sub.plan]?.name || sub.plan}</p>
      <p>ID: ${sub.paypalId}</p>
    </div>`;
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => AffiliateEngine.init());
