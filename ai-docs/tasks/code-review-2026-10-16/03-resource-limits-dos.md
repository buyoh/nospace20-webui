# 03. リソース上限の欠如（DoS 耐性）

- 重要度: **high**
- 対象: `src/app/Config.ts`, `src/app/Services/NospaceExecutionService.ts`, `src/app/Controllers/NospaceController.ts`, `src/web/hooks/useExecutionBackend.ts`, `src/web/components/execution/OutputPanel.tsx`

## 問題点

### (a) 同時実行数上限が未実装

`Config.ts:38` で `nospaceMaxProcesses`（`NOSPACE_MAX_PROCESSES`）を読み込むが、**どこからも参照されていない**。
`.env.example` には「同時実行プロセス数の上限」と記載され、`Config.spec.ts` でテストまでされているため、防御があると誤解させる。

現状の制限は 1 ソケット 1 プロセスのみ（`NospaceController.ts:47-56`）で、接続数は無制限。
N 本のソケットから無限ループを送れば N プロセスが各 30 秒 CPU を占有する。メモリ上限（ulimit / cgroup）もない。

### (b) サーバ側の出力量無制限

`NospaceExecutionService.ts:86-93`, `NospaceController.ts:60-71`。無限出力プログラムを 30 秒走らせると全 chunk がそのまま `socket.emit` され、遅いクライアントでは engine.io の writeBuffer にメモリが積み上がる。(a) と掛け合わせると OOM の恐れ。

付随バグ: chunk ごとに `data.toString()` しており、UTF-8 マルチバイト文字が chunk 境界で分断されると文字化けする。

### (c) クライアント側の出力蓄積無制限

`useExecutionBackend.ts:91` で `[...prev, entry]` と chunk ごとに配列全体をコピー（O(n²)）、`OutputPanel.tsx:40-44` で DOM も増え続ける。WASM でも最大 1 億ステップ許容されるため、タブのメモリ枯渇が起こりうる。

## 違反しているルール・原則

- 外部公開アプリにおける DoS 対策
- 設定と実装の不一致（ドキュメント・テストと挙動が乖離）

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | ExecutionService に実行数カウンタ/セマフォを持たせ、上限超過時は即エラーで拒否。`ExecutionConfig` に `nospaceMaxProcesses` を追加 | `NospaceExecutionService`, `Config`, テスト |
| 2 | IP 単位の接続数・実行頻度制限（`io.use` ミドルウェア） | `ExpressSocketIO.ts`（新規ミドルウェア） |
| 3 | セッションごとの総出力バイト数上限。超過時は kill して通知 | `SessionImpl`, Controller |
| 4 | `stdout.setEncoding('utf8')` に変更 | `SessionImpl` |
| 5 | クライアントで合計文字数/エントリ数の上限と `[output truncated]` 表示。隣接同種エントリの結合 | `useExecutionBackend`（または atom 書き込み部）、`OutputPanel` |
| 6 | デプロイ側で `prlimit` / cgroups / コンテナによる CPU・メモリ制限 | 運用（README / デプロイ設定） |
