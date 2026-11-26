# Chemistry error codes (draft)

Generated from `backend/birdbrains/subjects/chemistry.json` by `backend/tools/subject_codes_doc.py`. Edit the JSON, not this page.

Courses: SNC1W, SNC2D, SCH3U, SCH4U, SCH4C. 49 codes.

| Pillar | Name | Points | Slip | Scope |
|---|---|---|---|---|
| CON | Concepts | 2 |  | The student holds a wrong idea about matter, particles, bonding, reactions or energy. |
| STR | Strategy & Setup | 2 |  | The ideas are sound, but the plan is wrong: the wrong relationship, reaction, ratio or experimental design. |
| PRC | Procedure | 2 |  | The plan is right, but carrying out the method goes wrong (stoichiometry steps, naming, formulas, Lewis structures, equilibrium expressions). |
| FAC | Calculation & Recall | 2 | yes | Method and plan are sound; a number, molar mass, constant, charge, unit or rounding slips. |
| COM | Communication | 1 | yes | The chemistry may be right, but the answer is not what was asked, is written in wrong notation, or is not explained. |
| TST | Test Habits | 1 | yes | How the student handles the test: blanks, traps, giving up, not checking, not using the data sheet. |

## CON: Concepts

### `CON_PARTICLE_PROPERTIES` Bulk Properties Given to Particles

- **Shown as:** Gave particles properties they don't have. _Single particles don't melt, expand or change colour; only the spaces and motions between them change._
- **Means:** Gives individual atoms or molecules the visible properties of the substance (molecules expand when heated, copper atoms are orange, particles melt).
- **Example:** 'When the gas is heated, the molecules get bigger, so the balloon expands.'
- **Not `CON_INTER_INTRA_FORCES`:** If the error is about which bonds break during a change of state, use CON_INTER_INTRA_FORCES.
- **Not `COM_IMPRECISE_TERMS`:** If the student means the right thing and only words it loosely ('the particles spread out' for the gas), use COM_IMPRECISE_TERMS.
- **Next step:** Tier 1: particle diagram before and after the change.

### `CON_INTER_INTRA_FORCES` Intermolecular vs Intramolecular Forces

- **Shown as:** Mixed up forces between and within molecules. _Boiling and melting separate molecules from each other; the bonds inside each molecule stay._
- **Means:** Confuses forces between molecules with bonds inside them (boiling water breaks O-H bonds; a stronger covalent bond means a higher boiling point).
- **Example:** 'When water boils, the bonds between hydrogen and oxygen break, so the bubbles are hydrogen and oxygen gas.'
- **Not `CON_PARTICLE_PROPERTIES`:** CON_PARTICLE_PROPERTIES is about giving particles bulk properties; this code is about which forces a change affects.
- **Not `CON_BOND_ENERGY`:** If the error is about whether bond breaking takes in or gives out energy, use CON_BOND_ENERGY.
- **Next step:** Tier 1: two-level diagram of molecules with bonds inside and attractions between.

### `CON_BOND_ENERGY` Bond Breaking Releases Energy

- **Shown as:** Thinks breaking bonds gives out energy. _Breaking bonds always takes energy in; making bonds gives energy out._
- **Means:** Believes breaking bonds releases energy, or that energy is stored 'in' a bond and let out when it breaks; gets the sign of ΔH backwards as a result.
- **Example:** 'ATP releases energy because its phosphate bond breaks.' / 'Combustion is exothermic because the fuel's bonds break.'
- **Not `PRC_ENERGY_SIGN`:** If the student knows which way energy flows but writes ΔH with the wrong sign or on the wrong side, use PRC_ENERGY_SIGN.
- **Next step:** Tier 1: energy-level diagram with bond breaking and bond making drawn as separate steps.

### `CON_MASS_CONSERVATION` Mass Not Conserved

- **Shown as:** Thinks mass is lost or gained in reactions. _Atoms are rearranged, never created or destroyed; a gas that escapes still has mass._
- **Means:** Believes mass disappears when a gas is produced or appears when a solid forms, or that a reaction can make or destroy atoms.
- **Example:** 'The mass went down after burning the steel wool... wait, it went up, so mass was created.'
- **Not `PRC_BALANCING`:** If the student accepts conservation but balances incorrectly, use PRC_BALANCING.
- **Next step:** Tier 1: closed-system demonstration and atom counting.

