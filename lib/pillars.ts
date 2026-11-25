import type { AffectState, EQAOLevel, PillarCategory } from '@/types/birdBrains';

export const PILLARS: Record<
  PillarCategory,
  { label: string; short: string; description: string; color: string }
> = {
  CON: {
    label: 'Concepts',
    short: 'Concepts',
    description: 'Understanding the mathematical ideas themselves and why methods work.',
    color: '#6366f1',
  },
  STR: {
    label: 'Strategy & Setup',
    short: 'Strategy',
    description: 'Picking a method that fits and turning the question into the right equation.',
    color: '#14b8a6',
  },
  PRC: {
    label: 'Procedure',
    short: 'Procedure',
    description: 'Carrying out the steps of a method in the right order, without dropping any.',
    color: '#8b5cf6',
  },
  FAC: {
    label: 'Calculation & Recall',
    short: 'Calculation',
    description: 'Doing the arithmetic accurately and recalling facts, units and formulas.',
    color: '#0ea5e9',
  },
  COM: {
    label: 'Communication',
    short: 'Communication',
    description: 'Answering what was asked, with units, reasons and work that can be followed.',
    color: '#f59e0b',
  },
  TST: {
    label: 'Test Habits',
    short: 'Test habits',
    description: 'Finishing questions, avoiding trap answers and checking that answers make sense.',
    color: '#64748b',
  },
};

export const PILLAR_ORDER: PillarCategory[] = ['CON', 'STR', 'PRC', 'FAC', 'COM', 'TST'];

/** `level` 2+ shows the supportive friction callout. */
export const AFFECT_META: Record<
  AffectState,
  { label: string; tone: string; badge: string; level: number }
> = {
  CONFIDENT_MASTERY: {
    label: 'Confident Mastery',
    tone: 'Steady and assured',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    level: 0,
  },
  PRODUCTIVE_STRUGGLE: {
    label: 'Productive Struggle',
    tone: 'Working hard and getting there',
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    level: 1,
  },
  RUSHED_CARELESSNESS: {
    label: 'Rushing',
    tone: 'Moving fast and skipping checks',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    level: 1,
  },
  COGNITIVE_OVERLOAD_AVOIDANCE: {
    label: 'Overloaded',
    tone: 'Stopping or avoiding when it gets heavy',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    level: 2,
  },
  HIGH_FRICTION_FRUSTRATION: {
    label: 'High Friction',
    tone: 'Frustration detected',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    level: 3,
  },
};

export const EQAO_LEVELS: EQAOLevel[] = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4'];

export function eqaoLabel(level: EQAOLevel) {
  return `Level ${level.split('_')[1]}`;
}
