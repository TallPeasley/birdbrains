'use client';

import { useId } from 'react';
import {
  CURRICULA,
  DEFAULT_COURSE,
  courseId,
  curriculaByRegion,
  findCurriculum,
  gradeSubjects,
  isGradable,
  parseCourse,
  type SubjectId,
} from '@/lib/curricula';

/**
 * Curriculum, grade and subject, as one course id (see lib/curricula.ts).
 *
 * With `gradableOnly`, subjects Quark cannot grade yet stay visible but disabled, so a
 * student sees science is coming without being able to upload work for it.
 */
export default function CurriculumPicker({
  value,
  onChange,
  gradableOnly = false,
  selectClassName = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm',
  showLabels = true,
  stacked = false,
}: {
  value: string;
  onChange: (courseId: string) => void;
  gradableOnly?: boolean;
  selectClassName?: string;
  showLabels?: boolean;
  /** One select per row, for narrow spaces. */
  stacked?: boolean;
}) {
  const uid = useId();
  const current = parseCourse(value) ?? parseCourse(DEFAULT_COURSE)!;
  const curriculum = current.curriculum;
  const grade = current.grade;
  const subjects = gradeSubjects(curriculum.id, grade.id);

  const allowed = (curriculumId: string, gradeId: string) =>
    gradeSubjects(curriculumId, gradeId).filter((s) => !gradableOnly || isGradable(s.id));

  /** Keep the subject if the new grade offers it (and it is allowed), else the first that is. */
  const pick = (curriculumId: string, gradeId: string, preferred: SubjectId) => {
    const options = allowed(curriculumId, gradeId);
    const s = options.find((o) => o.id === preferred) ?? options[0];
    if (s) onChange(courseId(curriculumId, gradeId, s.id));
  };

  const changeCurriculum = (id: string) => {
    const next = findCurriculum(id) ?? CURRICULA[0];
    const usable = next.grades.filter((g) => allowed(next.id, g.id).length > 0);
    if (!usable.length) return;
    // Keep the student at the same age-equivalent grade where the new curriculum has one.
    const best =
      usable.find((g) => g.level === grade.level && allowed(next.id, g.id).some((s) => s.id === current.subject.id)) ??
      usable.find((g) => g.level === grade.level) ??
      usable.reduce((a, b) => (Math.abs(b.level - grade.level) < Math.abs(a.level - grade.level) ? b : a));
    pick(next.id, best.id, current.subject.id);
  };

  const label = (text: string, htmlFor: string) =>
    showLabels ? (
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600">
        {text}
      </label>
    ) : null;

  return (
    <div className={stacked ? 'grid gap-2' : 'grid gap-2 sm:grid-cols-3'}>
      <div>
        {label('Curriculum', `${uid}-cur`)}
        <select
          id={`${uid}-cur`}
          aria-label="Curriculum"
          value={curriculum.id}
          onChange={(e) => changeCurriculum(e.target.value)}
          className={showLabels ? `mt-1 ${selectClassName}` : selectClassName}
        >
          {curriculaByRegion().map(([region, list]) => (
            <optgroup key={region} label={region}>
              {list.map((c) => {
                const disabled = !c.grades.some((g) => allowed(c.id, g.id).length > 0);
                return (
                  <option key={c.id} value={c.id} disabled={disabled}>
                    {disabled ? `${c.name} (grading coming soon)` : c.name}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        {label('Grade or course', `${uid}-grade`)}
        <select
          id={`${uid}-grade`}
          aria-label="Grade or course"
          value={grade.id}
          onChange={(e) => pick(curriculum.id, e.target.value, current.subject.id)}
          className={showLabels ? `mt-1 ${selectClassName}` : selectClassName}
        >
          {curriculum.grades.map((g) => {
            const disabled = allowed(curriculum.id, g.id).length === 0;
            const text = g.stage ? `${g.label} · ${g.stage}` : g.label;
            return (
              <option key={g.id} value={g.id} disabled={disabled}>
                {disabled ? `${text} (grading coming soon)` : text}
              </option>
            );
          })}
        </select>
      </div>
      <div>
        {label('Subject', `${uid}-subj`)}
        <select
          id={`${uid}-subj`}
          aria-label="Subject"
          value={current.subject.id}
          onChange={(e) => onChange(courseId(curriculum.id, grade.id, e.target.value as SubjectId))}
          className={showLabels ? `mt-1 ${selectClassName}` : selectClassName}
        >
          {subjects.map((s) => {
            const disabled = gradableOnly && !isGradable(s.id);
            return (
              <option key={s.id} value={s.id} disabled={disabled}>
                {disabled ? `${s.name} (grading coming soon)` : s.name}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
