# Biology error codes (draft)

Generated from `backend/birdbrains/subjects/biology.json` by `backend/tools/subject_codes_doc.py`. Edit the JSON, not this page.

Courses: SNC1W, SNC2D, SBI3U, SBI3C, SBI4U. 48 codes.

| Pillar | Name | Points | Slip | Scope |
|---|---|---|---|---|
| CON | Concepts | 2 |  | The student holds a wrong idea about living things: evolution, genetics, cells, energy and matter in systems. |
| STR | Strategy & Setup | 2 |  | The ideas are sound, but the reasoning is set up wrongly: the wrong inheritance pattern, cross, process or experimental design, or a conclusion the data can't support. |
| PRC | Procedure | 2 |  | The plan is right, but carrying out a method goes wrong (Punnett squares, probability rules, transcription and translation, magnification, data processing, keys). |
| FAC | Calculation & Recall | 2 | yes | Reasoning is sound; a term, structure label, sequence, fact, number, unit or rounding slips. In biology most FAC errors are recall, not arithmetic. |
| COM | Communication | 1 | yes | The biology may be right, but the answer is not what was asked, uses loose or wrong notation, or is not explained. |
| TST | Test Habits | 1 | yes | How the student handles the test: blanks, traps, giving up, not checking, not using provided tables. |

## CON: Concepts

### `CON_NEED_DRIVES_EVOLUTION` Need Drives Evolution

- **Shown as:** Thinks living things change because they need to. _Variation exists first; the environment then selects which variants survive and reproduce._
- **Means:** Explains evolution as organisms changing because they need or want to (teleology), rather than selection acting on existing variation.
- **Example:** 'Giraffes grew long necks because they needed to reach high leaves.'
- **Not `CON_ACQUIRED_TRAITS`:** If the student says traits gained during life are passed on, use CON_ACQUIRED_TRAITS.
- **Not `COM_IMPRECISE_TERMS`:** If the student understands selection but writes 'adapted to' loosely, use COM_IMPRECISE_TERMS.
- **Next step:** Tier 1: variation-then-selection simulation (bead or beak lab).

### `CON_ACQUIRED_TRAITS` Acquired Traits Inherited

- **Shown as:** Thinks traits gained during life are inherited. _Only changes in the DNA of sex cells can be passed to offspring._
- **Means:** Believes characteristics gained during an organism's life (muscles, scars, learned behaviour) are passed to offspring, or that individuals evolve.
- **Example:** 'A bodybuilder's children will be born more muscular.'
- **Not `CON_NEED_DRIVES_EVOLUTION`:** If the explanation rests on need or purpose, use CON_NEED_DRIVES_EVOLUTION.
- **Next step:** Tier 1: germline vs body cell diagram.

### `CON_GENE_ALLELE_SCALE` Gene, Allele, Chromosome Scale

- **Shown as:** Mixed up genes, alleles and chromosomes. _DNA makes up chromosomes; a gene is a section of a chromosome; alleles are versions of a gene._
- **Means:** Confuses DNA, gene, allele and chromosome, or the sizes they come in (a gene contains chromosomes; alleles are different genes).
- **Example:** 'Each allele contains many chromosomes.'
- **Not `FAC_TERM_RECALL`:** If the student knows the relationships and only swaps two words, use FAC_TERM_RECALL.
- **Next step:** Tier 1: nested zoom diagram from cell to base pair.

### `CON_DOMINANT_MEANS_COMMON` Dominant Means Common

- **Shown as:** Thinks dominant means common or stronger. _Dominant only means the allele shows when one copy is present; it says nothing about how common or how good it is._
- **Means:** Believes dominant alleles are more frequent in the population, better for the organism, or will spread over time.
- **Example:** 'Polydactyly is dominant, so most people have six fingers.'
- **Not `STR_INHERITANCE_PATTERN`:** If the student misidentifies which pattern applies to a cross, use STR_INHERITANCE_PATTERN.
- **Next step:** Tier 1: allele frequency counter-examples.

