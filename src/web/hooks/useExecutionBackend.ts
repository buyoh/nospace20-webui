// バックエンドのライフサイクル管理 + イベント配線フック

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
  backendStateAtom,
} from '../stores/executionAtom';
import {
  compileOutputAtom,
  compileStatusAtom,
} from '../stores/compileOutputAtom';
import { compileErrorsAtom } from '../stores/compileErrorsAtom';
import type { ExecutionBackend } from '../services/ExecutionBackend';
import type { Flavor } from '../stores/flavorAtom';
import type { CompileTarget } from '../../interfaces/NospaceTypes';
import {
  appendOutputEntry,
  DEFAULT_OUTPUT_LIMITS,
  type OutputLimits,
} from '../libs/outputBuffer';

/** ExecutionBackend を生成するファクトリ関数 */
export type BackendFactory = (flavor: Flavor) => Promise<ExecutionBackend>;

/** useExecutionBackend フックの返り値 */
export interface UseExecutionBackendResult {
  /** 現在アクティブなバックエンドへの参照 */
  backendRef: React.MutableRefObject<ExecutionBackend | null>;
  /**
   * コンパイル中のターゲット。
   * null 以外の場合、stdout を compileOutputAtom にルーティングする。
   * handleCompile から書き込まれる。
   */
  compileTargetRef: React.MutableRefObject<CompileTarget | null>;
  /**
   * コンパイル中にエラーが発生したかどうかを追跡する。
   * handleCompile から false にリセットされ、onCompileErrors から true に設定される。
   */
  compileHadErrorRef: React.MutableRefObject<boolean>;
  /**
   * 直前の executionStatus を追跡する（コンパイル完了検出用）。
   * handleCompile から 'compiling' に設定される。
   */
  prevStatusRef: React.MutableRefObject<string | null>;
  /** バックエンドを破棄して再生成・再初期化する（初期化失敗時の再試行用） */
  retry: () => void;
}

/** unknown なエラーを表示用メッセージにする */
function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Failed to initialize the execution backend';
}

/**
 * バックエンドのライフサイクル管理とイベント配線を担うフック。
 * Flavor が変わると古いバックエンドを dispose し、新しいバックエンドを生成・初期化する。
 * onOutput / onStatusChange / onCompileErrors コールバックを設定し、各 atom に反映する。
 * 初期化の進行状況・失敗・切断は backendStateAtom に反映する。
 *
 * @param outputLimits 出力パネルが保持する量の上限（省略時は既定値）
 */
