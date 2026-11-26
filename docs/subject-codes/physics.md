# Physics error codes (draft)

Generated from `backend/birdbrains/subjects/physics.json` by `backend/tools/subject_codes_doc.py`. Edit the JSON, not this page.

Courses: SNC1W, SNC2D, SPH3U, SPH4U, SPH4C. 48 codes.

| Pillar | Name | Points | Slip | Scope |
|---|---|---|---|---|
| CON | Concepts | 2 |  | The student holds a wrong idea about forces, motion, energy, waves, fields or circuits. |
| STR | Strategy & Setup | 2 |  | The ideas are sound, but the plan is wrong: the wrong equation or law, a wrong free-body diagram, sign convention, system or angle reference. |
| PRC | Procedure | 2 |  | The plan is right, but carrying out the method goes wrong (rearranging, vector addition, circuit reduction, graph analysis, ray diagrams). |
| FAC | Calculation & Recall | 2 | yes | Method and plan are sound; a number, sign, constant, formula detail, unit or rounding slips. |
| COM | Communication | 1 | yes | The physics may be right, but the answer is not what was asked, lacks a direction or unit, or is not explained. |
| TST | Test Habits | 1 | yes | How the student handles the test: blanks, traps, giving up, not checking, not using the formula sheet. |

## CON: Concepts

### `CON_FORCE_IMPLIES_MOTION` Motion Needs a Force

- **Shown as:** Thinks moving things need a force to keep going. _A net force changes motion; an object at constant velocity has zero net force._
- **Means:** Believes a moving object needs a net force in its direction of motion, or that the net force points the way the object moves.
- **Example:** 'The puck slides at constant speed on ice because the force of the push is still acting on it.'
- **Not `CON_VELOCITY_VS_ACCELERATION`:** If the confusion is between velocity and acceleration in kinematics (no forces involved), use CON_VELOCITY_VS_ACCELERATION.
- **Not `STR_FREE_BODY_DIAGRAM`:** If the student adds a 'force of motion' arrow to a diagram but otherwise reasons correctly, use STR_FREE_BODY_DIAGRAM.
- **Next step:** Tier 1: frictionless-cart thought experiment.

### `CON_VELOCITY_VS_ACCELERATION` Velocity vs Acceleration

- **Shown as:** Mixed up velocity and acceleration. _Acceleration is how fast velocity changes; an object can be stopped and still accelerating._
- **Means:** Treats velocity and acceleration as the same thing (zero velocity means zero acceleration; a fast object has a large acceleration), or reads a v-t graph as a position graph.
- **Example:** 'At the top of its flight the ball has zero acceleration because it has stopped.'
- **Not `CON_FORCE_IMPLIES_MOTION`:** If the reasoning is about forces causing motion, use CON_FORCE_IMPLIES_MOTION.
- **Not `PRC_GRAPH_ANALYSIS`:** If the student understands the quantities but takes the slope or area of a graph wrongly, use PRC_GRAPH_ANALYSIS.
- **Next step:** Tier 1: motion-sensor graph matching.

### `CON_VECTOR_AS_SCALAR` Vectors Treated as Scalars

- **Shown as:** Added vectors as plain numbers. _Vectors have direction; perpendicular ones combine with Pythagoras, not addition._
- **Means:** Adds, subtracts or compares vector quantities as if they had no direction (3 m east + 4 m north = 7 m; distance used for displacement).
- **Example:** 'She walks 3 km east and 4 km north, so her displacement is 7 km.'
- **Not `PRC_VECTOR_ADDITION`:** If the student knows vectors need components but combines them wrongly, use PRC_VECTOR_ADDITION.
- **Not `COM_DIRECTION_MISSING`:** If the magnitude is right and only the direction is left off the answer, use COM_DIRECTION_MISSING.
- **Next step:** Tier 1: tip-to-tail drawing on grid paper.

### `CON_THIRD_LAW_PAIRS` Third-Law Pairs Misunderstood

- **Shown as:** Mixed up action-reaction pairs. _Newton's third-law forces act on two different objects, so they never cancel each other._
- **Means:** Places both forces of a third-law pair on the same object, thinks they cancel, or thinks the bigger or faster object exerts the bigger force.
- **Example:** 'The truck hits the car with more force than the car hits the truck.'
- **Not `STR_FREE_BODY_DIAGRAM`:** If the error is only in which forces are drawn on one object, use STR_FREE_BODY_DIAGRAM.
- **Next step:** Tier 1: pair-labelling exercise (force of A on B / B on A).

