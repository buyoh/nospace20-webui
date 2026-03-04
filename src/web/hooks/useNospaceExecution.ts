import { useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import { executionOptionsAtom, compileOptionsAtom } from '../stores/optionsAtom';
import {
  executionStatusAtom,
  outputEntriesAtom,
} from '../stores/executionAtom';
import { compileOutputAtom, compileStatusAtom, type CompileStatus } from '../stores/compileOutputAtom';
import { compileErrorsAtom } from '../stores/compileErrorsAtom';
import { flavorAtom } from '../stores/flavorAtom';
import type { Flavor } from '../stores/flavorAtom';
import type { CompileOutput } from '../stores/compileOutputAtom';
import { useExecutionBackend, type BackendFactory } from './useExecutionBackend';
// Note: ServerExecutionBackend is dynamically imported for tree-shaking
// import { WasmExecutionBackend } from '../services/WasmExecutionBackend';

/** ExecutionBackend を生成するファクトリ関数（後方互換のため再エクスポート） */
export type { BackendFactory };

/** useNospaceExecution フックの返り値 */
export interface UseNospaceExecutionResult {
  /** 実行中またはコンパイル中かどうか */
  isRunning: boolean;
  /** ソースコードを実行する */
  handleRun: (stdinData?: string) => void;
  /** ソースコードをコンパイルする */
  handleCompile: () => void;
  /** コンパイル済みコードを実行する（Whitespace ターゲット時のみ） */
  handleRunCompileOutput: (compiledCode: string, stdinData?: string) => void;
  /** 実行中のプロセスを停止する */
  handleKill: () => void;
  /** 標準入力にデータを送信する */
  handleSendStdin: (data: string) => void;
  /** 出力をクリアする */
  handleClearOutput: () => void;
  /** コンパイル結果 */
  compileOutput: CompileOutput | null;
  /** 直前のコンパイル結果ステータス */
  compileStatus: CompileStatus;
}

/** デフォルトの BackendFactory（動的インポートを使用） */
const defaultBackendFactory: BackendFactory = async (flavor: Flavor) => {
  if (flavor === 'websocket') {
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
): UseNospaceExecutionResult {
  const flavor = useAtomValue(flavorAtom);
  const sourceCode = useAtomValue(sourceCodeAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const compileOptions = useAtomValue(compileOptionsAtom);
  const executionStatus = useAtomValue(executionStatusAtom);
  const setOutputEntries = useSetAtom(outputEntriesAtom);
  const setExecutionOptions = useSetAtom(executionOptionsAtom);
  const compileOutput = useAtomValue(compileOutputAtom);
  const setCompileOutput = useSetAtom(compileOutputAtom);
  const setCompileErrors = useSetAtom(compileErrorsAtom);
  const compileStatus = useAtomValue(compileStatusAtom);
  const setCompileStatus = useSetAtom(compileStatusAtom);

  // バックエンドのライフサイクル管理とイベント配線は useExecutionBackend に委譲
  const { backendRef, compileTargetRef, compileHadErrorRef, prevStatusRef } =
    useExecutionBackend(flavor, backendFactory);

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
      setCompileErrors([]);

      backend.run(
        sourceCode,
        {
          language: compileOptions.language,
          debug: executionOptions.debug,
          ignoreDebug: executionOptions.ignoreDebug,
          inputMode: executionOptions.inputMode,
          stepBudget: executionOptions.stepBudget,
          maxTotalSteps: executionOptions.maxTotalSteps,
          optPasses: executionOptions.optPasses,
          stdExtensions: compileOptions.stdExtensions,
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
      setCompileErrors,
    ],
  );

  const handleCompile = useCallback(() => {
    const backend = backendRef.current;
    if (!backend || !backend.isReady() || isRunning) return;

    compileTargetRef.current = compileOptions.target;
    compileHadErrorRef.current = false;
    prevStatusRef.current = 'compiling';
    setCompileOutput(null);
    setCompileErrors([]);
    setCompileStatus(null);
    setOutputEntries([]);
    backend.compile(sourceCode, compileOptions);
  }, [sourceCode, compileOptions, isRunning, setOutputEntries, setCompileOutput, setCompileErrors, setCompileStatus]);

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
          stepBudget: executionOptions.stepBudget,
          maxTotalSteps: executionOptions.maxTotalSteps,
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
    compileStatus,
  };
}
