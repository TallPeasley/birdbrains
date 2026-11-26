# History, Geography & Civics error codes (draft)

Generated from `backend/birdbrains/subjects/history_geography.json` by `backend/tools/subject_codes_doc.py`. Edit the JSON, not this page.

Courses: CGC1W, CHC2D, CHC2P, CHV2O, CHA3U, CGG3O, CHY4U, CGW4U. 36 codes.

| Pillar | Name | Points | Slip | Scope |
|---|---|---|---|---|
| CON | Historical & Geographic Thinking | 2 |  | The student holds a wrong idea about how the past or places work: causes, change, significance, perspective, people-environment links. |
| STR | Argument & Inquiry | 2 |  | The thinking may be sound, but the argument or inquiry is set up wrongly: off the question, no arguable thesis, no criteria, one-sided, badly ordered. |
| PRC | Evidence & Sources | 2 |  | The argument is sound, but proving it goes wrong: narrating instead of analysing, no or unexplained evidence, sources taken at face value, data misread. |
| FAC | Facts & Recall | 1 | yes | The reasoning is sound; a date, name, term, place, statistic or calculation slips. |
| COM | Communication | 2 |  | The ideas are sound, but the expression gets in the way: unclear, informal, imprecise terms, missing citations or map conventions. |
| TST | Test Habits | 1 | yes | How the student handles the task: blanks, unfinished or missed parts, length, ignoring the provided source. |

## CON: Historical & Geographic Thinking

### `CON_PRESENTISM` Presentism

- **Shown as:** Judged the past only by today's values. _Ask what people at the time believed and why, before you judge them._
- **Means:** Judges past people or events only by present-day values, without considering the beliefs and conditions of the time.
- **Example:** 'People in 1917 were stupid for supporting conscription.'
- **Not `CON_UNIFORM_GROUPS`:** If the student treats a past group as all thinking the same, use CON_UNIFORM_GROUPS.
- **Not `STR_ONE_SIDED`:** If the student considers only one side of a question, use STR_ONE_SIDED.
- **Next step:** Tier 1: historical perspective-taking chart.

### `CON_SINGLE_CAUSE` Single Cause

- **Shown as:** Gave only one cause for a complex event. _Big events usually have several causes: long-term and short-term, political, economic and social._
- **Means:** Explains a complex event with one cause, or confuses a trigger with the underlying causes.
- **Example:** 'World War I happened because Franz Ferdinand was shot.'
- **Not `CON_SIGNIFICANCE_AS_FAME`:** If the issue is judging importance rather than cause, use CON_SIGNIFICANCE_AS_FAME.
- **Next step:** Tier 1: cause web (long-term, short-term, trigger).

### `CON_CHANGE_AS_PROGRESS` Change Always Progress

- **Shown as:** Assumed change is always progress. _Change can be better for some and worse for others; some things stay the same._
- **Means:** Assumes all change is improvement for everyone, or misses continuity alongside change.
- **Example:** 'After 1918 women had full equality in Canada because some women could vote.'
- **Not `CON_UNIFORM_GROUPS`:** If the error is treating a group as uniform, use CON_UNIFORM_GROUPS.
- **Next step:** Tier 1: continuity-and-change timeline with winners and losers.

### `CON_SIGNIFICANCE_AS_FAME` Significance as Fame

- **Shown as:** Judged importance by fame or size. _Something is significant if it had deep, lasting effects on many people, or reveals something important._
- **Means:** Judges historical or geographic significance by how famous, dramatic or large something is, not by its consequences or what it reveals.
- **Example:** 'The Halifax Explosion is the most significant event because it was the biggest explosion.'
- **Not `STR_NO_CRITERIA`:** If the student gives no criteria at all, use STR_NO_CRITERIA; this code is about using the wrong idea of significance.
- **Next step:** Tier 1: significance criteria (impact, depth, duration, revealing).

### `CON_UNIFORM_GROUPS` Groups Treated as Uniform

- **Shown as:** Treated a whole group as all the same. _People in a group (Canadians, a province, a community) often disagreed; name who thought what._
- **Means:** Treats a nation, group or community as if everyone in it shared the same experience or view.
- **Example:** 'Canadians all supported the war effort.'
- **Not `CON_PRESENTISM`:** If the issue is judging the past by today's values, use CON_PRESENTISM.
- **Next step:** Tier 1: perspectives grid with several groups.

