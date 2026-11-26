# Error codes for other subjects (draft)

Quark grades maths today. These are first-draft error-code lists for the other
core Ontario high-school subjects, so we can review them before building
grading for those subjects. **They are not used by grading yet.**

| Subject | File | Courses | Codes |
|---|---|---|---|
| Chemistry | `backend/birdbrains/subjects/chemistry.json` | SNC1W, SNC2D, SCH3U, SCH4U, SCH4C | 49 |
| Physics | `backend/birdbrains/subjects/physics.json` | SNC1W, SNC2D, SPH3U, SPH4U, SPH4C | 48 |
| Biology | `backend/birdbrains/subjects/biology.json` | SNC1W, SNC2D, SBI3U, SBI3C, SBI4U | 48 |
| English | `backend/birdbrains/subjects/english.json` | ENL1W, ENG2D, ENG3U/C, ENG4U/C, OLC4O, OSSLT | 49 |
| History, Geography & Civics | `backend/birdbrains/subjects/history_geography.json` | CGC1W, CHC2D/P, CHV2O, CHA3U, CGG3O, CHY4U, CGW4U | 36 (starter set) |

Readable versions of each list are in [docs/subject-codes/](subject-codes/).
They are generated: edit the JSON, then run
`python backend/tools/subject_codes_doc.py`.

## Format

Each file follows the maths list (`backend/birdbrains/error_codes.json`):

- Six pillars with the same ids as maths: `CON STR PRC FAC COM TST`. Each
  subject sets its own pillar **name** and **scope**, its points per pillar
  (`max_score`, summing to 10) and which pillars count as slips (`slip`, for
  the speed-bump view).
- `decision_order`: the questions the grader asks, in order, to pick a pillar.
- Codes have the same fields as maths: `id` (readable, prefix = pillar),
  `pillar`, `name`, `plain_name` and `student_help` (the only things students
  and parents see), `description`, `example`, `tell_apart` (`{code, how}`;
  `code` is null when the alternative is not another code), `remediation`,
  `legacy_ids` (empty for now).

**Shared ids mean the same thing everywhere.** When a subject uses an id that
maths also uses (for example `FAC_UNIT_CONVERSION`, `COM_MISSING_UNITS`,
`TST_DISTRACTOR_TRAP`), its name, plain name, student help and description
are copied from the maths list; only the example and tell-apart notes are
subject-specific. That lets reports compare habits like "missing units" or
"left blank" across subjects. `backend/tests/test_subject_taxonomies.py` fails
if a shared id drifts.

## Pillars by subject

The three sciences keep the maths pillars as they are, with the scopes
rewritten for each science. Biology's Calculation & Recall pillar is mostly
recall (terms, labels, sequences), not arithmetic.

**English needs different pillars,** because an essay has no "calculation"
and "procedure" is really about using evidence. Same ids, new meanings:

| Id | Maths / sciences | English | History, Geography & Civics |
|---|---|---|---|
| CON | Concepts | Reading & Understanding | Historical & Geographic Thinking |
| STR | Strategy & Setup | Thesis & Organisation | Argument & Inquiry |
| PRC | Procedure | Evidence & Analysis | Evidence & Sources |
| FAC | Calculation & Recall | Grammar & Mechanics | Facts & Recall |
| COM | Communication | Style & Expression | Communication |
| TST | Test Habits | Task Habits | Test Habits |

For English and history the points are weighted differently (CON 2, STR 2,
PRC 2, FAC 1, COM 2, TST 1), because grammar slips matter less than
expression in an essay, and only FAC and TST count as slips. These are
proposals to review.

Keeping the same six ids means the dashboards, pillar cards and charts work
for every subject; only the labels change per subject.

## Not done yet

- **Grading.** The pipeline, Stage 1 reading and Stage 2 prompts are
  maths-only (`CourseEnum` is MTH1W and MPM2D). To use a subject:
  add its courses, pass `subjects.taxonomy_text(subject)` to Stage 2 instead
  of the maths taxonomy, and teach Stage 1 to read prose answers, not just
  maths lines. English and history need a different Stage 1 entirely
  (paragraphs and essays, not numbered steps).
- **Site.** `lib/errorCodes.ts` only knows maths codes; the site would need to
  load the subject file to show `plain_name` and `student_help`.
- **Worksheets.** The worksheet generator and its maths checks are maths-only.
- **Other subjects.** French (FSF), computer science (ICS), and the Grade 12
  science/English variants beyond those listed are not started.
