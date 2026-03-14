# VibeCheck 🔍

> **あなたのコードベース、実際どれだけAIに書かせましたか？**
>
> 自分で書いたと言う。でもコミット履歴は嘘をつかない。

VibeCheckはgitコミット履歴を分析し、AIアシストコーディングの痕跡を検出します。人間には不可能なタイピング速度、不審なコミットバースト、誰もそんなに速くデバッグできないfix-fix-fixチェーン、そして消し忘れた`Co-Authored-By: Claude`。

**[🚀 今すぐ始める — git-vibe.pages.dev](https://git-vibe.pages.dev)**

> インストール不要。APIキー不要。リポジトリURLを貼るだけ。

---

## バッジ

自分のREADMEにVibeスコア（または恥）を表示しよう：

### リポジトリVibeスコア
```markdown
[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
```

### リポジトリグローバルランク
```markdown
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
```

### 自分の最もVibeなリポジトリ（個人バッジ）
```markdown
[![Top Vibe Repo](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/user/あなたのGitHubユーザー名)](https://git-vibe.pages.dev)
```

**例**（bkmashiro/redscript）：

[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/bkmashiro/redscript)](https://git-vibe.pages.dev/r/bkmashiro/redscript)
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/bkmashiro/redscript)](https://git-vibe.pages.dev/r/bkmashiro/redscript)

---

## 仕組み

詳細なアルゴリズムは [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) を参照してください。

**要約：** プログラマーは実際のコーディング中（思考時間を含む）に最大で毎分50行程度しか書けません。AIは毎分500〜2000行以上を出力します。VibeCheckはこの物理的な限界と照らし合わせてコミット履歴を測定します。

検出シグナル：

| シグナル | ポイント |
|---------|---------|
| バーストスピード > 500行/分 | +40/コミット |
| バーストスピード > 200行/分 | +20/コミット |
| 30分ウィンドウ > 300行/分 | +30/ウィンドウ |
| 2分以内の大きなコミット（30行以上） | +15 |
| fix→fixパターン（10分以内） | +50/ペア |
| `Co-Authored-By:`がメッセージにある | +200/コミット |
| CIエラーキーワード | +30/コミット |
| 総行数 | ×0.05/行 |

スコアは**上限なし**——これは競争です。

---

## 技術スタック

- **フロントエンド**：React + Vite + Tailwind CSS → Cloudflare Pages
- **バックエンド**：Hono on Cloudflare Workers
- **ストレージ**：Cloudflare KV（分析キャッシュ）+ D1 SQLite（ランキング）
- **認証**：GitHub OAuth App
- **データ**：GitHub GraphQL API（1リクエストで100コミット取得）

---

## コントリビュート

スコアアルゴリズムは意図的にシンプルにしています——そして面白い形で間違っている可能性が高いです。改善のアイデアを歓迎します：

**より良いシグナル検出：**
- コミットメッセージのAIパターン検出（完璧すぎる文法、整いすぎた箇条書き）
- コミットメッセージの長さ分布の測定（AIは長めのメッセージを書く傾向がある）
- 著者の一貫性追跡（人間とAIが交互になっているか？）
- ファイルタイプ別のシグナル重み付け
- Vibeセッションを隠すsquashコミットの検出

**アルゴリズム改善：**
- ラベル付きリポジトリ（既知のAI vs 既知の人間）で小さな分類器を訓練する
- コミットメッセージの埋め込みでVibeセッションをクラスタリング
- 時間帯パターンを考慮する（深夜3時のコミットは怪しい）

**オープンな疑問：**
- 削除行はカウントすべきか？1万行を100行にリファクタリングするのはAIより人間的かもしれない
- マージコミットは除外すべきか？
- AIが初期スキャフォールドを生成し、人間がメンテナンスしているリポジトリはどう扱うか？

PRは大歓迎です。アルゴリズムは[`worker/src/analyze.ts`](./worker/src/analyze.ts)にあります。

---

## Vibingはそんなに良いものなの？

良くないです。でも良い面もある。大抵の場合：状況による、それがポイントです。

**Vibe codingへの反論：**

AIが生成したコードは生産が速く、理解が遅い。4分で500行のモジュールをvibeした時、自分が出荷したものを深く理解できていないことが多い。これがもたらすもの：

- **メンテナンス負債**：自分で書かなかったコードは、触るたびに学び直しが必要
- **バグへの盲目**：LLMは自信を持って「もっともらしいが間違った」実装を生成する。高速な出力は本番前に見落としやすい
- **スキルの退化**：重度のAIアシストはデバッグ直感とシステム設計判断力の発達を妨げるという証拠がある
- **セキュリティリスク**：AIはあなたの脅威モデルを知らない。セキュリティについて聞かなければ、機能するが安全でないコードを生成する

**Vibe codingの擁護：**

速度は本物の競争優位性です。十分に機能するならば、競合より10倍速く出荷する小チームが勝ちます。

うまく使えば、ボイラープレートを処理し、構造をスキャフォールドし、考えていなかったパターンを提案し、些細なバグを捕まえてくれます。開発者はまだアーキテクトです。

**本当の懸念：**

問題はAIを使うことではなく、*生成*と*理解*の比率です。VibeCheckの高スコアはスピードと相関しており、理解とは相関していません。5000点のリポジトリは、AIが生成した全行を深く理解した作者による技術的傑作かもしれない。または、作者がデバッグできないAI出力の山かもしれない。

VibeCheckにはその区別ができません。意図的にそうしています——私たちは*プロセス*を測定しており、品質は測定していません。バッジは会話の糸口であり、評決ではありません。

本当の問題は「AIを使ったか？」ではなく、「自分のコードベースに何が入っているか知っているか？」です。

---

## 他の言語

- [English](./README.md)
- [中文](./README.zh.md)

---

## ライセンス

MIT

---

*Vibe codingで構築 🤖 ——そう、この皮肉は意図的です。*
