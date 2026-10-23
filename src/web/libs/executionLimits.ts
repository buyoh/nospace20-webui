/** WASM 実行の 1 回の step() で実行する命令数の既定値と許容範囲 */
export const DEFAULT_STEP_BUDGET = 10_000;
export const MIN_STEP_BUDGET = 100;
export const MAX_STEP_BUDGET = 1_000_000;

/** WASM 実行の最大総ステップ数の既定値と許容範囲 */
export const DEFAULT_MAX_TOTAL_STEPS = 100_000_000;
export const MIN_MAX_TOTAL_STEPS = 1_000;
export const MAX_MAX_TOTAL_STEPS = 10_000_000_000;

/**
 * 数値を [min, max] に収める。未指定・NaN・Infinity・数値でない値は既定値にする。
 *
 * BUG FIX: UI の number 入力は min / max 属性を手入力値に強制しないため、空欄（0）・負数・巨大値が
 * そのまま WASM の step() に渡っていた。巨大値では 1 回の step() が戻らずタブがフリーズして
 * Stop も効かず、0 では step(0) を永久に繰り返して CPU を消費し続けていた。
 * 解決策として、実行開始時（backend）に必ず許容範囲へ収める。
 */
export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** stepBudget を許容範囲に収める */
export function clampStepBudget(value: unknown): number {
  return clampNumber(
    value,
    MIN_STEP_BUDGET,
    MAX_STEP_BUDGET,
    DEFAULT_STEP_BUDGET
  );
}

/** maxTotalSteps を許容範囲に収める */
export function clampMaxTotalSteps(value: unknown): number {
  return clampNumber(
    value,
    MIN_MAX_TOTAL_STEPS,
    MAX_MAX_TOTAL_STEPS,
    DEFAULT_MAX_TOTAL_STEPS
  );
}

/**
 * VM のメモリ上限（セル数）の許容範囲。0 は無制限。
 * 上限は WASM の max_memory_cells が受け付ける最大値（u32）。
 * これを超える値・負数・小数は WASM のコンストラクタがエラーにするため、実行開始時に必ず収める。
 */
export const DEFAULT_MAX_MEMORY_CELLS = 4_194_304;
export const MAX_MEMORY_CELLS = 4_294_967_295;

/** maxMemoryCells を許容範囲に収める。未指定・不正な値は既定値にする */
export function clampMaxMemoryCells(value: unknown): number {
  return clampNumber(value, 0, MAX_MEMORY_CELLS, DEFAULT_MAX_MEMORY_CELLS);
}
