import { useAtomValue, useSetAtom } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import { executionOptionsAtom } from '../stores/optionsAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
} from '../stores/executionAtom';
import { useNospaceSocket } from './useNospaceSocket';
import type { RunOptions } from '../../interfaces/NospaceTypes';

export function useNospaceExecution() {
  const socket = useNospaceSocket();
  const sourceCode = useAtomValue(sourceCodeAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const executionStatus = useAtomValue(executionStatusAtom);
  const currentSessionId = useAtomValue(currentSessionIdAtom);
  const setOutputEntries = useSetAtom(outputEntriesAtom);

  const isRunning = executionStatus === 'running';

  const handleRun = (stdinData?: string) => {
    if (!socket || isRunning) return;

    // Clear output
    setOutputEntries([]);

    // Create run options
    const runOptions: RunOptions = {
      language: 'standard', // Default for now
      debug: executionOptions.debug,
      ignoreDebug: executionOptions.ignoreDebug,
      inputMode: executionOptions.inputMode,
    };

    // Send run request
    socket.emit('nospace_run', {
      code: sourceCode,
      options: runOptions,
      stdinData:
        executionOptions.inputMode === 'batch' ? stdinData : undefined,
    });
  };

  const handleKill = () => {
    if (!socket || !currentSessionId || !isRunning) return;

    socket.emit('nospace_kill', { sessionId: currentSessionId });
  };

  const handleSendStdin = (data: string) => {
    if (!socket || !currentSessionId || !isRunning) return;

    socket.emit('nospace_stdin', { sessionId: currentSessionId, data });
  };

  const handleClearOutput = () => {
    setOutputEntries([]);
  };

  return {
    isRunning,
    handleRun,
    handleKill,
    handleSendStdin,
    handleClearOutput,
  };
}