### `CON_IONIC_AS_MOLECULE` Ionic Compounds as Molecules

- **Shown as:** Treated an ionic compound like a molecule. _Ionic compounds are lattices of ions; there is no single 'NaCl molecule' and electrons are transferred, not shared._
- **Means:** Treats ionic compounds as discrete molecules, describes ionic bonding as sharing, or draws a single bond between a metal and non-metal ion.
- **Example:** 'One molecule of NaCl has a covalent bond where Na and Cl share an electron.'
- **Not `PRC_FORMULA_FROM_IONS`:** If the idea of ions is right but the formula is built wrongly from the charges, use PRC_FORMULA_FROM_IONS.
- **Next step:** Tier 1: lattice model next to a molecular model.

### `CON_MOLE_MEANING` What a Mole Means

- **Shown as:** Mixed up what a mole counts. _A mole is a count of particles; check whether you are counting molecules or the atoms inside them._
- **Means:** Treats the mole as a mass, or confuses moles of a compound with moles of the atoms in it (1 mol O₂ contains 1 mol O atoms).
- **Example:** '1 mol of O₂ has a mass of 16 g, the same as 1 mol of O.'
- **Not `FAC_MOLAR_MASS`:** If the student understands the mole and just adds the periodic table masses wrongly, use FAC_MOLAR_MASS.
- **Not `STR_WRONG_MOLE_RATIO`:** If the mole idea is right and the ratio from the equation is wrong, use STR_WRONG_MOLE_RATIO.
- **Next step:** Tier 1: counting analogy (a dozen eggs vs a dozen cartons).

### `CON_STATIC_EQUILIBRIUM` Equilibrium as Stopped

- **Shown as:** Thinks equilibrium means the reaction stops. _At equilibrium both reactions still happen at the same rate; amounts stay constant, not equal._
- **Means:** Believes reactions stop at equilibrium, that concentrations of reactants and products are equal, or that Le Châtelier shifts change K when only concentration changes.
- **Example:** 'At equilibrium the reaction is finished, so [N₂] = [NH₃].'
- **Not `PRC_EQUILIBRIUM_EXPRESSION`:** If the idea is right but the K expression or ICE table is built wrongly, use PRC_EQUILIBRIUM_EXPRESSION.
- **Next step:** Tier 1: two-way traffic simulation with equal rates.

### `CON_STRONG_VS_CONCENTRATED` Strong vs Concentrated

- **Shown as:** Mixed up strong and concentrated. _Strong means it ionises completely; concentrated means there is a lot of it per litre._
- **Means:** Confuses acid or base strength (degree of ionisation) with concentration, or thinks a weak acid cannot have a low pH.
- **Example:** '0.001 mol/L HCl is a weak acid because it is dilute.'
- **Not `FAC_SCIENCE_FACT_RECALL`:** If the student understands strength and just misremembers which acids are strong, use FAC_SCIENCE_FACT_RECALL.
- **Next step:** Tier 1: particle pictures of strong/weak × dilute/concentrated grid.


## STR: Strategy & Setup

### `STR_FORMULA_MISSELECTION` Formula / Law Misselection

- **Shown as:** Wrong formula for this question. _The formula or rule used here does not fit this type of question._
- **Means:** Applies a formula, theorem or law whose conditions the problem does not meet.
- **Example:** Uses Boyle's law (P₁V₁ = P₂V₂) on a question where the temperature also changes, instead of the combined gas law.
- **Not `STR_WRONG_SUBSTITUTION`:** Here the formula itself is wrong for the situation; in STR_WRONG_SUBSTITUTION the formula is right but the givens go into the wrong places.
- **Next step:** Condition check table: list each formula with the conditions it needs, then tick which ones the question meets.

### `STR_UNBALANCED_EQUATION_USED` Unbalanced Equation Used

- **Shown as:** Used an unbalanced equation. _Balance the equation before you take any mole ratio from it._
- **Means:** Takes mole ratios or mass predictions from an equation that has not been balanced.
- **Example:** Uses H₂ + O₂ → H₂O as written and concludes 1 mol H₂ gives 1 mol H₂O from 1 mol O₂.
- **Not `PRC_BALANCING`:** If the student tried to balance and got it wrong, use PRC_BALANCING; this code is for not balancing at all.
- **Not `STR_WRONG_MOLE_RATIO`:** If the equation is balanced and the ratio is read wrongly, use STR_WRONG_MOLE_RATIO.
- **Next step:** Tier 2: 'balance before you ratio' checkpoint.

