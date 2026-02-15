import { useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import { executionOptionsAtom, compileOptionsAtom } from '../stores/optionsAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../stores/executionAtom';
import { flavorAtom } from '../stores/flavorAtom';
import type { ExecutionBackend } from '../services/ExecutionBackend';
import type { Flavor } from '../stores/flavorAtom';
// Note: ServerExecutionBackend is dynamically imported for tree-shaking
// import { WasmExecutionBackend } from '../services/WasmExecutionBackend';

/** ExecutionBackend を生成するファクトリ関数 */
export type BackendFactory = (flavor: Flavor) => Promise<ExecutionBackend>;

/** デフォルトの BackendFactory（動的インポートを使用） */
const defaultBackendFactory: BackendFactory = async (flavor: Flavor) => {
  if (flavor === 'server') {
    const { ServerExecutionBackend } = await import(
      '../services/ServerExecutionBackend'
    );
    return new ServerExecutionBackend();
  } else {
    // WASM backend
    const { WasmExecutionBackend } = await import(
      '../services/WasmExecutionBackend'
    );
    return new WasmExecutionBackend();
  }
};

export function useNospaceExecution(
  backendFactory: BackendFactory = defaultBackendFactory,
) {
  const flavor = useAtomValue(flavorAtom);
  const sourceCode = useAtomValue(sourceCodeAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const compileOptions = useAtomValue(compileOptionsAtom);
  const executionStatus = useAtomValue(executionStatusAtom);
  const setExecutionStatus = useSetAtom(executionStatusAtom);
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom);
  const setOutputEntries = useSetAtom(outputEntriesAtom);
  const setExitCode = useSetAtom(exitCodeAtom);

  const backendRef = useRef<ExecutionBackend | null>(null);

  const isRunning =
    executionStatus === 'running' || executionStatus === 'compiling';

  // Switch backend when flavor changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const backend = await backendFactory(flavor);

      if (cancelled) {
        backend.dispose();
        return;
      }

      // Setup callbacks
      backend.onOutput((entry) => {
        setOutputEntries((prev) => [...prev, entry]);
      });

      backend.onStatusChange((status, sessionId, exitCode) => {
        setExecutionStatus(status);
        setCurrentSessionId(sessionId);
        if (exitCode !== undefined) {
          setExitCode(exitCode ?? null);
        }
      });

      // Initialize
      try {
        await backend.init();
      } catch (err) {
        console.error(
          `[useNospaceExecution] Failed to initialize ${flavor} backend:`,
          err,
        );
      }

      // Dispose old backend
      backendRef.current?.dispose();
      backendRef.current = backend;
    })();

    return () => {
      cancelled = true;
      if (backendRef.current) {
        backendRef.current.dispose();
        backendRef.current = null;
      }
    };
  }, [
    flavor,
    backendFactory,
    setOutputEntries,
    setExecutionStatus,
    setCurrentSessionId,
    setExitCode,
  ]);

  const handleRun = useCallback(
    (stdinData?: string) => {
      const backend = backendRef.current;
      if (!backend || !backend.isReady() || isRunning) {
        console.warn('[useNospaceExecution] handleRun blocked:', {
          backendExists: !!backend,
          backendReady: backend?.isReady() ?? false,
          isRunning,
        });
        return;
      }

      setOutputEntries([]);

      backend.run(
        sourceCode,
        {
          language: compileOptions.language,
          debug: executionOptions.debug,
          ignoreDebug: executionOptions.ignoreDebug,
          inputMode: executionOptions.inputMode,
        },
        stdinData,
      );
    },
    [
      sourceCode,
      executionOptions,
      compileOptions,
      isRunning,
      setOutputEntries,
    ],
  );

  const handleCompile = useCallback(() => {
    const backend = backendRef.current;
    if (!backend || !backend.isReady() || isRunning) return;

    setOutputEntries([]);
    backend.compile(sourceCode, compileOptions);
  }, [sourceCode, compileOptions, isRunning, setOutputEntries]);

  const handleKill = useCallback(() => {
    backendRef.current?.kill();
  }, []);

  const handleSendStdin = useCallback((data: string) => {
    backendRef.current?.sendStdin(data);
  }, []);

  const handleClearOutput = useCallback(() => {
    setOutputEntries([]);
  }, [setOutputEntries]);

  return {
    isRunning,
    handleRun,
    handleCompile,
    handleKill,
    handleSendStdin,
    handleClearOutput,
  };
}
