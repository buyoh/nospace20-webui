import type {
  CompileOptions,
  CompileTarget,
  InputMode,
  LanguageSubset,
  RunOptions,
} from '../../interfaces/NospaceTypes';

/** 検証結果。失敗時は、通知先を特定できる場合のみ requestId を持つ */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; requestId: string | null; message: string };

/** 検証済みの実行要求 */
export interface RunRequest {
  requestId: string;
  code: string;
  options: RunOptions;
  stdinData?: string;
}

/** 検証済みのコンパイル要求 */
export interface CompileRequest {
  requestId: string;
  code: string;
  options: CompileOptions;
}

/** 検証済みの stdin 送信要求 */
export interface StdinRequest {
  sessionId: string;
  data: string;
}

/** 検証済みの kill 要求 */
export interface KillRequest {
  sessionId: string;
}

/** requestId / sessionId として受け付ける最大文字数 */
const MAX_ID_LENGTH = 64;
/** 拡張・最適化パスのリストとして受け付ける最大件数 */
const MAX_LIST_LENGTH = 16;
/**
 * 拡張・最適化パスの名前として受け付ける形式。
 * 利用可能な名前は nospace20 の版に依存するため固定の許可リストにはせず（未知の名前は CLI がエラーにする）、
 * CLI の引数として渡される値がオプションとして解釈されない形式（先頭が英数字・アンダースコア）に限定する。
 */
const NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,31}$/;

const LANGUAGES: readonly LanguageSubset[] = ['standard', 'min', 'ws'];
const TARGETS: readonly CompileTarget[] = ['ws', 'mnemonic', 'ex-ws', 'json'];
const INPUT_MODES: readonly InputMode[] = ['interactive', 'batch'];

/** whitespace20 の --max-memory-cells が受け付ける最大値（u32）。0 は無制限 */
const MAX_MEMORY_CELLS = 4_294_967_295;

function isMemoryCellLimit(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_MEMORY_CELLS
  );
}

type Fail = { ok: false; requestId: string | null; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return (
    typeof value === 'string' && (allowed as readonly string[]).includes(value)
  );
}

/** 名前のリストを検証する。未指定は空配列。不正な要素があれば null */
function parseNameList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_LIST_LENGTH) return null;
  if (!value.every((v) => typeof v === 'string' && NAME_PATTERN.test(v))) {
    return null;
  }
  return value as string[];
}

/**
 * Socket.IO で受信した payload を、実行時に検証・正規化する。
 *
 * TypeScript の型は実行時に保証されないため、信頼境界であるここで形式・値域を検証する
 * （payload の欠落・型違い・CLI 引数として解釈されうる値などを、プロセスを起動する前に拒否する）。
 * 検証を通った値だけを新しいオブジェクトに詰め替えて返し、想定外のフィールドは取り除く。
 */
export const RequestValidator = {
  parseRun(payload: unknown): ValidationResult<RunRequest> {
    const common = parseCommon(payload, 'run');
    if (!common.ok) return common;
    const { requestId, code, options } = common.value;

    if (!oneOf(options.language, LANGUAGES)) {
      return fail(
        requestId,
        `language must be one of ${LANGUAGES.join(', ')}`,
        'run'
      );
    }
    if (!oneOf(options.inputMode, INPUT_MODES)) {
      return fail(
        requestId,
        `inputMode must be one of ${INPUT_MODES.join(', ')}`,
        'run'
      );
    }
    const stdExtensions = parseNameList(options.stdExtensions);
    if (!stdExtensions) {
      return fail(requestId, 'stdExtensions must be a list of names', 'run');
    }
    const optPasses = parseNameList(options.optPasses);
    if (!optPasses) {
      return fail(requestId, 'optPasses must be a list of names', 'run');
    }
    const maxMemoryCells = options.maxMemoryCells;
    if (maxMemoryCells !== undefined && !isMemoryCellLimit(maxMemoryCells)) {
      return fail(
        requestId,
        `maxMemoryCells must be an integer between 0 and ${MAX_MEMORY_CELLS}`,
        'run'
      );
    }
    const stdinData = (payload as Record<string, unknown>).stdinData;
    if (stdinData !== undefined && typeof stdinData !== 'string') {
      return fail(requestId, 'stdinData must be a string', 'run');
    }

    return {
      ok: true,
      value: {
        requestId,
        code,
        options: {
          language: options.language,
          debug: options.debug === true,
          strictHeap: options.strictHeap === true,
          randomizeHeap: options.randomizeHeap === true,
          ...(maxMemoryCells !== undefined && { maxMemoryCells }),
          inputMode: options.inputMode,
          stdExtensions,
          optPasses,
        },
        stdinData,
      },
    };
  },

  parseCompile(payload: unknown): ValidationResult<CompileRequest> {
    const common = parseCommon(payload, 'compile');
    if (!common.ok) return common;
    const { requestId, code, options } = common.value;

    if (!oneOf(options.language, LANGUAGES)) {
      return fail(
        requestId,
        `language must be one of ${LANGUAGES.join(', ')}`,
        'compile'
      );
    }
    if (!oneOf(options.target, TARGETS)) {
      return fail(
        requestId,
        `target must be one of ${TARGETS.join(', ')}`,
        'compile'
      );
    }
    const stdExtensions = parseNameList(options.stdExtensions);
    if (!stdExtensions) {
      return fail(
        requestId,
        'stdExtensions must be a list of names',
        'compile'
      );
    }
    const optPasses = parseNameList(options.optPasses);
    if (!optPasses) {
      return fail(requestId, 'optPasses must be a list of names', 'compile');
    }

    return {
      ok: true,
      value: {
        requestId,
        code,
        options: {
          language: options.language,
          target: options.target,
          stdExtensions,
          optPasses,
        },
      },
    };
  },

  parseStdin(payload: unknown): ValidationResult<StdinRequest> {
    if (!isRecord(payload))
      return fail(null, 'payload must be an object', 'stdin');
    const { sessionId, data } = payload;
    if (!isId(sessionId) || typeof data !== 'string') {
      return fail(null, 'sessionId and data are required', 'stdin');
    }
    return { ok: true, value: { sessionId, data } };
  },

  parseKill(payload: unknown): ValidationResult<KillRequest> {
    if (!isRecord(payload))
      return fail(null, 'payload must be an object', 'kill');
    if (!isId(payload.sessionId)) {
      return fail(null, 'sessionId is required', 'kill');
    }
    return { ok: true, value: { sessionId: payload.sessionId } };
  },
};

/** requestId を取り出す。通知先として使えない場合は null */
export function readRequestId(payload: unknown): string | null {
  return isRecord(payload) && isId(payload.requestId)
    ? payload.requestId
    : null;
}

function fail(requestId: string | null, message: string, kind: string): Fail {
  return {
    ok: false,
    requestId,
    message: `Invalid ${kind} request: ${message}`,
  };
}

/** run / compile 共通部分（requestId・code・options がオブジェクト）の検証 */
function parseCommon(
  payload: unknown,
  kind: string
):
  | {
      ok: true;
      value: {
        requestId: string;
        code: string;
        options: Record<string, unknown>;
      };
    }
  | Fail {
  const requestId = readRequestId(payload);
  // requestId が無ければ通知先がないため、無視する（requestId: null）
  if (!requestId) return fail(null, 'requestId is required', kind);
  const { code, options } = payload as Record<string, unknown>;
  if (typeof code !== 'string')
    return fail(requestId, 'code must be a string', kind);
  if (!isRecord(options))
    return fail(requestId, 'options must be an object', kind);
  return { ok: true, value: { requestId, code, options } };
}