### `STR_WRONG_MOLE_RATIO` Wrong Mole Ratio

- **Shown as:** Used the wrong mole ratio. _Write the ratio as (wanted coefficient / given coefficient) with the names next to the numbers._
- **Means:** Uses a balanced equation but inverts the mole ratio, takes the coefficient of the wrong species, or skips the ratio (assumes 1:1).
- **Example:** For 2H₂ + O₂ → 2H₂O, finds mol O₂ needed for 4 mol H₂ as 4 × 2/1 = 8 mol.
- **Not `STR_UNBALANCED_EQUATION_USED`:** If the equation was never balanced, use STR_UNBALANCED_EQUATION_USED.
- **Not `CON_MOLE_MEANING`:** If the student does not understand what the coefficients count, use CON_MOLE_MEANING.
- **Next step:** Tier 2: labelled ratio bridge (mol wanted / mol given).

### `STR_LIMITING_REAGENT_IGNORED` Limiting Reagent Ignored

- **Shown as:** Didn't find the limiting reactant. _When amounts of two reactants are given, work out which one runs out first._
- **Means:** When amounts of more than one reactant are given, calculates the product from the excess reactant or from both added together.
- **Example:** Given 2.0 mol H₂ and 2.0 mol O₂, predicts 4.0 mol H₂O from the oxygen.
- **Not `STR_WRONG_MOLE_RATIO`:** If the limiting reactant is chosen correctly but the ratio is wrong, use STR_WRONG_MOLE_RATIO.
- **Next step:** Tier 2: 'which runs out first' table for each reactant.

### `STR_WRONG_REACTION` Wrong Reaction Predicted

- **Shown as:** Predicted the wrong reaction or products. _Classify the reaction type first, then check the activity series or solubility table._
- **Means:** Predicts the wrong reaction type or products: a displacement the activity series rules out, a precipitate that is soluble, the wrong products of combustion or neutralisation.
- **Example:** Predicts Cu + ZnSO₄ → CuSO₄ + Zn even though copper is below zinc in the activity series.
- **Not `PRC_FORMULA_FROM_IONS`:** If the products are right but their formulas are written wrongly, use PRC_FORMULA_FROM_IONS.
- **Not `TST_REFERENCE_SHEET_UNUSED`:** If the activity series or solubility table was provided and ignored, use TST_REFERENCE_SHEET_UNUSED.
- **Next step:** Tier 1: reaction-type decision tree.

### `STR_WRONG_SUBSTITUTION` Wrong Substitution

- **Shown as:** Values put in the wrong places. _The right formula was used, but values went into the wrong spots._
- **Means:** Puts known values into the wrong variables of a correct formula.
- **Example:** In C₁V₁ = C₂V₂, puts the volume of water added in as V₂ instead of the total final volume.
- **Not `STR_FORMULA_MISSELECTION`:** If the formula is wrong for the situation, use STR_FORMULA_MISSELECTION; this code is only for the right formula filled in wrongly.
- **Not `TST_MISREAD_GIVEN`:** If the student read the number itself wrongly from the question, use TST_MISREAD_GIVEN; here the number is read right but given the wrong role.
- **Next step:** Givens list: symbol, value, unit for every quantity before any substitution.

### `STR_NO_VIABLE_PLAN` No Viable Plan

- **Shown as:** No clear plan. _The first move here could not lead to the answer. Plan the method before writing._
- **Means:** Starts with a move that cannot reach the answer, or moves symbols around with no method.
- **Example:** Asked for the mass of product from a mass of reactant, writes n = m/M and PV = nRT with no route between the two substances.
- **Not `STR_FORMULA_MISSELECTION`:** STR_FORMULA_MISSELECTION is one wrong choice inside a sensible plan; this code is for when no workable plan is visible at all.
- **Not `TST_UNWORKED_GUESS`:** If there is only an answer with no work, use TST_UNWORKED_GUESS; this code needs visible work that wanders.
- **Next step:** Plan-first prompt: name the target, the known quantities and the bridge between them before calculating.

### `STR_EXPERIMENT_DESIGN` Experimental Design Flaw

