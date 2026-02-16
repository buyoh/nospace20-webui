import { parseApplicationFlavor } from '../../web/libs/env';
import type { ExpectedEnvVars } from '../../interfaces/EnvConfig';

describe('parseApplicationFlavor', () => {
  it('VITE_APPLICATION_FLAVOR が "websocket" の場合 "websocket" を返す', () => {
    const env: ExpectedEnvVars = { VITE_APPLICATION_FLAVOR: 'websocket' };
    expect(parseApplicationFlavor(env)).toBe('websocket');
  });

  it('VITE_APPLICATION_FLAVOR が "wasm" の場合 "wasm" を返す', () => {
    const env: ExpectedEnvVars = { VITE_APPLICATION_FLAVOR: 'wasm' };
    expect(parseApplicationFlavor(env)).toBe('wasm');
  });

  it('VITE_APPLICATION_FLAVOR が未定義の場合 "wasm" を返す', () => {
    const env: ExpectedEnvVars = {};
    expect(parseApplicationFlavor(env)).toBe('wasm');
  });

  it('VITE_APPLICATION_FLAVOR が空文字の場合 "wasm" を返す', () => {
    const env: ExpectedEnvVars = { VITE_APPLICATION_FLAVOR: '' };
    expect(parseApplicationFlavor(env)).toBe('wasm');
  });

  it('VITE_APPLICATION_FLAVOR が不正な値の場合 "wasm" を返す', () => {
    const env: ExpectedEnvVars = { VITE_APPLICATION_FLAVOR: 'invalid' };
    expect(parseApplicationFlavor(env)).toBe('wasm');
  });
});
