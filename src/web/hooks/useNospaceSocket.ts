import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { socketAtom, createSocket } from '../stores/socketAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../stores/executionAtom';
import type { OutputEntry } from '../../interfaces/NospaceTypes';

export function useNospaceSocket() {
  const [socket, setSocket] = useAtom(socketAtom);
  const setExecutionStatus = useSetAtom(executionStatusAtom);
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom);
  const setOutputEntries = useSetAtom(outputEntriesAtom);
  const setExitCode = useSetAtom(exitCodeAtom);

  useEffect(() => {
    // Create socket connection
    if (!socket) {
      const newSocket = createSocket();
      setSocket(newSocket);

      // Setup nospace event listeners
      newSocket.on('nospace_stdout', (payload) => {
        const entry: OutputEntry = {
          type: 'stdout',
          data: payload.data,
          timestamp: Date.now(),
        };
        setOutputEntries((prev) => [...prev, entry]);
      });

      newSocket.on('nospace_stderr', (payload) => {
        const entry: OutputEntry = {
          type: 'stderr',
          data: payload.data,
          timestamp: Date.now(),
        };
        setOutputEntries((prev) => [...prev, entry]);
      });

      newSocket.on('nospace_execution_status', (payload) => {
        setExecutionStatus(payload.status);
        setCurrentSessionId(payload.sessionId);
        if (payload.exitCode !== undefined) {
          setExitCode(payload.exitCode);
        }

        // Add system message
        if (payload.status === 'running') {
          const entry: OutputEntry = {
            type: 'system',
            data: `[Process started: ${payload.sessionId}]\n`,
            timestamp: Date.now(),
          };
          setOutputEntries((prev) => [...prev, entry]);
        } else if (payload.status === 'finished') {
          const entry: OutputEntry = {
            type: 'system',
            data: `\n[Process exited with code: ${payload.exitCode ?? 'unknown'}]\n`,
            timestamp: Date.now(),
          };
          setOutputEntries((prev) => [...prev, entry]);
        } else if (payload.status === 'killed') {
          const entry: OutputEntry = {
            type: 'system',
            data: `\n[Process killed]\n`,
            timestamp: Date.now(),
          };
          setOutputEntries((prev) => [...prev, entry]);
        } else if (payload.status === 'error') {
          const entry: OutputEntry = {
            type: 'system',
            data: `\n[Process error]\n`,
            timestamp: Date.now(),
          };
          setOutputEntries((prev) => [...prev, entry]);
        }
      });

      return () => {
        newSocket.close();
      };
    }
  }, [
    socket,
    setSocket,
    setExecutionStatus,
    setCurrentSessionId,
    setOutputEntries,
    setExitCode,
  ]);

  return socket;
}
