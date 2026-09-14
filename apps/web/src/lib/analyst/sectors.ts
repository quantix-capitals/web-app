/**
 * Symbol → sector, for NSE names.
 *
 * **Why this table exists at all.** `instruments.sector` is in the schema
 * (`supabase/migrations/0001_init.sql`) and is never written: `upsert_instrument`
 * takes symbol, exchange and name only, so the column is null for every row. The
 * market function serves quotes, search, closes and history — none of which
 * carry a classification. So until one of those two changes, the browser has no
 * source of sector data and this hand-kept map is it.
 *
 * It was previously the *replacement bench* doing double duty as the sector
 * lookup, which meant a basket of mid caps came back 78% "Unclassified" — the
 * bench is 44 large caps, and a name not on it had no sector at all. Splitting
 * the two is the fix: the bench is what the agent may recommend buying, this is
 * what the agent knows about a symbol it already holds, and they answer different
 * questions.
 *
 * **It will still miss names**, and that is handled rather than hidden: an
 * unmapped symbol is `Unclassified`, and `quant.ts` keeps those out of the sector
 * weights entirely instead of totalling them into a bucket that reads like an
 * exposure. "I don't know what these are" and "these are all in one sector" are
 * different facts and only one of them is a concentration risk.
 *
 * **When you add a name**, put it in the sector its revenue comes from, not the
 * index it sits in. The groupings are GICS-style and deliberately coarse — the
 * agent uses them for two things only: totalling exposure, and preferring a
 * same-sector replacement so a swap holds the basket's shape.
 */

/** What a symbol with no entry here is called. Never counted as an exposure. */
export const UNCLASSIFIED = "Unclassified";

/**
 * Sectors, each listing its NSE symbols.
 *
 * Written this way round rather than symbol-first because it is maintained by
 * eye: adding a name means finding its sector and appending to that line, and a
 * flat map of 250 entries makes a duplicate or a miscategorisation invisible.
 * `BY_SYMBOL` below inverts it once at module load.
 */
