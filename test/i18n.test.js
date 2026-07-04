import { describe, it, expect } from 'vitest';
import { t } from '../src/i18n.js';

describe('t', () => {
  it('returns Finnish string', () => { expect(t('from', 'fi')).toBe('Mistä'); });
  it('returns English string', () => { expect(t('from', 'en')).toBe('From'); });
  it('falls back to fi for unknown lang', () => { expect(t('from', 'sv')).toBe('Mistä'); });
  it('returns key when string missing', () => { expect(t('nope', 'fi')).toBe('nope'); });
});