### `CON_ENVIRONMENTAL_DETERMINISM` Environment Decides Everything

- **Shown as:** Assumed geography alone decides what people do. _Physical geography shapes choices, but people, technology, economics and policy matter too._
- **Means:** Explains human patterns (settlement, wealth, culture) by physical geography alone, or treats natural and human systems as unconnected.
- **Example:** 'Northern Canada has few people only because it is cold.'
- **Not `CON_SINGLE_CAUSE`:** CON_SINGLE_CAUSE is the general one-cause error; use this code when that cause is physical geography.
- **Next step:** Tier 1: interrelationships web (natural, human, economic).


## STR: Argument & Inquiry

### `STR_OFF_PROMPT` Off the Prompt

- **Shown as:** Wrote about something other than the prompt. _Turn the prompt into a question and make sure your thesis answers it._
- **Means:** The response or thesis addresses a different question or topic from the one set (writes about a character when asked about a theme, or a general opinion when asked about the text).
- **Example:** Asked how the Depression changed government's role, writes about the causes of the stock market crash.
- **Not `TST_SKIPPED_PART`:** If one part of the question is left out, use TST_SKIPPED_PART.
- **Next step:** Tier 2: prompt-unpacking box.

### `STR_NO_ARGUABLE_THESIS` No Arguable Thesis

- **Shown as:** Thesis isn't something you can argue. _A thesis is a claim someone could disagree with, plus why._
- **Means:** The thesis is a fact, a plot statement, an announcement ('In this essay I will...'), or is missing.
- **Example:** 'The Winnipeg General Strike happened in 1919.'
- **Not `STR_OFF_PROMPT`:** If the thesis is arguable but answers another question, use STR_OFF_PROMPT.
- **Next step:** Tier 2: claim + because + so-what thesis frame.

### `STR_NO_CRITERIA` No Criteria

- **Shown as:** Judged without saying how. _When you judge (most significant, biggest change), say what you are judging by._
- **Means:** Makes a judgement of significance, change, success or responsibility without stating or applying criteria.
- **Example:** 'Vimy Ridge was the most important battle.' with no reason for 'important'.
- **Not `CON_SIGNIFICANCE_AS_FAME`:** If criteria are used but they are about fame or size, use CON_SIGNIFICANCE_AS_FAME.
- **Next step:** Tier 2: criteria table before judging.

### `STR_ONE_SIDED` One-Sided

- **Shown as:** Looked at only one side or perspective. _Include the perspectives the question asks for, especially those of groups most affected._
- **Means:** Considers only one perspective when the question asks for several, or leaves out the groups most affected (for example Indigenous peoples, workers, women, immigrants).
- **Example:** Explains the building of the CPR only from the government's point of view.
- **Not `CON_UNIFORM_GROUPS`:** If the student treats one group as uniform, use CON_UNIFORM_GROUPS.
- **Next step:** Tier 2: perspectives checklist.

### `STR_WEAK_INQUIRY_QUESTION` Weak Inquiry Question

- **Shown as:** Inquiry question has a yes/no or one-fact answer. _Good inquiry questions start with how, why, to what extent, or how significant._
- **Means:** In inquiry tasks, poses a question answerable with a fact or yes/no, or too broad to investigate.
- **Example:** 'When did Canada join NATO?'
- **Not `STR_NO_ARGUABLE_THESIS`:** STR_NO_ARGUABLE_THESIS is about the claim; this code is about the question being investigated.
- **Next step:** Tier 2: question-stem bank.

### `STR_ILLOGICAL_ORDER` Illogical Order

- **Shown as:** Ideas aren't in a logical order. _Put ideas in an order that builds: time order, weakest to strongest, or cause to effect._
- **Means:** Ideas or paragraphs are ordered with no logic or progression; the argument jumps back and forth.
- **Example:** Jumps from 1945 to 1914 to 1982 with no thematic reason.
- **Not `COM_UNCLEAR_SENTENCES`:** If the order is fine but sentences are hard to follow, use COM_UNCLEAR_SENTENCES.
- **Next step:** Tier 2: reverse outline.


## PRC: Evidence & Sources

### `PRC_NARRATIVE_NOT_ANALYSIS` Narrative Instead of Analysis