export const SECTOR_MEMBERS: Record<string, string[]> = {
  Financials: [
    "HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN", "INDUSINDBK", "BANKBARODA",
    "PNB", "CANBK", "UNIONBANK", "IDFCFIRSTB", "FEDERALBNK", "BANDHANBNK", "AUBANK",
    "YESBANK", "RBLBANK", "IDBI", "INDIANB", "UCOBANK", "CENTRALBK", "IOB",
    "BAJFINANCE", "BAJAJFINSV", "BAJAJHLDNG", "CHOLAFIN", "SHRIRAMFIN", "MUTHOOTFIN",
    "MANAPPURAM", "LICHSGFIN", "PFC", "RECLTD", "IRFC", "HUDCO", "SBICARD", "PAYTM",
    "POLICYBZR", "ANGELONE", "CDSL", "BSE", "MCX", "IEX", "HDFCAMC", "NAM-INDIA",
    "UTIAMC", "ABCAPITAL", "PEL", "IIFL", "M&MFIN", "JIOFIN", "360ONE",
    "HDFCLIFE", "SBILIFE", "ICICIPRULI", "ICICIGI", "LICI", "MAXHEALTH", "STARHEALTH",
    "GICRE", "NIACL",
  ],
  Technology: [
    "TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "MPHASIS", "PERSISTENT",
    "COFORGE", "LTTS", "KPITTECH", "TATAELXSI", "CYIENT", "SONATSOFTW", "BIRLASOFT",
    "ZENSARTECH", "MASTEK", "NEWGEN", "TANLA", "ROUTE", "HAPPSTMNDS", "INTELLECT",
    "E2E", "NETWEB", "TATATECH", "ZOMATO", "ETERNAL", "SWIGGY", "NYKAA", "DELHIVERY",
    "INDIAMART", "JUSTDIAL", "AFFLE", "MAPMYINDIA", "RATEGAIN", "IKS", "BLACKBUCK",
    "OLAELEC", "IDEAFORGE", "PBFINTECH",
  ],
  Healthcare: [
    "SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "LUPIN", "AUROPHARMA", "TORNTPHARM",
    "ALKEM", "ZYDUSLIFE", "GLENMARK", "BIOCON", "ABBOTINDIA", "MANKIND", "IPCALAB",
    "LAURUSLABS", "GRANULES", "NATCOPHARM", "AJANTPHARM", "ERIS", "FDC", "JBCHEPHARM",
    "SUVENPHAR", "PPLPHARMA", "GLAND", "SYNGENE", "DIVI", "APOLLOHOSP", "FORTIS",
    "NH", "RAINBOW", "KIMS", "ASTERDM", "METROPOLIS", "LALPATHLAB", "THYROCARE",
    "POLYMED", "VIJAYA",
  ],
  Energy: [
    "RELIANCE", "ONGC", "OIL", "IOC", "BPCL", "HINDPETRO", "GAIL", "PETRONET",
    "IGL", "MGL", "GUJGASLTD", "ATGL", "AEGISLOG", "COALINDIA", "CASTROLIND",
    "GSPL", "CHENNPETRO", "MRPL",
  ],
  Utilities: [
    "NTPC", "POWERGRID", "TATAPOWER", "ADANIPOWER", "ADANIGREEN", "ADANIENSOL",
    "JSWENERGY", "NHPC", "SJVN", "NLCINDIA", "TORNTPOWER", "CESC", "INOXWIND",
    "SUZLON", "WAAREEENER", "PREMIERENE", "ACMESOLAR", "IREDA", "THERMAX",
  ],
  Materials: [
    "ULTRACEMCO", "SHREECEM", "AMBUJACEM", "ACC", "GRASIM", "DALBHARAT", "JKCEMENT",
    "RAMCOCEM", "INDIACEM", "BIRLACORPN", "HEIDELBERG", "STARCEMENT",
    "TATASTEEL", "JSWSTEEL", "JINDALSTEL", "SAIL", "NMDC", "HINDALCO", "VEDL",
    "HINDZINC", "NATIONALUM", "APLAPOLLO", "RATNAMANI", "JINDALSAW", "WELCORP",
    "MOIL", "GRAVITA",
    "PIDILITIND", "ASIANPAINT", "BERGEPAINT", "KANSAINER", "INDIGOPNTS", "AKZOINDIA",
    "SRF", "PIIND", "UPL", "AARTIIND", "DEEPAKNTR", "NAVINFLUOR", "ATUL", "VINATIORGA",
    "TATACHEM", "GNFC", "CHAMBLFERT", "COROMANDEL", "FACT", "RCF", "BASF", "LINDEINDIA",
    "SOLARINDS", "CLEAN", "FLUOROCHEM", "EIDPARRY", "SUMICHEM", "BALRAMCHIN",
    "CENTURYPLY", "GREENPANEL", "JKPAPER", "WSTCSTPAPR",
  ],
  Industrials: [
    "LT", "SIEMENS", "ABB", "CGPOWER", "HAVELLS", "POLYCAB", "KEI", "FINCABLES",
    "BHEL", "BEL", "HAL", "BDL", "MAZDOCK", "COCHINSHIP", "GRSE", "DATAPATTNS",
    "PARAS", "ZENTEC", "SOLARA", "CUMMINSIND", "THERMAX2", "AIAENG", "GRINDWELL",
    "SCHAEFFLER", "SKFINDIA", "TIMKEN", "KSB", "ELGIEQUIP", "LMW", "TRITURBINE",
    "KIRLOSENG", "KIRLOSBROS", "ACE", "ESCORTS", "BEML", "TITAGARH", "TEXRAIL",
    "IRCON", "RVNL", "NBCC", "NCC", "KEC", "KALPATPOWR", "AFCONS", "GRINFRA",
    "PNCINFRA", "IRB", "GMRINFRA", "GMRAIRPORT", "ADANIPORTS", "JSWINFRA",
    "CONCOR", "BLUEDART", "TCI", "VRLLOG", "MAHLOG", "INDIGO", "SPICEJET",
    "SUPREMEIND", "ASTRAL", "FINOLEXIND", "PRINCEPIPE", "CARBORUNIV", "GMMPFAUDLR",
  ],
  "Consumer discretionary": [
    "MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "HEROMOTOCO", "TVSMOTOR", "EICHERMOT",
    "ASHOKLEY", "FORCEMOT", "OLECTRA", "SMLISUZU", "ATULAUTO",
    "BOSCHLTD", "MOTHERSON", "BHARATFORG", "SUNDRMFAST", "ENDURANCE", "EXIDEIND",
    "AMARAJABAT", "ARE&M", "MRF", "APOLLOTYRE", "BALKRISIND", "CEATLTD", "JKTYRE",
    "TITAN", "KALYANKJIL", "SENCO", "PCJEWELLER", "TRENT", "ABFRL", "ADITYABIRLA",
    "PAGEIND", "RAYMOND", "ARVIND", "KEWALKIRAN", "VMART", "DMART", "SHOPERSTOP",
    "BATAINDIA", "RELAXO", "METROBRAND", "CAMPUS", "VIPIND", "SAFARI",
    "HAVISHA", "VOLTAS", "BLUESTARCO", "WHIRLPOOL", "CROMPTON", "ORIENTELEC",
    "TTKPRESTIG", "HAWKINCOOK", "SYMPHONY", "DIXON", "AMBER", "KAYNES", "SYRMA",
    "INDHOTEL", "CHALET", "LEMONTREE", "EIHOTEL", "JUBLFOOD", "DEVYANI", "SAPPHIRE",
    "WESTLIFE", "BARBEQUE", "IRCTC", "THOMASCOOK", "WONDERLA", "PVRINOX", "NAZARA",
    "DELTACORP", "MOTILALOFS",
  ],
  "Consumer staples": [
    "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "MARICO", "GODREJCP",
    "COLPAL", "EMAMILTD", "JYOTHYLAB", "GILLETTE", "PGHH", "BAJAJCON", "HONASA",
    "TATACONSUM", "VBL", "UBL", "RADICO", "UNITDSPR", "GODFRYPHLP", "VSTIND",
    "AVANTIFEED", "KRBL", "LTFOODS", "HATSUN", "DODLA", "PATANJALI", "ZYDUSWELL",
    "GODREJAGRO", "KAVERISEED", "MRPLAGRO",
  ],
  Communication: [
    "BHARTIARTL", "IDEA", "TATACOMM", "INDUSTOWER", "HFCL", "STLTECH", "TEJASNET",
    "RAILTEL", "ONMOBILE", "SUNTV", "ZEEL", "TV18BRDCST", "NETWORK18", "SAREGAMA",
    "TIPSMUSIC", "DISHTV", "HATHWAY", "DEN",
  ],
  "Real estate": [
    "DLF", "GODREJPROP", "OBEROIRLTY", "PRESTIGE", "BRIGADE", "PHOENIXLTD",
    "SOBHA", "MAHLIFE", "SUNTECK", "ANANTRAJ", "KOLTEPATIL", "PURVA", "LODHA",
    "MACROTECH", "SIGNATURE", "AJMERA",
  ],
};

/** Symbol → sector, inverted once. Later duplicates are ignored, not merged. */
const BY_SYMBOL = new Map<string, string>();
for (const [sector, symbols] of Object.entries(SECTOR_MEMBERS)) {
  for (const symbol of symbols) {
    if (!BY_SYMBOL.has(symbol)) BY_SYMBOL.set(symbol, sector);
  }
}

/**
 * The sector a symbol belongs to, or `Unclassified`.
 *
 * A miss is never a guess. Half the value of this map is that the agent can tell
 * the difference between a holding it has placed and one it has not, and say so.
 */
export function sectorOf(symbol: string): string {
  return BY_SYMBOL.get(symbol.toUpperCase()) ?? UNCLASSIFIED;
}

export function isClassified(symbol: string): boolean {
  return BY_SYMBOL.has(symbol.toUpperCase());
}

/** How many symbols the map covers — quoted in the tool payload, so it is honest. */
export const MAPPED_COUNT = BY_SYMBOL.size;
