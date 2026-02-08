import React from 'react';
import ReactDOM from 'react-dom/client';

import './web/components/styles/default.scss';
import IndexPage from './web/pages/index';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IndexPage />
  </React.StrictMode>
);