### `CON_PLANT_MATTER_ENERGY` Plant Respiration and Mass

- **Shown as:** Mixed up photosynthesis and respiration in plants. _Plants carry out cellular respiration all the time; most of their mass comes from CO₂ in the air._
- **Means:** Believes plants photosynthesise instead of respiring, respire only at night, or get most of their mass from soil or water.
- **Example:** 'Plants don't need cellular respiration because they make their own food.'
- **Not `CON_ENERGY_MATTER_CYCLING`:** If the error is about energy or matter moving through an ecosystem, use CON_ENERGY_MATTER_CYCLING.
- **Next step:** Tier 1: van Helmont willow-tree analysis.

### `CON_ENERGY_MATTER_CYCLING` Energy and Matter Cycling

- **Shown as:** Mixed up how energy and matter move. _Matter cycles through ecosystems; energy flows through once and leaves as heat._
- **Means:** Believes energy is recycled in ecosystems, that matter is turned into energy, or that decomposers 'make energy'.
- **Example:** 'Decomposers return energy to the soil so plants can use it again.'
- **Not `CON_PLANT_MATTER_ENERGY`:** If the error is specifically about plant respiration or where plant mass comes from, use CON_PLANT_MATTER_ENERGY.
- **Next step:** Tier 1: two-colour diagram (matter loops, energy arrows exit).

### `CON_DIFFUSION_OSMOSIS` Diffusion and Osmosis Direction

- **Shown as:** Got the direction of diffusion or osmosis wrong. _Particles spread from high to low concentration; in osmosis water moves toward the side with more solute._
- **Means:** Predicts movement against the concentration gradient, thinks water moves toward lower solute concentration, or describes particles as 'wanting' to move.
- **Example:** 'In salt water the cell gains water because salt pulls water out of the beaker.'
- **Not `PRC_STEP_OMITTED`:** If the idea is right but a step in the comparison is skipped, use PRC_STEP_OMITTED.
- **Next step:** Tier 1: concentration-gradient sketch with arrows.

### `CON_ENZYME_FUNCTION` Enzyme Function

- **Shown as:** Misunderstood how enzymes work. _Enzymes have an optimum; past it, their shape changes (denatures) and activity drops; they are not alive._
- **Means:** Believes enzymes are alive and are 'killed', that more heat always means faster enzyme activity, or that enzymes are used up in reactions.
- **Example:** 'At 80 °C the enzyme works fastest because heat always speeds up reactions.'
- **Not `PRC_DATA_PROCESSING`:** If the idea is right but the rate is read from the graph wrongly, use PRC_DATA_PROCESSING.
- **Next step:** Tier 1: lock-and-key model with a melted key.


## STR: Strategy & Setup

### `STR_INHERITANCE_PATTERN` Wrong Inheritance Pattern

- **Shown as:** Used the wrong inheritance pattern. _Check the clues: is it sex-linked, codominant, incomplete, or simple dominant?_
- **Means:** Treats a trait with the wrong pattern: sex-linked as autosomal, codominance as incomplete dominance, multiple alleles as two alleles.
- **Example:** Colour-blindness cross done with autosomal alleles Bb × bb.
- **Not `STR_CROSS_SETUP`:** If the pattern is right but the parent genotypes are wrong, use STR_CROSS_SETUP.
- **Not `CON_DOMINANT_MEANS_COMMON`:** If the student misunderstands what dominance means, use CON_DOMINANT_MEANS_COMMON.
- **Next step:** Tier 2: pattern clue checklist.

### `STR_CROSS_SETUP` Cross Set Up Wrongly

