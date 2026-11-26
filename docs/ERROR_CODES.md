# Error codes

Generated from `backend/birdbrains/error_codes.json` by `backend/tools/error_codes_doc.py`.
Edit the JSON, not this file. Ids are internal: students and parents only ever see the
plain name and the student help line.

48 codes in six pillars. Points per question: CON 2, STR 2, PRC 2, FAC 2, COM 1, TST 1.

## Concepts (CON)

The student holds a wrong idea about the mathematics itself.

### Foundational Misconception

`CON_FOUNDATIONAL_MISCONCEPTION` (replaces CON-01)

- **Shown to people:** Mixed-up math rule. A core math rule was mixed up, like adding the bottoms of two fractions.
- **What it is:** A flawed mental model of what a quantity or operation means, applied consistently.
- **Example:** 1/2 + 1/3 = 2/5 (adds numerators and denominators).
- **Not this:** A one-off number slip with the right idea. Use **Arithmetic Slip** (`FAC_ARITHMETIC_SLIP`).
- **Not this:** A rule stretched beyond where it holds. Use **Overgeneralised Rule** (`CON_OVERGENERALISED_RULE`).
- **Practice that helps:** Concrete visual or area model of the idea, then the same item again.

### Sign / Direction Meaning

`CON_SIGN_DIRECTION_MEANING` (replaces CON-04)

- **Shown to people:** Sign or direction understood backwards. A plus or minus sign, or a direction on a graph, was understood the wrong way.
- **What it is:** Misunderstands what a sign, direction or shift means, rather than slipping while calculating.
- **Example:** Says y = (x - 3)^2 moves the parabola 3 left; reads a negative slope as rising.
- **Not this:** Losing a sign while rearranging. Use **Sign or Factor Dropped** (`PRC_SIGN_OR_FACTOR_DROPPED`).
- **Not this:** A slip adding negatives. Use **Signed Number Slip** (`FAC_SIGNED_NUMBER`).
- **Practice that helps:** Reference-frame sketch: plot two points and check the direction.

### Overgeneralised Rule

`CON_OVERGENERALISED_RULE`

- **Shown to people:** Rule used where it does not work. A rule was used where it does not work, like squaring each term of (a + b) separately.
- **What it is:** Treats an operation as if it splits over a sum when it does not (false linearity), or cancels terms instead of factors.
- **Example:** (x + 3)^2 = x^2 + 9; sqrt(x^2 + 16) = x + 4; (x + 6)/6 = x.
- **Not this:** Misusing a power law such as x^2 * x^3 = x^6. Use **Exponent Law Misuse** (`CON_EXPONENT_LAW`).
- **Practice that helps:** Counterexample check: test the rule with small numbers before using it.

### Exponent Law Misuse

`CON_EXPONENT_LAW`

- **Shown to people:** Power rule mixed up. A power rule was mixed up, like adding exponents when they should multiply.
- **What it is:** Misapplies the laws of exponents or what an exponent applies to.
- **Example:** x^2 * x^3 = x^6; (2x)^2 = 2x^2; x^0 = 0; -3^2 = 9.
- **Not this:** A rule split over a sum, like (a + b)^2 = a^2 + b^2,. Use **Overgeneralised Rule** (`CON_OVERGENERALISED_RULE`).
- **Practice that helps:** Expand the power as repeated multiplication, then compare with the law.

### Like Terms Confusion

`CON_LIKE_TERMS`

- **Shown to people:** Unlike terms combined. Terms that are not alike were added together, like x^2 and x.
- **What it is:** Combines or cancels terms that have different variables or powers.
- **Example:** 3x^2 + 2x = 5x^3; 4x + 3 = 7x.
- **Not this:** Dropping a term while collecting is PRC_STEP_OMITTED or PRC_SIGN_OR_FACTOR_DROPPED. Use **Sign or Factor Dropped** (`PRC_SIGN_OR_FACTOR_DROPPED`).
- **Practice that helps:** Colour-code terms by variable and power before collecting.