- **Shown as:** Experiment set up unfairly. _Change one thing, measure one thing, and keep everything else the same._
- **Means:** Gets the independent, dependent or controlled variables wrong, leaves out a control or repeats, or designs a test that cannot answer the question.
- **Example:** Tests how temperature affects reaction rate but also changes the acid concentration between trials.
- **Not `COM_OBSERVATION_VS_INFERENCE`:** This code is about how the experiment is set up; COM_OBSERVATION_VS_INFERENCE is about how the results are reported.
- **Not `STR_NO_VIABLE_PLAN`:** STR_NO_VIABLE_PLAN is for calculation problems; use this code for planning an investigation.
- **Next step:** Fair-test frame: I will change ___, measure ___, and keep ___ the same; repeat ___ times.


## PRC: Procedure

### `PRC_STEP_OMITTED` Step Omission

- **Shown as:** Skipped a step. _A needed step in the method was skipped._
- **Means:** Skips a required step of the procedure, so the result does not follow.
- **Example:** Applies the mole ratio directly to grams (mass of reactant × 2/1) without converting to moles first.
- **Not `PRC_INCOMPLETE_SOLUTION`:** Here a middle step is missing and the answer is wrong; in PRC_INCOMPLETE_SOLUTION the work is right but stops before the end.
- **Not `STR_NO_VIABLE_PLAN`:** If the plan itself is missing, use STR_NO_VIABLE_PLAN; here the plan is right and one step drops out.
- **Next step:** Faded worked example: complete the one missing step in an otherwise finished solution.

### `PRC_BALANCING` Balancing Method Error

- **Shown as:** Balanced the equation wrongly. _Only change the big numbers in front; never change the small subscripts._
- **Means:** Tries to balance but changes subscripts instead of coefficients, or leaves atoms unbalanced (often oxygen or polyatomic ions).
- **Example:** Balances H₂ + O₂ → H₂O by writing H₂ + O₂ → H₂O₂.
- **Not `STR_UNBALANCED_EQUATION_USED`:** If no balancing was attempted, use STR_UNBALANCED_EQUATION_USED.
- **Not `CON_MASS_CONSERVATION`:** If the student doesn't accept that atoms are conserved, use CON_MASS_CONSERVATION.
- **Next step:** Tier 2: atom-count table under each side of the equation.

### `PRC_FORMULA_FROM_IONS` Formula from Ions

- **Shown as:** Built the formula wrongly from the ions. _Make the total positive and negative charges equal; use brackets for more than one polyatomic ion._
- **Means:** Builds a formula whose charges don't balance, forgets brackets around polyatomic ions, or crosses charges without reducing.
- **Example:** Writes calcium nitrate as CaNO₃₂ or Ca₂(NO₃).
- **Not `FAC_ION_CHARGE_RECALL`:** If the student uses the wrong charge for an ion, use FAC_ION_CHARGE_RECALL; this code is for a wrong formula from the right charges.
- **Not `CON_IONIC_AS_MOLECULE`:** If the student does not see the compound as ionic at all, use CON_IONIC_AS_MOLECULE.
- **Next step:** Tier 2: charge-box method for each ion.

### `PRC_NAMING_RULES` Naming Rules Misapplied

- **Shown as:** Named the compound with the wrong rules. _Ionic: no prefixes, Roman numeral for multivalent metals. Molecular: prefixes._
- **Means:** Applies the wrong IUPAC naming system (prefixes on ionic compounds, no Roman numeral for a multivalent metal, wrong -ide/-ate/-ite ending, wrong organic parent chain).
- **Example:** Names FeCl₃ 'iron trichloride' or CO₂ 'carbon oxide'.
- **Not `FAC_ION_CHARGE_RECALL`:** If the rule is right but the Roman numeral is wrong because the charge was misremembered, use FAC_ION_CHARGE_RECALL.
- **Next step:** Tier 2: naming decision flowchart.

### `PRC_LEWIS_STRUCTURE` Lewis Structure Error

- **Shown as:** Drew the Lewis structure wrongly. _Count total valence electrons first, then check every atom has a full shell._
- **Means:** Miscounts valence electrons, leaves an atom without an octet, drops lone pairs, or misses a needed double bond; VSEPR shape follows from the wrong structure.
- **Example:** Draws CO₂ with single bonds and two lone pairs on carbon.
- **Not `FAC_SCIENCE_FACT_RECALL`:** If only the number of valence electrons for an element is misremembered, use FAC_SCIENCE_FACT_RECALL.
- **Next step:** Tier 2: electron-count checklist (total, bonds, lone pairs, octets).

