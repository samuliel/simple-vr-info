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