### `CON_CURRENT_USED_UP` Current Used Up

- **Shown as:** Thinks current gets used up in a circuit. _Current is the same all the way around a series loop; energy, not charge, is transferred._
- **Means:** Believes current is consumed by components, so less current returns to the battery, or that the first bulb in series is brighter.
- **Example:** 'The second bulb is dimmer because the first bulb used up some of the current.'
- **Not `PRC_CIRCUIT_REDUCTION`:** If the idea of current is right and the resistor combination is calculated wrongly, use PRC_CIRCUIT_REDUCTION.
- **Next step:** Tier 1: ammeter readings at several points in a series loop.

### `CON_ENERGY_ACCOUNTING` Energy Not Conserved

- **Shown as:** Lost track of where the energy goes. _Energy is never used up; it is transferred or transformed, often to thermal energy._
- **Means:** Has energy appear or disappear, confuses energy with force or power, or treats 'energy lost' to friction as vanishing rather than becoming thermal energy.
- **Example:** 'At the bottom of the ramp the cart has no energy left, so it stops.'
- **Not `STR_FORMULA_MISSELECTION`:** If the idea is right but the wrong energy equation is chosen, use STR_FORMULA_MISSELECTION.
- **Next step:** Tier 1: energy bar charts (before, transfer, after).

### `CON_CENTRIFUGAL_FORCE` Outward Force in Circular Motion

- **Shown as:** Added an outward force in circular motion. _In circular motion the net force points to the centre; the 'outward pull' is inertia, not a force._
- **Means:** Draws or uses an outward centrifugal force, or thinks an object released from circular motion flies straight outward.
- **Example:** 'When the string breaks, the ball flies directly away from the centre.'
- **Not `STR_FREE_BODY_DIAGRAM`:** Use this code when the outward force comes from a wrong idea; use STR_FREE_BODY_DIAGRAM for other missing or extra forces.
- **Next step:** Tier 1: release-point demonstration with tangent lines.

### `CON_WAVE_PROPERTIES` Wave Properties Misunderstood

- **Shown as:** Mixed up what changes when a wave changes medium. _Frequency is set by the source; when a wave enters a new medium its speed and wavelength change._
- **Means:** Believes waves carry matter along, that frequency changes when a wave enters a new medium, or that louder sounds travel faster.
- **Example:** 'Light slows down in glass, so its frequency decreases.'
- **Not `STR_FORMULA_MISSELECTION`:** If the idea is right but the wrong wave equation is picked, use STR_FORMULA_MISSELECTION.
- **Next step:** Tier 1: rope-junction demonstration.


## STR: Strategy & Setup

### `STR_FORMULA_MISSELECTION` Formula / Law Misselection

- **Shown as:** Wrong formula for this question. _The formula or rule used here does not fit this type of question._
- **Means:** Applies a formula, theorem or law whose conditions the problem does not meet.
- **Example:** Given v₁, a and Δt, and asked for Δd, uses v₂² = v₁² + 2aΔd, which has two unknowns, instead of Δd = v₁Δt + ½aΔt².
- **Not `STR_WRONG_SUBSTITUTION`:** Here the formula itself is wrong for the situation; in STR_WRONG_SUBSTITUTION the formula is right but the givens go into the wrong places.
- **Not `FAC_FORMULA_RECALL`:** Here a different, real formula is chosen; in FAC_FORMULA_RECALL the right formula is chosen but remembered wrongly.
- **Next step:** Condition check table: list each formula with the conditions it needs, then tick which ones the question meets.

### `STR_FREE_BODY_DIAGRAM` Free-Body Diagram Error

- **Shown as:** Free-body diagram has missing or extra forces. _Draw only forces that something touching the object (or gravity) exerts on it._
- **Means:** Leaves a force out of the free-body diagram (normal force, friction, tension) or adds one that doesn't exist (a 'force of motion', the applied force after release).
- **Example:** Block on an incline: draws gravity and friction but no normal force.
- **Not `CON_FORCE_IMPLIES_MOTION`:** If an extra force comes from believing motion needs a force, use CON_FORCE_IMPLIES_MOTION.
- **Not `STR_ANGLE_REFERENCE`:** If all forces are present but resolved along the wrong axes, use STR_ANGLE_REFERENCE.
- **Next step:** Tier 2: force-agent checklist (what exerts it, on what).

