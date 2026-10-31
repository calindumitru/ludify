import { describe, expect, it } from 'vitest';
import { pickVoice } from './voice.ts';

const v = (name: string, lang: string, extra: Partial<{ default: boolean; localService: boolean }> = {}) =>
  ({ name, lang, default: false, localService: true, ...extra });

// A shortened list from a Mac: the browser default is an English voice.
const mac = [
  v('Samantha', 'en-US', { default: true }),
  v('Daniel', 'en-GB'),
  v('Ioana', 'ro-RO'),
  v('Ioana (Enhanced)', 'ro-RO'),
  v('Anna', 'de-DE'),
  v('Google Deutsch', 'de-DE', { localService: false }),
  v('Thomas', 'fr-FR'),
  v('Amélie', 'fr-CA'),
];

describe('pickVoice', () => {
  it('picks a voice in the deck language over the browser default', () => {
    expect(pickVoice(mac, 'de')?.name).toBe('Google Deutsch');
  });

  it('prefers an enhanced or premium voice in the same language', () => {
    expect(pickVoice(mac, 'ro')?.name).toBe('Ioana (Enhanced)');
  });

  it('prefers the exact region, then any region of the language', () => {
    expect(pickVoice(mac, 'fr-CA')?.name).toBe('Amélie');
    expect(pickVoice(mac, 'en-GB')?.name).toBe('Daniel');
    expect(pickVoice([v('Amélie', 'fr-CA')], 'fr-FR')?.name).toBe('Amélie');
  });

  it('matches language tags whatever their case or separator', () => {
    expect(pickVoice([v('Ioana', 'ro_RO')], 'RO-ro')?.name).toBe('Ioana');
  });

  it('picks the default voice among equals in the language', () => {
    expect(pickVoice(mac, 'en')?.name).toBe('Samantha');
  });

  it('returns nothing when no voice speaks the language, so the browser keeps its own choice', () => {
    expect(pickVoice(mac, 'ja')).toBeUndefined();
    expect(pickVoice([], 'en')).toBeUndefined();
  });
});
