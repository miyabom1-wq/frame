# FRAME v0.1.0

個別銘柄のテクニカル構造を、月足・週足・日足に分けて判定し、エントリー条件・初期ストップ参考・追加条件・無効化条件を固定するアプリです。

## VANTAGEとの分担

- **VANTAGE**: 市場環境、資金フロー、候補抽出、リスク管理
- **FRAME**: 個別銘柄の時間軸、チャート構造、売買計画

このパッケージはVANTAGEと完全に独立しています。VANTAGEのWorker、KV、公開URL、ファイルは変更しません。

## v0.1.0で動く機能

- 日本株・米国株の銘柄コード入力
- Yahoo Financeの日足履歴をWorker経由で取得
- 月足・週足・日足への自動集約
- 25/50/200日線、EMA65、RSI14、ATR14
- 20日出来高比
- 日本株は日経平均、米国株はSOXに対する20日相対強度
- WAIT / READY / TRIGGERED / INVALID 判定
- エントリー、ストップ参考、追加条件、無効化条件の自動生成
- プラン保存・再分析・削除
- TradingView起動
- AI分析用コピー
- PWAインストール

## 正本

- フロントエンド: `public/`
- Cloudflare Worker: `worker/src/`
- Worker設定: `worker/wrangler.toml`
- 自動テスト: `worker/test/`

導入手順は `SETUP.md` を参照してください。
