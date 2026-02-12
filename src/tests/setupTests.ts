import '@testing-library/jest-dom';
import { setServerFlavorEnabled } from '../web/libs/env';

// Server flavor を無効化（テスト環境ではデフォルトで wasm のみ）
setServerFlavorEnabled(false);