- **Shown as:** Started the cross with the wrong parents. _Turn each word description into a genotype before you draw the square._
- **Means:** Uses the right pattern but the wrong parent genotypes or gametes from the description (heterozygous written as homozygous, a carrier not shown).
- **Example:** 'A heterozygous tall plant crossed with a short plant' set up as TT × tt.
- **Not `STR_INHERITANCE_PATTERN`:** If the pattern is wrong, use STR_INHERITANCE_PATTERN.
- **Not `PRC_PUNNETT_SQUARE`:** If the parents are right and the square is filled wrongly, use PRC_PUNNETT_SQUARE.
- **Next step:** Tier 2: description-to-genotype table.

### `STR_WRONG_PROCESS` Wrong Process Identified

- **Shown as:** Picked the wrong biological process. _Ask what the result needs to be (identical cells? gametes? protein?) and choose the process that makes it._
- **Means:** Applies the wrong process to the situation: mitosis for gamete formation, transcription where translation is meant, respiration for photosynthesis, active transport for diffusion.
- **Example:** 'Sperm cells are made by mitosis, so they have 46 chromosomes.'
- **Not `FAC_TERM_RECALL`:** If the student describes the right process but uses the wrong name for it, use FAC_TERM_RECALL.
- **Next step:** Tier 2: process comparison table.

### `STR_PEDIGREE_LOGIC` Pedigree Reasoning Error

- **Shown as:** Drew the wrong conclusion from the pedigree. _Look for two unaffected parents with an affected child (recessive) or a pattern only in males (X-linked)._
- **Means:** Draws the inheritance pattern from a pedigree without the key test (unaffected parents with an affected child, male-only patterns, father-to-son passing).
- **Example:** Calls a trait dominant because it appears in every generation, though two unaffected parents have an affected child.
- **Not `STR_INHERITANCE_PATTERN`:** STR_INHERITANCE_PATTERN is for using the wrong pattern in a cross; this code is for misreading a pedigree to find it.
- **Next step:** Tier 2: pedigree decision steps.

### `STR_CORRELATION_CAUSATION` Correlation as Cause

- **Shown as:** Said one thing causes another from a pattern alone. _A pattern shows a link; cause needs a controlled experiment or a mechanism._
- **Means:** Concludes cause from a correlation, generalises beyond the sample, or ignores a likely third factor.
- **Example:** 'Cities with more hospitals have more deaths, so hospitals cause deaths.'
- **Not `COM_OBSERVATION_VS_INFERENCE`:** COM_OBSERVATION_VS_INFERENCE is about where statements go in a report; this code is about the logic of the conclusion.
- **Not `STR_EXPERIMENT_DESIGN`:** If the flaw is in how the experiment was planned, use STR_EXPERIMENT_DESIGN.
- **Next step:** Tier 2: 'what else could explain this?' prompt.

### `STR_IGNORED_CONDITION` Ignored Condition

- **Shown as:** Given condition not used. _A condition the question gave was not used, like 'x is positive' or a point on the line._
- **Means:** Leaves a stated condition or given piece of information out of the model, so the answer does not meet it.
- **Example:** Question says the mother is a carrier; student uses XᴴXᴴ.
- **Not `TST_MISREAD_GIVEN`:** If the condition was read wrongly rather than left out, use TST_MISREAD_GIVEN.
- **Not `STR_CROSS_SETUP`:** If the condition is used but turned into the wrong genotype, use STR_CROSS_SETUP.
- **Next step:** Tier 2: condition checklist.

### `STR_NO_VIABLE_PLAN` No Viable Plan

- **Shown as:** No clear plan. _The first move here could not lead to the answer. Plan the method before writing._
- **Means:** Starts with a move that cannot reach the answer, or moves symbols around with no method.
- **Example:** Asked for the probability of a child with both traits, draws three unrelated Punnett squares with no plan to combine them.
- **Not `TST_UNWORKED_GUESS`:** If there is only an answer with no work, use TST_UNWORKED_GUESS; this code needs visible work that wanders.
- **Next step:** Plan-first prompt: name the target, the known quantities and the bridge between them before calculating.

### `STR_EXPERIMENT_DESIGN` Experimental Design Flaw

