// Shared house config — used by both the frontend (as a <script> tag, via `window.HOUSES`)
// and the backend (via `require()`), so floor/color/emoji data only lives in one place.
const HOUSES = {
  roc:     { key: 'roc',     name: 'Roc',     emoji: '🐺', levels: [3, 4, 5],    primary: '#3b82f6', secondary: '#2563eb', onPrimary: '#ffffff' },
  dragon:  { key: 'dragon',  name: 'Dragon',  emoji: '🐉', levels: [6, 7, 8],    primary: '#22c55e', secondary: '#16a34a', onPrimary: '#ffffff' },
  garuda:  { key: 'garuda',  name: 'Garuda',  emoji: '🐤', levels: [9, 10, 11],  primary: '#f1c40f', secondary: '#f39c12', onPrimary: '#000000' },
  phoenix: { key: 'phoenix', name: 'Phoenix', emoji: '🐦‍🔥', levels: [12, 13, 14], primary: '#ef4444', secondary: '#dc2626', onPrimary: '#ffffff' },
  tulpar:  { key: 'tulpar',  name: 'Tulpar',  emoji: '🐎', levels: [15, 16, 17], primary: '#1e293b', secondary: '#0f172a', onPrimary: '#ffffff' },
};

const HOUSE_ORDER = ['roc', 'dragon', 'garuda', 'phoenix', 'tulpar'];

function getHouseForLevel(level) {
  return Object.values(HOUSES).find(h => h.levels.includes(level));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HOUSES, HOUSE_ORDER, getHouseForLevel };
}
if (typeof window !== 'undefined') {
  window.HOUSES = HOUSES;
  window.HOUSE_ORDER = HOUSE_ORDER;
  window.getHouseForLevel = getHouseForLevel;
}