- **Shown as:** Told what happened instead of explaining it. _After each event, explain how it answers the question (why, how much, how significant)._
- **Means:** Narrates events in order where explanation or argument is asked for.
- **Example:** Asked why the Statute of Westminster mattered, lists events from 1919 to 1931.
- **Not `PRC_EVIDENCE_NOT_EXPLAINED`:** If evidence is given with a point but not linked, use PRC_EVIDENCE_NOT_EXPLAINED.
- **Next step:** Tier 2: 'so what?' annotation.

### `PRC_NO_EVIDENCE` No Evidence

- **Shown as:** Made a claim without evidence. _Back each point with a quote or specific detail from the text._
- **Means:** Makes claims about a text without any quotation, specific reference or detail.
- **Example:** 'The Depression was very bad for farmers.' with nothing specific.
- **Not `PRC_EVIDENCE_NOT_EXPLAINED`:** If evidence is given but not explained, use PRC_EVIDENCE_NOT_EXPLAINED.
- **Next step:** Tier 2: evidence hunt.

### `PRC_EVIDENCE_NOT_EXPLAINED` Evidence Not Explained

- **Shown as:** Didn't explain how the quote proves the point. _After a quote, explain which words matter and how they prove your point._
- **Means:** Gives a relevant quotation and then moves on, or only restates it, without explaining how it supports the claim.
- **Example:** 'Unemployment hit 30% in 1933.' and the paragraph ends.
- **Not `PRC_NARRATIVE_NOT_ANALYSIS`:** If the paragraph is mostly narrative, use PRC_NARRATIVE_NOT_ANALYSIS.
- **Next step:** Tier 2: point-evidence-explain frame.

### `PRC_SOURCE_AT_FACE_VALUE` Source Taken at Face Value

- **Shown as:** Trusted a source without questioning it. _Ask who made the source, when, why, and for whom before you trust it._
- **Means:** Uses a source without considering its author, date, purpose or bias (propaganda posters treated as fact).
- **Example:** 'The poster shows that every Canadian man was eager to enlist.'
- **Not `PRC_SOURCES_NOT_CORROBORATED`:** If the student uses several sources but ignores where they disagree, use PRC_SOURCES_NOT_CORROBORATED.
- **Next step:** Tier 2: sourcing questions (author, date, purpose, audience).

### `PRC_SOURCES_NOT_CORROBORATED` Sources Not Compared

- **Shown as:** Didn't compare sources. _Check whether other sources agree; explain any disagreement._
- **Means:** Uses sources without comparing them, ignores sources that disagree, or picks only the one that fits.
- **Example:** Uses one politician's speech as proof of public opinion while ignoring the provided strike newspaper.
- **Not `PRC_SOURCE_AT_FACE_VALUE`:** If one source is accepted uncritically, use PRC_SOURCE_AT_FACE_VALUE.
- **Next step:** Tier 2: source comparison grid.

### `PRC_DATA_MISREAD` Data, Map or Graph Misread

- **Shown as:** Misread a map, graph or table. _Read the title, legend, axes and scale before you read the data._
- **Means:** Misreads a map, climate graph, population pyramid, table or chart (wrong axis, scale or legend).
- **Example:** Reads the precipitation bars on a climate graph against the temperature axis.
- **Not `FAC_PLACE_LOCATION`:** If the error is locating a place, use FAC_PLACE_LOCATION.
- **Not `COM_MAP_CONVENTIONS`:** If the student draws a map or graph missing its conventions, use COM_MAP_CONVENTIONS.
- **Next step:** Tier 2: read-the-frame-first routine.


## FAC: Facts & Recall

### `FAC_DATE_CHRONOLOGY` Date or Chronology Slip

- **Shown as:** Got a date or order of events wrong. _Check dates against your timeline._
- **Means:** Gives a wrong date or puts events in the wrong order.
- **Example:** 'Confederation happened in 1876.'
- **Not `CON_SINGLE_CAUSE`:** If the chronology error supports a wrong cause-and-effect claim, also check CON_SINGLE_CAUSE.
- **Next step:** Tier 3: timeline flash cards.

### `FAC_NAME_TERM_RECALL` Name or Term Recall Slip

- **Shown as:** Used the wrong name or term. _Check names of people, laws and events in your notes._
- **Means:** Uses the wrong name for a person, law, treaty, event or concept.
- **Example:** Calls the Indian Act the 'Indigenous Act' or confuses Mackenzie King with Laurier.
- **Not `COM_IMPRECISE_TERMS`:** If the student uses an everyday word instead of the term, use COM_IMPRECISE_TERMS.
- **Next step:** Tier 3: term flash cards.