- **Shown as:** Experiment set up unfairly. _Change one thing, measure one thing, and keep everything else the same._
- **Means:** Gets the independent, dependent or controlled variables wrong, leaves out a control or repeats, or designs a test that cannot answer the question.
- **Example:** Tests a fertiliser on one plant in sunlight and a control plant in shade.
- **Not `COM_OBSERVATION_VS_INFERENCE`:** This code is about how the experiment is set up; COM_OBSERVATION_VS_INFERENCE is about how the results are reported.
- **Not `STR_NO_VIABLE_PLAN`:** STR_NO_VIABLE_PLAN is for calculation problems; use this code for planning an investigation.
- **Next step:** Fair-test frame: I will change ___, measure ___, and keep ___ the same; repeat ___ times.


## PRC: Procedure

### `PRC_STEP_OMITTED` Step Omission

- **Shown as:** Skipped a step. _A needed step in the method was skipped._
- **Means:** Skips a required step of the procedure, so the result does not follow.
- **Example:** Calculates actual cell size without first finding the field of view at the higher magnification.
- **Not `PRC_INCOMPLETE_SOLUTION`:** Here a middle step is missing and the answer is wrong; in PRC_INCOMPLETE_SOLUTION the work is right but stops before the end.
- **Not `STR_NO_VIABLE_PLAN`:** If the plan itself is missing, use STR_NO_VIABLE_PLAN; here the plan is right and one step drops out.
- **Next step:** Faded worked example: complete the one missing step in an otherwise finished solution.

### `PRC_PUNNETT_SQUARE` Punnett Square Error

- **Shown as:** Filled in the Punnett square wrongly. _Split each parent into gametes along the edges, then combine one from each side in every box._
- **Means:** Splits gametes wrongly (Tt into TT), combines boxes wrongly, or counts the ratio wrongly from a correct square.
- **Example:** For a dihybrid cross, lists gametes TtRr instead of TR, Tr, tR, tr.
- **Not `STR_CROSS_SETUP`:** If the parents are wrong before the square, use STR_CROSS_SETUP.
- **Not `PRC_PROBABILITY_RULES`:** If the square is right but probabilities are combined wrongly afterwards, use PRC_PROBABILITY_RULES.
- **Next step:** Tier 2: gamete-first worked example.

### `PRC_PROBABILITY_RULES` Probability Rules Misapplied

- **Shown as:** Combined probabilities wrongly. _Use 'and' → multiply; 'or' → add, for separate events._
- **Means:** Adds probabilities that should be multiplied (independent events) or multiplies ones that should be added; treats each child as affecting the next.
- **Example:** Chance of two affected children = ¼ + ¼ = ½.
- **Not `PRC_PUNNETT_SQUARE`:** If the error is inside the Punnett square, use PRC_PUNNETT_SQUARE.
- **Next step:** Tier 2: and/or rule card.

### `PRC_TRANSCRIPTION_TRANSLATION` Transcription / Translation Error

- **Shown as:** Made a mistake copying DNA to RNA or protein. _RNA uses U instead of T; read codons in threes from the start codon using the mRNA, not the DNA._
- **Means:** Pairs bases wrongly, keeps T in mRNA, reads codons from the DNA or the wrong strand, or shifts the reading frame.
- **Example:** Transcribes DNA TAC GGA as mRNA ATG CCT.
- **Not `STR_WRONG_PROCESS`:** If the student does the wrong process altogether, use STR_WRONG_PROCESS.
- **Not `FAC_COPY_ERROR`:** If one base is miscopied between lines, use FAC_COPY_ERROR.
- **Next step:** Tier 2: base-pairing template with a codon ruler.

### `PRC_MAGNIFICATION` Magnification Calculation Error

