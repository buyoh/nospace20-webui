import { atom } from 'jotai';
import type {
  CompileOptions,
  ExecutionOptions,
} from '../../interfaces/NospaceTypes';

export const compileOptionsAtom = atom<CompileOptions>({
  language: 'standard',
  target: 'ws',
});

export const executionOptionsAtom = atom<ExecutionOptions>({
  debug: false,
  ignoreDebug: false,
  inputMode: 'batch',
});