### Equation Balance

`CON_EQUATION_BALANCE`

- **Shown to people:** Changed only one side. Something was done to one side of the equation but not the other.
- **What it is:** Does not keep an equation balanced: operates on one side only, or treats = as 'the answer comes next'.
- **Example:** 3x + 4 = 10 -> 3x = 10 (subtracts 4 on the left only); 2x + 3 = 11 = 8 = 4.
- **Not this:** Using the wrong inverse operation on both sides (2x = 8 -> x = 6). Use **Wrong Inverse Operation** (`PRC_INVERSE_OPERATION`).
- **Not this:** Run-on equals chains in otherwise correct work. Use **Notation Misuse** (`COM_NOTATION_MISUSE`).
- **Practice that helps:** Balance-scale model: write the operation on both sides of every line.

### Domain / Restriction Blindness

`CON_DOMAIN_RESTRICTION`

- **Shown to people:** Value that is not allowed. The answer uses a value that is not allowed here, like dividing by zero or a negative length.
- **What it is:** Ignores where an expression or situation is defined: divides by something that may be zero, roots a negative, keeps an impossible length or angle.
- **Example:** Divides both sides of x^2 = 3x by x and loses x = 0; keeps a side length of -4 cm.
- **Not this:** Not noticing an absurd final answer the student could have checked. Use **Unchecked Answer** (`TST_UNCHECKED_ANSWER`).
- **Not this:** Leaving out the negative root of x^2 = 9. Use **Missing Case** (`STR_MISSING_CASE`).
- **Practice that helps:** 'What values are allowed?' check before and after solving.

### Graph Feature Meaning

`CON_GRAPH_FEATURE_MEANING`

- **Shown to people:** Graph feature read wrong. A part of the graph was read as something else, like the y-intercept as a zero.
- **What it is:** Misunderstands what a graph feature means: intercepts vs zeros, slope vs intercept, vertex vs root, axis of symmetry.
- **Example:** Gives the y-intercept as a zero of the parabola; reads the slope of y = 2x + 5 as 5.
- **Not this:** Reading a value off the graph inaccurately with the right idea is FAC_ARITHMETIC_SLIP or COM_ILLEGIBLE_WORK. Use **Illegible Work** (`COM_ILLEGIBLE_WORK`).
- **Not this:** Picking the wrong equation for a graph in a setup. Use **Word Problem Setup** (`STR_SETUP_FROM_WORDS`).
- **Practice that helps:** Label each feature on a sketch and say what it means in words.

## Strategy & Setup (STR)

The ideas are sound, but the plan is wrong: the wrong method or formula, or the question turned into the wrong equation.

### Formula / Law Misselection

`STR_FORMULA_MISSELECTION` (replaces CON-02)

- **Shown to people:** Wrong formula for this question. The formula or rule used here does not fit this type of question.
- **What it is:** Applies a formula, theorem or law whose conditions the problem does not meet.
- **Example:** Uses the sine law with three sides and no angle (needs the cosine law); uses SOH CAH TOA in a non-right triangle.
- **Not this:** Right formula, wrong values in its slots. Use **Wrong Substitution** (`STR_WRONG_SUBSTITUTION`).
- **Not this:** A misremembered version of the right formula. Use **Formula Recall** (`FAC_FORMULA_RECALL`).
- **Practice that helps:** Condition table: for each formula, list when it applies, then match the question.

### Word Problem Setup

`STR_SETUP_FROM_WORDS` (replaces CON-03)

- **Shown to people:** Question set up wrong. The words of the question were turned into the wrong equation.
- **What it is:** Translates a word problem, table or graph into an equation or model that does not match it.
- **Example:** '5 less than twice a number is 11' written as 5 - 2x = 11; perimeter used where area is described.
- **Not this:** A correct model with one given value misread. Use **Misread Given** (`TST_MISREAD_GIVEN`).
- **Not this:** A mislabelled diagram. Use **Diagram Misread** (`STR_DIAGRAM_MISREAD`).
- **Practice that helps:** Dimensional analysis table: name each quantity, its unit and how they relate before writing the equation.