- **Shown as:** Worked out the magnification or size wrongly. _Total magnification = eyepiece × objective; at higher power the field of view shrinks by the same factor._
- **Means:** Multiplies where it should divide, adds eyepiece and objective, or scales the field of view the wrong way.
- **Example:** Field of view 4 mm at 40×: says it is 16 mm at 400×.
- **Not `FAC_UNIT_CONVERSION`:** If the method is right and mm to µm goes wrong, use FAC_UNIT_CONVERSION.
- **Next step:** Tier 2: magnification ratio table.

### `PRC_DATA_PROCESSING` Data Processing Error

- **Shown as:** Processed or graphed the data wrongly. _Choose the graph type for the data, use an even scale, and take rates from the slope._
- **Means:** Processes data wrongly: wrong graph type, uneven scale, rate taken from a single point, averages that include an outlier without comment.
- **Example:** Plots enzyme rate against temperature as a bar graph with uneven gaps on the x-axis.
- **Not `COM_MISSING_LABELS`:** If the graph is right but missing title or axis labels, use COM_MISSING_LABELS.
- **Next step:** Tier 2: data-handling checklist.

### `PRC_CLASSIFICATION_KEY` Classification Key Error

- **Shown as:** Used the key or classification order wrongly. _Follow the key one choice at a time; the order is domain, kingdom, phylum, class, order, family, genus, species._
- **Means:** Skips couplets in a dichotomous key, writes a key with overlapping choices, or orders taxonomic ranks wrongly; formats binomial names wrongly.
- **Example:** Writes the scientific name as 'Homo Sapiens'.
- **Not `FAC_SEQUENCE_RECALL`:** If only the order of ranks is misremembered, use FAC_SEQUENCE_RECALL.
- **Next step:** Tier 2: key-walk practice with a real specimen set.

### `PRC_INCOMPLETE_SOLUTION` Stopped Before the End

- **Shown as:** Stopped one step early. _Read the question again when you think you are done: is your last line the thing it asked for?_
- **Means:** Correct work that stops before the requested quantity or form is reached.
- **Example:** Asked for the phenotype ratio, gives the genotype ratio from the square and stops.
- **Not `COM_ANSWERED_DIFFERENT_QUESTION`:** If the student aimed at a different target from the start, use COM_ANSWERED_DIFFERENT_QUESTION; here they were heading to the right target and stopped.
- **Not `TST_DISTRACTOR_TRAP`:** If an intermediate value is boxed as if it were final, use TST_DISTRACTOR_TRAP; if the work simply ends, use this code.
- **Next step:** Completion checklist: target quantity, unit, form asked for.


## FAC: Calculation & Recall

### `FAC_ARITHMETIC_SLIP` Arithmetic Slip

- **Shown as:** Calculation slip. _The steps make sense, with a small calculation slip in the numbers._
- **Means:** An isolated arithmetic error with a sound method.
- **Example:** Calculates 400 ÷ 40 as 100.
- **Not `PRC_MAGNIFICATION`:** If the magnification method is wrong (multiplying where it should divide), use PRC_MAGNIFICATION; this code is for a slip in the numbers.
- **Next step:** Five-item rapid micro-drill on the same operation.

### `FAC_COPY_ERROR` Copy Error

- **Shown as:** Copied a number wrong. _A number or sign changed when copying from one line to the next._
- **Means:** Miscopies a digit, sign or term from one of the student's own lines to the next.
- **Example:** Copies the mRNA AUG CCA as AUG CAC on the next line.
- **Not `TST_MISREAD_GIVEN`:** If the value was read wrongly from the question itself, use TST_MISREAD_GIVEN; this code is for copying between the student's own lines.
- **Not `FAC_ARITHMETIC_SLIP`:** If a value was calculated wrongly rather than copied, use FAC_ARITHMETIC_SLIP.
- **Next step:** Line-to-line check habit.

### `FAC_UNIT_CONVERSION` Unit Conversion

