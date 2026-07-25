# hair-salon-line-app

ヘアサロンの公式LINEシステム。「LINEひとつでマーケティングが完結する」ことをゴールに、予約・よくある質問・事前ヒアリング・サロン紹介LIFF・商品購入・前日リマインド・ポイントカード・リッチメニュー出し分けを段階的に実装する。詳しい仕様・予算試算は [`docs/SPEC.md`](./docs/SPEC.md) を参照。

## 技術スタック

- Next.js（App Router / TypeScript / Tailwind） on Vercel
- Prisma（Postgres, Neon想定）
- LINE Messaging API（`@line/bot-sdk`） / LIFF（`@line/liff`）

## 進捗（フェーズ1: 予約システムの土台） — 完了 ✅

- [x] DBスキーマ（Customer / Staff / Service / Reservation）
- [x] LINE連携ヘルパー（メッセージ送受信・署名検証・LIFFログイン検証）
- [x] 予約API（`/api/menu`, `/api/availability`, `/api/reservations`）
- [x] LIFF予約画面（`/liff/reserve`）
- [x] Webhook（友だち追加時のあいさつ＋予約ボタン）
- [x] Neon DBへの接続・マイグレーション実行（Vercel Marketplace経由でNeonを自動プロビジョニング）
- [x] LINE Developersでの資格情報取得・実機での動作確認（友だち追加→あいさつ→LIFF予約まで確認済み）
- [x] Vercel本番デプロイ（本番URL: `https://hair-salon-line-app.vercel.app`）

フェーズ2以降（前日リマインド、よくある質問Bot等）は [`docs/SPEC.md`](./docs/SPEC.md) の一覧を参照。次はこのフェーズ2の機能追加に着手する。

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーし、値を埋める。

```bash
cp .env.example .env
```

| 変数名 | 取得場所 |
|---|---|
| `DATABASE_URL` | [Neon](https://neon.tech) で直接作成してもよいが、`vercel link` 後に `vercel integration add neon` を実行するとVercel経由で自動プロビジョニングされ、`vercel env pull` でこのプロジェクトにも自動反映される（本プロジェクトはこの方法で構築済み） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → Messaging APIチャネル → 「Messaging API設定」タブ → 「チャネルアクセストークン」を発行 |
| `LINE_CHANNEL_SECRET` | LINE Developers → Messaging APIチャネル → 「チャネル基本設定」タブ |
| `LINE_LOGIN_CHANNEL_ID` | LINE Developers → LINEログインチャネル（LIFF用の別チャネル）→ 「チャネル基本設定」タブの Channel ID |
| `NEXT_PUBLIC_LIFF_ID` | 上記LINEログインチャネルの「LIFF」タブでLIFFアプリを追加すると発行される |

LIFFアプリを追加する際の「エンドポイントURL」は、デプロイ先のURL＋`/liff/reserve`（例: `https://xxxx.vercel.app/liff/reserve`）を指定する。

### 3. DBマイグレーション

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. 開発サーバー起動

```bash
npm run dev
```

## Webhook URLの設定

LINE Developers → Messaging APIチャネル → 「Messaging API設定」タブ → Webhook URLに、デプロイ先の `/api/line/webhook` を設定し、Webhookをオンにする（本番: `https://hair-salon-line-app.vercel.app/api/line/webhook`）。

`follow`イベント（友だち追加時のあいさつ）は初回追加時にしか発火しないため、動作確認をやり直したい場合は一度LINEでブロック→ブロック解除（再追加）する。

## デプロイ

```bash
vercel --prod
```

環境変数のうちDB系（`DATABASE_URL`等）はNeon連携で自動同期されるが、LINE系4つ（`LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` / `LINE_LOGIN_CHANNEL_ID` / `NEXT_PUBLIC_LIFF_ID`）は`vercel env add <name> production`で別途登録する必要がある（登録後は再デプロイが必要）。

- 本番URL: https://hair-salon-line-app.vercel.app
- GitHubリポジトリ（非公開）: https://github.com/niwasaya0501-cyber/hair-salon-line-app
