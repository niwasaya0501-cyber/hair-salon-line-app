# hair-salon-line-app

ヘアサロンの公式LINEシステム。「LINEひとつでマーケティングが完結する」ことをゴールに、予約・よくある質問・事前ヒアリング・サロン紹介LIFF・商品購入・前日リマインド・ポイントカード・リッチメニュー出し分けを段階的に実装する。詳しい仕様・予算試算は [`docs/SPEC.md`](./docs/SPEC.md) を参照。

## 技術スタック

- Next.js（App Router / TypeScript / Tailwind） on Vercel
- Prisma（Postgres, Neon想定）
- LINE Messaging API（`@line/bot-sdk`） / LIFF（`@line/liff`）
- Dify（よくある質問Bot。LLMはGoogle Gemini経由）

## 進捗（フェーズ1: 予約システムの土台） — 完了 ✅

- [x] DBスキーマ（Customer / Staff / Service / Reservation）
- [x] LINE連携ヘルパー（メッセージ送受信・署名検証・LIFFログイン検証）
- [x] 予約API（`/api/menu`, `/api/availability`, `/api/reservations`）
- [x] LIFF予約画面（`/liff/reserve`。茶色×クリームのブランドカラーでデザイン、レスポンシブ対応済み）
- [x] Webhook（友だち追加時のあいさつ＋予約ボタン）
- [x] Neon DBへの接続・マイグレーション実行（Vercel Marketplace経由でNeonを自動プロビジョニング）
- [x] LINE Developersでの資格情報取得・実機での動作確認（友だち追加→あいさつ→LIFF予約まで確認済み）
- [x] Vercel本番デプロイ（本番URL: `https://hair-salon-line-app.vercel.app`）

## 進捗（フェーズ4・5: よくある質問Bot・サロン紹介） — 完了 ✅

- [x] よくある質問Bot（Dify連携）。Webhookでテキストメッセージを受信し、Dify Chat APIに問い合わせて回答（`src/lib/dify.ts`, `DifyConversation`テーブルで会話継続）
- [x] サロン紹介ページ（`/about`）。コンセプト・スタイル写真ギャラリー・スタイリスト・メニュー・アクセスを掲載。写真は`public/images/about/`に置くだけで反映（未設置ならプレースホルダー表示）
- [x] リッチメニュー（6分割: 予約／よくある質問／サロン紹介／クーポン／メンバーズカード／ヘアグッズ購入）。クーポンはLINE公式アカウント標準のクーポン機能を利用、未実装の項目はWebhook側で「準備中」を案内

フェーズ2・3・6・7・8（前日リマインド、事前ヒアリング、メンバーズカード、リッチメニュー出し分け、ヘアグッズ購入）は未着手。詳細は [`docs/SPEC.md`](./docs/SPEC.md) を参照。

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
| `DIFY_API_KEY` | Dify（よくある質問Bot用チャットフローアプリ）画面左メニュー「APIアクセス」で発行 |
| `DIFY_API_BASE_URL` | Dify Cloudの場合は既定値（`https://api.dify.ai/v1`）のままでよい |

LIFFアプリを追加する際の「エンドポイントURL」は、デプロイ先のURL＋`/liff/reserve`（例: `https://xxxx.vercel.app/liff/reserve`）を指定する。

### サロン紹介ページの写真設置（任意）

`public/images/about/` に以下のファイル名で置くと、`/about`ページに反映される（置かなければプレースホルダー表示のまま動作する）。

| ファイル名 | 用途 | 推奨サイズ |
|---|---|---|
| `hero.jpg` | トップの雰囲気画像 | 横長 1600×900程度 |
| `style-1.jpg` 〜 `style-6.jpg` | カット後のスタイル写真ギャラリー（あるものだけ表示） | 正方形 600×600程度 |
| `stylist-1.jpg`, `stylist-2.jpg`, ... | スタイリスト写真（表示順=Staffの`sortOrder`順） | 正方形 600×600程度 |

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
