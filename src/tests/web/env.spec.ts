import { parseEnableServer } from '../../web/libs/env';
import type { ExpectedEnvVars } from '../../interfaces/EnvConfig';

describe('parseEnableServer', () => {
  it('VITE_ENABLE_SERVER が "true" の場合 true を返す', () => {
    const env: ExpectedEnvVars = { VITE_ENABLE_SERVER: 'true' };
    expect(parseEnableServer(env)).toBe(true);
  });

  it('VITE_ENABLE_SERVER が "false" の場合 false を返す', () => {
    const env: ExpectedEnvVars = { VITE_ENABLE_SERVER: 'false' };
    expect(parseEnableServer(env)).toBe(false);
  });

  it('VITE_ENABLE_SERVER が未定義の場合 false を返す', () => {
    const env: ExpectedEnvVars = {};
    expect(parseEnableServer(env)).toBe(false);
  });

  it('VITE_ENABLE_SERVER が空文字の場合 false を返す', () => {
    const env: ExpectedEnvVars = { VITE_ENABLE_SERVER: '' };
    expect(parseEnableServer(env)).toBe(false);
  });
});
