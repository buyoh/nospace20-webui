import { atom } from 'jotai';
import type {
  CompileOptions,
  ExecutionOptions,
} from '../../interfaces/NospaceTypes';

/** コンパイルオプション */
export const compileOptionsAtom = atom<CompileOptions>({
  language: 'standard',
  target: 'ws',
  stdExtensions: [],
  optPasses: [],
});

/** 実行オプション */
export const executionOptionsAtom = atom<ExecutionOptions>({
  debug: false,
  ignoreDebug: false,
  inputMode: 'batch',
  stepBudget: 10000,
  maxTotalSteps: 100_000_000,
  optPasses: [],
});
