# FRAME v0.2.0 検証レポート

検証日: 2026-07-17

## 合格

- Node.js構文確認
- 分析エンジンテスト
- 新規判定と保有判定の分離テスト
- 5・20・60日相対強度テスト
- 条件チェック8項目テスト
- KVプラン保存・メモ更新・削除テスト
- API統合テスト
- Cloudflare Worker dry-run
- package-lock内の内部npm URLが0件であることを確認

## テスト結果

- tests: 5
- pass: 5
- fail: 0

## 注意

Yahoo Financeへの実通信は本番Workerで確認します。FRAMEは自動売買を行いません。