### `STR_SIGN_CONVENTION` No Consistent Sign Convention

- **Shown as:** Mixed up which direction is positive. _Pick which way is positive at the start and give every vector its sign from that choice._
- **Means:** Does not choose a positive direction, or switches it partway, so values like g, displacement or velocity carry inconsistent signs.
- **Example:** Takes up as positive for the initial velocity (+12 m/s) but uses g = +9.8 m/s² for a ball thrown upward.
- **Not `FAC_SIGNED_NUMBER`:** If the signs are set up consistently and a sign slips in the arithmetic, use FAC_SIGNED_NUMBER.
- **Next step:** Tier 2: sign-convention box at the top of every solution.

### `STR_ANGLE_REFERENCE` Wrong Angle Reference

- **Shown as:** Used sin where cos was needed (or the reverse). _Sketch the right triangle and check which side is opposite your angle._
- **Means:** Resolves a vector using the wrong trig ratio because the angle is measured from a different line than assumed (from the vertical, from the incline).
- **Example:** On a 30° incline writes the component of gravity along the slope as mg cos 30°.
- **Not `STR_FREE_BODY_DIAGRAM`:** If a force is missing entirely, use STR_FREE_BODY_DIAGRAM.
- **Not `FAC_CALCULATOR_ENTRY`:** If the ratio is right but the calculator is in radians, use FAC_CALCULATOR_ENTRY.
- **Next step:** Tier 2: labelled component triangle drawn for every vector.

### `STR_WRONG_SYSTEM` Wrong System Chosen

- **Shown as:** Chose the wrong object or system. _Decide which object (or group of objects) you are applying the law to, and include only forces or momenta for that system._
- **Means:** Applies a law to the wrong system: uses the total mass for one object, conserves momentum across a system with a large external force, mixes forces on different objects in one Fnet.
- **Example:** Two blocks pulled together: finds the tension between them using Fnet on the whole system.
- **Not `STR_FREE_BODY_DIAGRAM`:** STR_FREE_BODY_DIAGRAM is about forces on one chosen object; this code is about choosing the object or system itself.
- **Next step:** Tier 2: system-boundary sketch before writing Fnet = ma.

### `STR_WRONG_SUBSTITUTION` Wrong Substitution

- **Shown as:** Values put in the wrong places. _The right formula was used, but values went into the wrong spots._
- **Means:** Puts known values into the wrong variables of a correct formula.
- **Example:** Puts the final velocity in for v₁ in v₂ = v₁ + aΔt.
- **Not `STR_FORMULA_MISSELECTION`:** If the formula is wrong for the situation, use STR_FORMULA_MISSELECTION; this code is only for the right formula filled in wrongly.
- **Not `TST_MISREAD_GIVEN`:** If the student read the number itself wrongly from the question, use TST_MISREAD_GIVEN; here the number is read right but given the wrong role.
- **Next step:** Givens list: symbol, value, unit for every quantity before any substitution.

### `STR_NO_VIABLE_PLAN` No Viable Plan

- **Shown as:** No clear plan. _The first move here could not lead to the answer. Plan the method before writing._
- **Means:** Starts with a move that cannot reach the answer, or moves symbols around with no method.
- **Example:** Projectile problem: writes three kinematics equations mixing horizontal and vertical values with no plan for which direction gives the time.
- **Not `STR_FORMULA_MISSELECTION`:** STR_FORMULA_MISSELECTION is one wrong choice inside a sensible plan; this code is for when no workable plan is visible at all.
- **Not `TST_UNWORKED_GUESS`:** If there is only an answer with no work, use TST_UNWORKED_GUESS; this code needs visible work that wanders.
- **Next step:** Plan-first prompt: name the target, the known quantities and the bridge between them before calculating.

### `STR_EXPERIMENT_DESIGN` Experimental Design Flaw

