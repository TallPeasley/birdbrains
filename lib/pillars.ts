import type { AffectState, EQAOLevel, PillarCategory } from '@/types/birdBrains';

export const PILLARS: Record<
  PillarCategory,
  { label: string; short: string; description: string; color: string }
> = {
  CONCEPTUAL: {
    label: 'Conceptual Understanding',
    short: 'Conceptual',
    description: 'Grasp of the underlying mathematical ideas and why methods work.',
    color: '#6366f1',
  },
  PROCEDURAL: {
    label: 'Procedural Accuracy',
    short: 'Procedural',
    description: 'Carrying out steps, arithmetic and algebra correctly.',
    color: '#8b5cf6',
  },
  REPRESENTATION: {
    label: 'Representation & Modeling',
    short: 'Representation',
    description: 'Translating between equations, graphs, tables and context.',
    color: '#0ea5e9',
  },
  COMMUNICATION: {
    label: 'Communication',
    short: 'Communication',
    description: 'Explaining reasoning clearly with labelled, ordered steps.',
    color: '#64748b',
  },
};

export const PILLAR_ORDER: PillarCategory[] = [
  'CONCEPTUAL',
  'PROCEDURAL',
  'REPRESENTATION',
  'COMMUNICATION',
];

export const AFFECT_META: Record<
  AffectState,
  { label: string; tone: string; badge: string; level: number }
> = {
  CONFIDENT: {
    label: 'Confident',
    tone: 'Steady and assured',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    level: 0,
  },
  NEUTRAL: {
    label: 'Neutral',
    tone: 'Focused',
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    level: 1,
  },
  MILD_FRICTION: {
    label: 'Mild Friction',
    tone: 'Some hesitation',
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
