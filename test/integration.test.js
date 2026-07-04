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
