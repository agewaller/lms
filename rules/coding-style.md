# コーディングスタイル規約

## JavaScript
- グローバルモジュールは `var ModuleName = { ... }` で定義（Vanilla JS、ESM不使用）
- 関数内スコープは `const` / `let`
- テンプレートリテラル（バッククォート）でHTML生成
- `async/await` を使用（`.then()` チェーンは避ける）
- 三項演算子は1段階まで（ネスト禁止）
- `===` を使用（`==` は使わない）
- 未使用変数は残さない

## CSS
- CSS変数は `:root` に一元定義
- BEMライクなクラス命名: `.block-name`, `.block-name-element`
- `!important` は禁止
- ハードコーディングされた色・サイズはCSS変数で置換
- モバイルファースト: デスクトップスタイルは `@media (min-width: 769px)` に

## HTML
- テンプレートリテラル内のHTMLはインデントを揃える
- セマンティックなクラス名（`.btn-primary`, `.form-input`）
- onclick属性でイベント処理（addEventListener不使用 — Vanilla JS SPA設計のため）

## ユーザー向けテキスト
- 専門用語禁止
- 「AI」の文字禁止（ユーザー画面）
- 小学5年生でもわかる日本語
- エラーメッセージは原因 + 対処法をセットで
