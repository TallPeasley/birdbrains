# Quirks and antiquirks

Generated from `backend/birdbrains/quirks.json` by `backend/tools/error_codes_doc.py`.
Edit the JSON, not this file. Never reuse or delete an id: stored gradings name them.

Every pillar has 4 checks (below). The grader marks each check MET, MISSED or
NOT_TESTED on every question. Of a pillar's checks that apply, meeting at least
two thirds earns the pillar's **quirk**, meeting a quarter or fewer gives its
**antiquirk**, anything else is neutral: 3-4 of 4 = quirk, 2 = neutral, 0-1 =
antiquirk; with fewer checks that apply, 2 of 3, 2 of 2 or 1 of 1 = quirk. A check
is MISSED when its question has a root error it lists under "cancelled by"; the
error codes (`ERROR_CODES.md`) stay the detailed reasons. On a page with several
questions the pillar's checks are added up over every question (e.g. 3 of 4 plus 1
of 3 = 4 of 7, neutral). All six pillars show on every upload, and quirks and antiquirks
are tallied per pillar over time. Quirks never change a mark. Every plan gets them.

## Concepts (CON)

### Used the right rule

`QK_CON_RULE_APPLIED`

- **When met, the student sees:** You used a maths rule correctly in a spot where it is easy to slip.
- **How to meet it:** Use a rule like the power laws or the distributive property correctly where it matters.
- **Grader rule:** The student correctly applied a key rule that the question hinges on (exponent laws, distributing over a bracket, combining like terms, a trig ratio, the zero-product property) at a point where students commonly slip.
- **Cancelled by:** Mixed-up math rule (`CON_FOUNDATIONAL_MISCONCEPTION`), Rule used where it does not work (`CON_OVERGENERALISED_RULE`), Power rule mixed up (`CON_EXPONENT_LAW`), Unlike terms combined (`CON_LIKE_TERMS`)

### Kept both sides balanced

`QK_CON_BALANCED`

- **When met, the student sees:** Every time you changed one side of the equation, you changed the other side the same way.
- **How to meet it:** Solve an equation in several steps, doing the same thing to both sides every time.
- **Grader rule:** Across a multi-step equation solution (at least two rearranging steps), every operation was applied to both sides of the equation.
- **Cancelled by:** Changed only one side (`CON_EQUATION_BALANCE`)

### Explained why it works

`QK_CON_EXPLAINED_WHY`

- **When met, the student sees:** You wrote down why a step works, not just what you did.
- **How to meet it:** Add a short reason beside a step, like "opposite angles are equal" or "the slopes are equal so the lines are parallel".
- **Grader rule:** The student wrote a correct reason, property or justification in words or symbols (e.g. naming the theorem, the angle property, why lines are parallel), showing understanding beyond the procedure.
- **Cancelled by:** Mixed-up math rule (`CON_FOUNDATIONAL_MISCONCEPTION`), Sign or direction understood backwards (`CON_SIGN_DIRECTION_MEANING`), Graph feature read wrong (`CON_GRAPH_FEATURE_MEANING`)

### Spotted a restriction

`QK_CON_RESTRICTION_NOTED`

- **When met, the student sees:** You noticed a value that is not allowed and dealt with it.
- **How to meet it:** Reject an answer that does not make sense, like a negative length, or note a value the variable cannot be.
- **Grader rule:** The student explicitly noticed and handled a restriction: rejected an extraneous or impossible root (negative length, negative time), stated a domain restriction, or noted a value that makes a denominator zero.
- **Cancelled by:** Value that is not allowed (`CON_DOMAIN_RESTRICTION`)

## Strategy & Setup (STR)

### Clear setup

`QK_STR_CLEAR_SETUP`

- **When met, the student sees:** You turned the question into the right equation and said what your letters stand for.
- **How to meet it:** Start a word problem with "Let x be ..." and write the right equation from the words.
- **Grader rule:** The student set the problem up correctly from words or context and made the setup readable: defined variables ("let x be ...") or clearly listed the givens, and the first equation or formula is correct.
- **Cancelled by:** Question set up wrong (`STR_SETUP_FROM_WORDS`), Values put in the wrong places (`STR_WRONG_SUBSTITUTION`), Wrong formula for this question (`STR_FORMULA_MISSELECTION`), No clear plan (`STR_NO_VIABLE_PLAN`)

### Smart method

`QK_STR_SMART_METHOD`

- **When met, the student sees:** You picked a method that made the question quicker and cleaner.
- **How to meet it:** Choose the method that fits, like elimination when the numbers line up, or factoring when the quadratic factors nicely.
- **Grader rule:** The student chose a notably efficient and suitable method for this question (e.g. elimination when coefficients already match, factoring instead of the formula when it factors, a shortcut property) and it worked. Do not award it for the only reasonable method.
- **Cancelled by:** Method that does not fit (`STR_UNSUITABLE_METHOD`), No clear plan (`STR_NO_VIABLE_PLAN`), Wrong formula for this question (`STR_FORMULA_MISSELECTION`)

### Drew a diagram

