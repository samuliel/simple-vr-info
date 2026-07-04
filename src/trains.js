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
