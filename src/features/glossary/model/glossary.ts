import { TranslationKey } from '../../../shared/i18n';

export interface GlossaryEntry {
  termKey: TranslationKey;
  definitionKey: TranslationKey;
}

export const glossaryEntries: GlossaryEntry[] = [
  { termKey: 'glossaryXpTerm', definitionKey: 'glossaryXpDefinition' },
  { termKey: 'glossaryLevelTerm', definitionKey: 'glossaryLevelDefinition' },
  { termKey: 'glossaryDailyCheckInTerm', definitionKey: 'glossaryDailyCheckInDefinition' },
  { termKey: 'glossaryStatsTerm', definitionKey: 'glossaryStatsDefinition' },
  { termKey: 'glossaryPathTerm', definitionKey: 'glossaryPathDefinition' },
  { termKey: 'glossaryFocusStatTerm', definitionKey: 'glossaryFocusStatDefinition' },
  { termKey: 'glossaryReduceMotionTerm', definitionKey: 'glossaryReduceMotionDefinition' },
  { termKey: 'glossaryDemoDataTerm', definitionKey: 'glossaryDemoDataDefinition' }
];
