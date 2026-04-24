/* ============================================================
   LMS - Firebase Backend
   Authentication (Google) + Firestore data sync
   ============================================================ */
var FirebaseBackend = {
  db: null,
  auth: null,
  initialized: false,

  // ─── Initialize Firebase ───
  async init() {
    if (this.initialized) return;
    if (!CONFIG.firebase.apiKey) {
      console.warn('Firebase not configured - using local-only mode');
      return;
    }

    try {
      const app = firebase.initializeApp(CONFIG.firebase);
      this.auth = firebase.auth();
      this.db = firebase.firestore();

      // Enable offline persistence
      try {
        await this.db.enablePersistence({ synchronizeTabs: true });
      } catch (e) {
        console.warn('Firestore persistence:', e.code);
      }

      // Listen for auth state changes
      this.auth.onAuthStateChanged(user => this.handleAuthChange(user));
      this.initialized = true;
    } catch (e) {
      console.error('Firebase init error:', e);
    }
  },

  // ─── Auth State Change Handler ───
  handleAuthChange(user) {
    if (user) {
      store.update({
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        },
        isAuthenticated: true
      });
      this.loadUserData(user.uid);
      this.enableAutoSync(user.uid);
    } else {
      store.update({ user: null, isAuthenticated: false });
    }
  },

  // ─── Google Sign In ───
  async signInWithGoogle() {
    if (!this.auth) {
      // Local-only mode fallback (Firebase not configured).
      // Prompt for email so that admin (agewaller@gmail.com) can still log in.
      const email = (prompt('メールアドレスを入力してください', '') || '').trim().toLowerCase();
      if (!email) return;
      store.update({
        user: {
          uid: 'local-' + email,
          displayName: email.split('@')[0],
          email
        },
        isAuthenticated: true,
        currentPage: 'home'
      });
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await this.auth.signInWithPopup(provider);
    } catch (e) {
      console.error('Google sign-in error:', e);
      Components.showToast(i18n.t('error') + ': ' + e.message, 'error');
    }
  },

  // ─── Email/Password Sign In ───
  async signInWithEmail(email, password) {
    if (!this.auth) {
      store.update({
        user: { uid: 'local', displayName: email.split('@')[0], email },
        isAuthenticated: true,
        currentPage: 'home'
      });
      return;
    }

    try {
      await this.auth.signInWithEmailAndPassword(email, password);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        throw new Error('このメールアドレスは登録されていません。「新規登録」をお試しください。');
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        throw new Error('パスワードが正しくありません。もう一度お試しください。');
      } else if (e.code === 'auth/invalid-email') {
        throw new Error('メールアドレスの形式が正しくありません。');
      } else if (e.code === 'auth/too-many-requests') {
        throw new Error('ログイン試行回数が多すぎます。しばらく待ってからお試しください。');
      } else {
        throw new Error('ログインに失敗しました: ' + e.message);
      }
    }
  },

  // ─── Email/Password Registration ───
  async registerWithEmail(email, password, displayName) {
    if (!this.auth) {
      store.update({
        user: { uid: 'local', displayName: displayName || email.split('@')[0], email },
        isAuthenticated: true,
        currentPage: 'home'
      });
      return;
    }

    try {
      const result = await this.auth.createUserWithEmailAndPassword(email, password);
      if (displayName && result.user) {
        await result.user.updateProfile({ displayName });
      }
      // Send welcome email (fire-and-forget; failure doesn't block registration)
      this.sendWelcomeEmail(email, displayName || email.split('@')[0]);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        throw new Error('このメールアドレスはすでに登録されています。ログインをお試しください。');
      } else if (e.code === 'auth/weak-password') {
        throw new Error('パスワードは6文字以上にしてください。');
      } else if (e.code === 'auth/invalid-email') {
        throw new Error('メールアドレスの形式が正しくありません。');
      } else {
        throw new Error('登録に失敗しました: ' + e.message);
      }
    }
  },

  // ─── Password Reset ───
  async sendPasswordReset(email) {
    if (!this.auth) {
      Components.showToast('ローカルモードではパスワードリセットは不要です', 'info');
      return;
    }

    try {
      await this.auth.sendPasswordResetEmail(email);
      Components.showToast('パスワード再設定メールを送信しました。メールをご確認ください。', 'success');
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        throw new Error('このメールアドレスは登録されていません。');
      } else if (e.code === 'auth/invalid-email') {
        throw new Error('メールアドレスの形式が正しくありません。');
      } else {
        throw new Error('送信に失敗しました: ' + e.message);
      }
    }
  },

  // ─── Sign Out ───
  async signOut() {
    if (this.auth) {
      await this.auth.signOut();
    }
    store.clearAll();
    store.set('currentPage', 'login');
  },

  // ─── Load User Data from Firestore ───
  async loadUserData(uid) {
    if (!this.db) return;

    try {
      // Load profile
      const profileDoc = await this.db.collection('users').doc(uid).get();
      if (profileDoc.exists) {
        const data = profileDoc.data();
        if (data.userProfile) store.set('userProfile', data.userProfile);
        if (data.subscription) store.set('subscription', data.subscription);
        if (data.domainScores) store.set('domainScores', data.domainScores);
      }

      // ─── Load ADMIN-SHARED config (AI model, prompts, API keys, admin list) ───
      // All users inherit the admin's configuration (未病ダイアリー pattern)
      try {
        const adminConfigDoc = await this.db.collection('admin').doc('config').get();
        if (adminConfigDoc.exists) {
          const cfg = adminConfigDoc.data();
          if (cfg.selectedModel) store.set('selectedModel', cfg.selectedModel);
          if (cfg.customPrompts) store.set('customPrompts', cfg.customPrompts);
          if (cfg.affiliateConfig) store.set('affiliateConfig', cfg.affiliateConfig);
          if (cfg.adminEmails) store.set('adminEmails', cfg.adminEmails);
          if (cfg.anthropicProxyUrl) {
            CONFIG.endpoints.anthropic = cfg.anthropicProxyUrl;
            localStorage.setItem('lms_workerUrl', cfg.anthropicProxyUrl);
          }
          if (cfg.emailIngestUrl) CONFIG.endpoints.emailIngest = cfg.emailIngestUrl;
          if (cfg.emailIngestDomain) CONFIG.emailIngestDomain = cfg.emailIngestDomain;
          if (cfg.mailSenderUrl) {
            CONFIG.endpoints.mailSender = cfg.mailSenderUrl;
            localStorage.setItem('lms_mailSenderUrl', cfg.mailSenderUrl);
          }

          // OAuth Client IDs (admin-shared) - merge with defaults
          // so that all users inherit the admin's OAuth apps and only
          // see a one-click Connect button in their integration page.
          if (cfg.oauthClientIds) {
            CONFIG.oauthClientIds = { ...CONFIG.oauthClientIds, ...cfg.oauthClientIds };
          }
        }

        // Load admin API keys (shared across all users)
        const adminSecretsDoc = await this.db.collection('admin').doc('secrets').get();
        if (adminSecretsDoc.exists) {
          const keys = adminSecretsDoc.data();
          store.state._apiKeys = keys;
          // Cache in localStorage for offline use
          if (keys.anthropic) localStorage.setItem('lms_apikey_anthropic', keys.anthropic);
          if (keys.openai) localStorage.setItem('lms_apikey_openai', keys.openai);
          if (keys.google) localStorage.setItem('lms_apikey_google', keys.google);
        }
      } catch (e) {
        console.warn('Admin config load error:', e);
      }

      // Load domain data collections in parallel
      const domainCollections = [];
      Object.keys(CONFIG.domains).forEach(domain => {
        Object.keys(CONFIG.domains[domain].categories).forEach(cat => {
          domainCollections.push({ domain, cat, key: `${domain}_${cat}` });
        });
      });

      await Promise.all(domainCollections.map(async ({ domain, cat, key }) => {
        try {
          const snap = await this.db.collection('users').doc(uid)
            .collection(key)
            .orderBy('timestamp', 'desc')
            .limit(500)
            .get();
          if (!snap.empty) {
            const entries = snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
            store.state[key] = entries.reverse();
            store.notify(key, store.state[key]);
          }
        } catch (e) { /* collection may not exist yet */ }
      }));

      // Load shared collections
      const sharedKeys = ['analysisHistory', 'conversationHistory', 'recommendations', 'actionItems'];
      await Promise.all(sharedKeys.map(async key => {
        try {
          const snap = await this.db.collection('users').doc(uid)
            .collection(key)
            .orderBy('timestamp', 'desc')
            .limit(200)
            .get();
          if (!snap.empty) {
            store.state[key] = snap.docs.map(d => d.data()).reverse();
            store.notify(key, store.state[key]);
          }
        } catch (e) { /* ignore */ }
      }));

    } catch (e) {
      console.error('Load user data error:', e);
    }
  },

  // ─── Auto-sync store changes to Firestore ───
  // All user data is stored in Firebase Firestore (未病ダイアリー pattern).
  // localStorage is only used as an offline cache. Source of truth = Firestore.
  enableAutoSync(uid) {
    if (!this.db) return;

    const isAdmin = this.isAdmin();

    // ─── Per-user profile fields (synced to users/{uid}) ───
    const userProfileFields = [
      'userProfile', 'subscription', 'domainScores',
      'userResume', 'timeMarketplaceSettings', 'timeMarketplaceBookings',
      'workProvisionPrefs', 'autoTradingSettings', 'autoTradePending', 'autoTradeHistory',
      'calendarEvents', 'latestFeedback', 'cachedResearch', 'aiComments',
      'adminPromptFilter', 'dataBrowserFilter'
    ];
    userProfileFields.forEach(key => {
      store.on(key, (value) => {
        this.db.collection('users').doc(uid).set(
          { [key]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        ).catch(e => console.warn('Sync error:', e));
      });
    });

    // ─── ADMIN-ONLY: shared config (AI model, prompts, affiliate, admin list) ───
    if (isAdmin) {
      const adminFields = ['selectedModel', 'customPrompts', 'affiliateConfig', 'adminEmails'];
      adminFields.forEach(key => {
        store.on(key, (value) => {
          this.db.collection('admin').doc('config').set(
            { [key]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          ).catch(e => console.warn('Admin config sync error:', e));
        });
      });
    }

    // ─── Domain data collections (stored as subcollections per category) ───
    Object.keys(CONFIG.domains).forEach(domain => {
      Object.keys(CONFIG.domains[domain].categories).forEach(cat => {
        const key = `${domain}_${cat}`;
        store.on(key, (entries) => {
          if (!Array.isArray(entries)) return;
          entries.filter(e => !e._synced).forEach(entry => {
            const docId = entry.id || entry._docId;
            this.db.collection('users').doc(uid)
              .collection(key).doc(docId)
              .set({ ...entry, _synced: true, syncedAt: firebase.firestore.FieldValue.serverTimestamp() })
              .then(() => { entry._synced = true; })
              .catch(e => console.warn('Entry sync error:', e));
          });
        });
      });
    });

    // ─── Shared collections (history, conversations, recommendations, actions) ───
    ['analysisHistory', 'conversationHistory', 'recommendations', 'actionItems'].forEach(key => {
      store.on(key, (entries) => {
        if (!Array.isArray(entries)) return;
        entries.filter(e => !e._synced).forEach(entry => {
          const docId = entry.id || Date.now().toString(36);
          entry.id = entry.id || docId;
          this.db.collection('users').doc(uid).collection(key).doc(docId)
            .set({ ...entry, _synced: true, syncedAt: firebase.firestore.FieldValue.serverTimestamp() })
            .then(() => { entry._synced = true; })
            .catch(e => console.warn('Shared sync error:', e));
        });
      });
    });
  },

  // ─── Upload file to Firebase Storage (for photos, screenshots, transcripts, etc.) ───
  async uploadFile(file, path) {
    if (!firebase.storage) {
      console.warn('Firebase Storage not available');
      return null;
    }
    const uid = store.get('user')?.uid;
    if (!uid) return null;

    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`users/${uid}/${path}/${Date.now()}_${file.name}`);
    try {
      const snapshot = await fileRef.put(file);
      const url = await snapshot.ref.getDownloadURL();
      return url;
    } catch (e) {
      console.error('Upload error:', e);
      return null;
    }
  },

  // ─── Save API Keys: admin writes to shared admin/secrets ───
  async saveApiKeys(keys) {
    if (!this.db) return;
    if (!this.isAdmin()) {
      console.warn('Only admin can save API keys');
      return;
    }
    await this.db.collection('admin').doc('secrets').set(keys, { merge: true });
  },

  // ─── Check if user is admin (owner or dynamic list) ───
  isAdmin() {
    const user = store.get('user');
    if (!user?.email) return false;
    if (user.email === 'agewaller@gmail.com') return true;
    const list = store.get('adminEmails') || ['agewaller@gmail.com'];
    return list.includes(user.email.toLowerCase());
  },

  // ─── Send welcome email via lms-mail-sender worker ───
  async sendWelcomeEmail(email, displayName) {
    const url = CONFIG.endpoints.mailSender;
    if (!url) return; // Not configured; skip silently
    try {
      await fetch(`${url}/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, displayName })
      });
    } catch (e) {
      console.warn('Welcome email failed:', e.message);
    }
  }
};
