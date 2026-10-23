import { useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import {
  executionOptionsAtom,
  compileOptionsAtom,
} from '../stores/optionsAtom';
import {
  executionStatusAtom,
  outputEntriesAtom,
  backendStateAtom,
  type BackendState,
} from '../stores/executionAtom';
import { appendOutputEntry } from '../libs/outputBuffer';
import {
  compileOutputAtom,
  compileStatusAtom,
  type CompileStatus,
} from '../stores/compileOutputAtom';
import { compileErrorsAtom } from '../stores/compileErrorsAtom';
import { flavorAtom } from '../stores/flavorAtom';
import type { Flavor } from '../stores/flavorAtom';
import type { CompileOutput } from '../stores/compileOutputAtom';
import {
  useExecutionBackend,
  type BackendFactory,
} from './useExecutionBackend';
// Note: ServerExecutionBackend is dynamically imported for tree-shaking
// import { WasmExecutionBackend } from '../services/WasmExecutionBackend';

/** ExecutionBackend を生成するファクトリ関数（後方互換のため再エクスポート） */
export type { BackendFactory };

/** useNospaceExecution フックの返り値 */
export interface UseNospaceExecutionResult {
  /** 実行中またはコンパイル中かどうか */
  isRunning: boolean;
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
  /** 実行バックエンドの状態（初期化中・準備完了・切断・失敗） */
  backendState: BackendState;
  /** バックエンドの再生成・再初期化を行う（初期化失敗時の再試行用） */
  retryBackend: () => void;
}

/** デフォルトの BackendFactory（動的インポートを使用） */
const defaultBackendFactory: BackendFactory = async (flavor: Flavor) => {
  if (flavor === 'websocket') {
    const { ServerExecutionBackend } =
      await import('../services/ServerExecutionBackend');
    return new ServerExecutionBackend();
  } else {
    // WASM backend
    const { WasmExecutionBackend } =
      await import('../services/WasmExecutionBackend');
    return new WasmExecutionBackend();
  }
};

export function useNospaceExecution(
  backendFactory: BackendFactory = defaultBackendFactory
): UseNospaceExecutionResult {
  const flavor = useAtomValue(flavorAtom);
  const sourceCode = useAtomValue(sourceCodeAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const compileOptions = useAtomValue(compileOptionsAtom);
  const executionStatus = useAtomValue(executionStatusAtom);
  const setExecutionStatus = useSetAtom(executionStatusAtom);
  const backendState = useAtomValue(backendStateAtom);
  const setOutputEntries = useSetAtom(outputEntriesAtom);
  const setExecutionOptions = useSetAtom(executionOptionsAtom);
  const compileOutput = useAtomValue(compileOutputAtom);
  const setCompileOutput = useSetAtom(compileOutputAtom);
  const setCompileErrors = useSetAtom(compileErrorsAtom);
  const compileStatus = useAtomValue(compileStatusAtom);
  const setCompileStatus = useSetAtom(compileStatusAtom);

  // バックエンドのライフサイクル管理とイベント配線は useExecutionBackend に委譲
  const {
    backendRef,
    compileTargetRef,
    compileHadErrorRef,
    prevStatusRef,
    retry: retryBackend,
  } = useExecutionBackend(flavor, backendFactory);

  const isRunning =
    executionStatus === 'running' || executionStatus === 'compiling';
  const backendReady = backendState.kind === 'ready';

  /**
   * 実行・コンパイルの開始に失敗した（未接続などで backend が同期的に例外を投げた）ときに、
   * 楽観的に設定した running / compiling のまま固着しないよう error に戻して理由を表示する。
   */
  const handleStartFailure = useCallback(
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      compileTargetRef.current = null;
      prevStatusRef.current = null;
      setExecutionStatus('error');
      setOutputEntries((prev) =>
        appendOutputEntry(prev, {
          type: 'system',
          data: `\n[Failed to start: ${message}]\n`,
          timestamp: Date.now(),
        })
      );
    },
    [setExecutionStatus, setOutputEntries]
  );

  // Flavor 切り替え時にオプションを自動リセット
  useEffect(() => {
    if (flavor === 'wasm') {
      // WASM 非対応のオプションをリセット
      setExecutionOptions((prev) => ({
        ...prev,
        inputMode: 'batch',
      }));
    }
  }, [flavor, setExecutionOptions]);

  const handleCompile = useCallback(() => {
    const backend = backendRef.current;
    if (!backend || !backend.isReady() || !backendReady || isRunning) return;

    compileTargetRef.current = compileOptions.target;
    compileHadErrorRef.current = false;
    prevStatusRef.current = 'compiling';
    setCompileOutput(null);
    setCompileErrors([]);
    setCompileStatus(null);
    setOutputEntries([]);
    setExecutionStatus('compiling');
    try {
      backend.compile(sourceCode, compileOptions);
    } catch (err) {
      setCompileStatus('error');
      handleStartFailure(err);
    }
  }, [
    sourceCode,
    compileOptions,
    isRunning,
    backendReady,
    setOutputEntries,
    setCompileOutput,
    setCompileErrors,
    setCompileStatus,
    setExecutionStatus,
    handleStartFailure,
  ]);

  /** コンパイル済みコードを実行する（Whitespace ターゲット時のみ） */
  const handleRunCompileOutput = useCallback(
    (compiledCode: string, stdinData?: string) => {
      const backend = backendRef.current;
      if (!backend || !backend.isReady() || !backendReady || isRunning) return;

      compileTargetRef.current = null;
      setOutputEntries([]);
      setExecutionStatus('running');
      try {
        backend.run(
          compiledCode,
          {
            language: 'ws',
            debug: executionOptions.debug,
            strictHeap: executionOptions.strictHeap,
            randomizeHeap: executionOptions.randomizeHeap,
            maxMemoryCells: executionOptions.maxMemoryCells,
            inputMode: 'batch',
            stepBudget: executionOptions.stepBudget,
            maxTotalSteps: executionOptions.maxTotalSteps,
            // VM の debug 拡張はコンパイル時の --std-ext と揃える（揃わないと __assert / __trace が無効になる）
            stdExtensions: compileOptions.stdExtensions,
          },
          stdinData
        );
      } catch (err) {
        handleStartFailure(err);
      }
    },
    [
      executionOptions,
      compileOptions.stdExtensions,
      isRunning,
      backendReady,
      setOutputEntries,
      setExecutionStatus,
      handleStartFailure,
    ]
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
    handleCompile,
    handleRunCompileOutput,
    handleKill,
    handleSendStdin,
    handleClearOutput,
    compileOutput,
    compileStatus,
    backendState,
    retryBackend,
  };
}
