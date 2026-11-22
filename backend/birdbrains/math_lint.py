"""Checks on generated worksheets before a student sees them.

Worksheet maths is written as plain text (x^2) and may contain inline LaTeX, which
the site renders with KaTeX. ``lint_math`` catches the syntax that makes KaTeX throw
or print raw markup: unbalanced brackets, an odd number of $ delimiters, dangling
^ or _, and commands KaTeX does not know. ``lint_worksheet`` adds the structural
rules of the 3-stage worksheet. An empty list means the worksheet is good.
"""
from __future__ import annotations

import re

from .schemas import WorksheetContent

BLANK = "[ __ ]"

# The KaTeX commands a Grade 9 to 12 worksheet has any reason to use.
KATEX_COMMANDS = frozenset("""
frac dfrac tfrac sqrt cdot times div pm mp le leq ge geq ne neq approx equiv sim
left right big Big text mathrm mathbf mathit cancel boxed overline underline hat vec bar
sin cos tan csc sec cot arcsin arccos arctan log ln exp lim sum prod int infty
alpha beta gamma delta theta lambda mu pi rho sigma phi omega Delta Sigma Omega
degree circ angle triangle perp parallel cong
to rightarrow Rightarrow leftarrow Leftarrow leftrightarrow implies iff therefore because
quad qquad ldots cdots dots begin end
in notin subset cup cap emptyset forall exists
displaystyle textbf textit operatorname overset underset underbrace overbrace binom
longrightarrow Longrightarrow longleftrightarrow checkmark square mid vert lvert rvert
lt gt neg ast star prime bcancel xcancel hline color textcolor colorbox
""".split())

_PAIRS = {")": "(", "]": "[", "}": "{"}
_COMMAND = re.compile(r"\\([A-Za-z]+)")
_DANGLING = re.compile(r"[\^_](\s|$|[)\]}=+*/,.;:])")


def lint_math(text: str) -> list[str]:
    problems: list[str] = []
    body = text.replace(BLANK, "0").replace("\\$", "")
    stack: list[str] = []
    for ch in body:
        if ch in "([{":
            stack.append(ch)
        elif ch in _PAIRS:
            if not stack or stack.pop() != _PAIRS[ch]:
                problems.append(f"unbalanced '{ch}'")
                break
    else:
        if stack:
            problems.append(f"unclosed '{stack[-1]}'")
    if body.count("$") % 2:
        problems.append("odd number of $ delimiters")
    if _DANGLING.search(body):
        problems.append("^ or _ with nothing after it")
    unknown = sorted({c for c in _COMMAND.findall(body) if c not in KATEX_COMMANDS})
    if unknown:
        problems.append("unknown LaTeX command: " + ", ".join("\\" + c for c in unknown))
    for env in re.findall(r"\\begin\{([^}]*)\}", body):
        if body.count("\\begin{" + env + "}") != body.count("\\end{" + env + "}"):
            problems.append(f"\\begin{{{env}}} without a matching \\end")
    return problems


def lint_copied(text: str) -> list[str]:
    """Lighter check for lines copied from the student's page. Students leave brackets
    open, and that is often the very mistake the worksheet is about, so only what
    stops KaTeX from rendering at all is checked: unbalanced { } and \\left/\\right."""
    problems: list[str] = []
    depth = 0
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "\\":
            i += 2
            continue
        depth += (ch == "{") - (ch == "}")
        if depth < 0:
            break
        i += 1
    if depth:
        problems.append("unbalanced '{' or '}'")
    if len(re.findall(r"\\left\b", text)) != len(re.findall(r"\\right\b", text)):
        problems.append("\\left without a matching \\right")
    return problems


def _squash(text: str) -> str:
    return re.sub(r"\s+", "", text)


