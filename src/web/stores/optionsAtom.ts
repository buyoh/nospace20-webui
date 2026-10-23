import { atom } from 'jotai';
import { DEFAULT_MAX_MEMORY_CELLS } from '../libs/executionLimits';
import type {
  CompileOptions,
  ExecutionOptions,
} from '../../interfaces/NospaceTypes';

/** コンパイルオプション */
export const compileOptionsAtom = atom<CompileOptions>({
  language: 'standard',
  target: 'ws',
  stdExtensions: ['alloc'],
  optPasses: ['all'],
});

/** 実行オプション */
export const executionOptionsAtom = atom<ExecutionOptions>({
  debug: false,
  strictHeap: false,
  randomizeHeap: false,
  maxMemoryCells: DEFAULT_MAX_MEMORY_CELLS,
  inputMode: 'batch',
  stepBudget: 10000,
  maxTotalSteps: 100_000_000,
  optPasses: [],
});
