import {
  clampStepBudget,
  clampMaxTotalSteps,
  DEFAULT_STEP_BUDGET,
  MIN_STEP_BUDGET,
  MAX_STEP_BUDGET,
  DEFAULT_MAX_TOTAL_STEPS,
  MIN_MAX_TOTAL_STEPS,
  MAX_MAX_TOTAL_STEPS,
} from '../../../web/libs/executionLimits';

describe('clampStepBudget', () => {
  it('範囲内の値はそのまま返し、小数は切り捨てる', () => {
    expect(clampStepBudget(5000)).toBe(5000);
    expect(clampStepBudget(5000.9)).toBe(5000);
  });

  it('BUG: 0・負数は下限に、巨大値は上限に収める（タブのフリーズ・CPU 占有の防止）', () => {
    expect(clampStepBudget(0)).toBe(MIN_STEP_BUDGET);
    expect(clampStepBudget(-5)).toBe(MIN_STEP_BUDGET);
    expect(clampStepBudget(1e12)).toBe(MAX_STEP_BUDGET);
  });

  it('未指定・NaN・Infinity・数値以外は既定値にする', () => {
    expect(clampStepBudget(undefined)).toBe(DEFAULT_STEP_BUDGET);
    expect(clampStepBudget(NaN)).toBe(DEFAULT_STEP_BUDGET);
    expect(clampStepBudget(Infinity)).toBe(DEFAULT_STEP_BUDGET);
    expect(clampStepBudget('100')).toBe(DEFAULT_STEP_BUDGET);
  });
});

describe('clampMaxTotalSteps', () => {
  it('範囲内の値はそのまま返す', () => {
    expect(clampMaxTotalSteps(1_000_000)).toBe(1_000_000);
  });

  it('範囲外は上下限に収め、不正値は既定値にする', () => {
    expect(clampMaxTotalSteps(0)).toBe(MIN_MAX_TOTAL_STEPS);
    expect(clampMaxTotalSteps(1e15)).toBe(MAX_MAX_TOTAL_STEPS);
    expect(clampMaxTotalSteps(undefined)).toBe(DEFAULT_MAX_TOTAL_STEPS);
    expect(clampMaxTotalSteps(NaN)).toBe(DEFAULT_MAX_TOTAL_STEPS);
  });
});