def tidy_worksheet(ws: WorksheetContent) -> WorksheetContent:
    """Small repairs that are safer than throwing a whole worksheet away.

    ``wrong_part`` must be an exact piece of the student's line so the site can mark it.
    The model often changes the spacing ("-9" for "- 9"): the piece is then taken from the
    line itself. If it still can't be found, the highlight is dropped and the viewer shows
    the plain line with what_went_wrong, which it already does for older worksheets."""
    items = []
    for item in ws.diagnostic_mirror:
        part, line = item.wrong_part, item.original_step_text
        if part and part not in line:
            target = _squash(part)
            found = ""
            if target:
                for start in range(len(line)):
                    if line[start].isspace():
                        continue
                    for end in range(start + 1, len(line) + 1):
                        piece = line[start:end]
                        if _squash(piece) == target:
                            found = piece
                            break
                        if len(_squash(piece)) > len(target):
                            break
                    if found:
                        break
            item = item.model_copy(update={"wrong_part": found, "correct_part": item.correct_part if found else ""})
        items.append(item)
    return ws.model_copy(update={"diagnostic_mirror": items})


def lint_worksheet(ws: WorksheetContent) -> list[str]:
    problems: list[str] = []

    def check(where: str, text: str, required: bool = True, copied: bool = False) -> None:
        if required and not text.strip():
            problems.append(f"{where}: empty")
        problems.extend(f"{where}: {p}" for p in (lint_copied(text) if copied else lint_math(text)))

    check("title", ws.title)
    check("target_concept", ws.target_concept)
    if not ws.diagnostic_mirror:
        problems.append("diagnostic_mirror: empty")
    for i, item in enumerate(ws.diagnostic_mirror, 1):
        check(f"mirror {i} previous", item.previous_step_text, required=False, copied=True)
        check(f"mirror {i} original", item.original_step_text, copied=True)
        if item.wrong_part and item.wrong_part not in item.original_step_text:
            problems.append(f"mirror {i}: wrong_part is not in the student's line")
        check(f"mirror {i} correction", item.annotated_correction)
        check(f"mirror {i} takeaway", item.key_takeaway)

    steps = ws.faded_scaffolding
    if not 3 <= len(steps) <= 5:
        problems.append(f"faded_scaffolding: {len(steps)} steps, expected 3 to 5")
    if [s.step_number for s in steps] != list(range(1, len(steps) + 1)):
        problems.append("faded_scaffolding: steps are not numbered 1, 2, 3, ...")
    if steps and steps[0].scaffolding_type != "GIVEN":
        problems.append("faded_scaffolding: the first step must be GIVEN")
    if steps and steps[-1].scaffolding_type != "INDEPENDENT":
        problems.append("faded_scaffolding: the last step must be INDEPENDENT")
    for s in steps:
        where = f"step {s.step_number}"
        check(f"{where} prompt", s.prompt)
        check(f"{where} content", s.given_content)
        check(f"{where} hint", s.hint)
        has_blank = BLANK in s.given_content
        if s.scaffolding_type == "PARTIAL_BLANK":
            if not has_blank:
                problems.append(f"{where}: PARTIAL_BLANK without a {BLANK} blank")
            if not (s.blank_placeholder or "").strip():
                problems.append(f"{where}: PARTIAL_BLANK without the expected answer")
        elif has_blank:
            problems.append(f"{where}: {s.scaffolding_type} step contains a blank")

    check("transfer problem", ws.independent_transfer.problem_statement)
    check("transfer answer", ws.independent_transfer.answer)
    check("transfer solution", ws.independent_transfer.worked_solution, required=False)
    if not 6 <= len(ws.practice_set) <= 12:
        problems.append(f"practice_set: {len(ws.practice_set)} problems, expected 6 to 12")
    seen: set[str] = set()
    for i, p in enumerate(ws.practice_set, 1):
        check(f"practice {i} problem", p.problem_statement)
        check(f"practice {i} answer", p.answer)
        check(f"practice {i} solution", p.worked_solution)
        key = re.sub(r"\s+", "", p.problem_statement.lower())
        if key in seen:
            problems.append(f"practice {i}: same problem twice")
        seen.add(key)
    if not 3 <= len(ws.independent_transfer.metacognitive_checklist) <= 4:
        problems.append("transfer checklist: expected 3 or 4 items")
    for i, line in enumerate(ws.independent_transfer.metacognitive_checklist, 1):
        check(f"checklist {i}", line)
    return problems