### `PRC_EQUILIBRIUM_EXPRESSION` Equilibrium Expression Error

- **Shown as:** Set up K or the ICE table wrongly. _Products over reactants, coefficients as powers, and leave out solids and pure liquids._
- **Means:** Builds K, Ksp or an ICE table wrongly: coefficients as multipliers instead of exponents, solids or water included, change row not in the mole ratio.
- **Example:** For N₂ + 3H₂ ⇌ 2NH₃ writes K = [NH₃]/(3[H₂][N₂]).
- **Not `CON_STATIC_EQUILIBRIUM`:** If the student misunderstands what equilibrium is, use CON_STATIC_EQUILIBRIUM.
- **Next step:** Tier 2: ICE-table template with the stoichiometry row filled in.

### `PRC_ENERGY_SIGN` Energy Sign Error

- **Shown as:** Got the sign of the energy change wrong. _Exothermic: ΔH is negative and energy is a product. Endothermic: ΔH is positive._
- **Means:** Knows whether a reaction is exothermic or endothermic but writes ΔH with the wrong sign, adds Hess's law steps without flipping signs, or uses q = mcΔT with the wrong sign for the system.
- **Example:** Reverses a Hess's law equation but keeps ΔH = −286 kJ.
- **Not `CON_BOND_ENERGY`:** If the student thinks bond breaking releases energy, use CON_BOND_ENERGY.
- **Next step:** Tier 2: sign-tracking checkpoints at each Hess's law step.

### `PRC_REARRANGEMENT` Rearranging Error

- **Shown as:** Rearranged the formula wrongly. _Rearrange with symbols first, then put the numbers in._
- **Means:** Rearranges an equation incorrectly to isolate the unknown (divides instead of multiplies, moves a term without changing its sign, loses a square).
- **Example:** Rearranges PV = nRT for T as T = nR/PV.
- **Not `FAC_ARITHMETIC_SLIP`:** If the algebra is right and only a number is computed wrongly, use FAC_ARITHMETIC_SLIP.
- **Not `STR_FORMULA_MISSELECTION`:** If the starting formula is wrong, use STR_FORMULA_MISSELECTION; this code is for a right formula rearranged wrongly.
- **Next step:** Symbol-first rearranging drill with a check by substituting simple numbers.

### `PRC_INCOMPLETE_SOLUTION` Stopped Before the End

- **Shown as:** Stopped one step early. _Read the question again when you think you are done: is your last line the thing it asked for?_
- **Means:** Correct work that stops before the requested quantity or form is reached.
- **Example:** Asked for the mass of CO₂ produced, finds 0.25 mol CO₂ and stops.
- **Not `COM_ANSWERED_DIFFERENT_QUESTION`:** If the student aimed at a different target from the start, use COM_ANSWERED_DIFFERENT_QUESTION; here they were heading to the right target and stopped.
- **Not `TST_DISTRACTOR_TRAP`:** If an intermediate value is boxed as if it were final, use TST_DISTRACTOR_TRAP; if the work simply ends, use this code.
- **Next step:** Completion checklist: target quantity, unit, form asked for.


## FAC: Calculation & Recall

### `FAC_ARITHMETIC_SLIP` Arithmetic Slip

- **Shown as:** Calculation slip. _The steps make sense, with a small calculation slip in the numbers._
- **Means:** An isolated arithmetic error with a sound method.
- **Example:** Computes 0.250 × 44.01 as 1.10 instead of 11.0.
- **Not `PRC_REARRANGEMENT`:** If the formula was rearranged wrongly before any arithmetic, use PRC_REARRANGEMENT.
- **Not `FAC_CALCULATOR_ENTRY`:** If the slip comes from how the number was keyed in (brackets, exponent, mode), use FAC_CALCULATOR_ENTRY.
- **Next step:** Five-item rapid micro-drill on the same operation.

### `FAC_COPY_ERROR` Copy Error

- **Shown as:** Copied a number wrong. _A number or sign changed when copying from one line to the next._
- **Means:** Miscopies a digit, sign or term from one of the student's own lines to the next.
- **Example:** Writes 0.0350 mol on one line and 0.0530 mol on the next.
- **Not `TST_MISREAD_GIVEN`:** If the value was read wrongly from the question itself, use TST_MISREAD_GIVEN; this code is for copying between the student's own lines.
- **Not `FAC_ARITHMETIC_SLIP`:** If a value was calculated wrongly rather than copied, use FAC_ARITHMETIC_SLIP.
- **Next step:** Line-to-line check habit.

