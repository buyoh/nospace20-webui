# テスト失敗調査: Language オプション変更テスト

## 失敗テスト

- ファイル: `src/tests/web/CompileOptions.spec.tsx`
- テスト名: `Language を変更できる`

## 失敗内容

```
Expected: "min"
Received: "standard"
```

## 原因

`FALLBACK_LANGUAGE_OPTIONS` を `['standard']` のみに変更したことで、`CompileOptions` のデフォルト（props なし）の Language セレクターに `min` が含まれなくなった。

`<select>` に存在しない value (`min`) を `fireEvent.change` で設定しようとしても、ブラウザの挙動上は先頭 option (`standard`) に戻ってしまう。

## 修正方法

テストを `'standard'` に変更するのが適切：

```diff
-    fireEvent.change(languageSelect, { target: { value: 'min' } });
-    expect(languageSelect.value).toBe('min');
+    fireEvent.change(languageSelect, { target: { value: 'standard' } });
+    expect(languageSelect.value).toBe('standard');
```

あるいは、このテストには言語選択肢を props で注入してテストするよう変更する。
