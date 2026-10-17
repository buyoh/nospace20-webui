import type { ChildProcess, spawn } from 'child_process';
import { createProcessSpawner } from '../../app/Services/ChildProcessEnv';

describe('createProcessSpawner', () => {
  it('BUG: 子プロセスには許可リストの環境変数だけを渡す', () => {
    const calls: Array<{ env?: NodeJS.ProcessEnv }> = [];
    const fakeSpawn = ((_cmd: string, _args: string[], options: object) => {
      calls.push(options);
      return {} as ChildProcess;
    }) as unknown as typeof spawn;

    const spawner = createProcessSpawner(
      {
        LANG: 'C.UTF-8',
        RUST_BACKTRACE: '1',
        PATH: '/usr/bin',
        HOME: '/home/user',
        SECRET_TOKEN: 'secret',
        NOSPACE_BIN_PATH: './bin/nospace20',
      },
      fakeSpawn
    );
    spawner.spawn('./bin/nospace20', []);

    // 未定義の許可リストの変数（LC_ALL など）はキー自体を持たない
    expect(calls[0].env).toEqual({ LANG: 'C.UTF-8', RUST_BACKTRACE: '1' });
  });
});