### `FAC_MOLAR_MASS` Molar Mass Slip

- **Shown as:** Molar mass slip. _Add one atomic mass for every atom, including the ones in brackets._
- **Means:** Calculates a molar mass wrongly: misses atoms in brackets or hydrates, reads the atomic number instead of the mass, adds a wrong mass.
- **Example:** Uses 62.0 g/mol for Ca(NO₃)₂ by counting the nitrate only once.
- **Not `CON_MOLE_MEANING`:** If the student confuses moles of molecules with atoms, use CON_MOLE_MEANING.
- **Not `FAC_ARITHMETIC_SLIP`:** If the right masses are added wrongly, use FAC_ARITHMETIC_SLIP.
- **Next step:** Tier 3: molar mass table (element, count, mass, subtotal).

### `FAC_ION_CHARGE_RECALL` Ion Charge Recall

- **Shown as:** Remembered an ion's charge or formula wrongly. _Check the ion table for charges and polyatomic formulas._
- **Means:** Uses the wrong charge for an ion or the wrong formula for a polyatomic ion.
- **Example:** Writes sulfate as SO₃²⁻ or aluminium as Al²⁺.
- **Not `PRC_FORMULA_FROM_IONS`:** If the charges are right and the formula is built wrongly, use PRC_FORMULA_FROM_IONS.
- **Not `TST_REFERENCE_SHEET_UNUSED`:** If an ion table was provided, use TST_REFERENCE_SHEET_UNUSED.
- **Next step:** Tier 3: ion flash cards.

### `FAC_SCIENCE_FACT_RECALL` Fact Recall Slip

- **Shown as:** Remembered a fact wrongly. _Check this fact in your notes; it is one to memorise._
- **Means:** Misremembers a specific fact: which acids are strong, valence electrons for a group, a solubility rule, a functional group name.
- **Example:** Lists HF as a strong acid.
- **Not `CON_STRONG_VS_CONCENTRATED`:** If the misunderstanding is about what 'strong' means, use CON_STRONG_VS_CONCENTRATED.
- **Next step:** Tier 3: spaced-recall quiz on the fact list.

### `FAC_UNIT_CONVERSION` Unit Conversion

- **Shown as:** Unit slip. _A unit conversion was off, like centimetres to metres._
- **Means:** Converts units wrongly or mixes units in one calculation.
- **Example:** Uses 25 °C instead of 298 K in PV = nRT.
- **Not `COM_MISSING_UNITS`:** Here the number is wrong because of a conversion; in COM_MISSING_UNITS the number is right but the unit is not written.
- **Not `FAC_ARITHMETIC_SLIP`:** If the conversion factor is right and the multiplication goes wrong, use FAC_ARITHMETIC_SLIP.
- **Next step:** Dimensional conversion bridge: write the factor as a fraction that cancels the old unit.

### `FAC_ROUNDING` Rounding / Precision

- **Shown as:** Rounding slip. _A number was rounded too early or to the wrong decimal place._
- **Means:** Rounds too early, or breaks the precision the question asks for.
- **Example:** Reports 0.12345 mol from data given to three significant figures.
- **Not `FAC_ARITHMETIC_SLIP`:** If the digits themselves are wrong, not just how many are kept, use FAC_ARITHMETIC_SLIP.
- **Next step:** Precision rules card: count significant figures in the givens, keep guard digits, round once.

### `FAC_CALCULATOR_ENTRY` Calculator Entry

- **Shown as:** Calculator used wrong. _The calculator was set up or used wrong, like being in radians instead of degrees._
- **Means:** Wrong calculator mode, missing brackets when keying, or misread display.
- **Example:** Types 6.02 × 10^23 without brackets in a division and gets an answer off by a factor of 10⁴⁶.
- **Not `FAC_ARITHMETIC_SLIP`:** Use FAC_ARITHMETIC_SLIP for mental or written arithmetic; this code is for results that only make sense as a keying slip (for example an answer off by a power of ten).
- **Next step:** Calculator entry drill with the same expression typed three ways.


## COM: Communication

### `COM_ANSWERED_DIFFERENT_QUESTION` Answered a Different Question

