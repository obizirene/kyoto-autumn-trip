// Phase 2A: presentation only. No data normalization or observers.
(function () {
'use strict';
const registry = Object.freeze({
  "bed": "<path d=\"M3 18v3m18-3v3M3 18V7h18v11ZM3 12h18M7 7v5m10-5v5\"/>",
  "calendar": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M16 3v4M8 3v4M3 11h18\"/>",
  "cart": "<path d=\"M2 3h3l3 13h11l3-9H6\"/><circle cx=\"9\" cy=\"21\" r=\"1\"/><circle cx=\"18\" cy=\"21\" r=\"1\"/>",
  "chart": "<path d=\"M3 3v18h18M7 16v-4m5 4V8m5 8V5\"/>",
  "check": "<path d=\"m5 12 4 4L19 6\"/>",
  "clipboard": "<rect x=\"5\" y=\"5\" width=\"14\" height=\"16\" rx=\"2\"/><rect x=\"9\" y=\"3\" width=\"6\" height=\"4\" rx=\"1\"/><path d=\"M9 12h6m-6 4h6\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  "cloud": "<path d=\"M20 16a4 4 0 0 0-1-7.9A6 6 0 0 0 7 7a4.5 4.5 0 0 0 0 9Z\"/>",
  "coffee": "<path d=\"M3 8h13v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM16 9h2a3 3 0 0 1 0 6h-2M6 2v3m4-3v3m4-3v3\"/>",
  "creditCard": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"M2 10h20M6 15h3\"/>",
  "download": "<path d=\"M12 3v13m-4-4 4 4 4-4M4 16v5h16v-5\"/>",
  "folder": "<path d=\"M3 7V4h6l3 3h9v13H3Z\"/>",
  "grip": "<circle cx=\"9\" cy=\"5\" r=\"1\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><circle cx=\"9\" cy=\"12\" r=\"1\"/><circle cx=\"15\" cy=\"12\" r=\"1\"/><circle cx=\"9\" cy=\"19\" r=\"1\"/><circle cx=\"15\" cy=\"19\" r=\"1\"/>",
  "gift": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"4\"/><path d=\"M5 12v9h14v-9M12 8v13\"/><path d=\"M12 8H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z\"/>",
  "leaf": "<path d=\"M20 3c-9-1-16 2-16 9a7 7 0 0 0 7 7c7 0 10-7 9-16ZM3 21 15 9\"/>",
  "lightbulb": "<path d=\"M9 18h6m-5 3h4M9 15a6 6 0 1 1 6 0v3H9Z\"/>",
  "link": "<path d=\"m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0\"/>",
  "luggage": "<rect x=\"5\" y=\"6\" width=\"14\" height=\"14\" rx=\"2\"/><path d=\"M9 6V3h6v3M9 10v6m6-6v6M8 20v2m8-2v2\"/>",
  "map": "<path d=\"m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15m6-12v15\"/>",
  "mapPin": "<path d=\"M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
  "message": "<path d=\"M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z\"/><path d=\"M7 8h10M7 12h7\"/>",
  "notebook": "<rect x=\"5\" y=\"3\" width=\"15\" height=\"18\" rx=\"2\"/><path d=\"M9 3v18M3 7h4m-4 5h4m-4 5h4m6-10h4m-4 5h4\"/>",
  "package": "<path d=\"m12 3 9 5v9l-9 5-9-5V8ZM3 8l9 5 9-5m-9 5v9M7 5l10 6\"/>",
  "pencil": "<path d=\"m16 3 5 5-12 12-6 1 1-6Z\"/><path d=\"m14 5 5 5\"/>",
  "plane": "<path d=\"M22 12a2 2 0 0 1-2 2h-5l-4 7H8l2-7H5l-2 3H2l1-5-1-5h1l2 3h5L8 3h3l4 7h5a2 2 0 0 1 2 2Z\"/>",
  "plus": "<path d=\"M12 5v14M5 12h14\"/>",
  "save": "<path d=\"M3 3h15l3 3v15H3ZM7 3v6h9V3M7 21v-8h10v8\"/>",
  "settings": "<path d=\"M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
  "shield": "<path d=\"m12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7Z\"/>",
  "shoppingBag": "<path d=\"M3 7h18l-1 14H4ZM8 7V5a4 4 0 0 1 8 0v2\"/>",
  "sparkles": "<path d=\"m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7ZM20 2v4m-2-2h4\"/>",
  "ticket": "<path d=\"M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4ZM15 5v3m0 3v2m0 3v3\"/>",
  "train": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"15\" rx=\"3\"/><path d=\"M5 10h14M9 3v7m6-7v7M7 22l3-4m7 4-3-4\"/><circle cx=\"9\" cy=\"14\" r=\"1\"/><circle cx=\"15\" cy=\"14\" r=\"1\"/>",
  "trash": "<path d=\"M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7\"/>",
  "upload": "<path d=\"M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5\"/>",
  "user": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21v-2a8 8 0 0 1 16 0v2\"/>",
  "circleUserRound": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/><path d=\"M6 20a6 6 0 0 1 12 0\"/>",
  "utensils": "<path d=\"M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 0-5 7-5 10h5\"/>",
  "wallet": "<path d=\"M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h15v12H6a3 3 0 0 1-3-3V6\"/><path d=\"M21 12h-5v5h5\"/>",
  "warning": "<path d=\"m12 3 10 18H2ZM12 9v4m0 4h.01\"/>",
  "wifi": "<path d=\"M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0M12 20h.01\"/>",
  "x": "<path d=\"m6 6 12 12M6 18 18 6\"/>"
});
const categories = Object.freeze({"交通":"train","送禮":"gift","住宿":"bed","其他":"package","飲食":"utensils","網路":"wifi","機票":"plane","購物":"shoppingBag","保險":"shield","門票":"ticket","正餐":"utensils","點心":"coffee","景點":"leaf"});
window.uiIcon = function(name, tone='muted', extra='') {
  if (!Object.hasOwn(registry, name)) throw new Error('Unknown UI icon: '+name);
  if (!['muted','active','strong','travel','danger','warning','inherit'].includes(tone)) throw new Error('Unknown icon tone');
  if (extra !== '' && extra !== 'itinerary-outline-icon') throw new Error('Unknown icon class');
  return '<svg class="ui-icon ui-icon--'+tone+(extra ? ' '+extra : '')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+registry[name]+'</svg>';
};
window.uiSetIconText = function(el, name, text, tone='muted') {
  if (!el) return;
  el.replaceChildren();
  if (name) { const template=document.createElement('template'); template.innerHTML=window.uiIcon(name,tone); el.appendChild(template.content); }
  el.appendChild(document.createTextNode((name ? ' ' : '')+String(text ?? '')));
};
window.uiOwnerPresentation = function(value) {
  if (value === '❤️') return window.uiIcon('user')+' 我';
  if (value === '🐷') return window.uiIcon('circleUserRound')+' 老公';
  return value;
};
window.uiCategoryText = function(id, originalLabel) { return Object.hasOwn(categories,id) ? id : originalLabel; };
window.uiCategoryPresentation = function(id, originalLabel) { return Object.hasOwn(categories,id) ? window.uiIcon(categories[id])+' '+id : originalLabel; };
})();
