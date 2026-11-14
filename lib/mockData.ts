import raw from '@/mocks/birdBrainsMockData.json';
import type {
  ParentProjectionSummary,
  Stage2GradingAndAffectOutput,
  WS_3STAGE_V1,
} from '@/types/birdBrains';

// Typed views over the mock payload pack. Swap these for API calls later.
export const gradingOutput = raw.stage2GradingAndAffectOutput as Stage2GradingAndAffectOutput;
export const worksheet = raw.ws3StageV1 as WS_3STAGE_V1;
export const parentSummary = raw.parentProjectionSummary as ParentProjectionSummary;

export const demoPersonas = {
  student: {
    id: 'stu_alexmercer99',
    name: 'Alex Mercer',
    detail: 'Grade 10 · MPM2D',
    initials: 'AM',
  },
  parent: {
    id: 'par_mercer_01',
    name: 'Jordan Mercer',
    detail: 'Parent of Alex',
    initials: 'JM',
  },
} as const;
