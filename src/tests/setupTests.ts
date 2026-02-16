import '@testing-library/jest-dom';
import { setApplicationFlavor } from '../web/libs/env';

// テスト環境ではデフォルトで wasm フレーバーを使用
setApplicationFlavor('wasm');