### Diagram Misread

`STR_DIAGRAM_MISREAD`

- **Shown to people:** Diagram labelled wrong. The diagram was labelled the wrong way, like calling the wrong side the hypotenuse.
- **What it is:** Misidentifies parts of a diagram: opposite vs adjacent, hypotenuse, matching angles or sides in similar triangles.
- **Example:** Uses the side next to the angle as 'opposite'; matches the wrong sides in a similar-triangle ratio.
- **Not this:** Choosing trig when the triangle is not right-angled. Use **Formula / Law Misselection** (`STR_FORMULA_MISSELECTION`).
- **Practice that helps:** Mark the angle, then label opp, adj, hyp (or matching sides) on the diagram first.

### Wrong Substitution

`STR_WRONG_SUBSTITUTION`

- **Shown to people:** Values put in the wrong places. The right formula was used, but values went into the wrong spots.
- **What it is:** Puts known values into the wrong variables of a correct formula.
- **Example:** Midpoint with ((x1 + y1)/2, (x2 + y2)/2); b and c swapped in the quadratic formula.
- **Not this:** Using a formula that does not apply. Use **Formula / Law Misselection** (`STR_FORMULA_MISSELECTION`).
- **Not this:** Copying a value wrong. Use **Copy Error** (`FAC_COPY_ERROR`).
- **Practice that helps:** Write 'a = , b = , c = ' (or x1, y1 ...) before substituting.

### No Viable Plan

`STR_NO_VIABLE_PLAN`

- **Shown to people:** No clear plan. The first move here could not lead to the answer. Plan the method before writing.
- **What it is:** Starts with a move that cannot reach the answer, or moves symbols around with no method.
- **Example:** Tries to solve x^2 + 5x + 6 = 0 by moving terms until x is alone; square-roots one term of a sum.
- **Not this:** A valid method that is just long or not the one asked for. Use **Unsuitable Method** (`STR_UNSUITABLE_METHOD`).
- **Practice that helps:** Plan-first prompt: name the method in words before writing any maths.

### Unsuitable Method

`STR_UNSUITABLE_METHOD`

- **Shown to people:** Method that does not fit. This method works, but it is not the one asked for, or it makes the question much longer.
- **What it is:** Uses a valid path that is not the one the question asked for, or one that makes the work much longer and error-prone.
- **Example:** Question says 'solve by elimination' and the student graphs; completes the square on an easily factorable quadratic and then slips.
- **Not this:** A method that cannot work at all. Use **No Viable Plan** (`STR_NO_VIABLE_PLAN`).
- **Practice that helps:** Method comparison: solve the same item two ways side by side.

### Missing Case

`STR_MISSING_CASE`

- **Shown to people:** A case left out. One possible answer or case was left out, like the negative square root.
- **What it is:** Does not consider every case the problem allows: the +/- root, both factors, a second triangle.
- **Example:** x^2 = 49 -> x = 7 only; sets only one factor of (x - 2)(x + 5) = 0 to zero.
- **Not this:** Dismissing a valid answer because of a wrong restriction. Use **Domain / Restriction Blindness** (`CON_DOMAIN_RESTRICTION`).
- **Not this:** Skipping a whole sub-question. Use **Skipped Part** (`TST_SKIPPED_PART`).
- **Practice that helps:** 'How many answers could there be?' check before finishing.

### Ignored Condition

`STR_IGNORED_CONDITION`

- **Shown to people:** Given condition not used. A condition the question gave was not used, like 'x is positive' or a point on the line.
- **What it is:** Leaves a stated condition or given piece of information out of the model, so the answer does not meet it.
- **Example:** Finds the line through (2, 3) with slope 4 but never uses the point; keeps a negative width when the question says it is positive.
- **Not this:** Misreading the value of a given. Use **Misread Given** (`TST_MISREAD_GIVEN`).
- **Practice that helps:** Underline every given and tick it off when it is used.

