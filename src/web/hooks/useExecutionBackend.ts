// バックエンドのライフサイクル管理 + イベント配線フック

import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../stores/executionAtom';
import {
  compileOutputAtom,
  compileStatusAtom,
} from '../stores/compileOutputAtom';
import { compileErrorsAtom } from '../stores/compileErrorsAtom';
import type { ExecutionBackend } from '../services/ExecutionBackend';
import type { Flavor } from '../stores/flavorAtom';
import type { CompileTarget } from '../../interfaces/NospaceTypes';

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
}

/**
 * バックエンドのライフサイクル管理とイベント配線を担うフック。
 * Flavor が変わると古いバックエンドを dispose し、新しいバックエンドを生成・初期化する。
 * onOutput / onStatusChange / onCompileErrors コールバックを設定し、各 atom に反映する。
 */
export function useExecutionBackend(
  flavor: Flavor,
  backendFactory: BackendFactory
): UseExecutionBackendResult {
  const setOutputEntries = useSetAtom(outputEntriesAtom);
  const setCompileOutput = useSetAtom(compileOutputAtom);
  const setCompileErrors = useSetAtom(compileErrorsAtom);
  const setCompileStatus = useSetAtom(compileStatusAtom);
  const setExecutionStatus = useSetAtom(executionStatusAtom);
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom);
  const setExitCode = useSetAtom(exitCodeAtom);

  const backendRef = useRef<ExecutionBackend | null>(null);
  /** コンパイル中のターゲット。null 以外の場合、stdout を compileOutputAtom にルーティングする */
  const compileTargetRef = useRef<CompileTarget | null>(null);
  /** コンパイル中にエラーが発生したかどうかを追跡する */
  const compileHadErrorRef = useRef(false);
  /** 直前の executionStatus を追跡する（コンパイル完了検出用） */
  const prevStatusRef = useRef<string | null>(null);

  // Flavor 変更時にバックエンドを再生成し、イベント配線を設定する
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const backend = await backendFactory(flavor);

      if (cancelled) {
        backend.dispose();
        return;
      }

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
          // compiling → 非compiling の遷移を検出してコンパイルステータスを確定する
          if (prevStatusRef.current === 'compiling') {
            setCompileStatus(compileHadErrorRef.current ? 'error' : 'success');
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
        setCompileErrors(errors);
        if (errors.length > 0) {
          // エラー発生を記録（コンパイル完了時にステータスを 'error' に設定するため）
          compileHadErrorRef.current = true;
        }
      });

      // バックエンドを初期化
      try {
        await backend.init();
      } catch (err) {
        console.error(
          `[useExecutionBackend] Failed to initialize ${flavor} backend:`,
          err
        );
      }

      // 古いバックエンドを破棄して新しいバックエンドを設定
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
    setCompileErrors,
    setCompileStatus,
    setExecutionStatus,
    setCurrentSessionId,
    setExitCode,
  ]);

  return { backendRef, compileTargetRef, compileHadErrorRef, prevStatusRef };
}
