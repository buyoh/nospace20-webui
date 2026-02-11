import { Socket } from 'socket.io';
import { NospaceExecutionService } from '../Services/NospaceExecutionService';
import type {
  RunOptions,
  NospaceClientToServerEvents,
} from '../../interfaces/NospaceTypes';

type EmitFunction = Socket['emit'];

export class NospaceController {
  private executionService = new NospaceExecutionService();
  private sessionsBySocket = new Map<string, string>(); // socketId -> sessionId

  handleConnection(socket: Socket): void {
    // Handle run request
    socket.on('nospace_run', (payload) => {
      this.handleRun(socket, payload.code, payload.options, payload.stdinData);
    });

    // Handle stdin input
    socket.on('nospace_stdin', (payload) => {
      this.handleStdinInput(socket, payload.sessionId, payload.data);
    });

    // Handle kill request
    socket.on('nospace_kill', (payload) => {
      this.handleKill(socket, payload.sessionId);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  private handleRun(
    socket: Socket,
    code: string,
    options: RunOptions,
    stdinData?: string
  ): void {
    // Kill existing session if any
    const existingSessionId = this.sessionsBySocket.get(socket.id);
    if (existingSessionId) {
      const existingSession =
        this.executionService.getSession(existingSessionId);
      if (existingSession) {
        existingSession.kill();
      }
      this.executionService.removeSession(existingSessionId);
    }

    // Create new session
    const session = this.executionService.run(code, options, {
      onStdout: (data) => {
        socket.emit('nospace_stdout', {
          sessionId: session.sessionId,
          data,
        });
      },
      onStderr: (data) => {
        socket.emit('nospace_stderr', {
          sessionId: session.sessionId,
          data,
        });
      },
      onExit: (exitCode) => {
        socket.emit('nospace_execution_status', {
          sessionId: session.sessionId,
          status: session.status,
          exitCode,
        });
        this.executionService.removeSession(session.sessionId);
        this.sessionsBySocket.delete(socket.id);
      },
    });

    // Register session
    this.sessionsBySocket.set(socket.id, session.sessionId);

    // Emit initial status (only if session is actually running)
    socket.emit('nospace_execution_status', {
      sessionId: session.sessionId,
      status: session.status,
      exitCode: session.exitCode,
    });

    // If batch mode, send stdin data and close stdin
    if (options.inputMode === 'batch' && stdinData !== undefined) {
      session.sendStdin(stdinData);
      // Note: We don't explicitly close stdin here as the process
      // should handle EOF when stdin stream ends
    }
  }

  private handleStdinInput(
    socket: Socket,
    sessionId: string,
    data: string
  ): void {
    const session = this.executionService.getSession(sessionId);
    if (session && session.status === 'running') {
      // Add newline if not present
      const inputData = data.endsWith('\n') ? data : data + '\n';
      session.sendStdin(inputData);
    }
  }

  private handleKill(socket: Socket, sessionId: string): void {
    const session = this.executionService.getSession(sessionId);
    if (session) {
      session.kill();
      socket.emit('nospace_execution_status', {
        sessionId,
        status: 'killed',
        exitCode: null,
      });
    }
  }

  private handleDisconnect(socket: Socket): void {
    const sessionId = this.sessionsBySocket.get(socket.id);
    if (sessionId) {
      const session = this.executionService.getSession(sessionId);
      if (session) {
        session.kill();
        this.executionService.removeSession(sessionId);
      }
      this.sessionsBySocket.delete(socket.id);
    }
  }
}