- **Shown as:** Answered a different question. _The work solved for something slightly different from what the question asked._
- **Means:** Gives a correct answer to a different target than the one asked.
- **Example:** Asked for the mass of oxygen needed, gives the mass of water produced.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work was heading to the right target and stopped short, use PRC_INCOMPLETE_SOLUTION.
- **Not `TST_SKIPPED_PART`:** If a whole labelled part (b) is missing, use TST_SKIPPED_PART.
- **Next step:** Prompt deconstruction box: circle the verb, underline the target.

### `COM_MISSING_UNITS` Missing Units

- **Shown as:** Missing units. _The final answer is missing its units._
- **Means:** Omits units on a measurement answer.
- **Example:** Writes the concentration as 0.50 with no mol/L.
- **Not `FAC_UNIT_CONVERSION`:** If the number is wrong because of a conversion, use FAC_UNIT_CONVERSION.
- **Next step:** Unit slot habit: draw a box after the answer for the unit.

### `COM_CHEM_NOTATION` Chemical Notation Error

- **Shown as:** Wrote the chemical symbols or formula wrongly. _Capital letter starts each element; subscripts go low, charges go high, and states go in brackets._
- **Means:** Correct chemistry in wrong notation: case of element symbols, subscripts written as coefficients, charges missing on ions, missing states, wrong arrow (→ vs ⇌).
- **Example:** Writes CO (carbon monoxide) as Co, or Na+ as Na.
- **Not `FAC_ION_CHARGE_RECALL`:** If the charge written is the wrong value, use FAC_ION_CHARGE_RECALL; this code is for a right value written wrongly or left out.
- **Not `PRC_BALANCING`:** If subscripts were changed to balance, use PRC_BALANCING.
- **Next step:** Tier 4: notation checklist.

### `COM_UNSUPPORTED_ANSWER` Unsupported Answer

- **Shown as:** Answer not explained. _The answer is there, but the reason the question asked for is missing._
- **Means:** Gives an answer, claim or 'show that' conclusion without the reasoning or working the question requires.
- **Example:** 'Which has the higher boiling point, H₂O or H₂S? H₂O.' with no mention of hydrogen bonding.
- **Not `COM_WORK_NOT_SHOWN`:** COM_WORK_NOT_SHOWN is for missing calculation steps; this code is for a missing explanation in words.
- **Not `COM_IMPRECISE_TERMS`:** If an explanation is there but uses loose words, use COM_IMPRECISE_TERMS.
- **Next step:** Claim-evidence-reasoning frame.

### `COM_WORK_NOT_SHOWN` Work Not Shown

- **Shown as:** Didn't show the work. _Write the formula, then the numbers in it, then the answer._
- **Means:** A calculation answer with no formula, substitution or steps where the question expects them, so the method cannot be checked or credited.
- **Example:** Writes 'mass = 11.0 g' for a stoichiometry question with no steps.
- **Not `TST_UNWORKED_GUESS`:** If the answer is wrong and there is no work, it is likely a guess: use TST_UNWORKED_GUESS. Use this code when the answer is right or close and only the steps are missing.
- **Not `COM_UNSUPPORTED_ANSWER`:** For a missing explanation in words, use COM_UNSUPPORTED_ANSWER.
- **Next step:** GRASS layout model: Given, Required, Analysis, Solution, Statement.

### `COM_MISSING_LABELS` Missing Labels / Definitions

- **Shown as:** Labels missing. _A graph, diagram or variable is missing labels, so it is unclear what it shows._
- **Means:** Leaves out axis labels, scales, diagram labels or the 'let x be ...' definition that the work needs.
- **Example:** Draws a heating curve with no axis labels or units.
- **Not `COM_MISSING_UNITS`:** COM_MISSING_UNITS is for a final numerical answer; this code is for diagrams, graphs and tables.
- **Next step:** Graph checklist card.

### `COM_IMPRECISE_TERMS` Imprecise Terms

- **Shown as:** Used an everyday word where a subject term was needed. _Use the exact subject word instead of an everyday one._
- **Means:** The idea is right but is stated with everyday or loose words where a specific scientific term is needed, so the answer is ambiguous.
- **Example:** 'The salt melts into the water' when the student means dissolves.
- **Not `COM_UNSUPPORTED_ANSWER`:** If no reasoning is given at all, use COM_UNSUPPORTED_ANSWER.
- **Not Other:** If the wrong word shows a wrong idea (the student really thinks sugar melts in water), use the matching concept (CON) code instead.
- **Next step:** Word wall with paired everyday and scientific terms.