- **Shown as:** Experiment set up unfairly. _Change one thing, measure one thing, and keep everything else the same._
- **Means:** Gets the independent, dependent or controlled variables wrong, leaves out a control or repeats, or designs a test that cannot answer the question.
- **Example:** Measures the period of a pendulum to study length but changes the release angle each trial.
- **Not `COM_OBSERVATION_VS_INFERENCE`:** This code is about how the experiment is set up; COM_OBSERVATION_VS_INFERENCE is about how the results are reported.
- **Not `STR_NO_VIABLE_PLAN`:** STR_NO_VIABLE_PLAN is for calculation problems; use this code for planning an investigation.
- **Next step:** Fair-test frame: I will change ___, measure ___, and keep ___ the same; repeat ___ times.


## PRC: Procedure

### `PRC_STEP_OMITTED` Step Omission

- **Shown as:** Skipped a step. _A needed step in the method was skipped._
- **Means:** Skips a required step of the procedure, so the result does not follow.
- **Example:** Projectile: finds time in the air from the vertical motion, then skips multiplying by the horizontal velocity and reports the time as the range.
- **Not `PRC_INCOMPLETE_SOLUTION`:** Here a middle step is missing and the answer is wrong; in PRC_INCOMPLETE_SOLUTION the work is right but stops before the end.
- **Not `STR_NO_VIABLE_PLAN`:** If the plan itself is missing, use STR_NO_VIABLE_PLAN; here the plan is right and one step drops out.
- **Next step:** Faded worked example: complete the one missing step in an otherwise finished solution.

### `PRC_REARRANGEMENT` Rearranging Error

- **Shown as:** Rearranged the formula wrongly. _Rearrange with symbols first, then put the numbers in._
- **Means:** Rearranges an equation incorrectly to isolate the unknown (divides instead of multiplies, moves a term without changing its sign, loses a square).
- **Example:** Rearranges Ek = ½mv² for v as v = 2Ek/m (forgets the square root).
- **Not `FAC_ARITHMETIC_SLIP`:** If the algebra is right and only a number is computed wrongly, use FAC_ARITHMETIC_SLIP.
- **Not `STR_FORMULA_MISSELECTION`:** If the starting formula is wrong, use STR_FORMULA_MISSELECTION; this code is for a right formula rearranged wrongly.
- **Next step:** Symbol-first rearranging drill with a check by substituting simple numbers.

### `PRC_VECTOR_ADDITION` Vector Addition Error

- **Shown as:** Combined the vector components wrongly. _Add x-components together and y-components together, then use Pythagoras and tan⁻¹ for the result._
- **Means:** Knows vectors need components but adds them wrongly: mixes x and y, gives components the wrong sign for their quadrant, or takes tan⁻¹ of the wrong ratio.
- **Example:** Adds the x-component of one vector to the y-component of the other.
- **Not `CON_VECTOR_AS_SCALAR`:** If the student adds magnitudes directly, use CON_VECTOR_AS_SCALAR.
- **Not `STR_ANGLE_REFERENCE`:** If each component is computed with the wrong trig ratio, use STR_ANGLE_REFERENCE.
- **Next step:** Tier 2: component table (vector, x, y, sign).

### `PRC_CIRCUIT_REDUCTION` Circuit Reduction Error

- **Shown as:** Combined resistors wrongly. _Series resistors add; parallel resistors add as reciprocals, and you flip at the end._
- **Means:** Combines resistors wrongly: adds parallel resistors directly, forgets to take the reciprocal at the end, or treats a mixed circuit as all series.
- **Example:** Two 6 Ω resistors in parallel: writes 1/R = 1/6 + 1/6 = 1/3, so R = 1/3 Ω.
- **Not `CON_CURRENT_USED_UP`:** If the student's idea of current is wrong, use CON_CURRENT_USED_UP.
- **Next step:** Tier 2: redraw-and-reduce one step at a time.

### `PRC_GRAPH_ANALYSIS` Graph Analysis Error

- **Shown as:** Read the slope or area wrongly. _On a d-t graph slope is velocity; on a v-t graph slope is acceleration and the area is displacement._
- **Means:** Takes the slope where the area is needed (or the reverse), reads a single point instead of a slope, or uses the wrong rise or run.
- **Example:** Finds displacement from a v-t graph as the final velocity times the time, ignoring that the graph is a sloped line.
- **Not `CON_VELOCITY_VS_ACCELERATION`:** If the student misunderstands what the quantities mean, use CON_VELOCITY_VS_ACCELERATION.
- **Next step:** Tier 2: slope-or-area decision chart.

