/**
 * Refined Smart Natural Language Expense Parser
 * Fixes title cleaning to strictly remove ❤️, 🐷, payment verbs, currencies, and card names.
 */

window.NLPParser = {
  parse(text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    // 1. Amount & Currency Detection
    let amount = 0;
    let currency = "JPY"; // Default currency

    const twdMatch = trimmed.match(/(\d[\d,]*)\s*(?:元|台幣|TWD|\$)/i);
    const jpyMatch = trimmed.match(/(\d[\d,]*)\s*(?:日圓|日幣|日元|円|JPY|yen|¥)/i);
    const numMatch = trimmed.match(/(?:花|刷|共|付|買)?\s*(\d[\d,]*)/);

    if (twdMatch) {
      amount = parseInt(twdMatch[1].replace(/,/g, ''), 10);
      currency = "TWD";
    } else if (jpyMatch) {
      amount = parseInt(jpyMatch[1].replace(/,/g, ''), 10);
      currency = "JPY";
    } else if (numMatch) {
      amount = parseInt(numMatch[1].replace(/,/g, ''), 10);
      currency = "JPY";
    }

    // 2. Payer Detection (❤️ vs 🐷)
    let payer = "❤️";
    if (/老公|先生|他|🐷|老公付|老公刷/.test(trimmed)) {
      payer = "🐷";
    } else if (/我|老婆|❤️|❤|我付|我刷|自己/.test(trimmed)) {
      payer = "❤️";
    }

    // 3. Credit Card / Payment Method Detection (Strictly from Image 2 list)
    let card = "現金";
    const lower = trimmed.toLowerCase();

    if (/熊本熊/.test(trimmed)) card = "熊本熊";
    else if (/西瓜卡|suica|西瓜/.test(lower)) card = "西瓜卡";
    else if (/icoca/.test(lower)) card = "icoca";
    else if (/永豐jcb|永豐 jcb/.test(lower)) card = "永豐JCB";
    else if (/永豐outlet|outlet/.test(lower)) card = "永豐outlet";
    else if (/幣倍/.test(trimmed)) card = "幣倍";
    else if (/大戶/.test(trimmed)) card = "大戶";
    else if (/全支付/.test(trimmed)) card = "全支付";
    else if (/吉鶴/.test(trimmed)) card = "吉鶴";
    else if (/sport/.test(lower)) card = "sport";
    else if (/giving/.test(lower)) card = "giving";
    else if (/星展永續|星展/.test(trimmed)) card = "星展永續";
    else if (/cube/.test(lower)) card = "cube";
    else if (/太陽/.test(trimmed)) card = "太陽";
    else if (/green卡|green/.test(lower)) card = "Green卡";
    else if (/現金|cash/.test(lower)) card = "現金";

    // 4. Category Detection (Strictly from Image 1 list)
    let category = "其他";
    if (/伴手禮|送禮|禮物|特產|禮盒/.test(trimmed)) {
      category = "送禮";
    } else if (/食|吃|餐|豆腐|拉麵|壽司|燒肉|懷石|午餐|晚餐|早餐|飯|麵|咖啡|鬆餅|丸子|抹茶|冰|甜點|飲品|手搖|星巴克|arabica|酒|肉|茶|冰淇淋/.test(lower)) {
      category = "飲食";
    } else if (/車|捷運|電車|地鐵|公車|計程車|haruka|搭車|儲值|船/.test(lower)) {
      category = "交通";
    } else if (/寺|門票|御守|拜觀|景點|神社|纜車|小火車|公園|展覽|神宮|城|票/.test(trimmed)) {
      category = "門票";
    } else if (/買|藥妝|uniqlo|服飾|包包|鞋|免稅|百貨|願望|紀念品|零食|衣服|雜貨/.test(lower)) {
      category = "購物";
    } else if (/住|房|飯店|hotel|民宿|三井/.test(lower)) {
      category = "住宿";
    } else if (/網路|sim|esim|網卡|wifi/.test(lower)) {
      category = "網路";
    } else if (/機票|飛機|星宇|jx820|jx835/.test(lower)) {
      category = "機票";
    } else if (/保險|平安險|不便險/.test(trimmed)) {
      category = "保險";
    }

    // 5. Clean title extraction (Completely strips ❤️, 🐷, payer words, verbs, and cards)
    let cleanTitle = trimmed
      .replace(/(\d[\d,]*)\s*(?:日圓|日幣|日元|円|JPY|yen|¥|元|台幣|TWD|\$)/gi, '')
      .replace(/(?:今天|昨天|在|買|刷|花|付了|我付|老公付|我刷|老公刷|付|的|卡|現金)/g, '')
      .replace(/[\uFE0F\u200D]/g, '') // Strip emoji variation selectors
      .replace(/(?:❤️|❤|🐷|我|老公)/g, '') // Strip emojis and payer words
      .replace(/(?:熊本熊|西瓜卡|icoca|永豐JCB|幣倍|大戶|全支付|吉鶴|sport|giving|星展永續|永豐outlet|cube|太陽|Green卡)/gi, '')
      .trim();

    if (!cleanTitle || cleanTitle.length < 1) {
      cleanTitle = trimmed.substring(0, 15);
    }

    return {
      rawText: trimmed,
      title: cleanTitle,
      amount: amount || 1000,
      currency,
      category,
      card,
      payer
    };
  }
};
