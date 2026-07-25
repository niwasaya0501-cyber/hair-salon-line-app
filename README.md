# hair-salon-line-app

ヘアサロンの公式LINEシステム。「LINEひとつでマーケティングが完結する」ことをゴールに、予約・よくある質問・事前ヒアリング・サロン紹介LIFF・商品購入・前日リマインド・ポイントカード・リッチメニュー出し分けを段階的に実装する。詳しい仕様・予算試算は [`docs/SPEC.md`](./docs/SPEC.md) を参照。

## 技術スタック

- Next.js（App Router / TypeScript / Tailwind） on Vercel
- Prisma（Postgres, Neon想定）
- LINE Messaging API（`@line/bot-sdk`） / LIFF（`@line/liff`）

## 進捗（フェーズ1: 予約システムの土台）

- [x] DBスキーマ（Customer / Staff / Service / Reservation）
- [x] LINE連携ヘルパー（メッセージ送受信・署名検証・LIFFログイン検証）
- [x] 予約API（`/api/menu`, `/api/availability`, `/api/reservations`）
- [x] LIFF予約画面（`/liff/reserve`）
- [x] Webhook（友だち追加時のあいさつ＋予約ボタン）
- [ ] Neon DBへの接続・マイグレーション実行（`DATABASE_URL`待ち）
- [ ] LINE Developersでの資格情報取得・実機での動作確認

フェーズ2以降（前日リマインド、よくある質問Bot等）は [`docs/SPEC.md`](./docs/SPEC.md) の一覧を参照。

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
| `DATABASE_URL` | [Neon](https://neon.tech) でプロジェクトを作成し、ダッシュボードの「Connection string」をコピー |
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

LINE Developers → Messaging APIチャネル → 「Messaging API設定」タブ → Webhook URLに、デプロイ先の `/api/line/webhook` を設定し、Webhookをオンにする（例: `https://xxxx.vercel.app/api/line/webhook`）。

## デプロイ

Vercelにデプロイする。環境変数は上記の5つをVercelのプロジェクト設定にも登録する。
