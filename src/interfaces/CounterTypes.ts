// カウンターアプリの型定義

// WebSocket メッセージ型
export interface CounterState {
  value: number;
}

// クライアント → サーバー
export type ClientToServerEvents = {
  counter_increment: () => void;
  counter_decrement: () => void;
  counter_reset: () => void;
};

// サーバー → クライアント
export type ServerToClientEvents = {
  counter_update: (state: CounterState) => void;
};
