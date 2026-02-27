# 単一責任原則 (SRP) 違反

## ルール

> 単一責任原則に従い、モジュール・構造体を分割する。例えば、設定ファイルの解析の場合、「ファイルの読み込み」「データのバリデーション」「データアクセス」を分類する

## 違反一覧

### 1. `src/web/hooks/useNospaceExecution.ts`（291行）— 重大度: High

1つのフックが以下の複数の責務を持つ:

| 行範囲 | 責務 |
|---|---|
| L96-L155 | バックエンドのライフサイクル管理（生成・初期化・破棄） |
| L108-L140 | イベントルーティング（stdout/stderr → atom 振り分け、コンパイル出力の分岐） |
| L88-L94 | Flavor 切り替え時のオプション自動リセット |
| L168-L291 | コマンド委譲（Run / Compile / Kill / SendStdin / ClearOutput） |
| L82-L86 | コンパイルステータス管理（`compileTargetRef`, `compileHadErrorRef`, `prevStatusRef`） |

#### 修正方針

バックエンド管理（生成・初期化・破棄・イベント配線）を `useExecutionBackend` のようなフックに分離し、`useNospaceExecution` はコマンド発行のみに集中させる。

### 2. `src/web/services/WasmExecutionBackend.ts`（313行）— 重大度: Medium

`run()` (L155-L195) と `compile()` (L247-L280) の両メソッドに、エラーハンドリングロジックが重複:

- `isNospaceErrorResult` 判定
- `formatErrorEntries` 変換
- `compileErrorsCallback` 呼び出し

#### 修正方針

エラー処理を `handleWasmError(e, sessionId)` のようなプライベートメソッドに共通化する。

### 3. `src/web/components/test-editor/CheckResultEditor.tsx`（345行）— 重大度: Medium

1ファイル内に5つのサブコンポーネント + メインコンポーネントが存在し、メインコンポーネントが以下を管理:

- JSON パース / シリアライゼーション
- スキーマ型判定
- Form / JSON モード切り替え
- バリデーション
- 5つの内部状態（`resultType`, `schema`, `editMode`, `jsonText`, `validationErrors`）

#### 修正方針

- サブコンポーネントの別ファイル分離
- JSON パース / バリデーションのユーティリティロジックをカスタムフックまたはユーティリティ関数に抽出

### 4. `src/web/containers/ExecutionContainer.tsx`（181行）— 重大度: Low

4つのオペレーションモード（Compile / Run / Run(Direct) / Test Editor）の表示分岐と入力状態管理を1コンポーネントで行っている。

#### 修正方針

各モードの JSX ブロックを `CompileTab`, `RunTab`, `RunDirectTab` 等のサブコンポーネントに切り出す。

---

## 修正計画

### Phase 1: 高優先度

1. `useNospaceExecution.ts` のバックエンド管理ロジック分離
   - `useExecutionBackend` フック新設
   - イベント配線ロジックの分離
   - テストの対応修正

### Phase 2: 中優先度

2. `WasmExecutionBackend.ts` のエラーハンドリング共通化
   - `handleWasmError` プライベートメソッド追加
   - 重複コードの統合

3. `CheckResultEditor.tsx` のコンポーネント分割
   - サブコンポーネントを `check-result-editor/` ディレクトリへ分離
   - カスタムフック `useCheckResultEditor` の抽出

### Phase 3: 低優先度

4. `ExecutionContainer.tsx` のモードごとサブコンポーネント分割
