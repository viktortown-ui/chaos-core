import { describe, expect, it } from 'vitest';
import { dictionaries, t } from './index';

describe('i18n', () => {
  it('uses Russian by default', () => {
    expect(t('dailyCheckIn')).toBe('Ежедневный чек-ин');
  });

  it('switches language to English', () => {
    expect(t('dailyCheckIn', 'en')).toBe('Daily Check-in');
  });

  it('has all RU keys in EN dictionary', () => {
    const ruKeys = Object.keys(dictionaries.ru).sort();
    const enKeys = Object.keys(dictionaries.en).sort();
    expect(enKeys).toEqual(ruKeys);
  });
});
