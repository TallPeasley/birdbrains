# Curriculums, grades and the K-12 topic catalog

Quark used to assume one curriculum (Ontario) and two courses (Grade 9 MTH1W and
Grade 10 MPM2D). This page records what was there, the model that replaces it, and
what still needs review.

## Audit (before this change)

| Where | What it assumed |
|---|---|
| `backend/birdbrains/schemas.py` | `CourseEnum` had two members, MTH1W and MPM2D. Stage 1's `detected_course` was a literal of the same two. |
| `backend/birdbrains/taxonomy.py` | `CURRICULUM` held strands and units for those two courses only. `curriculum_registry_text()` was titled "Ontario". |
| `backend/birdbrains/pipeline.py` | Stage 1 and Stage 2 system prompts said "Ontario Grade 9 (MTH1W) and Grade 10 (MPM2D) mathematics" and listed only those units. Stage 1's detected course always replaced the student's own. |
| `backend/birdbrains/batch_engine.py` | Worksheet prompt was written for Ontario Grade 9 and 10. |
| `backend/birdbrains/projections.py` | The parent forecast uses Ontario's four achievement levels (labelled EQAO on the site). |
| `backend/birdbrains/subjects/*.json` | Draft error codes for chemistry, physics, biology, English and history, tied to Ontario course codes, not used for grading. No earth-science list. |
| `types/birdBrains.ts` | `GradeCourse = 'MTH1W' \| 'MPM2D'`. |
| Sign-up, teacher import, settings, parent dashboard | Course selects with only "Grade 9 · MTH1W" and "Grade 10 · MPM2D"; labels computed as "Grade 10 if MPM2D else Grade 9". |
| Landing page, metadata, How it works, Plans | "Ontario curriculum", "Made for the Ontario curriculum", "Grade 9–10 math", "EQAO forecast". |

Gaps: no grades outside 9–10, no curriculum other than Ontario, no topic-level learning
goals, prerequisites or misconceptions anywhere, no science topics, and no way for a
student to change course after sign-up.

## The model

All data is in `backend/birdbrains/curricula/` and loaded by `curricula/__init__.py`.

**Curriculum** (`curricula.json`): id, name, region, notes, `review_status`, and its
grades. Included: Ontario, British Columbia, Alberta, Quebec, other Canadian provinces
and territories, US Common Core (math only), NGSS (science only), other US state
standards, the National Curriculum in England (with GCSE years), IB (PYP, MYP, DP), AP
(by course) and "other".

**Grade**: an id, a label as that curriculum says it ("Year 9", "Secondary III",
"MYP Year 2", "AP Chemistry"), an optional stage ("Key Stage 3"), optional allowed
subjects, and a `level`: the age-equivalent grade, 0 for kindergarten to 12 for the
last school year. The level is how a curriculum's grade finds topics.

**Subject**: math, biology, chemistry, physics, earth & space science, and "science
(general)", which covers the four sciences for integrated science courses.

**Course id**: what a student studies. Either a legacy Ontario code (`MTH1W`, `MPM2D`,
unchanged so stored data loads) or `<curriculum>.<grade>.<subject>`, e.g.
`ccss.g7.math`, `eng.y10.physics`, `ap.chem.chemistry`. Ontario Grade 9 and 10 math
only have the legacy id. `CourseEnum` in `schemas.py` keeps its old interface but now
validates against this registry.

**Topic** (`topics/<subject>.json`): curriculum-agnostic. Each has an id, strand, the
`levels` range it is usually taught at, learning goals, key concepts, prerequisites
(topic ids, possibly in another subject), common misconceptions and example problems
with answers. Each misconception names the existing error code it usually maps to, so
the "why the answer went wrong" diagnosis can use it. Earth science has no error-code
list yet, so its misconceptions name the science taxonomy their code comes from.

A course's topics are the topics of its subject whose level range includes the
course's level.

| Catalog | Topics |
|---|---|
| Math | 67 |
| Biology | 18 |
| Chemistry | 20 |
| Physics | 20 |
| Earth & space science | 14 |

## How it is used

- **Grading prompts.** The course is always the student's own choice; Stage 1 no
  longer guesses it from the page (stored transcriptions with the old
  `detected_course` field still load, and it is ignored). Stage 1 gets the course's
  units: MTH1W and MPM2D keep their own lists, every other course uses the catalog.
  Stage 2 gets the curriculum, grade, and the matched topic's learning goals and
  misconceptions with their codes. The system prompts no longer name Ontario.
- **Strands.** Ontario's two courses use their own strands. Others use the matched
  topic's strand.
- **Grading scope.** Only math is gradable (`gradable_subjects`). Uploads for a
  science course get upload code 109. The picker shows science as "grading coming
  soon".
- **Site.** `lib/curricula.ts` reads the same `curricula.json`;
  `components/CurriculumPicker.tsx` is the curriculum, grade and subject selector used
  at sign-up, in account settings (students can now change course) and in the
  teacher import.
- **Forecast names.** The parent forecast keeps the backend's four bands (below 60%,
  60-69, 70-79, 80+) and names them in the student's own system, from each
  curriculum's `assessments` in `curricula.json`: EQAO levels (Ontario), the BC
  proficiency scale, Alberta's acceptable standard and standard of excellence,
  Quebec marks (pass mark 60%), US state test levels (Smarter Balanced names), Key
  Stage 1-2 standards, GCSE grades and A level grades (England), IB grades 1-7 (MYP
  and DP) and AP scores 1-5. Other cases show score ranges. These are approximate
  translations for families, not published equivalences, and are marked
  `needs_review`.

## Review status

Everything new is marked `needs_review`:

- **Grade placement.** Topic level ranges are typical North American placements, not
  any curriculum's official standard. Placement differs between curriculums
  (England and IB in particular). Each curriculum's `notes` says so.
- **Grade mapping.** England's Year N is mapped to level N-1, Quebec's Secondary I–V
  to 7–11, IB MYP 1–5 to 6–10 and DP 1–2 to 11–12, all by age. AP courses are placed
  at 11 or 12.
- **No standard codes.** The catalog does not cite Common Core, NGSS, GCSE, IB or AP
  standard codes or course frameworks. Mapping topics to official standards is a
  follow-up that needs each curriculum's documents.
- **Content.** Learning goals, misconceptions and example problems were drafted for
  Quark and checked for arithmetic, but need review by subject teachers.
- **Earth science codes.** Borrowed from the physics, chemistry and biology lists until
  earth science has its own.

`backend/tests/test_curricula.py` checks the files are consistent (ids, prerequisites,
codes, no cycles, every grade covered). To change content, edit the JSON and run
pytest.
