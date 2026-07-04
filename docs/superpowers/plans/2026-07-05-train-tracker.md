# Finnish Railways Train Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile-first static SPA showing direct trains between two Finnish stations in the next 60 minutes, with live delay badges (MQTT) and tap-to-see delay causes.

**Architecture:** Vanilla JS + Vite SPA, no backend. Initial data from Digitraffic REST (`live-trains/station/{from}/{to}`), live updates via MQTT over WebSocket, metadata (stations, cause codes) cached in localStorage. Pure logic in `src/trains.js`, side effects in `src/api.js` / `src/mqtt.js`, DOM in `src/ui.js`.

**Tech Stack:** Vite, vanilla JS (ES modules), `mqtt` (mqtt.js), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-05-train-tracker-design.md`
- Only runtime npm dependency allowed: `mqtt`. Dev deps: `vite`, `vitest`.
- API base: `https://rata.digitraffic.fi/api/v1`
- MQTT: `wss://rata.digitraffic.fi:443/mqtt`, topic `trains-by-station/{from}`
- Delay badges: on time ≤ 1 min, yellow 2–5 min, red > 5 min, grey cancelled.
- Languages: fi and en only. Time display modes: clock ("14:32") and countdown ("12 min").
- Train window: origin DEPARTURE row scheduled-or-live-estimate within [now, now + 60 min]; destination must have a later row with `trainStopping: true`.
- localStorage keys: `tt.lang`, `tt.timeMode`, `tt.pair`, `tt.cache.<name>`.
- All UI strings go through `src/i18n.js` (no hardcoded UI text in ui.js/main.js).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/styles.css`, `.gitignore`

**Interfaces:**
- Produces: working `npm run dev`, `npm test` (Vitest), `npm run build`. `index.html` contains the static shell elements later tasks render into: `#from-input`, `#from-list`, `#to-input`, `#to-list`, `#swap`, `#lang-toggle`, `#time-toggle`, `#status`, `#trains`.

- [ ] **Step 1: Create package.json and install**

```json
{
  "name": "train-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

Run: `npm install && npm install mqtt && npm install -D vite vitest`
Expected: node_modules created, no errors.

- [ ] **Step 2: Create .gitignore, vite.config.js**

`.gitignore`:
```
node_modules/
dist/
```

`vite.config.js`:
```js
import { defineConfig } from 'vite';
export default defineConfig({});
```

- [ ] **Step 3: Create index.html shell**

```html
<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Junat</title>
  <link rel="stylesheet" href="/src/styles.css">
</head>
<body>
  <header class="controls">
    <div class="field">
      <input id="from-input" autocomplete="off" placeholder="">
      <ul id="from-list" class="suggestions" hidden></ul>
    </div>
    <button id="swap" type="button" aria-label="swap">⇅</button>
    <div class="field">
      <input id="to-input" autocomplete="off" placeholder="">
      <ul id="to-list" class="suggestions" hidden></ul>
    </div>
    <div class="toggles">
      <button id="time-toggle" type="button"></button>
      <button id="lang-toggle" type="button"></button>
    </div>
  </header>
  <div id="status" hidden></div>
  <ul id="trains"></ul>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create mobile-first src/styles.css**

```css
:root { --ontime:#1a7f37; --late:#b58900; --verylate:#c62828; --cancelled:#757575; --bg:#fff; --fg:#111; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, sans-serif; background:var(--bg); color:var(--fg); }
.controls { display:flex; flex-wrap:wrap; gap:.5rem; padding:.75rem; position:sticky; top:0; background:var(--bg); border-bottom:1px solid #ddd; }
.field { position:relative; flex:1 1 40%; }
.field input { width:100%; padding:.6rem; font-size:1rem; border:1px solid #bbb; border-radius:.5rem; }
.suggestions { position:absolute; z-index:10; left:0; right:0; margin:0; padding:0; list-style:none; background:var(--bg); border:1px solid #bbb; border-radius:.5rem; max-height:40vh; overflow-y:auto; }
.suggestions li { padding:.6rem; cursor:pointer; }
.suggestions li:hover, .suggestions li.active { background:#eef; }
.toggles { display:flex; gap:.5rem; flex:1 1 100%; }
.toggles button, #swap { padding:.5rem .8rem; font-size:1rem; border:1px solid #bbb; border-radius:.5rem; background:var(--bg); }
#status { padding:.75rem; background:#fff3cd; }
#trains { list-style:none; margin:0; padding:0; }
#trains li { border-bottom:1px solid #eee; padding:.75rem; }
.train-row { display:flex; align-items:center; gap:.75rem; }
.train-name { font-weight:600; min-width:3.5rem; }
.train-times { flex:1; }
.train-duration { color:#666; font-size:.85rem; }
.badge { padding:.2rem .5rem; border-radius:1rem; color:#fff; font-size:.85rem; white-space:nowrap; }
.badge.ontime { background:var(--ontime); } .badge.late { background:var(--late); }
.badge.verylate { background:var(--verylate); } .badge.cancelled { background:var(--cancelled); }
.causes { margin:.5rem 0 0; padding-left:1rem; color:#444; font-size:.9rem; }
.stale { opacity:.5; }
.empty { padding:2rem 1rem; text-align:center; color:#666; }
@media (min-width:700px) { body { max-width:44rem; margin:0 auto; } .toggles { flex:0 0 auto; } }
```

