# FRAME 導入手順

## 重要

VANTAGEのリポジトリやフォルダへ上書きしないでください。FRAMEは新しいフォルダ・新しいGitHubリポジトリとして導入します。

推奨フォルダ名:

```text
C:\Users\miyab\Documents\自作アプリ\FRAME_v0.1.0
```

## 1. ZIPを展開

`FRAME_v0.1.0.zip`を右クリックし、「すべて展開」を選びます。

## 2. Cloudflare Workerを作成

PowerShellで次を実行します。

```powershell
cd "C:\Users\miyab\Documents\自作アプリ\FRAME_v0.1.0\worker"
npm install
npx wrangler login
npm run deploy
```

初回デプロイでは、`FRAME_KV`が自動作成されます。デプロイ後、次のようなURLが表示されます。

```text
https://frame-backend.miyab.workers.dev
```

URLが異なっても問題ありません。FRAME画面右上の設定から実際のAPI URLを入力できます。

### 動作確認

ブラウザで次を開きます。

```text
https://frame-backend.miyab.workers.dev/api/health
```

`"ok":true` と `"app":"FRAME"` が表示されれば正常です。

## 3. GitHubへ新規リポジトリとしてアップロード

新しいリポジトリ名は `frame` を推奨します。

アップロード対象は、展開したFRAMEフォルダの中身すべてです。

```text
.github
public
worker
README.md
SETUP.md
USAGE_GUIDE.md
VERIFICATION_REPORT.md
```

VANTAGEの既存リポジトリは変更しません。

## 4. GitHub Pagesを有効化

GitHubのFRAMEリポジトリで、次を開きます。

```text
Settings → Pages → Source → GitHub Actions
```

`Deploy FRAME Pages`が完了すると、通常は次のURLになります。

```text
https://miyabom1-wq.github.io/frame/
```

## 5. API URLを確認

FRAMEを開き、右上の歯車を押します。

API URLが実際のWorker URLと同じか確認し、「保存」を押します。

## 6. 任意の書き込み保護

プラン保存を自分だけに制限する場合、Workerフォルダで次を実行します。

```powershell
npx wrangler secret put WRITE_TOKEN
```

任意の長い文字列を入力し、FRAME画面右上の「書き込みキー」に同じ文字列を保存します。

## 更新方針

FRAMEが安定し、VANTAGE側の役割変更版も完成するまでは、現在のVANTAGEをそのまま使用します。