`QK_STR_USED_DIAGRAM`

- **When met, the student sees:** You drew or labelled a diagram to plan your answer.
- **How to meet it:** Sketch the triangle, graph or situation and label what you know before you start.
- **Grader rule:** The student drew, or correctly labelled, a diagram or sketch of their own (triangle with sides marked, a quick graph, a number line) that supports the solution. The transcription or affect markers must show it.
- **Cancelled by:** Diagram labelled wrong (`STR_DIAGRAM_MISREAD`), Labels missing (`COM_MISSING_LABELS`)

### Found every case

`QK_STR_ALL_CASES`

- **When met, the student sees:** You found every answer, not just the first one.
- **How to meet it:** When there can be more than one answer, like the two roots of a quadratic or a plus-or-minus square root, find them all.
- **Grader rule:** The question has more than one case or solution (two roots, plus-or-minus square root, two possible triangles, both intersection points) and the student found all of them.
- **Cancelled by:** A case left out (`STR_MISSING_CASE`), Given condition not used (`STR_IGNORED_CONDITION`)

## Procedure (PRC)

### Showed every step

`QK_PRC_EVERY_STEP_SHOWN`

- **When met, the student sees:** Each line of your work follows clearly from the one before.
- **How to meet it:** Write one change per line so anyone can follow how you got from the question to the answer.
- **Grader rule:** Every key step in the answer key is PRESENT or EQUIVALENT_METHOD in key_step_checks, with no jumps, and the work is long enough (at least three lines) for this to matter.
- **Cancelled by:** Skipped a step (`PRC_STEP_OMITTED`), Answer not explained (`COM_UNSUPPORTED_ANSWER`)

### Kept every sign

`QK_PRC_SIGNS_CARRIED`

- **When met, the student sees:** You kept every negative sign and term through a long rearrangement.
- **How to meet it:** Rearrange an equation with negatives in it without losing a sign or a term.
- **Grader rule:** The student rearranged or expanded an expression containing negative terms over several lines without dropping a sign, term or factor.
- **Cancelled by:** Sign or term lost while rearranging (`PRC_SIGN_OR_FACTOR_DROPPED`), Undid a step the wrong way (`PRC_INVERSE_OPERATION`), Inequality sign not flipped (`PRC_INEQUALITY_DIRECTION`), Negative number slip (`FAC_SIGNED_NUMBER`)

### Factored cleanly

`QK_PRC_CLEAN_FACTORING`

- **When met, the student sees:** You factored correctly the first time.
- **How to meet it:** Factor a trinomial, a difference of squares or a common factor correctly.
- **Grader rule:** The student factored an expression correctly (common factor, trinomial, difference of squares, grouping) where factoring was part of the method.
- **Cancelled by:** Factored wrong (`PRC_FACTORING_ERROR`)

### Fully simplified

`QK_PRC_FULLY_SIMPLIFIED`

- **When met, the student sees:** You simplified your answer all the way down.
- **How to meet it:** Finish by collecting like terms and reducing fractions and roots as far as they go.
- **Grader rule:** The final answer is in fully simplified form where simplifying took real work (reduced fraction, simplified radical, collected like terms, combined systems cleanly).
- **Cancelled by:** Not fully simplified (`PRC_INCOMPLETE_SIMPLIFICATION`), Equations combined wrong (`PRC_SYSTEM_COMBINING`), Answer in the wrong form (`COM_WRONG_FORM`)

## Calculation & Recall (FAC)

### Accurate arithmetic

`QK_FAC_ACCURATE_ARITHMETIC`

- **When met, the student sees:** All your calculations were right, even the long ones.
- **How to meet it:** Get through a question with several calculations and no arithmetic slips.
- **Grader rule:** The question involved substantial arithmetic (several multiplications, divisions or multi-digit operations) and every calculation was correct.
- **Cancelled by:** Calculation slip (`FAC_ARITHMETIC_SLIP`), Copied a number wrong (`FAC_COPY_ERROR`), Calculator used wrong (`FAC_CALCULATOR_ENTRY`), Steps done out of order (`PRC_ORDER_OF_OPERATIONS`)

### Handled negatives

`QK_FAC_NEGATIVES_HANDLED`

- **When met, the student sees:** You worked with negative numbers without a slip.
- **How to meet it:** Multiply, divide or subtract negative numbers correctly.
- **Grader rule:** The student computed correctly with negative numbers in places where sign slips are common (subtracting a negative, squaring a negative, multiplying two negatives).
- **Cancelled by:** Negative number slip (`FAC_SIGNED_NUMBER`), Sign or direction understood backwards (`CON_SIGN_DIRECTION_MEANING`)

### Rounded correctly

`QK_FAC_RIGHT_ROUNDING`

- **When met, the student sees:** You kept full accuracy until the end and rounded the way the question asked.
- **How to meet it:** Keep the full number on your calculator until the last step, then round as the question says.
- **Grader rule:** The answer required rounding or a decimal approximation and the student kept accuracy through the work and rounded correctly at the end.
- **Cancelled by:** Rounding slip (`FAC_ROUNDING`), Calculator used wrong (`FAC_CALCULATOR_ENTRY`)