### `PRC_RAY_DIAGRAM` Ray Diagram Error

- **Shown as:** Drew the ray diagram with the wrong rules. _Use two standard rays: parallel then through F, and through the centre (or through F then parallel)._
- **Means:** Applies the ray rules wrongly (parallel ray not sent through the focal point, rays not extended for virtual images), so the image position or type is wrong.
- **Example:** Converging lens: draws the parallel ray refracting straight through without bending toward F.
- **Not `COM_MISSING_LABELS`:** If the diagram is right but the image, F or axes are unlabelled, use COM_MISSING_LABELS.
- **Next step:** Tier 2: three-ray template.

### `PRC_STAGE_HANDOFF` Stage Handoff Error

- **Shown as:** Didn't carry values between stages. _The final values from one stage become the starting values for the next._
- **Means:** In multi-stage problems (motion that changes acceleration, collision then slide), does not carry the end values of one stage into the next, or restarts from the original givens.
- **Example:** Car speeds up then brakes: uses v₁ = 0 for the braking stage instead of the speed reached in stage 1.
- **Not `STR_NO_VIABLE_PLAN`:** If the student never splits the problem into stages, use STR_NO_VIABLE_PLAN.
- **Next step:** Tier 2: stage table with a 'carry over' column.

### `PRC_INCOMPLETE_SOLUTION` Stopped Before the End

- **Shown as:** Stopped one step early. _Read the question again when you think you are done: is your last line the thing it asked for?_
- **Means:** Correct work that stops before the requested quantity or form is reached.
- **Example:** Asked for the speed at impact, finds the vertical component only and stops.
- **Not `COM_ANSWERED_DIFFERENT_QUESTION`:** If the student aimed at a different target from the start, use COM_ANSWERED_DIFFERENT_QUESTION; here they were heading to the right target and stopped.
- **Not `TST_DISTRACTOR_TRAP`:** If an intermediate value is boxed as if it were final, use TST_DISTRACTOR_TRAP; if the work simply ends, use this code.
- **Next step:** Completion checklist: target quantity, unit, form asked for.


## FAC: Calculation & Recall

### `FAC_ARITHMETIC_SLIP` Arithmetic Slip

- **Shown as:** Calculation slip. _The steps make sense, with a small calculation slip in the numbers._
- **Means:** An isolated arithmetic error with a sound method.
- **Example:** Computes 9.8 × 2.5 as 2.45.
- **Not `PRC_REARRANGEMENT`:** If the formula was rearranged wrongly before any arithmetic, use PRC_REARRANGEMENT.
- **Not `FAC_CALCULATOR_ENTRY`:** If the slip comes from how the number was keyed in (brackets, exponent, mode), use FAC_CALCULATOR_ENTRY.
- **Next step:** Five-item rapid micro-drill on the same operation.

### `FAC_SIGNED_NUMBER` Signed Number Slip

- **Shown as:** Negative number slip. _A slip happened when adding, subtracting or multiplying negative numbers._
- **Means:** Arithmetic slip with negatives in otherwise correct work.
- **Example:** Computes 0 − (−9.8)(3.0) as −29.4.
- **Not `FAC_ARITHMETIC_SLIP`:** Use this code when the slip is about the sign; other arithmetic slips are FAC_ARITHMETIC_SLIP.
- **Next step:** Integer operations micro-drill.

### `FAC_COPY_ERROR` Copy Error

- **Shown as:** Copied a number wrong. _A number or sign changed when copying from one line to the next._
- **Means:** Miscopies a digit, sign or term from one of the student's own lines to the next.
- **Example:** Writes 12.5 m/s on one line and 15.2 m/s on the next.
- **Not `TST_MISREAD_GIVEN`:** If the value was read wrongly from the question itself, use TST_MISREAD_GIVEN; this code is for copying between the student's own lines.
- **Not `FAC_ARITHMETIC_SLIP`:** If a value was calculated wrongly rather than copied, use FAC_ARITHMETIC_SLIP.
- **Next step:** Line-to-line check habit.

### `FAC_FORMULA_RECALL` Formula Recall