- **Shown as:** Unit slip. _A unit conversion was off, like centimetres to metres._
- **Means:** Converts units wrongly or mixes units in one calculation.
- **Example:** Converts 0.4 mm to 40 µm.
- **Not `COM_MISSING_UNITS`:** Here the number is wrong because of a conversion; in COM_MISSING_UNITS the number is right but the unit is not written.
- **Not `FAC_ARITHMETIC_SLIP`:** If the conversion factor is right and the multiplication goes wrong, use FAC_ARITHMETIC_SLIP.
- **Next step:** Dimensional conversion bridge: write the factor as a fraction that cancels the old unit.

### `FAC_ROUNDING` Rounding / Precision

- **Shown as:** Rounding slip. _A number was rounded too early or to the wrong decimal place._
- **Means:** Rounds too early, or breaks the precision the question asks for.
- **Example:** Reports mean heart rate as 72.3333 bpm.
- **Not `FAC_ARITHMETIC_SLIP`:** If the digits themselves are wrong, not just how many are kept, use FAC_ARITHMETIC_SLIP.
- **Next step:** Precision rules card: count significant figures in the givens, keep guard digits, round once.

### `FAC_TERM_RECALL` Term Recall Slip

- **Shown as:** Used the wrong term. _Check terms that sound alike (mitosis/meiosis, ileum/ilium, xylem/phloem)._
- **Means:** Knows the idea but uses the wrong technical word for it, often a similar-sounding term.
- **Example:** 'Water travels up the stem in the phloem.'
- **Not `CON_GENE_ALLELE_SCALE`:** If the swap shows a wrong idea of how the terms relate, use the concept code.
- **Not `COM_IMPRECISE_TERMS`:** If the student uses an everyday word instead of a technical one, use COM_IMPRECISE_TERMS.
- **Next step:** Tier 3: paired-term flash cards.

### `FAC_STRUCTURE_LABEL` Structure Label Slip

- **Shown as:** Labelled a structure wrongly. _Check each label line ends exactly on the part it names._
- **Means:** Labels a part of a diagram (cell, organ, heart, flower) with the wrong name, or points the line at the wrong part.
- **Example:** Labels the left ventricle as the right ventricle on a heart diagram.
- **Not `COM_MISSING_LABELS`:** If labels are missing rather than wrong, use COM_MISSING_LABELS.
- **Next step:** Tier 3: blank-diagram labelling drill.

### `FAC_SEQUENCE_RECALL` Sequence Recall Slip

- **Shown as:** Put the stages in the wrong order. _Use a memory aid (PMAT; right atrium → right ventricle → lungs) and check each step._
- **Means:** Gets the order of stages or a pathway wrong (phases of mitosis, blood flow, digestion, Krebs before glycolysis).
- **Example:** Lists the mitosis phases as prophase, anaphase, metaphase, telophase.
- **Not `STR_WRONG_PROCESS`:** If the wrong process is used entirely, use STR_WRONG_PROCESS.
- **Next step:** Tier 3: sequencing cards.

### `FAC_SCIENCE_FACT_RECALL` Fact Recall Slip

- **Shown as:** Remembered a fact wrongly. _Check this fact in your notes; it is one to memorise._
- **Means:** Misremembers a specific fact: which acids are strong, valence electrons for a group, a solubility rule, a functional group name.
- **Example:** 'Human gametes have 46 chromosomes.'
- **Not `STR_WRONG_PROCESS`:** If the wrong number comes from picking the wrong process (mitosis for gametes), use STR_WRONG_PROCESS.
- **Next step:** Tier 3: spaced-recall quiz on the fact list.


## COM: Communication

### `COM_ANSWERED_DIFFERENT_QUESTION` Answered a Different Question

- **Shown as:** Answered a different question. _The work solved for something slightly different from what the question asked._
- **Means:** Gives a correct answer to a different target than the one asked.
- **Example:** Asked for the probability of a carrier daughter, gives the probability of an affected son.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work was heading to the right target and stopped short, use PRC_INCOMPLETE_SOLUTION.
- **Not `TST_SKIPPED_PART`:** If a whole labelled part (b) is missing, use TST_SKIPPED_PART.
- **Next step:** Prompt deconstruction box: circle the verb, underline the target.

