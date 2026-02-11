import React from 'react';
import { Header } from '../components/layout/Header';
import { SplitPane } from '../components/layout/SplitPane';
import { EditorContainer } from '../containers/EditorContainer';
import { ExecutionContainer } from '../containers/ExecutionContainer';
import './styles/index.scss';

export default function IndexPage(): React.ReactNode {
  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <SplitPane
          left={<EditorContainer />}
          right={<ExecutionContainer />}
          initialLeftWidth={50}
          minLeftWidth={300}
          minRightWidth={300}
        />
      </main>
    </div>
  );
}
