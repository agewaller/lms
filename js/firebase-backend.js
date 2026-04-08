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
      // Local-only mode fallback
      store.update({
        user: { uid: 'local', displayName: 'Local User', email: 'local@lms' },
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
        user: { uid: 'local', displayName: email, email },
        isAuthenticated: true,
        currentPage: 'home'
      });
      return;
    }

    try {
      await this.auth.signInWithEmailAndPassword(email, password);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        await this.auth.createUserWithEmailAndPassword(email, password);
      } else {
        throw e;
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
        if (data.selectedModel) store.set('selectedModel', data.selectedModel);
        if (data.customPrompts) store.set('customPrompts', data.customPrompts);
        if (data.affiliateConfig) store.set('affiliateConfig', data.affiliateConfig);
        if (data.subscription) store.set('subscription', data.subscription);
        if (data.domainScores) store.set('domainScores', data.domainScores);
      }

      // Load API keys from secrets subcollection
      const secretsDoc = await this.db.collection('users').doc(uid).collection('secrets').doc('apikeys').get();
      if (secretsDoc.exists) {
        store.state._apiKeys = secretsDoc.data();
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
  enableAutoSync(uid) {
    if (!this.db) return;

    // Profile fields to sync to the main user doc
    const profileFields = ['userProfile', 'selectedModel', 'customPrompts',
      'affiliateConfig', 'subscription', 'domainScores'];

    profileFields.forEach(key => {
      store.on(key, (value) => {
        this.db.collection('users').doc(uid).set(
          { [key]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        ).catch(e => console.warn('Sync error:', e));
      });
    });

    // Domain data collections
    Object.keys(CONFIG.domains).forEach(domain => {
      Object.keys(CONFIG.domains[domain].categories).forEach(cat => {
        const key = `${domain}_${cat}`;
        store.on(key, (entries) => {
          if (!Array.isArray(entries)) return;
          // Sync only unsynced entries
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
  },

  // ─── Save API Keys to Firestore secrets ───
  async saveApiKeys(keys) {
    const uid = store.get('user')?.uid;
    if (!this.db || !uid) return;
    await this.db.collection('users').doc(uid).collection('secrets').doc('apikeys').set(keys);
  },

  // ─── Check if user is admin ───
  isAdmin() {
    const user = store.get('user');
    return user?.email === 'agewaller@gmail.com';
  }
};
