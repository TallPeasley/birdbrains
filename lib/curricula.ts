// Curriculums, grades and subjects for the course picker. The list comes from
// backend/birdbrains/curricula/curricula.json, the same file the grading backend uses,
// so the site and the backend always agree on which course ids exist.
//
// A course id is a legacy Ontario code (MTH1W, MPM2D) or
// "<curriculum>.<grade>.<subject>", e.g. "ccss.g7.math".
//
// Every subject's topic catalog covers kindergarten to Grade 12 (a backend test checks
// this), so the subjects offered for a grade are simply the ones the grade allows.
import data from '@/backend/birdbrains/curricula/curricula.json';

export type SubjectId = 'math' | 'science' | 'biology' | 'chemistry' | 'physics' | 'earth_science';

export interface CurriculumGrade {
  id: string;
  label: string;
  /** Age-equivalent grade: 0 = kindergarten, 12 = final year. */
  level: number;
  stage?: string;
  subjects?: SubjectId[];
}

export interface Curriculum {
  id: string;
  name: string;
  region: string;
  grades: CurriculumGrade[];
  notes: string;
}

export interface Subject {
  id: SubjectId;
  name: string;
}

interface LegacyCourse {
  id: string;
  curriculum: string;
  grade: string;
  subject: SubjectId;
  label: string;
  name: string;
}

interface Registry {
  subjects: Subject[];
  gradable_subjects: SubjectId[];
  default_curriculum: string;
  legacy_courses: LegacyCourse[];
  curricula: Curriculum[];
}

const REGISTRY = data as unknown as Registry;

export const CURRICULA: Curriculum[] = REGISTRY.curricula;
export const SUBJECTS: Subject[] = REGISTRY.subjects;
export const DEFAULT_CURRICULUM = REGISTRY.default_curriculum;
const GRADABLE = new Set<SubjectId>(REGISTRY.gradable_subjects);

/** The course new Ontario students start on, as before. */
export const DEFAULT_COURSE = 'MPM2D';

export interface CourseInfo {
  id: string;
  curriculum: Curriculum;
  grade: CurriculumGrade;
  subject: Subject;
  /** Short: "Grade 10 · MPM2D", "Year 9 · Math". */
  label: string;
  /** Long: "Year 9 Math · National Curriculum in England (incl. GCSE)". */
  name: string;
  legacy: boolean;
  gradable: boolean;
}

export function findCurriculum(id: string): Curriculum | undefined {
  return CURRICULA.find((c) => c.id === id);
}

export function findGrade(curriculumId: string, gradeId: string): CurriculumGrade | undefined {
  return findCurriculum(curriculumId)?.grades.find((g) => g.id === gradeId);
}

function subject(id: SubjectId): Subject {
  return SUBJECTS.find((s) => s.id === id)!;
}

/** Subjects offered for a curriculum and grade, in display order. */
export function gradeSubjects(curriculumId: string, gradeId: string): Subject[] {
  const g = findGrade(curriculumId, gradeId);
  if (!g) return [];
  return SUBJECTS.filter((s) => !g.subjects || g.subjects.includes(s.id));
}

export function isGradable(subjectId: SubjectId): boolean {
  return GRADABLE.has(subjectId);
}

/** The course id for a picker choice. Ontario Grade 9/10 math keep MTH1W / MPM2D. */
export function courseId(curriculumId: string, gradeId: string, subjectId: SubjectId): string {
  const legacy = REGISTRY.legacy_courses.find(
    (c) => c.curriculum === curriculumId && c.grade === gradeId && c.subject === subjectId,
  );
  return legacy ? legacy.id : `${curriculumId}.${gradeId}.${subjectId}`;
}

export function parseCourse(id: string | null | undefined): CourseInfo | null {
  if (!id) return null;
  const legacy = REGISTRY.legacy_courses.find((c) => c.id === id);
  if (legacy) {
    const cur = findCurriculum(legacy.curriculum)!;
    return {
      id,
      curriculum: cur,
      grade: findGrade(legacy.curriculum, legacy.grade)!,
      subject: subject(legacy.subject),
      label: legacy.label,
      name: `${legacy.name} · ${cur.name}`,
      legacy: true,
      gradable: isGradable(legacy.subject),
    };
  }
  const m = /^([a-z_]+)\.([a-z0-9_]+)\.([a-z_]+)$/.exec(id);
  if (!m) return null;
  const [, c, g, s] = m;
  const cur = findCurriculum(c);
  const grade = findGrade(c, g);
  const subj = SUBJECTS.find((x) => x.id === s);
  if (!cur || !grade || !subj || !gradeSubjects(c, g).some((x) => x.id === subj.id)) return null;
  if (courseId(c, g, subj.id) !== id) return null;
  return {
    id,
    curriculum: cur,
    grade,
    subject: subj,
    label: `${grade.label} · ${subj.name}`,
    name: `${grade.label} ${subj.name} · ${cur.name}`,
    legacy: false,
    gradable: isGradable(subj.id),
  };
}

/** Short label for chips and summaries; falls back to the raw id for unknown values. */
export function courseLabel(id: string | null | undefined, fallback = 'Not set'): string {
  if (!id) return fallback;
  return parseCourse(id)?.label ?? id;
}

/** Just the grade, e.g. "Grade 10" or "Year 9". */
export function courseGradeLabel(id: string | null | undefined): string {
  return parseCourse(id)?.grade.label ?? '';
}

/** What a course is "in": the course code for Ontario's MTH1W / MPM2D, else the subject. */
export function courseSubjectLabel(id: string | null | undefined): string {
  const info = parseCourse(id);
  if (!info) return id ?? '';
  return info.legacy ? info.id : info.subject.name;
}

/** Ontario courses show Ontario-specific extras such as the EQAO-style level forecast. */
export function isOntarioCourse(id: string | null | undefined): boolean {
  return parseCourse(id)?.curriculum.id === 'on';
}

/** Curriculums grouped by region, in registry order, for <optgroup>s. */
export function curriculaByRegion(): [string, Curriculum[]][] {
  const out = new Map<string, Curriculum[]>();
  for (const c of CURRICULA) out.set(c.region, [...(out.get(c.region) ?? []), c]);
  return [...out.entries()];
}
