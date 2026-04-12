# 開発ワークフロー規約

## ブランチ戦略
- **開発**: `claude/life-management-system-95hjH` ブランチ
- **本番**: `main` ブランチ（GitHub Pages 自動デプロイ）
- main への直接 push は禁止（feature → main のマージのみ）
- マージ後は必ず feature ブランチに checkout して戻る

## コミット規約
- **feat**: 新機能追加
- **fix**: バグ修正
- **refactor**: リファクタリング（機能変更なし）
- **chore**: ビルド・設定・ドキュメント
- **docs**: ドキュメントのみ
- メッセージは英語、本文は日本語説明可
- 1コミット1関心事（複数の無関係な変更を混ぜない）
- コミットメッセージの末尾にセッションURLを追加

## 変更前の確認事項
1. 関連ファイルを **読む** （推測で変更しない）
2. 影響範囲を **列挙** する
3. 最小変更で **実装** する
4. 構文チェック（`node -c file.js`）で **検証** する
5. git status で意図したファイルのみ変更されていることを **確認** する

## デプロイ確認
- `git push` 後、GitHub Pages の反映に 1〜3分
- ブラウザのハードリロード（Shift+更新）で最新版を確認
- Worker の変更は `worker/` パス配下のコミットで自動デプロイ

## ファイル編集ルール
- 自動生成ファイルは編集しない
- firestore.rules / storage.rules は Firebase Console にも手動で反映が必要
- `CONFIG.persistKeys` のキー名を変更すると既存ユーザーのデータが失われる
- package.json / lockfile は存在しない（npm不使用）

## 破壊的操作の禁止
- `git reset --hard` / `git push --force` は禁止
- `store.clearAll()` は管理画面の「すべて削除」ボタン経由のみ
- Firestore collection の一括削除はコード経由で行わない
