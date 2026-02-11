# フロントエンド構成・コンポーネント設計

## ページ構成

シングルページアプリケーション。ルーティングは不要。

## コンポーネントツリー

```
pages/index.tsx
├── Header
└── SplitPane (左右リサイズ可能)
    ├── EditorContainer
    │   └── CodeTextarea (初期: textarea / 後期: NospaceEditor に差し替え)
    └── ExecutionContainer
        ├── CompileOptions
        ├── ExecutionOptions
        ├── ExecutionControls ([Compile] [Run] [Stop])
        ├── OutputPanel
        │   ├── stdout 表示エリア
        │   └── stderr 表示エリア（タブ or 色分け）
        └── InputPanel
            ├── InteractiveInput (1行入力 + 送信)
            └── BatchInput (テキストエリア)
```

## コンポーネント詳細

### `SplitPane`

- 左右 2 ペインレイアウト
- ドラッグでリサイズ可能
- 初期比率: 50:50
- 最小幅制限あり
- 外部ライブラリを使わず自前で実装（シンプルな実装で十分）

### `Header`

- アプリケーションタイトル（"nospace Web IDE" 等）
- 将来的に flavor 切り替え UI を配置可能

### `EditorContainer`

container 層。Jotai atom からエディタ状態（コード）を読み書きし、エディタコンポーネントに渡す。
初期は `CodeTextarea` を使用し、Phase 8 で `NospaceEditor` に差し替え。

### `CodeTextarea`（Phase 4 初期実装）

- `<textarea>` ベースのシンプルなコードエディタ
- モノスペースフォントで表示
- タブキー入力でスペース 2 文字を挿入
- 行番号表示なし（シンプルさ優先）
- 高さ: 親要素に合わせて 100%
- props: `value: string`, `onChange: (value: string) => void`

### `NospaceEditor`

- **Phase 4（初期）**: `CodeTextarea` を使用。`<textarea>` ベースのシンプルなエディタ
- **Phase 8（後期）**: `NospaceEditor` に差し替え。`react-ace` を使用した Ace Editor ラッパー
- nospace syntax highlighting モードを適用（Phase 8）
- 詳細は [02-ace-editor.md](02-ace-editor.md)

### `ExecutionContainer`

container 層。`useNospaceExecution` フックで実行状態を管理し、子コンポーネントに props を渡す。

### `CompileOptions`

| オプション | 型 | 説明 |
|-----------|-----|------|
| language | `'standard' \| 'min' \| 'ws'` | 言語サブセット |
| target | `'ws' \| 'mnemonic' \| 'ex-ws' \| 'json'` | コンパイル出力形式 |

- `<select>` で選択
- デフォルト: language=`standard`, target=`ws`

### `ExecutionOptions`

| オプション | 型 | 説明 |
|-----------|-----|------|
| debug | `boolean` | `--debug` フラグ |
| ignoreDebug | `boolean` | `--ignore-debug` フラグ |
| inputMode | `'interactive' \| 'batch'` | 標準入力モード |

- チェックボックス / ラジオボタン

### `ExecutionControls`

ボタン群:
- **Compile**: コンパイルのみ実行。コンパイル結果を OutputPanel に表示
- **Run**: コンパイル+実行。realtime で stdout を表示
- **Stop**: 実行中のプロセスを停止

状態に応じたボタンの有効/無効:
- 実行中: Compile/Run を disabled、Stop を enabled
- 停止中: Compile/Run を enabled、Stop を disabled

### `OutputPanel`

- stdout / stderr を表示
- 新しい出力が来たら自動スクロール（トグルで無効化可能）
- 出力はモノスペースフォントで表示
- クリアボタンあり

### `InputPanel`

- 2 つのモードを切り替え（詳細は [06-io-interaction.md](06-io-interaction.md)）

## Jotai Store 設計

### `editorAtom.ts`

```typescript
// エディタのソースコード
export const sourceCodeAtom = atom<string>('');
```

### `optionsAtom.ts`

```typescript
export const compileOptionsAtom = atom<CompileOptions>({
  language: 'standard',
  target: 'ws',
});

export const executionOptionsAtom = atom<ExecutionOptions>({
  debug: false,
  ignoreDebug: false,
  inputMode: 'batch',
});
```

### `executionAtom.ts`

```typescript
export type ExecutionStatus = 'idle' | 'compiling' | 'running' | 'finished' | 'error' | 'killed';

export const executionStatusAtom = atom<ExecutionStatus>('idle');
export const stdoutAtom = atom<string>('');
export const stderrAtom = atom<string>('');
export const compileResultAtom = atom<string>('');
export const exitCodeAtom = atom<number | null>(null);
```

## Flavor 抽象化

将来の WASM flavor 対応のため、実行バックエンドを抽象化する。

### `services/ExecutionBackend.ts`

```typescript
export interface ExecutionBackend {
  compile(code: string, options: CompileOptions): void;
  run(code: string, options: CompileOptions & ExecutionOptions): void;
  sendStdin(data: string): void;
  kill(): void;
  onStdout(callback: (data: string) => void): void;
  onStderr(callback: (data: string) => void): void;
  onStatusChange(callback: (status: ExecutionStatus) => void): void;
  onCompileResult(callback: (result: string) => void): void;
  dispose(): void;
}
```

### `services/ServerExecutionBackend.ts`

Socket.IO ベースの実装。`ExecutionBackend` インターフェースを実装。

## スタイル

- SCSS で記述（既存踏襲）
- `src/web/styles/` に配置
- レスポンシブ対応は最低限（デスクトップ向け前提）
