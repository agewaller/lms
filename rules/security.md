# セキュリティ規約

## 認証・認可
- Firebase Authentication を唯一の認証手段として使用
- `FirebaseBackend.isAdmin()` による管理者判定を必ず通す
- Firestore Rules でサーバー側権限チェック（フロント判定のみに依存しない）
- API キーはユーザーのブラウザ localStorage に保存される設計を理解した上で使用
- OAuth トークンは per-user localStorage に保存（他ユーザーと共有されない）

## データ保護
- ユーザーデータは `/users/{uid}/` 配下にスコープ
- 管理者データは `/admin/config` と `/admin/secrets` に分離
- 管理者のみ write 可能なルール（`isAdmin()` 関数）
- ファイルアップロードは Firebase Storage に保存（base64でFirestoreに入れない）

## 入力検証
- ユーザー入力は表示前に必ずサニタイズ
- `Components.formatMarkdown()` でHTMLエスケープ済み出力を使用
- テンプレートリテラルへの直接挿入時は `${value}` が安全であることを確認
- onclick 属性に渡す値は英数字のみ（ユーザー入力をそのまま渡さない）

## 外部API
- API キーはリクエストヘッダーで送信（URLパラメータに含めない）
- CORS: `Access-Control-Allow-Origin: *` は Worker のみ（フロントからのCORSは各APIが管理）
- OAuth Client ID は公開値のため Firestore 共有は安全
- OAuth Access Token は非公開値のため per-user localStorage のみ

## 禁止事項
- `.env` ファイルの作成・コミット
- API キーのハードコーディング
- `eval()` の使用
- `innerHTML` でのユーザー入力直接挿入（`formatMarkdown()` 経由に限定）
- 管理者メール以外への管理機能の露出