### `COM_MISSING_UNITS` Missing Units

- **Shown as:** Missing units. _The final answer is missing its units._
- **Means:** Omits units on a measurement answer.
- **Example:** Writes the cell length as '25' with no µm.
- **Not `FAC_UNIT_CONVERSION`:** If the number is wrong because of a conversion, use FAC_UNIT_CONVERSION.
- **Next step:** Unit slot habit: draw a box after the answer for the unit.

### `COM_GENETICS_NOTATION` Genetics Notation Error

- **Shown as:** Wrote alleles in a confusing way. _Use one letter per gene (capital = dominant) and write sex-linked alleles on the X, like Xᴴ._
- **Means:** Right genetics in confusing notation: different letters for alleles of one gene, sex-linked alleles not written on X, no key for the symbols.
- **Example:** Uses T for tall and s for short.
- **Not `STR_CROSS_SETUP`:** If the genotypes themselves are wrong, use STR_CROSS_SETUP.
- **Next step:** Tier 4: notation key template.

### `COM_UNSUPPORTED_ANSWER` Unsupported Answer

- **Shown as:** Answer not explained. _The answer is there, but the reason the question asked for is missing._
- **Means:** Gives an answer, claim or 'show that' conclusion without the reasoning or working the question requires.
- **Example:** 'Will the cell shrink in salt water? Yes.' with no mention of osmosis.
- **Not `COM_WORK_NOT_SHOWN`:** COM_WORK_NOT_SHOWN is for missing calculation steps; this code is for a missing explanation in words.
- **Not `COM_IMPRECISE_TERMS`:** If an explanation is there but uses loose words, use COM_IMPRECISE_TERMS.
- **Next step:** Claim-evidence-reasoning frame.

### `COM_WORK_NOT_SHOWN` Work Not Shown

- **Shown as:** Didn't show the work. _Write the formula, then the numbers in it, then the answer._
- **Means:** A calculation answer with no formula, substitution or steps where the question expects them, so the method cannot be checked or credited.
- **Example:** Writes 'actual size = 0.02 mm' with no calculation.
- **Not `TST_UNWORKED_GUESS`:** If the answer is wrong and there is no work, it is likely a guess: use TST_UNWORKED_GUESS. Use this code when the answer is right or close and only the steps are missing.
- **Not `COM_UNSUPPORTED_ANSWER`:** For a missing explanation in words, use COM_UNSUPPORTED_ANSWER.
- **Next step:** GRASS layout model: Given, Required, Analysis, Solution, Statement.

### `COM_MISSING_LABELS` Missing Labels / Definitions

- **Shown as:** Labels missing. _A graph, diagram or variable is missing labels, so it is unclear what it shows._
- **Means:** Leaves out axis labels, scales, diagram labels or the 'let x be ...' definition that the work needs.
- **Example:** Draws a plant cell with no labels.
- **Not `COM_MISSING_UNITS`:** COM_MISSING_UNITS is for a final numerical answer; this code is for diagrams, graphs and tables.
- **Next step:** Graph checklist card.

### `COM_IMPRECISE_TERMS` Imprecise Terms

- **Shown as:** Used an everyday word where a subject term was needed. _Use the exact subject word instead of an everyday one._
- **Means:** The idea is right but is stated with everyday or loose words where a specific scientific term is needed, so the answer is ambiguous.
- **Example:** 'The food gets broken down by the juices' instead of naming enzymes.
- **Not `COM_UNSUPPORTED_ANSWER`:** If no reasoning is given at all, use COM_UNSUPPORTED_ANSWER.
- **Not Other:** If the wrong word shows a wrong idea (the student really thinks sugar melts in water), use the matching concept (CON) code instead.
- **Next step:** Word wall with paired everyday and scientific terms.

### `COM_OBSERVATION_VS_INFERENCE` Observation vs Inference

