import { parseAppConfig } from '../../app/Config';
import type { ExpectedEnvVars } from '../../interfaces/EnvConfig';

describe('parseAppConfig', () => {
  it('デフォルト値でパースできる', () => {
    const env: ExpectedEnvVars = {};
    const config = parseAppConfig(env);
    expect(config.production).toBe(false);
    expect(config.develop).toBe(true);
    expect(config.httpPort).toBe(8080);
    expect(config.frontend).toBe('vite');
    expect(config.nospaceBinPath).toBe('./components/nospace20/bin/nospace20');
    expect(config.nospaceTimeout).toBe(30000);
    expect(config.nospaceMaxProcesses).toBe(5);
  });

  it('production 環境を正しくパースする', () => {
    const env: ExpectedEnvVars = { NODE_ENV: 'production' };
    const config = parseAppConfig(env);
    expect(config.production).toBe(true);
    expect(config.develop).toBe(false);
  });

  it('カスタム値を正しくパースする', () => {
    const env: ExpectedEnvVars = {
      PORT: '3000',
      FRONTEND: 'static',
      NOSPACE_BIN_PATH: '/usr/local/bin/nospace20',
      NOSPACE_TIMEOUT: '60',
      NOSPACE_MAX_PROCESSES: '10',
    };
    const config = parseAppConfig(env);
    expect(config.httpPort).toBe(3000);
    expect(config.frontend).toBe('static');
    expect(config.nospaceBinPath).toBe('/usr/local/bin/nospace20');
    expect(config.nospaceTimeout).toBe(60000);
    expect(config.nospaceMaxProcesses).toBe(10);
  });

  it('不正な FRONTEND 値は vite にフォールバックする', () => {
    const env: ExpectedEnvVars = { FRONTEND: 'invalid' };
    const config = parseAppConfig(env);
    expect(config.frontend).toBe('vite');
  });
});
