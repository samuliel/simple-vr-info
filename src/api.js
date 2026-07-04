export const API_BASE = 'https://rata.digitraffic.fi/api/v1';
const TTL = 7 * 86400000;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function cached(name, loader) {
  const key = `tt.cache.${name}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key));
    if (hit && Date.now() - hit.at < TTL) return hit.data;
  } catch { /* corrupt cache -> refetch */ }
  const data = await loader();
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* quota */ }
  return data;
}

export async function fetchStations() {
  return cached('stations', async () => {
    const all = await getJson(`${API_BASE}/metadata/stations`);
    return all
      .filter(s => s.passengerTraffic)
      .map(s => ({
        stationName: s.stationName.replace(/ asema$/, ''),
        stationShortCode: s.stationShortCode,
      }));
  });
}

export async function fetchCauseCodes() {
  const raw = await cached('causes', async () => {
    const [cat, det, third] = await Promise.all([
      getJson(`${API_BASE}/metadata/cause-category-codes`),
      getJson(`${API_BASE}/metadata/detailed-cause-category-codes`),
      getJson(`${API_BASE}/metadata/third-cause-category-codes`),
    ]);
    const pick = (list, codeField) => list
      .filter(c => c.passengerTerm)
      .map(c => [c[codeField], { fi: c.passengerTerm.fi, en: c.passengerTerm.en }]);
    return {
      category: pick(cat, 'categoryCode'),
      detailed: pick(det, 'detailedCategoryCode'),
      third: pick(third, 'thirdCategoryCode'),
    };
  });
  return { category: new Map(raw.category), detailed: new Map(raw.detailed), third: new Map(raw.third) };
}

export async function fetchLiveTrains(from, to) {
  return getJson(`${API_BASE}/live-trains/station/${from}/${to}`);
}
