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