- **Shown as:** Mixed up what you saw with what it means. _Observations are what you saw, heard or measured; put explanations in the analysis._
- **Means:** In lab or data questions, reports an explanation as if it were observed, or lists observations where an analysis or conclusion is asked for. Includes conclusions that go beyond the data.
- **Example:** Observation: 'the yeast respired faster' when the record was balloon size.
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
- **Example:** Asked for genotype and phenotype ratios; gives only the genotype ratio.
- **Not `TST_BLANK`:** If the whole question is empty, use TST_BLANK.
- **Not `COM_ANSWERED_DIFFERENT_QUESTION`:** If the student answered something else instead of what was asked, use COM_ANSWERED_DIFFERENT_QUESTION.
- **Next step:** Part checklist habit.

### `TST_DISTRACTOR_TRAP` Distractor Trap

- **Shown as:** Middle step taken as the answer. _A middle step was treated as the final answer._
- **Means:** Takes an intermediate value or a tempting wrong option as the final answer.
- **Example:** Multiple choice on organelles: chooses 'nucleus' because it appeared in the stem.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work just stops, use PRC_INCOMPLETE_SOLUTION; this code is for presenting the wrong value as final.
- **Not `TST_UNWORKED_GUESS`:** If there is no work behind the choice, use TST_UNWORKED_GUESS.
- **Next step:** 'Is this what was asked?' stop sign.

### `TST_ABANDONED_WORK` Abandoned Work

- **Shown as:** Gave up partway. _A good start was stopped or crossed out before reaching an answer._
- **Means:** Starts a valid approach, then stops or crosses it out partway with no answer.
- **Example:** Starts the dihybrid square, fills four boxes, then stops.
- **Not `TST_BLANK`:** If nothing was written, use TST_BLANK.
- **Not `PRC_INCOMPLETE_SOLUTION`:** If the work reaches a result one step short of the target, use PRC_INCOMPLETE_SOLUTION.
- **Next step:** First-step confidence warm-up, then the same problem.

### `TST_UNCHECKED_ANSWER` Unchecked Answer

- **Shown as:** Answer not checked. _A quick check would show this answer cannot be right, like a negative length._
- **Means:** Gives an answer a quick check would show is impossible or absurd, and does not notice.
- **Example:** Gives a probability of 150%.
- **Not `FAC_ARITHMETIC_SLIP`:** Code the slip that caused the answer as well when it is visible; this code records that the impossible result was not caught.
- **Next step:** Estimate-then-check habit.

### `TST_MISREAD_GIVEN` Misread Given

- **Shown as:** Read the question wrong. _A number or sign in the question was read wrong._
- **Means:** Misreads a number, sign or symbol printed in the question.
- **Example:** Question says 100×; student uses 1000×.
- **Not `FAC_COPY_ERROR`:** If the slip happens between the student's own lines, use FAC_COPY_ERROR.
- **Next step:** Given-data check habit.

### `TST_UNWORKED_GUESS` Unworked Guess

- **Shown as:** Guessed with no work. _An answer was written with no working, and it is not right._
- **Means:** Writes a wrong final answer with no working shown, suggesting a guess.
- **Example:** Writes '3:1' with no square for a test-cross question; the answer is 1:1.
- **Not `COM_WORK_NOT_SHOWN`:** If the answer is right but the work is missing, use COM_WORK_NOT_SHOWN.
- **Next step:** Show-one-step routine.

### `TST_REFERENCE_SHEET_UNUSED` Reference Sheet Not Used

- **Shown as:** Didn't use the data sheet. _If a value or formula is on the data sheet or periodic table, look it up instead of remembering it._
- **Means:** Gets a value, constant or formula wrong that was printed on the provided data sheet, formula sheet or periodic table.
- **Example:** Gets the amino acid for a codon wrong when the codon chart was provided.
- **Not Other:** If the formula or value was NOT provided, use the matching recall (FAC) code.
- **Next step:** Reference-sheet scavenger hunt before the test.
