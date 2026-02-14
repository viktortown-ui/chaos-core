import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('i18n', () => {
  it('uses Russian by default', () => {
    expect(t('dailyCheckIn')).toBe('Ежедневный чек-ин');
  });

  it('switches language to English', () => {
    expect(t('dailyCheckIn', 'en')).toBe('Daily Check-in');
  });
});
