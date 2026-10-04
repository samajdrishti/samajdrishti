import { describe, it, expect } from 'vitest';
import { toneFor } from '../components/ui';

describe('toneFor', () => {
  it.each([
    ['verified', 'ok'],
    ['completed', 'ok'],
    ['submitted', 'ok'],
    ['pending', 'warn'],
    ['assigned', 'warn'],
    ['critical', 'bad'],
    ['suspicious', 'bad'],
    ['high', 'bad'],
    ['in_progress', 'info'],
    ['live', 'info'],
  ])('maps %s → %s', (status, tone) => {
    expect(toneFor(status)).toBe(tone);
  });

  it('falls back to mute for unknown statuses', () => {
    expect(toneFor('something-else')).toBe('mute');
    expect(toneFor(null)).toBe('mute');
    expect(toneFor(undefined)).toBe('mute');
  });

  it('is case-insensitive', () => {
    expect(toneFor('VERIFIED')).toBe('ok');
    expect(toneFor('Critical')).toBe('bad');
  });
});
