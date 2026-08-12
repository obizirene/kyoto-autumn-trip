/**
 * Kyoto Autumn Trip Preset Data & Constants
 */

// Expense Categories (記帳分類)
window.EXPENSE_CATEGORIES = [
  { id: '交通', label: '🚃 交通' },
  { id: '送禮', label: '🎁 送禮' },
  { id: '住宿', label: '🏨 住宿' },
  { id: '其他', label: '📦 其他' },
  { id: '飲食', label: '🍱 飲食' },
  { id: '網路', label: '📶 網路' },
  { id: '機票', label: '✈️ 機票' },
  { id: '購物', label: '🛍️ 購物' },
  { id: '保險', label: '🛡️ 保險' },
  { id: '門票', label: '🎟️ 門票' }
];

// Itinerary Categories (行程分類: 正餐 / 點心 / 景點 / 購物 / 交通)
window.ITINERARY_CATEGORIES = [
  { id: '正餐', label: '🍱 正餐' },
  { id: '點心', label: '🍡 點心' },
  { id: '景點', label: '🍁 景點' },
  { id: '購物', label: '🛍️ 購物' },
  { id: '交通', label: '🚃 交通' }
];

window.CREDIT_CARDS = [
  '現金',
  '西瓜卡',
  'icoca',
  '熊本熊',
  '永豐JCB',
  '幣倍',
  '大戶',
  '全支付',
  '吉鶴',
  'sport',
  'giving',
  '星展永續',
  '永豐outlet',
  'cube',
  '太陽',
  'Green卡'
];