export function useExecutionBackend(
  flavor: Flavor,
  backendFactory: BackendFactory,
  outputLimits: OutputLimits = DEFAULT_OUTPUT_LIMITS
): UseExecutionBackendResult {
  const setOutputEntries = useSetAtom(outputEntriesAtom);
  const setCompileOutput = useSetAtom(compileOutputAtom);
  const setCompileErrors = useSetAtom(compileErrorsAtom);
  const setCompileStatus = useSetAtom(compileStatusAtom);
  const setExecutionStatus = useSetAtom(executionStatusAtom);
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom);
  const setExitCode = useSetAtom(exitCodeAtom);
  const setBackendState = useSetAtom(backendStateAtom);

  const backendRef = useRef<ExecutionBackend | null>(null);
  /** コンパイル中のターゲット。null 以外の場合、stdout を compileOutputAtom にルーティングする */
  const compileTargetRef = useRef<CompileTarget | null>(null);
  /** コンパイル中にエラーが発生したかどうかを追跡する */
  const compileHadErrorRef = useRef(false);
  /** 直前の executionStatus を追跡する（コンパイル完了検出用） */
  const prevStatusRef = useRef<string | null>(null);
  /** 出力の保持上限（effect の再実行を避けるため ref で参照する） */
  const outputLimitsRef = useRef(outputLimits);
  outputLimitsRef.current = outputLimits;

  /** 直前の effect で使った flavor。初回マウントと flavor 変更を区別する */
  const lastFlavorRef = useRef<Flavor | null>(null);

  // 再試行のたびに増やし、effect を再実行してバックエンドを再生成する
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((n) => n + 1), []);

  // Flavor 変更時にバックエンドを再生成し、イベント配線を設定する
  useEffect(() => {
    // BUG FIX: 以前は `await backend.init()` の後に cancelled を確認せず、
    // backendRef.current を無条件に上書きしていた。接続に時間がかかる websocket の init が
    // 後から完了すると、すでに wasm へ戻していても websocket の backend が採用され、
    // 表示は WASM なのに実行はサーバへ飛ぶ状態になっていた（アンマウント後の完了ではリークも発生）。
    // 解決策として、この effect が所有する backend をローカル変数で保持し、
    // 各 await の後で cancelled を確認する。cleanup もこのローカル変数だけを dispose する。
    let cancelled = false;
    // dispose 済みの backend が遅れて呼ぶコールバックを atom に反映しないためのフラグ
    let disposed = false;
    let backend: ExecutionBackend | null = null;
    const isStale = () => cancelled || disposed;

    // flavor 切り替え時に旧 backend の実行状態・コンパイル追跡状態を引き継がない。
    // 初回マウントと再試行（flavor 不変）では、既存の状態を維持する
    if (lastFlavorRef.current !== null && lastFlavorRef.current !== flavor) {
      setExecutionStatus('idle');
      setCurrentSessionId(null);
      setCompileStatus(null);
      compileTargetRef.current = null;
      compileHadErrorRef.current = false;
      prevStatusRef.current = null;
    }
    lastFlavorRef.current = flavor;
    setBackendState({ kind: 'initializing' });

    (async () => {
      try {
        const created = await backendFactory(flavor);
        if (cancelled) {
          created.dispose();
          return;
        }
        backend = created;

        // コンパイル中は stdout を compileOutputAtom にルーティングし、
        // それ以外は outputEntriesAtom に送る
        backend.onOutput((entry) => {
          if (isStale()) return;
          if (compileTargetRef.current !== null && entry.type === 'stdout') {
            setCompileOutput((prev) => ({
              output: (prev?.output ?? '') + entry.data,
              target: compileTargetRef.current!,
            }));
          } else {
            setOutputEntries((prev) =>
              appendOutputEntry(prev, entry, outputLimitsRef.current)
            );
          }
        });

        backend.onStatusChange((status, sessionId, exitCode) => {
          if (isStale()) return;
          // コンパイル完了後に compileTargetRef をリセット
          if (status !== 'compiling') {
            compileTargetRef.current = null;
            // compiling → 非compiling の遷移を検出してコンパイルステータスを確定する。
            // 構造化エラーがなくても、error / killed（切断・サーバエラー等）で終わった場合は失敗とする
            if (prevStatusRef.current === 'compiling') {
              const failed =
                compileHadErrorRef.current ||
                status === 'error' ||
                status === 'killed';
              setCompileStatus(failed ? 'error' : 'success');
            }
          }
          prevStatusRef.current = status;
          setExecutionStatus(status);
          setCurrentSessionId(sessionId);
          if (exitCode !== undefined) {
            setExitCode(exitCode ?? null);
          }
        });

        backend.onCompileErrors((errors) => {
          if (isStale()) return;
          setCompileErrors(errors);
          if (errors.length > 0) {
            // エラー発生を記録（コンパイル完了時にステータスを 'error' に設定するため）
            compileHadErrorRef.current = true;
          }
        });

        backend.onConnectionChange?.((state) => {
          if (isStale()) return;
          if (state === 'connected') {
            setBackendState({ kind: 'ready' });
          } else if (state === 'reconnecting') {
            setBackendState({ kind: 'disconnected' });
          } else {
            setBackendState({
              kind: 'error',
              message: 'Disconnected by server',
            });
          }
        });

        // バックエンドを初期化
        await backend.init();
        if (cancelled) return; // dispose は cleanup が行う

        backendRef.current = backend;
        setBackendState({ kind: 'ready' });
      } catch (err) {
        if (cancelled) return;
        console.error(
          `[useExecutionBackend] Failed to initialize ${flavor} backend:`,
          err
        );
        // 準備できていない backend は採用せず、失敗を UI に伝えて再試行できるようにする
        disposed = true;
        backend?.dispose();
        backend = null;
        setBackendState({ kind: 'error', message: toErrorMessage(err) });
      }
    })();

    return () => {
      cancelled = true;
      if (backend) {
        if (backendRef.current === backend) {
          backendRef.current = null;
        }
        backend.dispose();
        disposed = true;
      }
    };
  }, [
    flavor,
    backendFactory,
    retryToken,
    setOutputEntries,
    setCompileOutput,
    setCompileErrors,
    setCompileStatus,
    setExecutionStatus,
    setCurrentSessionId,
    setExitCode,
    setBackendState,
  ]);

  return {
    backendRef,
    compileTargetRef,
    compileHadErrorRef,
    prevStatusRef,
    retry,
  };
}
