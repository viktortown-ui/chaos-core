export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const glossaryEntries: GlossaryEntry[] = [
  { term: 'XP', definition: 'Experience points earned from actions like Daily Check-ins. XP increases your Level.' },
  { term: 'Level', definition: 'Your progression rank, calculated from total XP.' },
  {
    term: 'Daily Check-in',
    definition: 'A once-per-day action that grants +10 XP and +1 to one selected stat.'
  },
  { term: 'Stats', definition: 'Your four growth attributes: Strength, Intellect, Wisdom, and Dexterity.' },
  { term: 'Path', definition: 'Your style identity (Warrior, Mage, Rogue, or Priest) chosen during onboarding.' },
  { term: 'Focus stat', definition: 'The one stat you prioritize at start to guide your progression intent.' },
  {
    term: 'Reduce motion',
    definition: 'Accessibility setting that limits animations based on system preference or app override.'
  },
  {
    term: 'Demo data',
    definition: 'A deterministic sample profile that preloads XP, stats, and history so the app is understandable immediately.'
  }
];
