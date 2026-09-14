/**
 * The bench the agent picks replacements from, and the sector map it reads
 * exposure through.
 *
 * Why a hand-written list rather than the instruments table: a replacement is
 * only useful if the agent can *price* it, and pricing a candidate costs a slot
 * in the same history request the holdings use. A 40-name bench of liquid NSE
 * large caps is one extra fetch; NIFTY 500 would be eight, most of them for
 * names that could never win. When the agent moves server-side this list is the
 * first thing to replace with a real screen — see `apps/agent`.
 *
 * `sector` is the only editorial judgement in here, and it exists so a swap can
 * hold exposure steady: selling a bank to buy a bank keeps the basket's shape,
 * selling a bank to buy a pharma name changes what the basket *is*, and the
 * agent should have to say which it is doing.
 *
 * **This list is not the sector lookup.** It used to be, and a basket of mid caps
 * came back 78% "Unclassified" as a result — a bench of 44 large caps can only
 * classify 44 symbols. Classification lives in `sectors.ts`, which covers several
 * hundred NSE names; this file answers a different question, namely what the
 * agent is allowed to recommend buying.
 */

export interface Candidate {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
}

export const BENCH: Candidate[] = [
  { symbol: "RELIANCE", exchange: "NSE", name: "Reliance Industries", sector: "Energy" },
  { symbol: "ONGC", exchange: "NSE", name: "Oil & Natural Gas Corp", sector: "Energy" },
  { symbol: "BPCL", exchange: "NSE", name: "Bharat Petroleum", sector: "Energy" },
  { symbol: "COALINDIA", exchange: "NSE", name: "Coal India", sector: "Energy" },

  { symbol: "HDFCBANK", exchange: "NSE", name: "HDFC Bank", sector: "Financials" },
  { symbol: "ICICIBANK", exchange: "NSE", name: "ICICI Bank", sector: "Financials" },
  { symbol: "KOTAKBANK", exchange: "NSE", name: "Kotak Mahindra Bank", sector: "Financials" },
  { symbol: "AXISBANK", exchange: "NSE", name: "Axis Bank", sector: "Financials" },
  { symbol: "SBIN", exchange: "NSE", name: "State Bank of India", sector: "Financials" },
  { symbol: "BAJFINANCE", exchange: "NSE", name: "Bajaj Finance", sector: "Financials" },
  { symbol: "HDFCLIFE", exchange: "NSE", name: "HDFC Life Insurance", sector: "Financials" },

  { symbol: "TCS", exchange: "NSE", name: "Tata Consultancy Services", sector: "Technology" },
  { symbol: "INFY", exchange: "NSE", name: "Infosys", sector: "Technology" },
  { symbol: "HCLTECH", exchange: "NSE", name: "HCL Technologies", sector: "Technology" },
  { symbol: "WIPRO", exchange: "NSE", name: "Wipro", sector: "Technology" },
  { symbol: "TECHM", exchange: "NSE", name: "Tech Mahindra", sector: "Technology" },
  { symbol: "PERSISTENT", exchange: "NSE", name: "Persistent Systems", sector: "Technology" },

  { symbol: "SUNPHARMA", exchange: "NSE", name: "Sun Pharmaceutical", sector: "Healthcare" },
  { symbol: "CIPLA", exchange: "NSE", name: "Cipla", sector: "Healthcare" },
  { symbol: "DRREDDY", exchange: "NSE", name: "Dr Reddy's Laboratories", sector: "Healthcare" },
  { symbol: "DIVISLAB", exchange: "NSE", name: "Divi's Laboratories", sector: "Healthcare" },
  { symbol: "APOLLOHOSP", exchange: "NSE", name: "Apollo Hospitals", sector: "Healthcare" },

  { symbol: "HINDUNILVR", exchange: "NSE", name: "Hindustan Unilever", sector: "Consumer staples" },
  { symbol: "ITC", exchange: "NSE", name: "ITC", sector: "Consumer staples" },
  { symbol: "NESTLEIND", exchange: "NSE", name: "Nestlé India", sector: "Consumer staples" },
  { symbol: "BRITANNIA", exchange: "NSE", name: "Britannia Industries", sector: "Consumer staples" },
  { symbol: "DABUR", exchange: "NSE", name: "Dabur India", sector: "Consumer staples" },

  { symbol: "MARUTI", exchange: "NSE", name: "Maruti Suzuki", sector: "Consumer discretionary" },
  { symbol: "M&M", exchange: "NSE", name: "Mahindra & Mahindra", sector: "Consumer discretionary" },
  { symbol: "TITAN", exchange: "NSE", name: "Titan Company", sector: "Consumer discretionary" },
  { symbol: "TRENT", exchange: "NSE", name: "Trent", sector: "Consumer discretionary" },
  { symbol: "BAJAJ-AUTO", exchange: "NSE", name: "Bajaj Auto", sector: "Consumer discretionary" },

  { symbol: "LT", exchange: "NSE", name: "Larsen & Toubro", sector: "Industrials" },
  { symbol: "SIEMENS", exchange: "NSE", name: "Siemens India", sector: "Industrials" },
  { symbol: "ABB", exchange: "NSE", name: "ABB India", sector: "Industrials" },
  { symbol: "CUMMINSIND", exchange: "NSE", name: "Cummins India", sector: "Industrials" },

  { symbol: "ULTRACEMCO", exchange: "NSE", name: "UltraTech Cement", sector: "Materials" },
  { symbol: "TATASTEEL", exchange: "NSE", name: "Tata Steel", sector: "Materials" },
  { symbol: "JSWSTEEL", exchange: "NSE", name: "JSW Steel", sector: "Materials" },
  { symbol: "GRASIM", exchange: "NSE", name: "Grasim Industries", sector: "Materials" },

  { symbol: "BHARTIARTL", exchange: "NSE", name: "Bharti Airtel", sector: "Communication" },
  { symbol: "NTPC", exchange: "NSE", name: "NTPC", sector: "Utilities" },
  { symbol: "POWERGRID", exchange: "NSE", name: "Power Grid Corp", sector: "Utilities" },
  { symbol: "TATAPOWER", exchange: "NSE", name: "Tata Power", sector: "Utilities" },
];

const BY_SYMBOL = new Map(BENCH.map((c) => [c.symbol.toUpperCase(), c]));

/** The company name, for the few symbols the bench happens to carry one for. */
export function nameOf(symbol: string): string | null {
  return BY_SYMBOL.get(symbol.toUpperCase())?.name ?? null;
}
