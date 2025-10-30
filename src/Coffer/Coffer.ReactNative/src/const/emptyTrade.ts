import { TradeRequired } from "../types/entities/trade";

export const emptyTradeRequired = (userId: string): TradeRequired => {
  return {
    userId: userId,
    title: "",
    description: "",
    tradeItems: [],
  };
};