### `FAC_PLACE_LOCATION` Place or Location Slip

- **Shown as:** Got a place or location wrong. _Check latitude/longitude order and the map's scale and grid._
- **Means:** Locates a place wrongly, swaps latitude and longitude, or uses grid references or scale wrongly.
- **Example:** Places Saskatchewan east of Manitoba; gives 45° W, 75° N for Ottawa.
- **Not `PRC_DATA_MISREAD`:** If the error is reading a data map or graph, use PRC_DATA_MISREAD.
- **Next step:** Tier 3: map-location drill.

### `FAC_STATISTIC_RECALL` Statistic or Fact Slip

- **Shown as:** Remembered a fact or number wrongly. _Check this fact or number in your notes or the source._
- **Means:** Misremembers a statistic or specific fact.
- **Example:** 'About 6,000 Canadians died at Vimy Ridge' (about 3,600).
- **Not `TST_SOURCE_NOT_USED`:** If the number was in a provided source, use TST_SOURCE_NOT_USED.
- **Next step:** Tier 3: key-facts list.

### `FAC_ARITHMETIC_SLIP` Arithmetic Slip

- **Shown as:** Calculation slip. _The steps make sense, with a small calculation slip in the numbers._
- **Means:** An isolated arithmetic error with a sound method.
- **Example:** Population density: 2,000,000 ÷ 50,000 km² = 400 people/km².
- **Not `PRC_DATA_MISREAD`:** If the wrong numbers were read from the graph or table, use PRC_DATA_MISREAD; this code is for a slip in the calculation.
- **Next step:** Five-item rapid micro-drill on the same operation.

### `FAC_COPY_ERROR` Copy Error

- **Shown as:** Copied a number wrong. _A number or sign changed when copying from one line to the next._
- **Means:** Miscopies a digit, sign or term from one of the student's own lines to the next.
- **Example:** Copies 1929 from the source as 1992 in the answer.
- **Not `FAC_ARITHMETIC_SLIP`:** If a value was calculated wrongly rather than copied, use FAC_ARITHMETIC_SLIP.
- **Next step:** Line-to-line check habit.


## COM: Communication

### `COM_UNCLEAR_SENTENCES` Unclear or Wordy Sentences

- **Shown as:** Sentences are hard to follow. _Say it in fewer words; one idea per sentence is fine._
- **Means:** Sentences are so long, wordy or tangled that the meaning is hard to follow, though no single grammar rule is broken.
- **Example:** 'The thing about the Depression was that it was a time when the things that happened were very bad for many reasons.'
- **Not `STR_ILLOGICAL_ORDER`:** If the problem is the order of ideas, use STR_ILLOGICAL_ORDER.
- **Next step:** Tier 4: sentence-trimming exercise.

### `COM_INFORMAL_REGISTER` Informal Register

- **Shown as:** Too casual for the task. _In formal writing avoid slang, contractions and 'you'._
- **Means:** Uses slang, contractions, text-speak, second person or a chatty tone where a formal register is expected.
- **Example:** 'Basically the government was super mean to the strikers.'
- **Not `COM_IMPRECISE_TERMS`:** If a specific subject term is missing, use COM_IMPRECISE_TERMS.
- **Next step:** Tier 4: formal / informal rewrite pairs.

### `COM_IMPRECISE_TERMS` Imprecise Terms

- **Shown as:** Used an everyday word where a subject term was needed. _Use the exact subject word instead of an everyday one._
- **Means:** The idea is right but is stated with everyday or loose words where a specific scientific term is needed, so the answer is ambiguous.
- **Example:** 'The government made people join the army' (conscription); 'more people moved to cities' with no 'urbanisation' when asked to define trends.
- **Not `FAC_NAME_TERM_RECALL`:** If the student uses the wrong term, use FAC_NAME_TERM_RECALL.
- **Next step:** Tier 4: subject word wall.

### `COM_CITATION_FORMAT` Citation Format

- **Shown as:** Quote or source cited incorrectly. _Cite with the format your teacher uses (for example MLA: (Golding 45))._
- **Means:** Missing or wrongly formatted citations, page references or works cited entries; quotations not marked as quotations.
- **Example:** Uses a sentence from a website with no quotation marks or source.
- **Not `PRC_SOURCE_AT_FACE_VALUE`:** If the source is cited but not evaluated, use PRC_SOURCE_AT_FACE_VALUE.
- **Next step:** Tier 4: citation template card.

