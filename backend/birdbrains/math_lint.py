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


def lint_worksheet(ws: WorksheetContent) -> list[str]:
    problems: list[str] = []

    def check(where: str, text: str, required: bool = True) -> None:
        if required and not text.strip():
            problems.append(f"{where}: empty")
        problems.extend(f"{where}: {p}" for p in lint_math(text))

    check("title", ws.title)
    check("target_concept", ws.target_concept)
    if not ws.diagnostic_mirror:
        problems.append("diagnostic_mirror: empty")
    for i, item in enumerate(ws.diagnostic_mirror, 1):
        check(f"mirror {i} previous", item.previous_step_text, required=False)
        check(f"mirror {i} original", item.original_step_text)
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
    if not 3 <= len(ws.independent_transfer.metacognitive_checklist) <= 4:
        problems.append("transfer checklist: expected 3 or 4 items")
    for i, line in enumerate(ws.independent_transfer.metacognitive_checklist, 1):
        check(f"checklist {i}", line)
    return problems