- **Shown as:** Formula remembered wrong. _The right formula was chosen but remembered with a piece missing or changed._
- **Means:** Picks the right formula but recalls it wrongly.
- **Example:** Writes kinetic energy as Ek = mv².
- **Not `STR_FORMULA_MISSELECTION`:** If a different formula was chosen, use STR_FORMULA_MISSELECTION.
- **Not `TST_REFERENCE_SHEET_UNUSED`:** If the formula was on the provided sheet, use TST_REFERENCE_SHEET_UNUSED.
- **Next step:** Formula flash cards with units for each symbol.

### `FAC_UNIT_CONVERSION` Unit Conversion

- **Shown as:** Unit slip. _A unit conversion was off, like centimetres to metres._
- **Means:** Converts units wrongly or mixes units in one calculation.
- **Example:** Uses 90 km/h directly in an equation with metres and seconds.
- **Not `COM_MISSING_UNITS`:** Here the number is wrong because of a conversion; in COM_MISSING_UNITS the number is right but the unit is not written.
- **Not `FAC_ARITHMETIC_SLIP`:** If the conversion factor is right and the multiplication goes wrong, use FAC_ARITHMETIC_SLIP.
- **Next step:** Dimensional conversion bridge: write the factor as a fraction that cancels the old unit.

### `FAC_ROUNDING` Rounding / Precision

- **Shown as:** Rounding slip. _A number was rounded too early or to the wrong decimal place._
- **Means:** Rounds too early, or breaks the precision the question asks for.
- **Example:** Rounds the time to 1 s halfway through and gets a final distance off by 20%.
- **Not `FAC_ARITHMETIC_SLIP`:** If the digits themselves are wrong, not just how many are kept, use FAC_ARITHMETIC_SLIP.
- **Next step:** Precision rules card: count significant figures in the givens, keep guard digits, round once.

### `FAC_CALCULATOR_ENTRY` Calculator Entry

- **Shown as:** Calculator used wrong. _The calculator was set up or used wrong, like being in radians instead of degrees._
- **Means:** Wrong calculator mode, missing brackets when keying, or misread display.
- **Example:** Calculator in radian mode: sin 30 = −0.988.
- **Not `FAC_ARITHMETIC_SLIP`:** Use FAC_ARITHMETIC_SLIP for mental or written arithmetic; this code is for results that only make sense as a keying slip (for example an answer off by a power of ten).
- **Next step:** Calculator entry drill with the same expression typed three ways.

### `FAC_CONSTANT_RECALL` Constant Recall Slip

- **Shown as:** Used the wrong value for a constant. _Check constants (g, c, k) against the data sheet._
- **Means:** Uses a wrong value for a physical constant (g = 10 or 98 m/s², c = 3 × 10⁶ m/s, wrong exponent on k or G).
- **Example:** Uses the speed of light as 3.0 × 10⁶ m/s.
- **Not `TST_REFERENCE_SHEET_UNUSED`:** If the constant was printed on the provided data sheet, use TST_REFERENCE_SHEET_UNUSED.
- **Not `FAC_FORMULA_RECALL`:** If the formula, not the constant, is misremembered, use FAC_FORMULA_RECALL.
- **Next step:** Tier 3: constants flash cards.


## COM: Communication

### `COM_ANSWERED_DIFFERENT_QUESTION` Answered a Different Question

- **Shown as:** Answered a different question. _The work solved for something slightly different from what the question asked._
- **Means:** Gives a correct answer to a different target than the one asked.
- **Example:** Asked for the maximum height, gives the time to reach it.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work was heading to the right target and stopped short, use PRC_INCOMPLETE_SOLUTION.
- **Not `TST_SKIPPED_PART`:** If a whole labelled part (b) is missing, use TST_SKIPPED_PART.
- **Next step:** Prompt deconstruction box: circle the verb, underline the target.

### `COM_MISSING_UNITS` Missing Units

- **Shown as:** Missing units. _The final answer is missing its units._
- **Means:** Omits units on a measurement answer.
- **Example:** Gives the force as '24.5' with no newtons.
- **Not `FAC_UNIT_CONVERSION`:** If the number is wrong because of a conversion, use FAC_UNIT_CONVERSION.
- **Next step:** Unit slot habit: draw a box after the answer for the unit.

### `COM_DIRECTION_MISSING` Direction Missing

