# npm run build 失敗の修正: ace-builds / react-ace 依存不足

## 問題

`npm run build`（`vite build`）が以下のエラーで失敗する：

```
error during build:
[vite]: Rollup failed to resolve import "react-ace" from
  "src/web/components/editor/NospaceEditor.tsx".
```

## 原因

Phase 7-8 の実装で Ace Editor を導入した際、ソースコードに `react-ace` と `ace-builds` の import が追加されたが、`package.json` の `dependencies` にこれらのパッケージが追加されなかった。

### 影響ファイル

| ファイル | import |
|---|---|
| `src/web/components/editor/NospaceEditor.tsx` | `react-ace`, `ace-builds/src-noconflict/theme-monokai` |
| `src/web/components/editor/nospace-ace-mode.ts` | `ace-builds` |

### 依存先

- `src/web/containers/EditorContainer.tsx` → `NospaceEditor` を使用

## 修正方針

`package.json` の `dependencies` に以下を追加し、`npm install` を実行する：

- `ace-builds`
- `react-ace`

### 理由

- これらはランタイムで必要なパッケージであるため `dependencies`（`devDependencies` ではない）に含める
- `ai-docs/done-tasks/nospace-webui-phase7-8-implementation.md` にも `npm install ace-builds react-ace` の記載がある

## 作業手順

1. `package.json` の `dependencies` に `ace-builds` と `react-ace` を追加
2. `npm install` を実行
3. `npm run build` で成功を確認
4. 修正したファイルをコミット