### `COM_OBSERVATION_VS_INFERENCE` Observation vs Inference

- **Shown as:** Mixed up what you saw with what it means. _Observations are what you saw, heard or measured; put explanations in the analysis._
- **Means:** In lab or data questions, reports an explanation as if it were observed, or lists observations where an analysis or conclusion is asked for. Includes conclusions that go beyond the data.
- **Example:** Observation: 'hydrogen gas was produced.' (what was seen was bubbles).
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
- **Example:** Question asks for the limiting reagent and the mass of product; gives only the mass.
- **Not `TST_BLANK`:** If the whole question is empty, use TST_BLANK.
- **Not `COM_ANSWERED_DIFFERENT_QUESTION`:** If the student answered something else instead of what was asked, use COM_ANSWERED_DIFFERENT_QUESTION.
- **Next step:** Part checklist habit.

### `TST_DISTRACTOR_TRAP` Distractor Trap

- **Shown as:** Middle step taken as the answer. _A middle step was treated as the final answer._
- **Means:** Takes an intermediate value or a tempting wrong option as the final answer.
- **Example:** Boxes the moles of product as the final answer when the question asks for grams.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work just stops, use PRC_INCOMPLETE_SOLUTION; this code is for presenting the wrong value as final.
- **Not `TST_UNWORKED_GUESS`:** If there is no work behind the choice, use TST_UNWORKED_GUESS.
- **Next step:** 'Is this what was asked?' stop sign.

### `TST_ABANDONED_WORK` Abandoned Work

- **Shown as:** Gave up partway. _A good start was stopped or crossed out before reaching an answer._
- **Means:** Starts a valid approach, then stops or crosses it out partway with no answer.
- **Example:** Starts an ICE table, fills the first row, then crosses it out and moves on.
- **Not `TST_BLANK`:** If nothing was written, use TST_BLANK.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work reaches a result one step short of the target, use PRC_INCOMPLETE_SOLUTION.
- **Next step:** First-step confidence warm-up, then the same problem.

### `TST_UNCHECKED_ANSWER` Unchecked Answer

- **Shown as:** Answer not checked. _A quick check would show this answer cannot be right, like a negative length._
- **Means:** Gives an answer a quick check would show is impossible or absurd, and does not notice.
- **Example:** Reports a percentage yield of 340% without comment.
- **Not `FAC_ARITHMETIC_SLIP`:** Code the slip that caused the answer as well when it is visible; this code records that the impossible result was not caught.
- **Next step:** Estimate-then-check habit.

### `TST_MISREAD_GIVEN` Misread Given

- **Shown as:** Read the question wrong. _A number or sign in the question was read wrong._
- **Means:** Misreads a number, sign or symbol printed in the question.
- **Example:** Question gives 0.250 L; student uses 250 L.
- **Not `FAC_COPY_ERROR`:** If the slip happens between the student's own lines, use FAC_COPY_ERROR.
- **Not `STR_WRONG_SUBSTITUTION`:** If the value is read right but used in the wrong place, use STR_WRONG_SUBSTITUTION.
- **Next step:** Given-data check habit.

### `TST_UNWORKED_GUESS` Unworked Guess

- **Shown as:** Guessed with no work. _An answer was written with no working, and it is not right._
- **Means:** Writes a wrong final answer with no working shown, suggesting a guess.
- **Example:** Writes 'pH = 4' with no working for a weak-acid pH question; the answer is 2.9.
- **Not `COM_WORK_NOT_SHOWN`:** If the answer is right but the work is missing, use COM_WORK_NOT_SHOWN.
- **Next step:** Show-one-step routine.

### `TST_REFERENCE_SHEET_UNUSED` Reference Sheet Not Used

- **Shown as:** Didn't use the data sheet. _If a value or formula is on the data sheet or periodic table, look it up instead of remembering it._
- **Means:** Gets a value, constant or formula wrong that was printed on the provided data sheet, formula sheet or periodic table.
- **Example:** Uses 35 g/mol for chlorine when the provided periodic table says 35.45.
- **Not Other:** If the formula or value was NOT provided, use the matching recall (FAC) code.
- **Next step:** Reference-sheet scavenger hunt before the test.