window.DEFAULT_TRIP_DATA = {
  // Fixed Flights (星宇航空 JX820 / JX835)
  flightInfo: {
    outbound: {
      airline: "星宇航空 Starlux",
      flightNo: "JX820",
      date: "2026-11-20",
      depAirport: "台北桃園 (TPE)",
      depTime: "07:40 AM",
      arrAirport: "關西國際機場 (KIX)",
      arrTime: "11:10 AM"
    },
    inbound: {
      airline: "星宇航空 Starlux",
      flightNo: "JX835",
      date: "2026-11-29",
      depAirport: "神戶機場 (UKB)",
      depTime: "11:30 AM",
      arrAirport: "台北桃園 (TPE)",
      arrTime: "13:45 PM"
    },
    exchangeRate: 0.21,
  },

  // Hotels / Accommodation List
  hotels: [
    {
      id: "ht-101",
      name: "京都三井花園飯店 (Mitsui Garden Hotel Kyoto Sanjo)",
      checkIn: "2026-11-20",
      checkOut: "2026-11-29",
      phone: "+81 75-256-3111",
      notes: "地鐵烏丸御池站 6 號出口步行 1 分鐘",
      googleMapsUrl: "https://maps.google.com/?q=Mitsui+Garden+Hotel+Kyoto+Sanjo"
    }
  ],

  // Itinerary (分日行程 Days 1 - 10 with categories: 正餐 / 點心 / 景點 / 購物 / 交通)
  itinerary: [
    {
      id: "it-101",
      day: 1,
      date: "11/20 (五)",
      time: "11:10 AM",
      title: "抵達關西機場 & 搭特急直達京都車站",
      category: "交通",
      location: "關西國際機場 JR 綠色窗口",
      costJPY: 3800,
      note: "憑 QR Code 領取車票",
      mapsUrl: "https://maps.google.com/?q=Kansai+Airport+Station"
    },
    {
      id: "it-102",
      day: 1,
      date: "11/20 (五)",
      time: "15:00 PM",
      title: "飯店 Check-in 放置行李",
      category: "景點",
      location: "三井花園飯店 京都三條",
      costJPY: 0,
      note: "辦理入住、放置重行李",
      mapsUrl: "https://maps.google.com/?q=Mitsui+Garden+Hotel+Kyoto+Sanjo"
    },
    {
      id: "it-103",
      day: 1,
      date: "11/20 (五)",
      time: "18:00 PM",
      title: "鴨川散策 & 先斗町懷石料理",
      category: "正餐",
      location: "先斗町 京料理",
      costJPY: 12000,
      note: "享受鴨川水岸夜景與京料理",
      mapsUrl: "https://maps.google.com/?q=Pontocho+Kyoto"
    },
    {
      id: "it-201",
      day: 2,
      date: "11/21 (六)",
      time: "08:30 AM",
      title: "嵐山小火車 (嵯峨野觀光鐵道)",
      category: "景點",
      location: "嵯峨嵐山站",
      costJPY: 1700,
      note: "保津川溪谷滿山紅葉超壯觀！",
      mapsUrl: "https://maps.google.com/?q=Torokko+Saga+Station"
    },
    {
      id: "it-202",
      day: 2,
      date: "11/21 (六)",
      time: "11:00 AM",
      title: "嵐山竹林之道 & 天龍寺曹源池",
      category: "景點",
      location: "天龍寺",
      costJPY: 1000,
      note: "米其林三星庭園映照楓紅",
      mapsUrl: "https://maps.google.com/?q=Tenryuji+Temple"
    },
    {
      id: "it-203",
      day: 2,
      date: "11/21 (六)",
      time: "12:30 PM",
      title: "嵐山湯豆腐 嵯峨野 午餐",
      category: "正餐",
      location: "湯豆腐 嵯峨野",
      costJPY: 8000,
      note: "經典京都正統湯豆腐",
      mapsUrl: "https://maps.google.com/?q=Yudofu+Sagano"
    },
    {
      id: "it-204",
      day: 2,
      date: "11/21 (六)",
      time: "15:00 PM",
      title: "% ARABICA 渡月橋抹茶拿鐵",
      category: "點心",
      location: "% ARABICA 嵐山店",
      costJPY: 1500,
      note: "邊喝咖啡邊欣賞渡月橋楓景",
      mapsUrl: "https://maps.google.com/?q=Arabica+Kyoto+Arashiyama"
    },
    {
      id: "it-301",
      day: 3,
      date: "11/22 (日)",
      time: "09:00 AM",
      title: "清水寺本堂國寶舞台賞楓",
      category: "景點",
      location: "音羽山 清水寺",
      costJPY: 800,
      note: "音羽瀑布祈福，賞楓名所",
      mapsUrl: "https://maps.google.com/?q=Kiyomizu-dera"
    },
    {
      id: "it-302",
      day: 3,
      date: "11/22 (日)",
      time: "14:00 PM",
      title: "三年坂 祇園 Yojiya 採買",
      category: "購物",
      location: "Yojiya 祇園本店",
      costJPY: 5000,
      note: "購買吸油面紙與護手霜",
      mapsUrl: "https://maps.google.com/?q=Yojiya+Gion"
    },
    {
      id: "it-303",
      day: 3,
      date: "11/22 (日)",
      time: "18:00 PM",
      title: "高台寺 夜間拜觀 (夜楓點燈)",
      category: "景點",
      location: "高台寺",
      costJPY: 1200,
      note: "臥龍池倒映紅葉，燈光秀極美",
      mapsUrl: "https://maps.google.com/?q=Kodaiji+Temple"
    },
    {
      id: "it-1001",
      day: 10,
      date: "11/29 (日)",
      time: "09:00 AM",
      title: "前往神戶機場 (UKB) 辦理登機",
      category: "交通",
      location: "神戶機場 (UKB)",
      costJPY: 2500,
      note: "搭乘 JX835 11:30 AM 班機返回台北桃園",
      mapsUrl: "https://maps.google.com/?q=Kobe+Airport"
    }
  ],

  // Expense Records (記帳)
  expenses: [
    {
      id: "exp-001",
      date: "2026-11-20 13:00",
      title: "icoca 交通卡儲值",
      category: "交通",
      amount: 5000,
      currency: "JPY",
      card: "icoca",
      payer: "❤️",
      note: "機場儲值"
    },
    {
      id: "exp-002",
      date: "2026-11-20 18:30",
      title: "先斗町懷石晚餐",
      category: "飲食",
      amount: 12000,
      currency: "JPY",
      card: "熊本熊",
      payer: "🐷",
      note: "海外刷卡"
    },
    {
      id: "exp-003",
      date: "2026-11-21 14:45",
      title: "% ARABICA 咖啡",
      category: "飲食",
      amount: 1500,
      currency: "JPY",
      card: "吉鶴",
      payer: "❤️",
      note: "嵐山渡月橋店"
    }
  ],

  // Packing Checklist (行李清單)
  packing: [
    {
      id: "cat-1",
      category: "📄 護照與重要證件",
      items: [
        { id: "pk-1", text: "護照正本 (效期6個月以上)", checked: true },
        { id: "pk-2", text: "Visit Japan Web QR Code", checked: true },
        { id: "pk-3", text: "日幣現金與信用卡", checked: true }
      ]
    },
    {
      id: "cat-2",
      category: "🔌 電子設備與通訊",
      items: [
        { id: "pk-4", text: "日本 eSIM / 網卡", checked: true },
        { id: "pk-5", text: "行動電源 (10000mAh)", checked: true },
        { id: "pk-6", text: "手機/相機充電線", checked: false }
      ]
    },
    {
      id: "cat-3",
      category: "👔 秋季保暖衣物",
      items: [
        { id: "pk-7", text: "夜楓保暖防風外套", checked: true },
        { id: "pk-8", text: "發熱衣 / 羽絨背心", checked: true },
        { id: "pk-9", text: "好走運動鞋", checked: true }
      ]
    },
    {
      id: "cat-4",
      category: "💊 藥品與隨身備用",
      items: [
        { id: "pk-10", text: "常備感冒/止痛藥", checked: true },
        { id: "pk-11", text: "休足時間貼布", checked: true },
        { id: "pk-12", text: "護手霜與護唇膏", checked: false }
      ]
    }
  ],

  // Shopping Wishlist Grouped by Store Location
  shopping: [
    {
      id: "shop-loc-1",
      location: "祇園本店 (Yojiya)",
      category: "購物",
      note: "四條通近八坂神社",
      items: [
        {
          id: "item-101",
          name: "Yojiya 柚子吸油面紙 (3入)",
          priceJPY: 1280,
          image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&auto=format&fit=crop&q=80",
          bought: false,
          note: "京都限定柚子香"
        },
        {
          id: "item-102",
          name: "Yojiya 保濕護手霜",
          priceJPY: 2200,
          image: "https://images.unsplash.com/photo-1608248597263-00079e9631c4?w=300&auto=format&fit=crop&q=80",
          bought: false,
          note: "經典蠶絲滋潤成份"
        }
      ]
    },
    {
      id: "shop-loc-2",
      location: "京都大丸百貨",
      category: "送禮",
      note: "B1 和菓子專櫃",
      items: [
        {
          id: "item-201",
          name: "阿闍梨餅 (滿月 和菓子 10入)",
          priceJPY: 1500,
          image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&auto=format&fit=crop&q=80",
          bought: false,
          note: "丹波大納言紅豆陷名物"
        }
      ]
    }
  ]
};