### Remembered the formula

`QK_FAC_FORMULA_RECALLED`

- **When met, the student sees:** You wrote a formula from memory and got it exactly right.
- **How to meet it:** Write a formula like the quadratic formula, distance formula or a trig ratio correctly from memory.
- **Grader rule:** The student wrote out a formula that the question did not give (quadratic formula, distance or midpoint formula, slope, Pythagorean theorem, a trig ratio, sine or cosine law) and it is exactly right.
- **Cancelled by:** Formula remembered wrong (`FAC_FORMULA_RECALL`), Math fact misremembered (`FAC_FACT_RECALL`)

## Communication (COM)

### Included units

`QK_COM_UNITS_INCLUDED`

- **When met, the student sees:** Your final answer has the right units.
- **How to meet it:** Put units like cm, m² or degrees on answers that need them.
- **Grader rule:** The answer needed units (lengths, areas, angles, money, time) and the student wrote the correct units on the final answer.
- **Cancelled by:** Missing units (`COM_MISSING_UNITS`), Unit slip (`FAC_UNIT_CONVERSION`)

### Wrote a final sentence

`QK_COM_CONCLUSION_WRITTEN`

- **When met, the student sees:** You finished with a sentence that answers the question.
- **How to meet it:** End a word problem with a sentence like "The ladder reaches 4.2 m up the wall."
- **Grader rule:** The question was a word or context problem and the student ended with a clear concluding statement that answers what was asked, in context.
- **Cancelled by:** Missing final sentence (`COM_MISSING_CONCLUSION`), Answered a different question (`COM_ANSWERED_DIFFERENT_QUESTION`)

### Neat, easy-to-follow work

`QK_COM_NEAT_WORK`

- **When met, the student sees:** Your work is neat and easy to follow from top to bottom.
- **How to meet it:** Write one step per line, lined up, with your final answer clearly marked.
- **Grader rule:** The work is laid out in a clean, ordered way (one step per line, equals signs lined up, final answer boxed or underlined) and the affect markers show clean, continuous flow rather than cramped or scratched-out writing.
- **Cancelled by:** Hard-to-read working (`COM_ILLEGIBLE_WORK`), Maths written the wrong way (`COM_NOTATION_MISUSE`)

### Wrote the maths correctly

`QK_COM_CORRECT_NOTATION`

- **When met, the student sees:** You used equals signs, brackets and symbols the right way.
- **How to meet it:** Use an equals sign only between things that are equal, and keep brackets where they belong.
- **Grader rule:** The student used notation correctly throughout a non-trivial solution: no run-on equals signs, brackets kept where needed, correct symbols for angles, roots, plus-or-minus and labels.
- **Cancelled by:** Maths written the wrong way (`COM_NOTATION_MISUSE`), Labels missing (`COM_MISSING_LABELS`)

## Test Habits (TST)

### Checked the answer

`QK_TST_CHECKED_ANSWER`

- **When met, the student sees:** You checked your answer by putting it back into the question.
- **How to meet it:** When you finish, substitute your answer back in to see if it works.
- **Grader rule:** The student's own work shows a check: substituting the answer back into the original equation(s), checking against an estimate, or verifying a constraint. It must be written on the page.
- **Cancelled by:** Answer not checked (`TST_UNCHECKED_ANSWER`), Middle step taken as the answer (`TST_DISTRACTOR_TRAP`)

### Answered every part

`QK_TST_ANSWERED_ALL_PARTS`

- **When met, the student sees:** You answered every part of the question.
- **How to meet it:** Answer every part, (a), (b) and (c), even if you are not sure of one.
- **Grader rule:** The question has two or more parts or asks for two or more things, and the student attempted every one.
- **Cancelled by:** Part of the question skipped (`TST_SKIPPED_PART`), Left blank (`TST_BLANK`), Answered a different question (`COM_ANSWERED_DIFFERENT_QUESTION`)

### Kept going

`QK_TST_KEPT_GOING`

- **When met, the student sees:** You kept working through a hard question instead of giving up.
- **How to meet it:** Stick with a tough question and reach an answer, even if you get stuck along the way.
- **Grader rule:** The affect markers or the work show the student hit difficulty (scratch-outs, a question mark, a restart) but persisted and reached a final answer.
- **Cancelled by:** Gave up partway (`TST_ABANDONED_WORK`), Left blank (`TST_BLANK`), Guessed with no work (`TST_UNWORKED_GUESS`)

### Caught your own mistake

`QK_TST_CAUGHT_OWN_MISTAKE`

- **When met, the student sees:** You spotted a mistake in your own work and fixed it.
- **How to meet it:** Look back over your work, find something that is wrong and correct it.
- **Grader rule:** The page shows the student crossed out or corrected a wrong line and replaced it with a correct one. Do not award it if the crossed-out work was actually right.
- **Cancelled by:** Crossed out right work (`TST_ERASED_CORRECT_WORK`)
