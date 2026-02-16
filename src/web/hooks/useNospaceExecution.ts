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
import { compileOutputAtom } from '../stores/compileOutputAtom';
import { flavorAtom } from '../stores/flavorAtom';
import type { ExecutionBackend } from '../services/ExecutionBackend';
import type { Flavor } from '../stores/flavorAtom';
import type { CompileTarget } from '../../interfaces/NospaceTypes';
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
  const setExecutionOptions = useSetAtom(executionOptionsAtom);
  const compileOutput = useAtomValue(compileOutputAtom);
  const setCompileOutput = useSetAtom(compileOutputAtom);

  const backendRef = useRef<ExecutionBackend | null>(null);
  /** コンパイル中のターゲット。null 以外の場合、stdout を compileOutputAtom にルーティングする */
  const compileTargetRef = useRef<CompileTarget | null>(null);

  const isRunning =
    executionStatus === 'running' || executionStatus === 'compiling';

  // Flavor 切り替え時にオプションを自動リセット
  useEffect(() => {
    if (flavor === 'wasm') {
      // WASM 非対応のオプションをリセット
      setExecutionOptions((prev) => ({
        ...prev,
        inputMode: 'batch',
        ignoreDebug: false,
      }));
    }
  }, [flavor, setExecutionOptions]);

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
      // コンパイル中は stdout を compileOutputAtom にルーティングし、
      // それ以外は outputEntriesAtom に送る
      backend.onOutput((entry) => {
        if (compileTargetRef.current !== null && entry.type === 'stdout') {
          setCompileOutput((prev) => ({
            output: (prev?.output ?? '') + entry.data,
            target: compileTargetRef.current!,
          }));
        } else {
          setOutputEntries((prev) => [...prev, entry]);
        }
      });

      backend.onStatusChange((status, sessionId, exitCode) => {
        // コンパイル完了後に compileTargetRef をリセット
        if (status !== 'compiling') {
          compileTargetRef.current = null;
        }
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
    setCompileOutput,
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

    compileTargetRef.current = compileOptions.target;
    setCompileOutput(null);
    setOutputEntries([]);
    backend.compile(sourceCode, compileOptions);
  }, [sourceCode, compileOptions, isRunning, setOutputEntries, setCompileOutput]);

  /** コンパイル済みコードを実行する（Whitespace ターゲット時のみ） */
  const handleRunCompileOutput = useCallback(
    (compiledCode: string, stdinData?: string) => {
      const backend = backendRef.current;
      if (!backend || !backend.isReady() || isRunning) return;

      compileTargetRef.current = null;
      setOutputEntries([]);
      backend.run(
        compiledCode,
        {
          language: 'ws',
          debug: executionOptions.debug,
          ignoreDebug: false,
          inputMode: 'batch',
        },
        stdinData,
      );
    },
    [executionOptions, isRunning, setOutputEntries],
  );

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
    handleRunCompileOutput,
    handleKill,
    handleSendStdin,
    handleClearOutput,
    compileOutput,
  };
}
