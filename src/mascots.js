// The things you hunt on the board. All artwork is original to this project.
//
// Every mascot is a 64x64 SVG that has to stay readable at roughly 34px on a
// 10x10 phone board, so: bold shapes, thick strokes, no fine detail.

export const MASCOTS = [
  {
    id: 'poop',
    name: '大便',
    unit: '坨',
    accent: '#8b5c37',
    // Toilets stand in for the crosses: a flat silhouette, because this glyph
    // ends up on most of the board at low opacity.
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5.5" y="2" width="13" height="6.5" rx="1.8"/>
      <path d="M2.2 9.8h19.6v1.6c0 2.7-1.9 5-4.6 5.7v2.4H7.4v-2.4c-2.7-.7-4.6-3-4.6-5.7z"/>
      <rect x="4.6" y="19.6" width="14.8" height="2.4" rx="1.2"/>
    </svg>`,
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="13" rx="5" ry="4" fill="#a5713f"/>
      <ellipse cx="32" cy="21" rx="9.6" ry="6" fill="#99673e"/>
      <ellipse cx="32" cy="32" rx="14.6" ry="8" fill="#8b5c37"/>
      <ellipse cx="32" cy="45.5" rx="20" ry="10" fill="#7d5130"/>
      <ellipse cx="25.6" cy="30.4" rx="3.6" ry="4.2" fill="#fff"/>
      <ellipse cx="38.4" cy="30.4" rx="3.6" ry="4.2" fill="#fff"/>
      <circle cx="26.2" cy="31" r="2" fill="#2b1f15"/>
      <circle cx="39" cy="31" r="2" fill="#2b1f15"/>
      <path d="M24 39.5q8 6.5 16 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'cat',
    name: '貓咪',
    unit: '隻',
    accent: '#e08a3c',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M13 27 11 6l17 10z" fill="#f0a35a"/>
      <path d="M51 27 53 6 36 16z" fill="#f0a35a"/>
      <path d="M15.8 23.5 15 12l8.6 5z" fill="#f2aab4"/>
      <path d="M48.2 23.5 49 12l-8.6 5z" fill="#f2aab4"/>
      <ellipse cx="32" cy="34" rx="22.5" ry="20.5" fill="#f6b877"/>
      <path d="M22 14q5 4 10 4t10-4" stroke="#d3883c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="32" cy="43" rx="12" ry="8.5" fill="#fff6ea"/>
      <ellipse cx="23" cy="32" rx="3.5" ry="4.4" fill="#2f2419"/>
      <ellipse cx="41" cy="32" rx="3.5" ry="4.4" fill="#2f2419"/>
      <circle cx="24.3" cy="30.5" r="1.1" fill="#fff"/>
      <circle cx="42.3" cy="30.5" r="1.1" fill="#fff"/>
      <path d="M28.8 39.3h6.4L32 42.6z" fill="#e0737f" stroke="#e0737f" stroke-width="2" stroke-linejoin="round"/>
      <path d="M32 43.4v1.8M32 45.2q-3.2 2.9-6 .2M32 45.2q3.2 2.9 6 .2" stroke="#2f2419" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M13 38h-7M13 43.5l-6.5 2.5M51 38h7M51 43.5l6.5 2.5" stroke="#2f2419" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
    </svg>`,
  },
  {
    id: 'shiba',
    name: '柴犬',
    unit: '隻',
    accent: '#d97b34',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M15 23 12 5l15 10z" fill="#c97c3c"/>
      <path d="M49 23 52 5 37 15z" fill="#c97c3c"/>
      <path d="M17.5 20 16 11l7.5 5z" fill="#8c4a21"/>
      <path d="M46.5 20 48 11l-7.5 5z" fill="#8c4a21"/>
      <path d="M32 11c14 0 22 10 22 22s-10 22-22 22S10 45 10 33s8-22 22-22z" fill="#e8a45d"/>
      <path d="M32 29c10 0 16 6 16 13s-7 14-16 14-16-6.5-16-14 6-13 16-13z" fill="#fff7ec"/>
      <circle cx="21.5" cy="24" r="1.8" fill="#c9803f"/>
      <circle cx="42.5" cy="24" r="1.8" fill="#c9803f"/>
      <ellipse cx="24" cy="31.5" rx="3.1" ry="3.7" fill="#33241a"/>
      <ellipse cx="40" cy="31.5" rx="3.1" ry="3.7" fill="#33241a"/>
      <circle cx="25.2" cy="30.1" r="1.05" fill="#fff"/>
      <circle cx="41.2" cy="30.1" r="1.05" fill="#fff"/>
      <path d="M28.6 37h6.8L32 41.4z" fill="#33241a" stroke="#33241a" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M32 42.2v1.9M32 44.1q-3.4 3.1-6.4.2M32 44.1q3.4 3.1 6.4.2" stroke="#33241a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'boba',
    name: '珍奶',
    unit: '杯',
    accent: '#a5703f',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="35" y="2" width="6" height="22" rx="3" fill="#e5675c" transform="rotate(14 38 13)"/>
      <path d="M17 20h30l-3.2 32q-.3 3.2-3.5 3.2H23.7q-3.2 0-3.5-3.2z" fill="#e3c398"/>
      <path d="M19.4 40h25.2l-1.8 12q-.3 3.2-3.5 3.2H24.7q-3.2 0-3.5-3.2z" fill="#d9b183"/>
      <circle cx="26" cy="46" r="3.4" fill="#33241a"/><circle cx="34.5" cy="49" r="3.4" fill="#33241a"/>
      <circle cx="42" cy="45" r="3.4" fill="#33241a"/><circle cx="30" cy="54" r="3.4" fill="#33241a"/>
      <circle cx="39" cy="54" r="3.2" fill="#33241a"/>
      <rect x="13" y="14" width="38" height="7" rx="3.5" fill="#fbf5ea" stroke="#d8c4a6" stroke-width="1.5"/>
      <path d="M23 26v9" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>
      <ellipse cx="25" cy="30" rx="2.6" ry="3" fill="#33241a"/>
      <ellipse cx="38" cy="30" rx="2.6" ry="3" fill="#33241a"/>
      <path d="M28 35q3.5 3 7 0" stroke="#33241a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'chicken',
    name: '雞排',
    unit: '塊',
    accent: '#c4772a',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="#c07f2e"><circle cx="57.0" cy="34.0" r="5.4"/><circle cx="54.8" cy="41.1" r="5.4"/><circle cx="48.7" cy="47.0" r="5.4"/><circle cx="39.7" cy="50.6" r="5.4"/><circle cx="29.4" cy="51.4" r="5.4"/><circle cx="19.5" cy="49.2" r="5.4"/><circle cx="11.8" cy="44.3" r="5.4"/><circle cx="7.5" cy="37.6" r="5.4"/><circle cx="7.5" cy="30.4" r="5.4"/><circle cx="11.8" cy="23.7" r="5.4"/><circle cx="19.5" cy="18.8" r="5.4"/><circle cx="29.4" cy="16.6" r="5.4"/><circle cx="39.7" cy="17.4" r="5.4"/><circle cx="48.7" cy="21.0" r="5.4"/><circle cx="54.8" cy="26.9" r="5.4"/></g>
      <ellipse cx="32" cy="34" rx="25.5" ry="18" fill="#c07f2e"/>
      <ellipse cx="32" cy="33" rx="21" ry="14" fill="#e6ad5c"/>
      <g fill="#a4661f" opacity=".75">
        <circle cx="21" cy="26" r="1.7"/><circle cx="44" cy="25" r="1.4"/>
        <circle cx="47" cy="38" r="1.7"/><circle cx="17" cy="38" r="1.4"/>
        <circle cx="32" cy="24" r="1.3"/><circle cx="25" cy="43" r="1.5"/>
        <circle cx="41" cy="43" r="1.3"/>
      </g>
      <path d="M40 15q5-5 10-3-2 6-8 6z" fill="#5f9440"/>
      <ellipse cx="25" cy="32" rx="2.9" ry="3.4" fill="#33241a"/>
      <ellipse cx="39" cy="32" rx="2.9" ry="3.4" fill="#33241a"/>
      <circle cx="26.1" cy="30.8" r="1" fill="#fff"/><circle cx="40.1" cy="30.8" r="1" fill="#fff"/>
      <path d="M27 39.5q5 4.5 10 0" stroke="#33241a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'cooker',
    name: '電鍋',
    unit: '個',
    accent: '#7d8b93',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="27" y="12" width="10" height="6" rx="3" fill="#6f6f6f"/>
      <path d="M11 30q3-13 21-13t21 13z" fill="#eceae3"/>
      <rect x="6" y="28" width="52" height="6" rx="3" fill="#cfccc3"/>
      <path d="M11 34h42v12q0 8-8 8H19q-8 0-8-8z" fill="#f5f3ec"/>
      <rect x="3" y="36" width="9" height="6" rx="3" fill="#b9b6ad"/>
      <rect x="52" y="36" width="9" height="6" rx="3" fill="#b9b6ad"/>
      <circle cx="45" cy="47" r="2.8" fill="#d9483c"/>
      <ellipse cx="24" cy="42" rx="2.8" ry="3.3" fill="#33241a"/>
      <ellipse cx="35" cy="42" rx="2.8" ry="3.3" fill="#33241a"/>
      <circle cx="25.1" cy="40.9" r="1" fill="#fff"/><circle cx="36.1" cy="40.9" r="1" fill="#fff"/>
      <path d="M25 47.5q4.5 3.5 9 0" stroke="#33241a" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <path d="M21 25q1.5-5 4.5-7M32 22q1-4 3.5-6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".75"/>
    </svg>`,
  },
  {
    id: 'toilet',
    name: '馬桶',
    unit: '個',
    accent: '#5b8fb0',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="15" y="3" width="34" height="16" rx="4" fill="#f2f6f8" stroke="#c3d2da" stroke-width="2"/>
      <circle cx="42.5" cy="7.5" r="2.3" fill="#b6c7d1"/>
      <path d="M11 21h42v6q0 13-11 17H22q-11-4-11-17z" fill="#fafcfd" stroke="#c3d2da" stroke-width="2"/>
      <ellipse cx="32" cy="29" rx="17.5" ry="8.5" fill="#e6eef2"/>
      <ellipse cx="32" cy="30" rx="11.5" ry="5" fill="#a9c6d6"/>
      <path d="M24 46h16l2 7H22z" fill="#e6eef2" stroke="#c3d2da" stroke-width="2"/>
      <ellipse cx="32" cy="16.5" rx="3.6" ry="3" fill="#a5713f"/>
      <ellipse cx="32" cy="21.5" rx="6.6" ry="4.6" fill="#99673e"/>
      <ellipse cx="32" cy="28.5" rx="9.6" ry="5.6" fill="#8b5c37"/>
      <ellipse cx="32" cy="36" rx="12.2" ry="6.6" fill="#7d5130"/>
      <ellipse cx="27.6" cy="27.6" rx="3" ry="3.5" fill="#fff"/>
      <ellipse cx="36.4" cy="27.6" rx="3" ry="3.5" fill="#fff"/>
      <circle cx="28.1" cy="28.1" r="1.6" fill="#2b1f15"/>
      <circle cx="36.9" cy="28.1" r="1.6" fill="#2b1f15"/>
      <path d="M27 34q5 4.2 10 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'durian',
    name: '榴槤',
    unit: '顆',
    accent: '#6f8c35',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M33 4h-2l-1 7h4z" fill="#7c5a2e"/>
      <path d="M32 9.5 35.5 18.9 42.9 12.2 41.6 22.1 51.3 19.7 45.6 27.9 55.3 30.2 46.4 34.7 54 41.3 43.9 41.2 47.6 50.6 38.7 45.8 37.6 55.8 32 47.5 26.4 55.8 25.3 45.8 16.4 50.6 20.1 41.2 10 41.3 17.6 34.7 8.7 30.2 18.4 27.9 12.7 19.7 22.4 22.1 21.1 12.2 28.5 18.9Z" fill="#8ba844" stroke="#6f8c35" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="32" cy="33" r="14" fill="#9cba51"/>
      <ellipse cx="26" cy="31" rx="2.9" ry="3.4" fill="#2f2a14"/>
      <ellipse cx="38" cy="31" rx="2.9" ry="3.4" fill="#2f2a14"/>
      <circle cx="27.1" cy="29.8" r="1" fill="#fff"/><circle cx="39.1" cy="29.8" r="1" fill="#fff"/>
      <path d="M27 38q5 4.5 10 0" stroke="#2f2a14" stroke-width="2.1" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'alien',
    name: '外星人',
    unit: '隻',
    accent: '#4f9e5e',
    svg: `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M22 8q-4 3-3 7M42 8q4 3 3 7" stroke="#79c96a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="19" cy="6" r="3.2" fill="#c9f07a"/><circle cx="45" cy="6" r="3.2" fill="#c9f07a"/>
      <path d="M32 11c13 0 22 9 22 20 0 13-10 24-22 24S10 44 10 31c0-11 9-20 22-20z" fill="#86cf70"/>
      <path d="M32 15c10 0 17 7 17 15 0 4-3 6-6 4-4-2-7-3-11-3s-7 1-11 3c-3 2-6 0-6-4 0-8 7-15 17-15z" fill="#a4e08c" opacity=".6"/>
      <path d="M19 28q6-3 9 2t-4 8-8-4 3-6z" fill="#1d1b26"/>
      <path d="M45 28q-6-3-9 2t4 8 8-4-3-6z" fill="#1d1b26"/>
      <circle cx="22.5" cy="30.5" r="1.7" fill="#fff" opacity=".85"/>
      <circle cx="41.5" cy="30.5" r="1.7" fill="#fff" opacity=".85"/>
      <path d="M27 45q5 3.5 10 0" stroke="#3d7a45" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
];

export const DEFAULT_MASCOT = 'poop';

export function getMascot(id) {
  return MASCOTS.find((mascot) => mascot.id === id) || MASCOTS[0];
}