- [ ] **Step 5: Verify build and commit**

Run: `npm run build`
Expected: builds successfully (main.js doesn't exist yet — create an empty `src/main.js` first with `// wiring added later`).

```bash
git add -A
git commit -m "chore: scaffold Vite project with HTML shell and styles"
```

---

### Task 2: i18n module

**Files:**
- Create: `src/i18n.js`
- Test: `test/i18n.test.js`

**Interfaces:**
- Produces: `t(key, lang)` → string (lang `'fi'|'en'`, falls back to fi, then key); `defaultLang()` → `'fi'|'en'` from `navigator.language`.

- [ ] **Step 1: Write failing test**

`test/i18n.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { t } from '../src/i18n.js';

describe('t', () => {
  it('returns Finnish string', () => { expect(t('from', 'fi')).toBe('Mistä'); });
  it('returns English string', () => { expect(t('from', 'en')).toBe('From'); });
  it('falls back to fi for unknown lang', () => { expect(t('from', 'sv')).toBe('Mistä'); });
  it('returns key when string missing', () => { expect(t('nope', 'fi')).toBe('nope'); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/i18n.test.js`
Expected: FAIL (cannot resolve ../src/i18n.js)

- [ ] **Step 3: Implement src/i18n.js**

```js
const strings = {
  from:        { fi: 'Mistä', en: 'From' },
  to:          { fi: 'Minne', en: 'To' },
  onTime:      { fi: 'ajallaan', en: 'on time' },
  cancelled:   { fi: 'peruttu', en: 'cancelled' },
  noTrains:    { fi: 'Ei suoria junia seuraavan tunnin aikana', en: 'No direct trains in the next hour' },
  loadError:   { fi: 'Tietojen haku epäonnistui', en: 'Failed to load data' },
  retry:       { fi: 'Yritä uudelleen', en: 'Retry' },
  dataFrom:    { fi: 'Tiedot klo', en: 'Data from' },
  track:       { fi: 'Raide', en: 'Track' },
  clockMode:   { fi: 'Kellonaika', en: 'Clock' },
  countdownMode:{ fi: 'Minuutit', en: 'Minutes' },
  minShort:    { fi: 'min', en: 'min' },
  unknownCause:{ fi: 'Syy ei tiedossa', en: 'Reason unknown' },
};

export function t(key, lang) {
  const entry = strings[key];
  if (!entry) return key;
  return entry[lang] ?? entry.fi;
}

export function defaultLang() {
  return (typeof navigator !== 'undefined' && (navigator.language || '').startsWith('fi')) ? 'fi' : 'en';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/i18n.test.js` — Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/i18n.js test/i18n.test.js
git commit -m "feat: i18n module with fi/en strings"
```

---

### Task 3: Pure train logic (trains.js)

**Files:**
- Create: `src/trains.js`
- Test: `test/trains.test.js`

**Interfaces:**
- Consumes: raw Digitraffic train objects (`{ trainNumber, departureDate, trainType, trainCategory, commuterLineID, cancelled, timeTableRows: [{ stationShortCode, type: 'DEPARTURE'|'ARRIVAL', trainStopping, scheduledTime, liveEstimateTime, differenceInMinutes, commercialTrack, causes: [{ categoryCode, detailedCategoryCode, thirdCategoryCode }] }] }`).
- Produces (all pure, all used by ui.js/main.js):
  - `selectTrains(trains, from, to, now)` → sorted array of view models `{ id, label, cancelled, delayMinutes, scheduledDeparture: Date, bestDeparture: Date, bestArrival: Date, track, causes }`
  - `mergeTrain(trains, train)` → new array (replace by trainNumber+departureDate, else append)
  - `badgeClass(vm)` → `'ontime'|'late'|'verylate'|'cancelled'`
  - `formatClock(date)` → `'14:32'`; `formatCountdown(date, now)` → minutes number (floor, min 0)
  - `formatDuration(dep, arr)` → `'1 h 47 min'` or `'47 min'`
  - `searchStations(stations, query)` → up to 8 matches (name prefix > name substring > shortCode exact), passenger stations assumed pre-filtered
  - `resolveCauses(causes, codes, lang)` → array of strings; `codes = { category: Map, detailed: Map, third: Map }` mapping code → `{ fi, en }`

- [ ] **Step 1: Write failing tests**

`test/trains.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { selectTrains, mergeTrain, badgeClass, formatClock, formatCountdown, formatDuration, searchStations, resolveCauses } from '../src/trains.js';

const NOW = new Date('2026-07-05T10:00:00Z');
const iso = (min) => new Date(NOW.getTime() + min * 60000).toISOString();

function makeTrain(over = {}) {
  return {
    trainNumber: 27, departureDate: '2026-07-05', trainType: 'IC',
    trainCategory: 'Long-distance', commuterLineID: '', cancelled: false,
    timeTableRows: [
      { stationShortCode: 'HKI', type: 'DEPARTURE', trainStopping: true,
        scheduledTime: iso(20), differenceInMinutes: 0, commercialTrack: '7', causes: [] },
      { stationShortCode: 'TPE', type: 'ARRIVAL', trainStopping: true,
        scheduledTime: iso(120), differenceInMinutes: 0, commercialTrack: '1', causes: [] },
    ],
    ...over,
  };
}

describe('selectTrains', () => {
  it('includes a train departing within 60 min that stops at destination', () => {
    const vms = selectTrains([makeTrain()], 'HKI', 'TPE', NOW);
    expect(vms).toHaveLength(1);
    expect(vms[0].label).toBe('IC 27');
    expect(vms[0].track).toBe('7');
  });
  it('excludes trains departing after 60 min', () => {
    const t = makeTrain();
    t.timeTableRows[0].scheduledTime = iso(75);
    expect(selectTrains([t], 'HKI', 'TPE', NOW)).toHaveLength(0);
  });
  it('excludes trains already departed', () => {
    const t = makeTrain();
    t.timeTableRows[0].scheduledTime = iso(-5);
    expect(selectTrains([t], 'HKI', 'TPE', NOW)).toHaveLength(0);
  });
  it('includes past-scheduled train whose live estimate is in the window', () => {
    const t = makeTrain();
    t.timeTableRows[0].scheduledTime = iso(-5);
    t.timeTableRows[0].liveEstimateTime = iso(6);
    t.timeTableRows[0].differenceInMinutes = 11;
    const vms = selectTrains([t], 'HKI', 'TPE', NOW);
    expect(vms).toHaveLength(1);
    expect(vms[0].delayMinutes).toBe(11);
  });
  it('excludes trains not stopping at destination', () => {
    const t = makeTrain();
    t.timeTableRows[1].trainStopping = false;
    expect(selectTrains([t], 'HKI', 'TPE', NOW)).toHaveLength(0);
  });
  it('excludes trains where destination precedes origin', () => {
    const t = makeTrain();
    t.timeTableRows.reverse();
    t.timeTableRows[0].type = 'ARRIVAL'; t.timeTableRows[0].stationShortCode = 'TPE';
    t.timeTableRows[1].type = 'DEPARTURE'; t.timeTableRows[1].stationShortCode = 'HKI';
    // TPE arrival now at index 0 (earlier in route) — must not match
    expect(selectTrains([t], 'HKI', 'TPE', NOW)).toHaveLength(0);
  });
  it('sorts by departure and labels commuter trains by line', () => {
    const late = makeTrain();
    const early = makeTrain({ trainNumber: 9701, trainType: 'HL', trainCategory: 'Commuter', commuterLineID: 'R' });
    early.timeTableRows[0].scheduledTime = iso(5);
    const vms = selectTrains([late, early], 'HKI', 'TPE', NOW);
    expect(vms.map(v => v.label)).toEqual(['R', 'IC 27']);
  });
});

describe('mergeTrain', () => {
  it('replaces matching train and appends new', () => {
    const a = makeTrain();
    const updated = makeTrain(); updated.timeTableRows[0].differenceInMinutes = 4;
    const other = makeTrain({ trainNumber: 45 });
    let list = mergeTrain([a], updated);
    expect(list).toHaveLength(1);
    expect(list[0].timeTableRows[0].differenceInMinutes).toBe(4);
    list = mergeTrain(list, other);
    expect(list).toHaveLength(2);
  });
});

describe('badgeClass', () => {
  it('classifies', () => {
    expect(badgeClass({ cancelled: false, delayMinutes: 1 })).toBe('ontime');
    expect(badgeClass({ cancelled: false, delayMinutes: 3 })).toBe('late');
    expect(badgeClass({ cancelled: false, delayMinutes: 6 })).toBe('verylate');
    expect(badgeClass({ cancelled: true, delayMinutes: 0 })).toBe('cancelled');
  });
});

describe('formatting', () => {
  it('formatClock renders HH:MM', () => {
    expect(formatClock(new Date('2026-07-05T14:05:00'))).toBe('14:05');
  });
  it('formatCountdown floors minutes, min 0', () => {
    expect(formatCountdown(new Date(NOW.getTime() + 12.7 * 60000), NOW)).toBe(12);
    expect(formatCountdown(new Date(NOW.getTime() - 60000), NOW)).toBe(0);
  });
  it('formatDuration formats h+min and min-only', () => {
    expect(formatDuration(NOW, new Date(NOW.getTime() + 107 * 60000))).toBe('1 h 47 min');
    expect(formatDuration(NOW, new Date(NOW.getTime() + 47 * 60000))).toBe('47 min');
  });
});

describe('searchStations', () => {
  const stations = [
    { stationName: 'Helsinki asema', stationShortCode: 'HKI' },
    { stationName: 'Tampere asema', stationShortCode: 'TPE' },
    { stationName: 'Herrala', stationShortCode: 'HR' },
  ];
  it('matches by name prefix first', () => {
    expect(searchStations(stations, 'he')[0].stationShortCode).toBe('HKI');
  });
  it('matches by short code', () => {
    expect(searchStations(stations, 'tpe')[0].stationShortCode).toBe('TPE');
  });
  it('returns empty for blank query', () => {
    expect(searchStations(stations, ' ')).toEqual([]);
  });
});

describe('resolveCauses', () => {
  const codes = {
    category: new Map([['L', { fi: 'Liikenteenhoito', en: 'Traffic management' }]]),
    detailed: new Map([['L2', { fi: 'Ratatyö', en: 'Track work' }]]),
    third: new Map(),
  };
  it('uses most detailed available level', () => {
    expect(resolveCauses([{ categoryCode: 'L', detailedCategoryCode: 'L2' }], codes, 'en')).toEqual(['Track work']);
  });
  it('falls back to category and raw code', () => {
    expect(resolveCauses([{ categoryCode: 'L' }], codes, 'fi')).toEqual(['Liikenteenhoito']);
    expect(resolveCauses([{ categoryCode: 'X' }], codes, 'fi')).toEqual(['X']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/trains.test.js` — Expected: FAIL (module missing)

- [ ] **Step 3: Implement src/trains.js**

```js
const WINDOW_MS = 60 * 60000;

function bestTime(row) {
  return new Date(row.liveEstimateTime ?? row.scheduledTime);
}

export function selectTrains(trains, from, to, now) {
  const vms = [];
  for (const train of trains) {
    const rows = train.timeTableRows;
    const depIdx = rows.findIndex(r => r.stationShortCode === from && r.type === 'DEPARTURE');
    if (depIdx === -1) continue;
    const dep = rows[depIdx];
    const depTime = bestTime(dep);
    if (depTime < now || depTime > new Date(now.getTime() + WINDOW_MS)) continue;
    const arr = rows.slice(depIdx + 1).find(r =>
      r.stationShortCode === to && r.type === 'ARRIVAL' && r.trainStopping);
    if (!arr) continue;
    vms.push({
      id: `${train.departureDate}/${train.trainNumber}`,
      label: train.commuterLineID ? train.commuterLineID : `${train.trainType} ${train.trainNumber}`,
      cancelled: train.cancelled,
      delayMinutes: dep.differenceInMinutes ?? 0,
      scheduledDeparture: new Date(dep.scheduledTime),
      bestDeparture: depTime,
      bestArrival: bestTime(arr),
      track: dep.commercialTrack ?? '',
      causes: dep.causes ?? [],
    });
  }
  vms.sort((a, b) => a.bestDeparture - b.bestDeparture);
  return vms;
}

export function mergeTrain(trains, train) {
  const key = t => `${t.departureDate}/${t.trainNumber}`;
  const idx = trains.findIndex(t => key(t) === key(train));
  if (idx === -1) return [...trains, train];
  const next = trains.slice();
  next[idx] = train;
  return next;
}

export function badgeClass(vm) {
  if (vm.cancelled) return 'cancelled';
  if (vm.delayMinutes > 5) return 'verylate';
  if (vm.delayMinutes > 1) return 'late';
  return 'ontime';
}

export function formatClock(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatCountdown(date, now) {
  return Math.max(0, Math.floor((date - now) / 60000));
}

export function formatDuration(dep, arr) {
  const mins = Math.round((arr - dep) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function searchStations(stations, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = s => {
    const name = s.stationName.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (s.stationShortCode.toLowerCase() === q) return 1;
    if (name.includes(q)) return 2;
    return -1;
  };
  return stations
    .map(s => [score(s), s]).filter(([sc]) => sc >= 0)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 8).map(([, s]) => s);
}

export function resolveCauses(causes, codes, lang) {
  return causes.map(c => {
    const hit =
      (c.thirdCategoryCode && codes.third.get(c.thirdCategoryCode)) ||
      (c.detailedCategoryCode && codes.detailed.get(c.detailedCategoryCode)) ||
      (c.categoryCode && codes.category.get(c.categoryCode));
    if (hit) return hit[lang] ?? hit.fi;
    return c.thirdCategoryCode ?? c.detailedCategoryCode ?? c.categoryCode ?? '?';
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/trains.test.js` — Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/trains.js test/trains.test.js
git commit -m "feat: pure train selection, delay, formatting and cause logic"
```

---

### Task 4: API module with metadata caching (api.js)

**Files:**
- Create: `src/api.js`
- Test: `test/api.test.js`

**Interfaces:**
- Consumes: global `fetch`, `localStorage` (mocked in tests).
- Produces:
  - `fetchStations()` → Promise of passenger-station array `[{ stationName, stationShortCode }]` (cached, 7-day TTL, key `tt.cache.stations`)
  - `fetchCauseCodes()` → Promise of `{ category: Map, detailed: Map, third: Map }` code → `{ fi, en }` (cached as plain arrays, key `tt.cache.causes`)
  - `fetchLiveTrains(from, to)` → Promise of raw train array (never cached)
  - Exported for tests: `API_BASE = 'https://rata.digitraffic.fi/api/v1'`

- [ ] **Step 1: Write failing tests**

`test/api.test.js`:
```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/api.test.js` — Expected: FAIL (module missing)

- [ ] **Step 3: Implement src/api.js**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/api.test.js` — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api.js test/api.test.js
git commit -m "feat: Digitraffic REST client with localStorage metadata cache"
```

---

### Task 5: Rendering (ui.js)

**Files:**
- Create: `src/ui.js`
- Test: `test/ui.test.js` (Vitest with jsdom-free approach: use `environment: 'happy-dom'`? No — keep zero extra deps: test pure HTML-string builders instead)

**Interfaces:**
- Consumes: view models from `selectTrains` (Task 3), `badgeClass`, `formatClock`, `formatCountdown`, `formatDuration`, `resolveCauses` (Task 3), `t` (Task 2).
- Produces:
  - `trainRowHtml(vm, opts)` → HTML string for one `<li>`; `opts = { timeMode: 'clock'|'countdown', lang, now: Date, expanded: boolean, causeCodes }`
  - `renderTrains(listEl, vms, opts)` → replaces `listEl` children; rows carry `data-id`; expanded row includes `<ul class="causes">`; empty list renders `<li class="empty">` with `t('noTrains', lang)`
  - `renderSuggestions(listEl, stations, onPick)` → fills a suggestion `<ul>`, wires click via event delegation
  - `esc(s)` → HTML-escaped string

- [ ] **Step 1: Write failing tests (pure HTML string level)**

`test/ui.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { trainRowHtml, esc } from '../src/ui.js';

const NOW = new Date('2026-07-05T10:00:00');
const vm = {
  id: '2026-07-05/27', label: 'IC 27', cancelled: false, delayMinutes: 0,
  scheduledDeparture: new Date('2026-07-05T10:20:00'),
  bestDeparture: new Date('2026-07-05T10:20:00'),
  bestArrival: new Date('2026-07-05T12:07:00'),
  track: '7', causes: [],
};
const codes = { category: new Map(), detailed: new Map(), third: new Map() };
const base = { timeMode: 'clock', lang: 'en', now: NOW, expanded: false, causeCodes: codes };

describe('trainRowHtml', () => {
  it('clock mode shows departure clock time, duration and badge', () => {
    const html = trainRowHtml(vm, base);
    expect(html).toContain('10:20');
    expect(html).toContain('1 h 47 min');
    expect(html).toContain('badge ontime');
    expect(html).toContain('data-id="2026-07-05/27"');
  });
  it('countdown mode shows minutes until departure', () => {
    const html = trainRowHtml(vm, { ...base, timeMode: 'countdown' });
    expect(html).toContain('20 min');
  });
  it('late train shows +N min badge and causes when expanded', () => {
    const late = { ...vm, delayMinutes: 7,
      causes: [{ categoryCode: 'L' }],
      bestDeparture: new Date('2026-07-05T10:27:00') };
    const withCodes = { ...base, expanded: true,
      causeCodes: { ...codes, category: new Map([['L', { fi: 'Liikenne', en: 'Traffic' }]]) } };
    const html = trainRowHtml(late, withCodes);
    expect(html).toContain('badge verylate');
    expect(html).toContain('+7 min');
    expect(html).toContain('Traffic');
  });
  it('cancelled train shows cancelled badge', () => {
    const html = trainRowHtml({ ...vm, cancelled: true }, base);
    expect(html).toContain('badge cancelled');
    expect(html).toContain('cancelled');
  });
});

describe('esc', () => {
  it('escapes HTML', () => { expect(esc('<b>&"')).toBe('&lt;b&gt;&amp;&quot;'); });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/ui.test.js` — Expected: FAIL (module missing)

- [ ] **Step 3: Implement src/ui.js**

```js
import { badgeClass, formatClock, formatCountdown, formatDuration, resolveCauses } from './trains.js';
import { t } from './i18n.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badgeHtml(vm, lang) {
  const cls = badgeClass(vm);
  const text =
    cls === 'cancelled' ? t('cancelled', lang) :
    cls === 'ontime' ? t('onTime', lang) :
    `+${vm.delayMinutes} ${t('minShort', lang)}`;
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

export function trainRowHtml(vm, { timeMode, lang, now, expanded, causeCodes }) {
  const depText = timeMode === 'countdown'
    ? `${formatCountdown(vm.bestDeparture, now)} ${t('minShort', lang)}`
    : formatClock(vm.bestDeparture);
  const causesHtml = expanded && vm.causes.length
    ? `<ul class="causes">${resolveCauses(vm.causes, causeCodes, lang).map(c => `<li>${esc(c)}</li>`).join('')}</ul>`
    : expanded ? `<ul class="causes"><li>${esc(t('unknownCause', lang))}</li></ul>` : '';
  return `<li data-id="${esc(vm.id)}">
    <div class="train-row">
      <span class="train-name">${esc(vm.label)}</span>
      <span class="train-times">${esc(depText)} → ${formatClock(vm.bestArrival)}
        <div class="train-duration">${esc(formatDuration(vm.bestDeparture, vm.bestArrival))}
          · ${esc(t('track', lang))} ${esc(vm.track)}</div>
      </span>
      ${badgeHtml(vm, lang)}
    </div>
    ${causesHtml}
  </li>`;
}

export function renderTrains(listEl, vms, opts) {
  listEl.innerHTML = vms.length
    ? vms.map(vm => trainRowHtml(vm, { ...opts, expanded: opts.expandedId === vm.id })).join('')
    : `<li class="empty">${esc(t('noTrains', opts.lang))}</li>`;
}

export function renderSuggestions(listEl, stations, onPick) {
  listEl.innerHTML = stations
    .map(s => `<li data-code="${esc(s.stationShortCode)}">${esc(s.stationName)} (${esc(s.stationShortCode)})</li>`)
    .join('');
  listEl.hidden = stations.length === 0;
  listEl.onclick = (e) => {
    const li = e.target.closest('li[data-code]');
    if (li) onPick(stations.find(s => s.stationShortCode === li.dataset.code));
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/ui.test.js` — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui.js test/ui.test.js
git commit -m "feat: train list and suggestion rendering"
```

---

### Task 6: MQTT live updates with polling fallback (mqtt.js)

**Files:**
- Create: `src/mqtt.js`
- Test: `test/mqtt.test.js`

**Interfaces:**
- Consumes: `mqtt` package (`mqtt.connect(url)`), injected in tests.
- Produces: `subscribeStation(shortCode, handlers, connectFn?)` where `handlers = { onTrain(train), onFallbackTick() }`. Returns `{ close() }`. On MQTT error/close, starts a 30 s interval calling `onFallbackTick`; on (re)connect, clears it. `connectFn` defaults to `mqtt.connect` bound to `wss://rata.digitraffic.fi:443/mqtt`.

- [ ] **Step 1: Write failing tests**

`test/mqtt.test.js`:
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeStation } from '../src/mqtt.js';

function fakeClient() {
  const listeners = {};
  return {
    on: vi.fn((ev, cb) => { (listeners[ev] ??= []).push(cb); }),
    emit: (ev, ...args) => (listeners[ev] ?? []).forEach(cb => cb(...args)),
    subscribe: vi.fn(),
    end: vi.fn(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('subscribeStation', () => {
  it('subscribes to the station topic on connect and forwards parsed trains', () => {
    const client = fakeClient();
    const onTrain = vi.fn();
    subscribeStation('HKI', { onTrain, onFallbackTick: vi.fn() }, () => client);
    client.emit('connect');
    expect(client.subscribe).toHaveBeenCalledWith('trains-by-station/HKI');
    client.emit('message', 'trains-by-station/HKI', Buffer.from(JSON.stringify({ trainNumber: 27 })));
    expect(onTrain).toHaveBeenCalledWith({ trainNumber: 27 });
  });
  it('ignores malformed messages', () => {
    const client = fakeClient();
    const onTrain = vi.fn();
    subscribeStation('HKI', { onTrain, onFallbackTick: vi.fn() }, () => client);
    client.emit('message', 't', Buffer.from('not json'));
    expect(onTrain).not.toHaveBeenCalled();
  });
  it('polls every 30 s while disconnected, stops on reconnect and close()', () => {
    const client = fakeClient();
    const onFallbackTick = vi.fn();
    const sub = subscribeStation('HKI', { onTrain: vi.fn(), onFallbackTick }, () => client);
    client.emit('close');
    vi.advanceTimersByTime(65000);
    expect(onFallbackTick).toHaveBeenCalledTimes(2);
    client.emit('connect');
    vi.advanceTimersByTime(65000);
    expect(onFallbackTick).toHaveBeenCalledTimes(2);
    sub.close();
    expect(client.end).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mqtt.test.js` — Expected: FAIL (module missing)

- [ ] **Step 3: Implement src/mqtt.js**

```js
import mqtt from 'mqtt';

const MQTT_URL = 'wss://rata.digitraffic.fi:443/mqtt';
const FALLBACK_MS = 30000;

export function subscribeStation(shortCode, { onTrain, onFallbackTick }, connectFn = () => mqtt.connect(MQTT_URL)) {
  const client = connectFn();
  let fallbackTimer = null;

  const startFallback = () => {
    if (!fallbackTimer) fallbackTimer = setInterval(onFallbackTick, FALLBACK_MS);
  };
  const stopFallback = () => {
    if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
  };

  client.on('connect', () => {
    stopFallback();
    client.subscribe(`trains-by-station/${shortCode}`);
  });
  client.on('close', startFallback);
  client.on('error', startFallback);
  client.on('message', (_topic, payload) => {
    try { onTrain(JSON.parse(payload.toString())); } catch { /* ignore malformed */ }
  });

  return {
    close() {
      stopFallback();
      client.end();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mqtt.test.js` — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mqtt.js test/mqtt.test.js
git commit -m "feat: MQTT station subscription with 30s polling fallback"
```

---

### Task 7: App wiring (main.js)

**Files:**
- Modify: `src/main.js` (replace placeholder)

**Interfaces:**
- Consumes everything from Tasks 2–6. No new exports (entry point); logic added here must stay thin — anything testable belongs in trains.js.

No unit tests for this task (glue code); verification is the smoke test in Task 8. Steps:

- [ ] **Step 1: Implement src/main.js**

```js
import { fetchStations, fetchCauseCodes, fetchLiveTrains } from './api.js';
import { subscribeStation } from './mqtt.js';
import { selectTrains, mergeTrain, searchStations } from './trains.js';
import { renderTrains, renderSuggestions, esc } from './ui.js';
import { t, defaultLang } from './i18n.js';

const $ = id => document.getElementById(id);

const state = {
  lang: localStorage.getItem('tt.lang') ?? defaultLang(),
  timeMode: localStorage.getItem('tt.timeMode') ?? 'clock',
  from: null, to: null,          // station objects {stationName, stationShortCode}
  stations: [], causeCodes: { category: new Map(), detailed: new Map(), third: new Map() },
  trains: [], expandedId: null,
  lastFetchAt: null, error: false,
  sub: null,
};

function render() {
  $('from-input').placeholder = t('from', state.lang);
  $('to-input').placeholder = t('to', state.lang);
  $('lang-toggle').textContent = state.lang === 'fi' ? 'EN' : 'FI';
  $('time-toggle').textContent = state.timeMode === 'clock' ? t('countdownMode', state.lang) : t('clockMode', state.lang);

  const status = $('status');
  if (state.error && state.lastFetchAt) {
    status.hidden = false;
    status.innerHTML = `${esc(t('loadError', state.lang))} — ${esc(t('dataFrom', state.lang))} ` +
      `${state.lastFetchAt.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })} ` +
      `<button id="retry">${esc(t('retry', state.lang))}</button>`;
    document.getElementById('retry').onclick = refresh;
  } else if (state.error) {
    status.hidden = false;
    status.innerHTML = `${esc(t('loadError', state.lang))} <button id="retry">${esc(t('retry', state.lang))}</button>`;
    document.getElementById('retry').onclick = refresh;
  } else {
    status.hidden = true;
  }

  const list = $('trains');
  list.classList.toggle('stale', state.error);
  if (state.from && state.to) {
    const vms = selectTrains(state.trains, state.from.stationShortCode, state.to.stationShortCode, new Date());
    renderTrains(list, vms, {
      timeMode: state.timeMode, lang: state.lang, now: new Date(),
      expandedId: state.expandedId, causeCodes: state.causeCodes,
    });
  } else {
    list.innerHTML = '';
  }
}

async function refresh() {
  if (!state.from || !state.to) return;
  try {
    state.trains = await fetchLiveTrains(state.from.stationShortCode, state.to.stationShortCode);
    state.lastFetchAt = new Date();
    state.error = false;
  } catch {
    state.error = true;
  }
  render();
}

function setPair(from, to) {
  state.from = from; state.to = to; state.trains = []; state.expandedId = null;
  if (from) $('from-input').value = from.stationName;
  if (to) $('to-input').value = to.stationName;
  if (from && to) {
    location.hash = `#${from.stationShortCode}/${to.stationShortCode}`;
    localStorage.setItem('tt.pair', `${from.stationShortCode}/${to.stationShortCode}`);
    state.sub?.close();
    state.sub = subscribeStation(from.stationShortCode, {
      onTrain: (train) => { state.trains = mergeTrain(state.trains, train); render(); },
      onFallbackTick: refresh,
    });
    refresh();
  }
  render();
}

function wireAutocomplete(inputId, listId, pick) {
  const input = $(inputId), list = $(listId);
  input.addEventListener('input', () => {
    renderSuggestions(list, searchStations(state.stations, input.value), (s) => {
      list.hidden = true;
      pick(s);
    });
  });
  input.addEventListener('focus', () => input.select());
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 200));
}

function restorePair() {
  const source = location.hash.slice(1) || localStorage.getItem('tt.pair') || '';
  const [f, tCode] = source.split('/');
  const find = code => state.stations.find(s => s.stationShortCode === code) ?? null;
  if (f && tCode) setPair(find(f), find(tCode));
}

async function init() {
  render();
  try {
    [state.stations, state.causeCodes] = await Promise.all([fetchStations(), fetchCauseCodes()]);
  } catch {
    state.error = true;
    render();
    return;
  }

  wireAutocomplete('from-input', 'from-list', s => setPair(s, state.to));
  wireAutocomplete('to-input', 'to-list', s => setPair(state.from, s));

  $('swap').onclick = () => state.from && state.to && setPair(state.to, state.from);
  $('lang-toggle').onclick = () => {
    state.lang = state.lang === 'fi' ? 'en' : 'fi';
    localStorage.setItem('tt.lang', state.lang);
    render();
  };
  $('time-toggle').onclick = () => {
    state.timeMode = state.timeMode === 'clock' ? 'countdown' : 'clock';
    localStorage.setItem('tt.timeMode', state.timeMode);
    render();
  };
  $('trains').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    state.expandedId = state.expandedId === li.dataset.id ? null : li.dataset.id;
    render();
  });
  window.addEventListener('hashchange', restorePair);

  setInterval(render, 30000);        // countdown freshness + window sliding
  setInterval(refresh, 5 * 60000);   // REST safety net

  restorePair();
}

init();
```

- [ ] **Step 2: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: wire app state, autocomplete, toggles, timers and live updates"
```

---

### Task 8: Live smoke test and fixture-based regression test

**Files:**
- Create: `test/fixtures/live-trains-hki-tpe.json` (captured from real API)
- Create: `test/integration.test.js`

**Interfaces:**
- Consumes: `selectTrains` from Task 3.

- [ ] **Step 1: Capture a real API fixture**

Run:
```bash
curl -s "https://rata.digitraffic.fi/api/v1/live-trains/station/HKI/TPE" -o test/fixtures/live-trains-hki-tpe.json
```
Expected: valid JSON array of trains (check with `node -e "console.log(JSON.parse(require('fs').readFileSync('test/fixtures/live-trains-hki-tpe.json')).length)"` → a number > 0).

- [ ] **Step 2: Write regression test against the fixture**

`test/integration.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { selectTrains } from '../src/trains.js';

const trains = JSON.parse(readFileSync(new URL('./fixtures/live-trains-hki-tpe.json', import.meta.url)));

describe('selectTrains against real API data', () => {
  it('parses real payload without throwing and produces well-formed view models', () => {
    // Fixed "now" = earliest HKI departure in fixture, so the window is non-empty
    const times = trains.flatMap(t => t.timeTableRows
      .filter(r => r.stationShortCode === 'HKI' && r.type === 'DEPARTURE')
      .map(r => new Date(r.scheduledTime).getTime()));
    const now = new Date(Math.min(...times));
    const vms = selectTrains(trains, 'HKI', 'TPE', now);
    expect(vms.length).toBeGreaterThan(0);
    for (const vm of vms) {
      expect(vm.id).toMatch(/^\d{4}-\d{2}-\d{2}\/\d+$/);
      expect(vm.bestArrival.getTime()).toBeGreaterThan(vm.bestDeparture.getTime());
      expect(typeof vm.delayMinutes).toBe('number');
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test` — Expected: all PASS.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the printed URL:
1. Type "hel" in From → pick Helsinki; "tam" in To → pick Tampere.
2. Verify trains list appears, sorted, with durations and badges; URL hash is `#HKI/TPE`.
3. Toggle time mode → departure times switch to "N min". Toggle language → labels switch.
4. Tap a late train (if any) → causes expand.
5. Reload page → pair restored. Test at 390px viewport width (mobile) in devtools.

- [ ] **Step 5: Commit**

```bash
git add test/fixtures/live-trains-hki-tpe.json test/integration.test.js
git commit -m "test: real-API fixture regression test"
```