## Procedure (PRC)

The plan is right, but carrying out the method goes wrong.

### Step Omission

`PRC_STEP_OMITTED` (replaces PRC-01)

- **Shown to people:** Skipped a step. A needed step in the method was skipped.
- **What it is:** Skips a required step of the procedure, so the result does not follow.
- **Example:** Completing the square without adding and subtracting (b/2)^2; finds x in a system but never finds y.
- **Not this:** Stopping before the requested final form. Use **Incomplete Simplification** (`PRC_INCOMPLETE_SIMPLIFICATION`).
- **Practice that helps:** Faded worked example (about 80% done), then the full procedure.

### Order of Operations

`PRC_ORDER_OF_OPERATIONS` (replaces PRC-02)

- **Shown to people:** Steps done out of order. The steps were done in the wrong order.
- **What it is:** Applies valid rules in an invalid order (BEDMAS, or method steps out of sequence).
- **Example:** 2 + 3 * 4 = 20; takes the square root before isolating the squared term.
- **Not this:** Doing the inverse operation wrongly. Use **Wrong Inverse Operation** (`PRC_INVERSE_OPERATION`).
- **Practice that helps:** Parsons problem: put the given steps in order.

### Sign or Factor Dropped

`PRC_SIGN_OR_FACTOR_DROPPED` (replaces PRC-03)

- **Shown to people:** Sign or term lost while rearranging. A sign or a number got lost when expanding or moving terms around.
- **What it is:** Drops a sign, factor or term while expanding, factoring out, or moving terms, even though the method is right.
- **Example:** -(x - 3) = -x - 3; 2(x^2 + 6x) + 5 written as 2(x + 3)^2 - 9 + 5 instead of - 18 + 5.
- **Not this:** A consistent belief about signs. Use **Sign / Direction Meaning** (`CON_SIGN_DIRECTION_MEANING`).
- **Not this:** Adding or subtracting negatives wrongly. Use **Signed Number Slip** (`FAC_SIGNED_NUMBER`).
- **Practice that helps:** Sign-tracking checkpoints: highlight every sign before and after the step.

### Wrong Inverse Operation

`PRC_INVERSE_OPERATION`

- **Shown to people:** Undid a step the wrong way. A step was undone with the wrong operation, like subtracting instead of dividing.
- **What it is:** Uses the wrong inverse when isolating a variable.
- **Example:** 2x = 8 -> x = 6; x/3 = 4 -> x = 4/3; x^2 = 16 -> x = 8.
- **Not this:** Applying the operation to one side only. Use **Equation Balance** (`CON_EQUATION_BALANCE`).
- **Practice that helps:** Write the operation being undone, then its inverse, next to each line.

### Inequality Direction

`PRC_INEQUALITY_DIRECTION`

- **Shown to people:** Inequality sign not flipped. The inequality sign should have flipped when multiplying or dividing by a negative.
- **What it is:** Does not reverse the inequality when multiplying or dividing by a negative (or reverses it when it should not).
- **Example:** -2x > 6 -> x > -3.
- **Not this:** Other sign slips while rearranging. Use **Sign or Factor Dropped** (`PRC_SIGN_OR_FACTOR_DROPPED`).
- **Practice that helps:** Test a number from the answer in the original inequality.

### Factoring Error

`PRC_FACTORING_ERROR`

- **Shown to people:** Factored wrong. The expression was factored into pieces that do not multiply back to it.
- **What it is:** Factors incorrectly: wrong pair of numbers, common factor only partly removed, or a difference of squares as a perfect square.
- **Example:** x^2 + 5x + 6 = (x + 1)(x + 6); x^2 - 9 = (x - 3)^2.
- **Not this:** Solving each correct factor with the wrong sign. Use **Sign or Factor Dropped** (`PRC_SIGN_OR_FACTOR_DROPPED`).
- **Not this:** Not factoring fully. Use **Incomplete Simplification** (`PRC_INCOMPLETE_SIMPLIFICATION`).
- **Practice that helps:** Expand the factors back out to check before moving on.