- **Shown as:** Left the direction off a vector answer. _Velocity, displacement, force and momentum answers need a direction, like [E 30° N] or 'down the ramp'._
- **Means:** Gives a correct magnitude for a vector quantity but no direction, or a direction that does not use the convention set up in the question.
- **Example:** Final answer: 'v = 25 m/s' when the question asks for the velocity.
- **Not `CON_VECTOR_AS_SCALAR`:** If the student combined vectors as scalars, use CON_VECTOR_AS_SCALAR.
- **Not `COM_MISSING_UNITS`:** If the unit is missing, use COM_MISSING_UNITS.
- **Next step:** Tier 4: final-answer template with magnitude, unit and direction slots.

### `COM_UNSUPPORTED_ANSWER` Unsupported Answer

- **Shown as:** Answer not explained. _The answer is there, but the reason the question asked for is missing._
- **Means:** Gives an answer, claim or 'show that' conclusion without the reasoning or working the question requires.
- **Example:** 'Which ball lands first? They land at the same time.' with no reasoning about equal acceleration.
- **Not `COM_WORK_NOT_SHOWN`:** COM_WORK_NOT_SHOWN is for missing calculation steps; this code is for a missing explanation in words.
- **Not `COM_IMPRECISE_TERMS`:** If an explanation is there but uses loose words, use COM_IMPRECISE_TERMS.
- **Next step:** Claim-evidence-reasoning frame.

### `COM_WORK_NOT_SHOWN` Work Not Shown

- **Shown as:** Didn't show the work. _Write the formula, then the numbers in it, then the answer._
- **Means:** A calculation answer with no formula, substitution or steps where the question expects them, so the method cannot be checked or credited.
- **Example:** Writes 'a = 2.4 m/s²' with no equation or substitution.
- **Not `TST_UNWORKED_GUESS`:** If the answer is wrong and there is no work, it is likely a guess: use TST_UNWORKED_GUESS. Use this code when the answer is right or close and only the steps are missing.
- **Not `COM_UNSUPPORTED_ANSWER`:** For a missing explanation in words, use COM_UNSUPPORTED_ANSWER.
- **Next step:** GRASS layout model: Given, Required, Analysis, Solution, Statement.

### `COM_MISSING_LABELS` Missing Labels / Definitions

- **Shown as:** Labels missing. _A graph, diagram or variable is missing labels, so it is unclear what it shows._
- **Means:** Leaves out axis labels, scales, diagram labels or the 'let x be ...' definition that the work needs.
- **Example:** Draws a free-body diagram with arrows but no force names.
- **Not `COM_MISSING_UNITS`:** COM_MISSING_UNITS is for a final numerical answer; this code is for diagrams, graphs and tables.
- **Next step:** Graph checklist card.

### `COM_IMPRECISE_TERMS` Imprecise Terms

- **Shown as:** Used an everyday word where a subject term was needed. _Use the exact subject word instead of an everyday one._
- **Means:** The idea is right but is stated with everyday or loose words where a specific scientific term is needed, so the answer is ambiguous.
- **Example:** Writes 'the speed changes direction' or uses 'weight' for mass.
- **Not `COM_UNSUPPORTED_ANSWER`:** If no reasoning is given at all, use COM_UNSUPPORTED_ANSWER.
- **Not Other:** If the wrong word shows a wrong idea (the student really thinks sugar melts in water), use the matching concept (CON) code instead.
- **Next step:** Word wall with paired everyday and scientific terms.

### `COM_OBSERVATION_VS_INFERENCE` Observation vs Inference

- **Shown as:** Mixed up what you saw with what it means. _Observations are what you saw, heard or measured; put explanations in the analysis._
- **Means:** In lab or data questions, reports an explanation as if it were observed, or lists observations where an analysis or conclusion is asked for. Includes conclusions that go beyond the data.
- **Example:** Observation: 'friction slowed the cart' (what was measured was the distance).
- **Not `STR_EXPERIMENT_DESIGN`:** STR_EXPERIMENT_DESIGN is about how the investigation is planned; this code is about how results are written up.
- **Next step:** Two-column observation / inference sort.


## TST: Test Habits

### `TST_BLANK` Blank / Time Attrition

