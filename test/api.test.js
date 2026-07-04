import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchStations, fetchCauseCodes, fetchLiveTrains, API_BASE } from '../src/api.js';

const store = new Map();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: k => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: k => store.delete(k),
  });
  vi.stubGlobal('fetch', vi.fn());
});

describe('fetchStations', () => {
  it('filters to passenger stations, strips " asema", caches', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [
      { stationName: 'Helsinki asema', stationShortCode: 'HKI', passengerTraffic: true },
      { stationName: 'Ratapiha', stationShortCode: 'RTP', passengerTraffic: false },
    ]});
    const stations = await fetchStations();
    expect(stations).toEqual([{ stationName: 'Helsinki', stationShortCode: 'HKI' }]);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/metadata/stations`);
    await fetchStations();
    expect(fetch).toHaveBeenCalledTimes(1); // second call served from cache
  });
  it('refetches when cache is older than 7 days', async () => {
    store.set('tt.cache.stations', JSON.stringify({ at: Date.now() - 8 * 86400000, data: [] }));
    fetch.mockResolvedValue({ ok: true, json: async () => [] });
    await fetchStations();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchCauseCodes', () => {
  it('builds Maps from the three endpoints', async () => {
    fetch.mockImplementation(url => {
      const data =
        url.endsWith('/cause-category-codes') ? [{ categoryCode: 'L', passengerTerm: { fi: 'Liikenne', en: 'Traffic' } }] :
        url.endsWith('/detailed-cause-category-codes') ? [{ detailedCategoryCode: 'L2', passengerTerm: { fi: 'Ratatyö', en: 'Track work' } }] :
        [{ thirdCategoryCode: 'L201', passengerTerm: null }];
      return Promise.resolve({ ok: true, json: async () => data });
    });
    const codes = await fetchCauseCodes();
    expect(codes.category.get('L')).toEqual({ fi: 'Liikenne', en: 'Traffic' });
    expect(codes.detailed.get('L2').en).toBe('Track work');
    expect(codes.third.has('L201')).toBe(false); // no passengerTerm -> skipped
  });
});

describe('fetchLiveTrains', () => {
  it('fetches from the station pair endpoint and throws on HTTP error', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [{ trainNumber: 1 }] });
    expect(await fetchLiveTrains('HKI', 'TPE')).toEqual([{ trainNumber: 1 }]);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/live-trains/station/HKI/TPE`);
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchLiveTrains('HKI', 'TPE')).rejects.toThrow();
  });
});
