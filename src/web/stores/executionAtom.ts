import { atom } from 'jotai';
import type {
  ExecutionStatus,
  OutputEntry,
} from '../../interfaces/NospaceTypes';

export const executionStatusAtom = atom<ExecutionStatus>('idle');
export const currentSessionIdAtom = atom<string | null>(null);
export const outputEntriesAtom = atom<OutputEntry[]>([]);
export const exitCodeAtom = atom<number | null>(null);