- **Shown as:** Left blank. _This part was left blank._
- **Means:** Leaves a question or part with no attempt, from time pressure or a frustration block.
- **Example:** A whole question with no writing at all.
- **Not `TST_ABANDONED_WORK`:** If any work was started, use TST_ABANDONED_WORK.
- **Not `TST_SKIPPED_PART`:** If other parts of the same question are answered, use TST_SKIPPED_PART.
- **Next step:** Prerequisite baseline probe on that topic.

### `TST_SKIPPED_PART` Skipped Part

- **Shown as:** Part of the question skipped. _One part of the question was skipped while the others were answered._
- **Means:** Answers some parts of a multi-part question and leaves another out, likely without noticing.
- **Example:** Asked for the range and the maximum height; gives only the range.
- **Not `TST_BLANK`:** If the whole question is empty, use TST_BLANK.
- **Not `COM_ANSWERED_DIFFERENT_QUESTION`:** If the student answered something else instead of what was asked, use COM_ANSWERED_DIFFERENT_QUESTION.
- **Next step:** Part checklist habit.

### `TST_DISTRACTOR_TRAP` Distractor Trap

- **Shown as:** Middle step taken as the answer. _A middle step was treated as the final answer._
- **Means:** Takes an intermediate value or a tempting wrong option as the final answer.
- **Example:** Boxes the horizontal component of velocity as the final speed.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work just stops, use PRC_INCOMPLETE_SOLUTION; this code is for presenting the wrong value as final.
- **Not `TST_UNWORKED_GUESS`:** If there is no work behind the choice, use TST_UNWORKED_GUESS.
- **Next step:** 'Is this what was asked?' stop sign.

### `TST_ABANDONED_WORK` Abandoned Work

- **Shown as:** Gave up partway. _A good start was stopped or crossed out before reaching an answer._
- **Means:** Starts a valid approach, then stops or crosses it out partway with no answer.
- **Example:** Starts resolving forces on the incline, then crosses it out with no answer.
- **Not `TST_BLANK`:** If nothing was written, use TST_BLANK.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work reaches a result one step short of the target, use PRC_INCOMPLETE_SOLUTION.
- **Next step:** First-step confidence warm-up, then the same problem.

### `TST_UNCHECKED_ANSWER` Unchecked Answer

- **Shown as:** Answer not checked. _A quick check would show this answer cannot be right, like a negative length._
- **Means:** Gives an answer a quick check would show is impossible or absurd, and does not notice.
- **Example:** Reports a car's stopping distance as 4500 km.
- **Not `FAC_ARITHMETIC_SLIP`:** Code the slip that caused the answer as well when it is visible; this code records that the impossible result was not caught.
- **Next step:** Estimate-then-check habit.

### `TST_MISREAD_GIVEN` Misread Given

- **Shown as:** Read the question wrong. _A number or sign in the question was read wrong._
- **Means:** Misreads a number, sign or symbol printed in the question.
- **Example:** Question says 45 cm; student uses 45 m.
- **Not `FAC_COPY_ERROR`:** If the slip happens between the student's own lines, use FAC_COPY_ERROR.
- **Not `STR_WRONG_SUBSTITUTION`:** If the value is read right but used in the wrong place, use STR_WRONG_SUBSTITUTION.
- **Next step:** Given-data check habit.

### `TST_UNWORKED_GUESS` Unworked Guess

- **Shown as:** Guessed with no work. _An answer was written with no working, and it is not right._
- **Means:** Writes a wrong final answer with no working shown, suggesting a guess.
- **Example:** Writes 'Fnet = 50 N' with no work; the answer is 18 N.
- **Not `COM_WORK_NOT_SHOWN`:** If the answer is right but the work is missing, use COM_WORK_NOT_SHOWN.
- **Next step:** Show-one-step routine.

### `TST_REFERENCE_SHEET_UNUSED` Reference Sheet Not Used

- **Shown as:** Didn't use the data sheet. _If a value or formula is on the data sheet or periodic table, look it up instead of remembering it._
- **Means:** Gets a value, constant or formula wrong that was printed on the provided data sheet, formula sheet or periodic table.
- **Example:** Uses G = 6.67 × 10⁻¹² when the data sheet gives 6.67 × 10⁻¹¹.
- **Not Other:** If the formula or value was NOT provided, use the matching recall (FAC) code.
- **Next step:** Reference-sheet scavenger hunt before the test.