### `COM_MAP_CONVENTIONS` Map or Graph Conventions Missing

- **Shown as:** Map or graph missing title, legend or scale. _Maps need a title, legend, scale, north arrow and labels; graphs need a title, labelled axes and units._
- **Means:** A map or graph the student made is missing required conventions (title, orientation, date, author, legend, scale, labels).
- **Example:** Thematic map with colours but no legend or title.
- **Not `PRC_DATA_MISREAD`:** PRC_DATA_MISREAD is about reading a map or graph; this code is about making one.
- **Next step:** Tier 4: TODALSIG checklist.

### `COM_UNSUPPORTED_ANSWER` Unsupported Answer

- **Shown as:** Answer not explained. _The answer is there, but the reason the question asked for is missing._
- **Means:** Gives an answer, claim or 'show that' conclusion without the reasoning or working the question requires.
- **Example:** 'Was the Treaty of Versailles fair to Germany? No.'
- **Not `PRC_NO_EVIDENCE`:** If reasoning is given but no specific evidence, use PRC_NO_EVIDENCE.
- **Next step:** Tier 4: claim-because-evidence frame.


## TST: Test Habits

### `TST_BLANK` Blank / Time Attrition

- **Shown as:** Left blank. _This part was left blank._
- **Means:** Leaves a question or part with no attempt, from time pressure or a frustration block.
- **Example:** Leaves the source-analysis question blank.
- **Not `TST_ABANDONED_WORK`:** If any work was started, use TST_ABANDONED_WORK.
- **Not `TST_SKIPPED_PART`:** If other parts of the same question are answered, use TST_SKIPPED_PART.
- **Not `TST_LENGTH_MISMATCH`:** If something was written but far too little, use TST_LENGTH_MISMATCH.
- **Next step:** Prerequisite baseline probe on that topic.

### `TST_SKIPPED_PART` Skipped Part

- **Shown as:** Part of the question skipped. _One part of the question was skipped while the others were answered._
- **Means:** Answers some parts of a multi-part question and leaves another out, likely without noticing.
- **Example:** Asked for one cause and one consequence; gives only the cause.
- **Not `TST_BLANK`:** If the whole question is empty, use TST_BLANK.
- **Next step:** Part checklist habit.

### `TST_ABANDONED_WORK` Abandoned Work

- **Shown as:** Gave up partway. _A good start was stopped or crossed out before reaching an answer._
- **Means:** Starts a valid approach, then stops or crosses it out partway with no answer.
- **Example:** Starts the essay outline, writes the thesis, then stops.
- **Not `TST_BLANK`:** If nothing was written, use TST_BLANK.
- **Next step:** First-step confidence warm-up, then the same problem.

### `TST_LENGTH_MISMATCH` Length Mismatch

- **Shown as:** Much too short or too long. _Check the length asked for (words, paragraphs, lines) and plan to fit it._
- **Means:** Writes far less or far more than the task asks for (a paragraph for an essay, one sentence where a series of paragraphs is set).
- **Example:** Two sentences for a question worth 10 marks.
- **Not `TST_ABANDONED_WORK`:** If the writing stops mid-thought, use TST_ABANDONED_WORK.
- **Next step:** Marks-to-length planning habit.

### `TST_SOURCE_NOT_USED` Provided Source Not Used

- **Shown as:** Didn't use the source you were given. _When a question gives you a source, quote or point to it in your answer._
- **Means:** Answers a source-based question from memory or general knowledge without using the provided source, or gets a fact wrong that the source states.
- **Example:** Asked what Source B suggests about public opinion, writes about the war in general.
- **Not `PRC_SOURCE_AT_FACE_VALUE`:** If the source is used but not questioned, use PRC_SOURCE_AT_FACE_VALUE.
- **Next step:** Source-reference habit.

### `TST_TEMPTING_OPTION` Tempting Wrong Option

- **Shown as:** Picked an answer that sounds right but isn't supported. _Check each option against the passage, not against what sounds true._
- **Means:** In a multiple-choice reading question, picks an option that is true in general, uses words from the passage, or is half right, instead of the one the passage supports.
- **Example:** Picks 'Canada fought in WWI' when the question asks what the source says about conscription.
- **Not `TST_SOURCE_NOT_USED`:** For written answers that ignore the source, use TST_SOURCE_NOT_USED.
- **Next step:** Eliminate-with-evidence routine for multiple choice.
