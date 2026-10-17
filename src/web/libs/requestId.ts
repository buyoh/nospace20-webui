/** 実行要求・セッションの識別子を生成する関数 */
export type RequestIdGenerator = () => string;

/** crypto.randomUUID を提供するオブジェクト（テスト時に差し替えられるよう最小限の形にする） */
export interface RandomUuidSource {
  randomUUID?: () => string;
}

/**
 * 既定の識別子生成器を作る。
 *
 * crypto.randomUUID は HTTPS / localhost 以外（secure context 外）では undefined のため、
 * 使える場合はそれを使い、使えない場合は時刻・連番・乱数による識別子にフォールバックする。
 * （以前は WASM backend が crypto.randomUUID に直接依存しており、HTTP で配信すると
 * run() / compile() が TypeError を投げて WASM 実行が一切できなくなっていた）
 *
 * @param source randomUUID の提供元。省略時は globalThis.crypto
 */
export function createDefaultRequestIdGenerator(
  source: RandomUuidSource | undefined = globalThis.crypto
): RequestIdGenerator {
  let counter = 0;
  return () => {
    if (typeof source?.randomUUID === 'function') {
      return source.randomUUID();
    }
    return `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  };
}