### Combining Equations

`PRC_SYSTEM_COMBINING`

- **Shown to people:** Equations combined wrong. When combining the two equations, they were added when they should have been subtracted, or the reverse.
- **What it is:** In a linear system, combines equations with the wrong operation or substitutes back into the equation it came from.
- **Example:** 4y and -4y with the equations subtracted instead of added; substitutes y = 2x - 1 back into the equation it came from and gets 0 = 0.
- **Not this:** Not multiplying every term when scaling an equation. Use **Sign or Factor Dropped** (`PRC_SIGN_OR_FACTOR_DROPPED`).
- **Practice that helps:** Write which variable will cancel and why before combining.

### Incomplete Simplification

`PRC_INCOMPLETE_SIMPLIFICATION` (replaces PRC-04)

- **Shown to people:** Not fully simplified. The work stopped a step or two before the answer was fully simplified.
- **What it is:** Stops before reaching the simplified or requested form.
- **Example:** Leaves 6/8; leaves sqrt(50) instead of 5 sqrt(2); stops at 2x = 10.
- **Not this:** Giving an answer in a different form than asked (decimal for exact). Use **Wrong Answer Form** (`COM_WRONG_FORM`).
- **Practice that helps:** Completion checklist: fractions reduced, radicals simplified, variable alone.

## Calculation & Recall (FAC)

Method and plan are sound; a number, fact, formula, unit or rounding slips.

### Arithmetic Slip

`FAC_ARITHMETIC_SLIP` (replaces FAC-01)

- **Shown to people:** Calculation slip. The steps make sense, with a small calculation slip in the numbers.
- **What it is:** An isolated arithmetic error with a sound method.
- **Example:** 7 * 8 = 54 in the middle of a correct solution; 52/13 = 3.
- **Not this:** A slip with negative numbers. Use **Signed Number Slip** (`FAC_SIGNED_NUMBER`).
- **Not this:** A wrong recalled fact used repeatedly. Use **Math Fact Recall** (`FAC_FACT_RECALL`).
- **Practice that helps:** 5-item rapid micro-drill on the same kind of calculation.

### Signed Number Slip

`FAC_SIGNED_NUMBER`

- **Shown to people:** Negative number slip. A slip happened when adding, subtracting or multiplying negative numbers.
- **What it is:** Arithmetic slip with negatives in otherwise correct work.
- **Example:** -3 - 5 = -2; (-4)(-2) = -8; (-4)^2 = -16 on a calculator line.
- **Not this:** Not understanding what a negative means. Use **Sign / Direction Meaning** (`CON_SIGN_DIRECTION_MEANING`).
- **Not this:** Losing a sign during expansion. Use **Sign or Factor Dropped** (`PRC_SIGN_OR_FACTOR_DROPPED`).
- **Practice that helps:** Number-line check for each signed step.

### Copy Error

`FAC_COPY_ERROR` (replaces FAC-02)

- **Shown to people:** Copied a number wrong. A number or sign changed when copying from one line to the next.
- **What it is:** Miscopies a digit, sign or term from one of the student's own lines to the next.
- **Example:** Line 3 says 3x + 12; line 4 starts 3x + 21.
- **Not this:** Misreading the printed question. Use **Misread Given** (`TST_MISREAD_GIVEN`).
- **Practice that helps:** Given-data check habit: compare each new line with the one above.

### Math Fact Recall

`FAC_FACT_RECALL`

