export type MarketIndex = {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
};

export type KlinePoint = {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
};

export type StockSentiment = {
  bull: number;
  bear: number;
  total: number;
  bullPercent: number;
  myVote: 'bull' | 'bear' | null;
};

export type StockDetail = {
  quote: StockQuote;
  postCount: number;
  sentiment: StockSentiment;
};

export type HotStock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  mentionCount: number;
};

export type StockQuote = {
  code: string;
  name: string;
  open: number;
  close: number;
  high: number;
  low: number;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  amount: number;
  time: string;
};