- **Shown to people:** Math fact misremembered. A basic fact was remembered wrong, like a times-table fact or a perfect square.
- **What it is:** Misremembers a basic fact: times tables, squares and roots, exact trig values.
- **Example:** sqrt(81) = 8; 12^2 = 124; sin 30 deg = 0.6.
- **Not this:** A misremembered formula. Use **Formula Recall** (`FAC_FORMULA_RECALL`).
- **Practice that helps:** Short fact fluency drill, then the item again.

### Formula Recall

`FAC_FORMULA_RECALL`

- **Shown to people:** Formula remembered wrong. The right formula was chosen but remembered with a piece missing or changed.
- **What it is:** Picks the right formula but recalls it wrongly.
- **Example:** Quadratic formula without 2a in the denominator; distance formula without the square root.
- **Not this:** Choosing a formula that does not apply. Use **Formula / Law Misselection** (`STR_FORMULA_MISSELECTION`).
- **Practice that helps:** Formula card rebuild: write the formula from memory, then compare.

### Unit Conversion

`FAC_UNIT_CONVERSION` (replaces FAC-03)

- **Shown to people:** Unit slip. A unit conversion was off, like centimetres to metres.
- **What it is:** Converts units wrongly or mixes units in one calculation.
- **Example:** 150 cm = 15 m; adds 2 m and 30 cm as 32.
- **Not this:** Leaving units off the answer. Use **Missing Units** (`COM_MISSING_UNITS`).
- **Practice that helps:** Dimensional conversion bridge: write the conversion factor as a fraction.

### Rounding / Precision

`FAC_ROUNDING` (replaces FAC-04)

- **Shown to people:** Rounding slip. A number was rounded too early or to the wrong decimal place.
- **What it is:** Rounds too early, or breaks the precision the question asks for.
- **Example:** Rounds sin 37 deg to 0.6 mid-question and ends up 2 cm off; gives 3 decimals when asked for 1.
- **Not this:** Giving a decimal when an exact answer is asked for. Use **Wrong Answer Form** (`COM_WRONG_FORM`).
- **Practice that helps:** Precision rule: keep full values until the last line.

### Calculator Entry

`FAC_CALCULATOR_ENTRY`

- **Shown to people:** Calculator used wrong. The calculator was set up or used wrong, like being in radians instead of degrees.
- **What it is:** Wrong calculator mode, missing brackets when keying, or misread display.
- **Example:** sin 30 = -0.988 (radian mode); keys -3^2 and gets -9 when (-3)^2 = 9 was meant.
- **Not this:** A hand-arithmetic slip. Use **Arithmetic Slip** (`FAC_ARITHMETIC_SLIP`).
- **Practice that helps:** Calculator check: key a known value (sin 30 = 0.5) first.

## Communication (COM)

The maths may be right, but the answer does not say what was asked, or the work cannot be followed.

### Answered a Different Question

`COM_ANSWERED_DIFFERENT_QUESTION` (replaces TST-01)

- **Shown to people:** Answered a different question. The work solved for something slightly different from what the question asked.
- **What it is:** Gives a correct answer to a different target than the one asked.
- **Example:** Asked for the vertex, gives the zeros; asked for 2x + 5, stops at x.
- **Not this:** The right target in the wrong format. Use **Wrong Answer Form** (`COM_WRONG_FORM`).
- **Not this:** Skipping a whole sub-part. Use **Skipped Part** (`TST_SKIPPED_PART`).
- **Practice that helps:** Pre-submission prompt check: circle what is asked, then reread the final line.

### Wrong Answer Form

`COM_WRONG_FORM`

- **Shown to people:** Answer in the wrong form. The answer is right, but not in the form the question asked for.
- **What it is:** Gives the right quantity in a form other than the one requested.
- **Example:** Asked for vertex form, gives standard form; asked for an exact answer, gives 1.414; gives x = 2, y = 3 when a point is asked for.
- **Not this:** Stopping before simplifying. Use **Incomplete Simplification** (`PRC_INCOMPLETE_SIMPLIFICATION`).
- **Practice that helps:** Underline the requested form in the question and match it.

### Missing Units

`COM_MISSING_UNITS` (replaces TST-02)

- **Shown to people:** Missing units. The final answer is missing its units.
- **What it is:** Omits units on a measurement answer.
- **Example:** Area = 24 (no cm^2); time = 3.5.
- **Not this:** A wrong unit conversion. Use **Unit Conversion** (`FAC_UNIT_CONVERSION`).
- **Practice that helps:** Unit slot: draw a box for the unit next to every final answer.

### Missing Conclusion

`COM_MISSING_CONCLUSION`

- **Shown to people:** Missing final sentence. The question needed a closing sentence that answers it in words.
- **What it is:** Omits the concluding statement a word problem or proof requires.
- **Example:** Word problem ends at t = 4 with no 'The ball lands after 4 s.'
- **Not this:** Missing reasoning for a claim. Use **Unsupported Answer** (`COM_UNSUPPORTED_ANSWER`).
- **Practice that helps:** Concluding statement frame: 'Therefore, ...' using the question's words.

### Notation Misuse

`COM_NOTATION_MISUSE`

- **Shown to people:** Maths written the wrong way. The maths is written in a way that says something different, like a long chain of equals signs.
- **What it is:** Misuses notation so the written statement is false or ambiguous, even if the thinking is right.
- **Example:** 2x + 3 = 11 - 3 = 8 / 2 = 4; writes x + 2 * 3 meaning (x + 2) * 3; equals sign between an equation and its solution.
- **Not this:** Doing an operation to one side only (a real balance error). Use **Equation Balance** (`CON_EQUATION_BALANCE`).
- **Practice that helps:** One-equation-per-line layout model.

### Illegible Work

`COM_ILLEGIBLE_WORK`

- **Shown to people:** Hard-to-read working. Part of the working is too hard to read or follow.
- **What it is:** Handwriting or layout makes a line impossible to read or follow.
- **Example:** Overwritten digits that could be 1 or 7; steps scattered around the page with no order.
- **Not this:** When the photo itself is blurry, it is an upload problem, not an error code.
- **Practice that helps:** Grid workspace; ask for a clearer retake if the page is hard to read.

### Unsupported Answer

`COM_UNSUPPORTED_ANSWER`

- **Shown to people:** Answer not explained. The answer is there, but the reason the question asked for is missing.
- **What it is:** Gives an answer, claim or 'show that' conclusion without the reasoning or working the question requires.
- **Example:** 'Show the triangles are similar' answered 'they are similar'; correct root written with no work when work is required.
- **Not this:** A wrong answer with no work, likely guessed,. Use **Unworked Guess** (`TST_UNWORKED_GUESS`).
- **Practice that helps:** 'Because ...' justification frame after every claim.

### Missing Labels / Definitions

`COM_MISSING_LABELS`

- **Shown to people:** Labels missing. A graph, diagram or variable is missing labels, so it is unclear what it shows.
- **What it is:** Leaves out axis labels, scales, diagram labels or the 'let x be ...' definition that the work needs.
- **Example:** Graph with no axis labels or scale; uses x and y in a word problem without saying what they are.
- **Not this:** Units missing on a final answer. Use **Missing Units** (`COM_MISSING_UNITS`).
- **Practice that helps:** Label checklist: axes, scale, units, and 'let x = ...'.

## Test Habits (TST)

How the student handles the test: blanks, skipped parts, traps, giving up, not checking, guessing.

### Blank / Time Attrition

`TST_BLANK` (replaces TST-03)

- **Shown to people:** Left blank. This part was left blank.
- **What it is:** Leaves a question or part with no attempt, from time pressure or a frustration block.
- **Example:** Question 5 is empty; the last two parts have nothing written.
- **Not this:** Starting and then stopping. Use **Abandoned Work** (`TST_ABANDONED_WORK`).
- **Practice that helps:** Prerequisite baseline probe on the skill, then a first-step warm-up.

### Skipped Part

`TST_SKIPPED_PART`

- **Shown to people:** Part of the question skipped. One part of the question was skipped while the others were answered.
- **What it is:** Answers some parts of a multi-part question and leaves another out, likely without noticing.
- **Example:** Finds x in (a) and the vertex in (c) but never answers (b).
- **Not this:** Answering a different target. Use **Answered a Different Question** (`COM_ANSWERED_DIFFERENT_QUESTION`).
- **Not this:** Leaving the whole question empty. Use **Blank / Time Attrition** (`TST_BLANK`).
- **Practice that helps:** Tick each part number as it is answered.

### Distractor Trap

`TST_DISTRACTOR_TRAP` (replaces TST-04)

- **Shown to people:** Middle step taken as the answer. A middle step was treated as the final answer.
- **What it is:** Takes an intermediate value or a tempting wrong option as the final answer.
- **Example:** Finds the discriminant and gives it as the root; picks the multiple-choice option that matches a half-way value.
- **Not this:** Answering a different target from the start. Use **Answered a Different Question** (`COM_ANSWERED_DIFFERENT_QUESTION`).
- **Practice that helps:** 'Is this what was asked?' stop sign before the final line.

### Abandoned Work

`TST_ABANDONED_WORK`

- **Shown to people:** Gave up partway. A good start was stopped or crossed out before reaching an answer.
- **What it is:** Starts a valid approach, then stops or crosses it out partway with no answer.
- **Example:** Sets up the quadratic formula correctly, substitutes, then stops.
- **Not this:** No attempt at all. Use **Blank / Time Attrition** (`TST_BLANK`).
- **Practice that helps:** First-step confidence warm-up, then the same problem.

### Erased Correct Work

`TST_ERASED_CORRECT_WORK`

- **Shown to people:** Crossed out right work. Correct work was crossed out and replaced with something wrong.
- **What it is:** Strikes out or erases correct work and replaces it with an incorrect answer.
- **Example:** x = 4 crossed out, replaced with x = -4 which does not satisfy the equation.
- **Not this:** Crossing out work and giving no answer. Use **Abandoned Work** (`TST_ABANDONED_WORK`).
- **Practice that helps:** Check-before-changing habit: substitute both answers before crossing one out.

### Unchecked Answer

`TST_UNCHECKED_ANSWER`

- **Shown to people:** Answer not checked. A quick check would show this answer cannot be right, like a negative length.
- **What it is:** Gives an answer a quick check would show is impossible or absurd, and does not notice.
- **Example:** A side length of -3 cm; a probability of 1.4; a root that does not satisfy the equation.
- **Not this:** Not knowing the value is disallowed. Use **Domain / Restriction Blindness** (`CON_DOMAIN_RESTRICTION`).
- **Practice that helps:** Substitute-back or estimate check before finishing.

### Misread Given

`TST_MISREAD_GIVEN`

- **Shown to people:** Read the question wrong. A number or sign in the question was read wrong.
- **What it is:** Misreads a number, sign or symbol printed in the question.
- **Example:** Question says y = 2x^2 - 12x; work starts from y = 2x^2 + 12x.
- **Not this:** Miscopying between the student's own lines. Use **Copy Error** (`FAC_COPY_ERROR`).
- **Not this:** Misunderstanding the words. Use **Word Problem Setup** (`STR_SETUP_FROM_WORDS`).
- **Practice that helps:** Given-data check: compare line 1 with the question.

### Unworked Guess

`TST_UNWORKED_GUESS`

- **Shown to people:** Guessed with no work. An answer was written with no working, and it is not right.
- **What it is:** Writes a wrong final answer with no working shown, suggesting a guess.
- **Example:** 'x = 5' alone under a two-step equation whose answer is 3.
- **Not this:** A correct answer missing the required reasoning. Use **Unsupported Answer** (`COM_UNSUPPORTED_ANSWER`).
- **Practice that helps:** Show-one-step rule: write at least the first step before any answer.
