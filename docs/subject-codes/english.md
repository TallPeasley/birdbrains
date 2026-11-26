# English error codes (draft)

Generated from `backend/birdbrains/subjects/english.json` by `backend/tools/subject_codes_doc.py`. Edit the JSON, not this page.

Courses: ENL1W, ENG2D, ENG3U, ENG3C, ENG4U, ENG4C, OLC4O, OSSLT. 49 codes.

| Pillar | Name | Points | Slip | Scope |
|---|---|---|---|---|
| CON | Reading & Understanding | 2 |  | The student misunderstands the text: what it says, what it means, its tone, purpose or devices. |
| STR | Thesis & Organisation | 2 |  | The reading may be right, but the argument or plan is wrong: off the prompt, no arguable thesis, drifting, badly ordered, wrong form. |
| PRC | Evidence & Analysis | 2 |  | The thesis is sound, but proving it goes wrong: summary instead of analysis, missing, weak or unexplained evidence. |
| FAC | Grammar & Mechanics | 1 | yes | The ideas are sound; a sentence-level convention slips (sentence boundaries, agreement, tense, spelling, punctuation). |
| COM | Style & Expression | 2 |  | The ideas are sound, but how they are expressed gets in the way: unclear, informal, imprecise, repetitive, unlinked, or wrongly cited. |
| TST | Task Habits | 1 | yes | How the student handles the task: blanks, unfinished work, missed parts, length, not rereading the text, not proofreading. |

## CON: Reading & Understanding

### `CON_LITERAL_MISREAD` Literal Misread

- **Shown as:** Misread what happens in the text. _Reread the lines around your answer: who does what, to whom, and when?_
- **Means:** Gets the plain sense of a passage wrong: who did what, the order of events, or what a sentence states.
- **Example:** 'In Act 1, Romeo is in love with Juliet' (he is pining for Rosaline).
- **Not `CON_FIGURATIVE_AS_LITERAL`:** If the student reads a figure of speech as fact, use CON_FIGURATIVE_AS_LITERAL.
- **Not `TST_TEXT_NOT_REREAD`:** If the answer comes from memory or general knowledge rather than the passage, use TST_TEXT_NOT_REREAD.
- **Next step:** Tier 1: who-what-when retelling of the passage.

### `CON_FIGURATIVE_AS_LITERAL` Figurative Read as Literal

- **Shown as:** Took figurative language literally. _Ask whether the words could really be true; if not, what are they comparing or suggesting?_
- **Means:** Reads metaphor, hyperbole, symbolism or idiom as literal statement.
- **Example:** '"All the world's a stage" means the play is set in a theatre.'
- **Not `CON_TONE_MISREAD`:** If the student misses sarcasm or irony (the attitude), use CON_TONE_MISREAD.
- **Not `CON_DEVICE_MISIDENTIFIED`:** If the student sees the figure but names the wrong device, use CON_DEVICE_MISIDENTIFIED.
- **Next step:** Tier 1: literal vs figurative sort with the effect of each.

### `CON_TONE_MISREAD` Tone Misread

- **Shown as:** Misjudged the tone or attitude. _Look at word choice: is the writer serious, mocking, angry, hopeful?_
- **Means:** Misjudges the speaker's or writer's attitude: takes sarcasm or irony as sincere, misses humour, or names a mood the text doesn't support.
- **Example:** Reads Swift's 'A Modest Proposal' as a serious plan.
- **Not `CON_FIGURATIVE_AS_LITERAL`:** If it is a single figure of speech read literally, use CON_FIGURATIVE_AS_LITERAL.
- **Not `CON_NARRATOR_AS_AUTHOR`:** If the student assumes the narrator's views are the author's, use CON_NARRATOR_AS_AUTHOR.
- **Next step:** Tier 1: tone-word ladder with evidence for each choice.

### `CON_NARRATOR_AS_AUTHOR` Narrator Taken as Author

- **Shown as:** Treated the narrator as the author. _The narrator or speaker is a character the author created; their views may not be the author's._
- **Means:** Treats the narrator, speaker or a character as the author, or takes an unreliable narrator at face value.
- **Example:** 'Poe admits he is a murderer in "The Tell-Tale Heart".'
- **Not `CON_TONE_MISREAD`:** If the issue is the attitude of the text rather than who is speaking, use CON_TONE_MISREAD.
- **Next step:** Tier 1: speaker/author/audience triangle.

### `CON_THEME_AS_TOPIC` Topic Given as Theme

- **Shown as:** Gave a topic, not a theme. _A theme is a full statement about life ("Ambition without limits destroys"), not one word ("ambition")._
- **Means:** Gives a topic word or a moral cliché as the theme instead of a statement the text makes about its topic.
- **Example:** 'The theme of Macbeth is ambition.'
- **Not `STR_NO_ARGUABLE_THESIS`:** If the thesis of the whole essay is not arguable, use STR_NO_ARGUABLE_THESIS; this code is about naming a theme.
- **Next step:** Tier 1: topic → question → theme statement frame.

### `CON_DEVICE_MISIDENTIFIED` Device Misidentified

- **Shown as:** Named the wrong literary device. _Check the definition: simile uses like/as, metaphor doesn't; irony is a gap between expected and actual._
- **Means:** Names a literary, rhetorical or media device wrongly (simile for metaphor, irony for coincidence, foreshadowing for flashback).
- **Example:** '"Her eyes were stars" is a simile.'
- **Not `PRC_DEVICE_SPOTTING`:** If the device is named correctly but its effect isn't explained, use PRC_DEVICE_SPOTTING.
- **Next step:** Tier 1: device definition cards with paired examples.

### `CON_PURPOSE_AUDIENCE` Purpose or Audience Misread

- **Shown as:** Misread the text's purpose or audience. _Ask who the text is for and what it wants them to think or do._
- **Means:** Misidentifies the purpose (inform, persuade, entertain) or intended audience of an informational, media or persuasive text.
- **Example:** Calls a sponsored advertisement for a sports drink an objective health report.
- **Not `CON_FACT_VS_OPINION`:** If the student treats a claim as fact, use CON_FACT_VS_OPINION.
- **Next step:** Tier 1: purpose-audience-form (PAF) table.

### `CON_FACT_VS_OPINION` Fact vs Opinion

- **Shown as:** Mixed up fact and opinion. _A fact can be checked; an opinion or claim needs support. Watch for loaded words._
- **Means:** Treats opinion, claims or biased statements as facts, or misses bias in a source.
- **Example:** 'The article proves that video games are a waste of time because the author says so.'
- **Not `CON_PURPOSE_AUDIENCE`:** If the issue is the text's overall purpose, use CON_PURPOSE_AUDIENCE.
- **Next step:** Tier 1: fact / opinion / claim sort with loaded-word highlighting.


## STR: Thesis & Organisation

### `STR_OFF_PROMPT` Off the Prompt

- **Shown as:** Wrote about something other than the prompt. _Turn the prompt into a question and make sure your thesis answers it._
- **Means:** The response or thesis addresses a different question or topic from the one set (writes about a character when asked about a theme, or a general opinion when asked about the text).
- **Example:** Prompt: 'How does Shakespeare use the witches to build tension?' Essay: 'Macbeth is a tragic hero.'
- **Not `TST_SKIPPED_PART`:** If the prompt is answered but one of its parts is left out, use TST_SKIPPED_PART.
- **Not `STR_THESIS_DRIFT`:** If the thesis answers the prompt but the body wanders away, use STR_THESIS_DRIFT.
- **Next step:** Tier 2: prompt-unpacking box (verb, topic, limits).

### `STR_NO_ARGUABLE_THESIS` No Arguable Thesis

- **Shown as:** Thesis isn't something you can argue. _A thesis is a claim someone could disagree with, plus why._
- **Means:** The thesis is a fact, a plot statement, an announcement ('In this essay I will...'), or is missing.
- **Example:** 'In this essay I will talk about the symbols in Lord of the Flies.'
- **Not `CON_THEME_AS_TOPIC`:** If the problem is naming a theme as a single word, use CON_THEME_AS_TOPIC.
- **Not `STR_OFF_PROMPT`:** If the thesis is arguable but answers a different question, use STR_OFF_PROMPT.
- **Next step:** Tier 2: claim + because + so-what thesis frame.

### `STR_THESIS_DRIFT` Thesis Drift

- **Shown as:** Body moved away from the thesis. _Each paragraph's point should prove a part of your thesis._
- **Means:** Body paragraphs argue something other than the thesis, or the conclusion reaches a different claim.
- **Example:** Thesis about guilt; body paragraphs about Lady Macbeth's ambition with no link to guilt.
- **Not `STR_PARAGRAPH_FOCUS`:** If a single paragraph mixes points, use STR_PARAGRAPH_FOCUS; this code is about the essay as a whole.
- **Next step:** Tier 2: thesis-to-topic-sentence map.

### `STR_PARAGRAPH_FOCUS` Unfocused Paragraph

- **Shown as:** Paragraph has no single clear point. _Start each paragraph with one point; everything after should support it._
- **Means:** A paragraph has no topic sentence, combines several unrelated points, or its point only appears at the end.
- **Example:** One paragraph discusses setting, then a character's motive, then a quote about the ending.
- **Not `STR_THESIS_DRIFT`:** If the paragraph is focused but off the thesis, use STR_THESIS_DRIFT.
- **Not `COM_WEAK_TRANSITIONS`:** If paragraphs are focused but not linked, use COM_WEAK_TRANSITIONS.
- **Next step:** Tier 2: point-evidence-explain (PEE) paragraph frame.

### `STR_ILLOGICAL_ORDER` Illogical Order

- **Shown as:** Ideas aren't in a logical order. _Put ideas in an order that builds: time order, weakest to strongest, or cause to effect._
- **Means:** Ideas or paragraphs are ordered with no logic or progression; the argument jumps back and forth.
- **Example:** Persuasive essay puts its strongest point first, a rebuttal in the middle, and a new reason in the conclusion.
- **Not `COM_WEAK_TRANSITIONS`:** If the order is sound but the links between ideas are missing, use COM_WEAK_TRANSITIONS.
- **Next step:** Tier 2: reverse outline of the draft.

### `STR_OVERLAPPING_POINTS` Overlapping Points

- **Shown as:** Points repeat each other. _Each body point should be a different reason, not the same reason in new words._
- **Means:** The thesis or body points overlap, so the essay makes one point several times.
- **Example:** Thesis: 'Jack is violent, aggressive and brutal.'
- **Not `COM_REPETITION`:** COM_REPETITION is about repeated words or sentence patterns; this code is about repeated ideas.
- **Next step:** Tier 2: point-distinctness check (can each stand alone?).

### `STR_WRONG_FORM` Wrong Form

- **Shown as:** Used the wrong form for the task. _Check the form asked for (news report, letter, series of paragraphs) and its features._
- **Means:** Writes in a form other than the one set, or misses its required features (a news report without a headline or 5Ws lead, a letter without salutation).
- **Example:** OSSLT news report task answered as a personal story with no headline.
- **Not `STR_OFF_PROMPT`:** If the topic is wrong, use STR_OFF_PROMPT; this code is about the form.
- **Not `TST_LENGTH_MISMATCH`:** If the form is right but far too short or long, use TST_LENGTH_MISMATCH.
- **Next step:** Tier 2: form-feature checklist.

### `STR_WEAK_INTRO_CONCLUSION` Weak Introduction or Conclusion

- **Shown as:** Introduction or conclusion is missing or weak. _Introduce the text, author and thesis; conclude by showing what the argument proved, without new points._
- **Means:** Missing introduction or conclusion, an introduction without context or thesis, or a conclusion that only repeats or adds a new argument.
- **Example:** Conclusion: 'In conclusion, that is why Macbeth is a tragedy. Also, Banquo is important.'
- **Not `STR_NO_ARGUABLE_THESIS`:** If the introduction is there but its thesis isn't arguable, use STR_NO_ARGUABLE_THESIS.
- **Next step:** Tier 2: intro funnel and conclusion so-what templates.


## PRC: Evidence & Analysis

### `PRC_SUMMARY_NOT_ANALYSIS` Summary Instead of Analysis

- **Shown as:** Retold the story instead of analysing. _After each event you mention, explain why it matters to your point._
- **Means:** Retells plot or paraphrases the text where analysis is asked for.
- **Example:** Paragraph on the conch: retells each scene the conch appears in, with no claim about what it shows.
- **Not `PRC_EVIDENCE_NOT_EXPLAINED`:** If there is a quote and a point but no link, use PRC_EVIDENCE_NOT_EXPLAINED; this code is for paragraphs that are mostly retelling.
- **Next step:** Tier 2: 'so what?' annotation after each sentence.

### `PRC_NO_EVIDENCE` No Evidence

- **Shown as:** Made a claim without evidence. _Back each point with a quote or specific detail from the text._
- **Means:** Makes claims about a text without any quotation, specific reference or detail.
- **Example:** 'Gatsby is lonely throughout the novel.' with no reference to the text.
- **Not `PRC_WEAK_EVIDENCE`:** If evidence is given but doesn't support the claim, use PRC_WEAK_EVIDENCE.
- **Next step:** Tier 2: evidence hunt with page references.

### `PRC_WEAK_EVIDENCE` Weak or Irrelevant Evidence

- **Shown as:** Quote doesn't support the point. _Choose the quote that proves your point most directly, not just one on the same topic._
- **Means:** Uses a quotation or detail that does not support the claim, is too general, or supports a different point.
- **Example:** Claim: Piggy is intelligent. Quote: 'Piggy wiped his glasses.'
- **Not `PRC_NO_EVIDENCE`:** If no evidence is given, use PRC_NO_EVIDENCE.
- **Not `PRC_OVERREACH`:** If the evidence is relevant but the claim reads too much into it, use PRC_OVERREACH.
- **Next step:** Tier 2: claim-evidence match ranking.

### `PRC_DROPPED_QUOTE` Dropped Quotation

- **Shown as:** Dropped a quote in without introducing it. _Lead into each quote with who says it and when, and blend it into your sentence._
- **Means:** Inserts a quotation as a sentence on its own with no lead-in, context or grammatical integration.
- **Example:** 'Macbeth is guilty. "Will all great Neptune's ocean wash this blood clean from my hand?"'
- **Not `PRC_EVIDENCE_NOT_EXPLAINED`:** PRC_EVIDENCE_NOT_EXPLAINED is about what comes after the quote; this code is about how it is brought in.
- **Next step:** Tier 2: sandwich method (lead-in, quote, explanation).

### `PRC_EVIDENCE_NOT_EXPLAINED` Evidence Not Explained

- **Shown as:** Didn't explain how the quote proves the point. _After a quote, explain which words matter and how they prove your point._
- **Means:** Gives a relevant quotation and then moves on, or only restates it, without explaining how it supports the claim.
- **Example:** 'Jack says "Kill the pig!" This shows he is violent.' and the paragraph ends.
- **Not `PRC_SUMMARY_NOT_ANALYSIS`:** If most of the paragraph retells plot, use PRC_SUMMARY_NOT_ANALYSIS.
- **Not `PRC_DEVICE_SPOTTING`:** If a device is named without its effect, use PRC_DEVICE_SPOTTING.
- **Next step:** Tier 2: zoom-in on key words in the quote.

### `PRC_DEVICE_SPOTTING` Device Spotting

- **Shown as:** Named a device without its effect. _Say what the device does: what does it make the reader feel, see or think?_
- **Means:** Identifies a literary or rhetorical device correctly but does not explain its effect or how it supports the argument.
- **Example:** 'The author uses alliteration in "silent sea".' (nothing more).
- **Not `CON_DEVICE_MISIDENTIFIED`:** If the device is named wrongly, use CON_DEVICE_MISIDENTIFIED.
- **Not `PRC_EVIDENCE_NOT_EXPLAINED`:** PRC_EVIDENCE_NOT_EXPLAINED is for quotes left unexplained; this code is specifically for naming devices without effect.
- **Next step:** Tier 2: device-effect-purpose chain.

### `PRC_OVERREACH` Overreaching Interpretation

- **Shown as:** Read more into the text than it supports. _Check that your interpretation fits the whole text, not just one line._
- **Means:** Makes an interpretation the text cannot support or that other parts contradict.
- **Example:** 'The green light proves Gatsby is secretly an alien.' / reading every colour as a symbol.
- **Not `PRC_WEAK_EVIDENCE`:** If the claim is reasonable but the quote chosen doesn't support it, use PRC_WEAK_EVIDENCE.
- **Not `CON_LITERAL_MISREAD`:** If the reading comes from misunderstanding what happens, use CON_LITERAL_MISREAD.
- **Next step:** Tier 2: 'what in the text supports and challenges this?' table.

### `PRC_COUNTERARGUMENT_MISSING` Counterargument Missing

- **Shown as:** Didn't deal with the other side. _In persuasive writing, name the strongest opposing view and answer it._
- **Means:** Persuasive or argumentative writing ignores obvious opposing views, or only addresses a weak version of them.
- **Example:** Argues for a four-day school week without addressing childcare or learning time.
- **Not `PRC_NO_EVIDENCE`:** If the writer's own points lack support, use PRC_NO_EVIDENCE.
- **Next step:** Tier 2: 'some may argue... however...' frame.


## FAC: Grammar & Mechanics

### `FAC_RUN_ON` Run-on / Comma Splice

- **Shown as:** Joined sentences with only a comma (or nothing). _Two complete sentences need a period, a semicolon, or a joining word like 'and' or 'because'._
- **Means:** Joins independent clauses with only a comma or with no punctuation.
- **Example:** 'Macbeth kills Duncan, he feels guilty right away.'
- **Not `FAC_FRAGMENT`:** A fragment is a piece missing a subject or verb; a run-on is two sentences stuck together.
- **Not `TST_NOT_PROOFREAD`:** If slips like this are scattered through work where the student usually punctuates correctly, also consider TST_NOT_PROOFREAD.
- **Next step:** Tier 3: sentence-boundary micro-drill.

### `FAC_FRAGMENT` Sentence Fragment

- **Shown as:** Wrote an incomplete sentence. _Every sentence needs a subject and a verb and must make sense alone._
- **Means:** Punctuates a phrase or dependent clause as a full sentence.
- **Example:** 'Because he wanted to be king.'
- **Not `FAC_RUN_ON`:** If two complete sentences are joined wrongly, use FAC_RUN_ON.
- **Next step:** Tier 3: fragment-fix drill.

### `FAC_AGREEMENT` Agreement Error

- **Shown as:** Subject and verb (or pronoun) don't match. _Match singular with singular and plural with plural, even when words come between._
- **Means:** Subject-verb or pronoun-antecedent agreement error.
- **Example:** 'The group of boys are lost.' / 'Every student must bring their... his... they're book.'
- **Not `FAC_VERB_TENSE`:** If the verb's time changes rather than its number, use FAC_VERB_TENSE.
- **Next step:** Tier 3: agreement micro-drill.

### `FAC_VERB_TENSE` Tense Shift

- **Shown as:** Switched verb tenses. _Write about literature in the present tense and keep it steady._
- **Means:** Shifts between past and present without reason, or does not use the literary present when discussing a text.
- **Example:** 'Gatsby throws parties and he wanted Daisy to come.'
- **Not `FAC_AGREEMENT`:** If the verb doesn't match its subject's number, use FAC_AGREEMENT.
- **Next step:** Tier 3: tense-highlight reread.

### `FAC_SPELLING_HOMOPHONE` Spelling / Homophone

- **Shown as:** Spelling or sound-alike word slip. _Check sound-alike words: their/there/they're, its/it's, affect/effect, then/than._
- **Means:** Misspells a word or uses the wrong homophone.
- **Example:** 'Its clear that there going to lose.'
- **Not `COM_WORD_CHOICE`:** If the word is spelled right but is the wrong word for the meaning, use COM_WORD_CHOICE.
- **Next step:** Tier 3: personal spelling list.

### `FAC_PUNCTUATION` Punctuation Error

- **Shown as:** Punctuation used wrongly. _Apostrophes show ownership or missing letters, not plurals; check commas after introductory phrases._
- **Means:** Misuses apostrophes, commas, semicolons, colons or quotation punctuation (other than run-ons).
- **Example:** 'The boy's ran to the beach.' / 'However the plan fails.'
- **Not `FAC_RUN_ON`:** Comma splices and fused sentences are FAC_RUN_ON.
- **Not `COM_CITATION_FORMAT`:** Punctuation of in-text citations belongs to COM_CITATION_FORMAT.
- **Next step:** Tier 3: punctuation rule cards.

### `FAC_MODIFIER` Misplaced Modifier

- **Shown as:** A describing phrase is attached to the wrong word. _Put describing phrases right next to the word they describe._
- **Means:** A dangling or misplaced modifier makes the sentence describe the wrong thing.
- **Example:** 'Running to the boat, the conch fell from Ralph's hands.'
- **Not `COM_UNCLEAR_SENTENCES`:** If the sentence is unclear for other reasons (length, wordiness), use COM_UNCLEAR_SENTENCES.
- **Next step:** Tier 3: modifier-fix drill.

### `FAC_CAPITALS_TITLES` Capitals and Titles

- **Shown as:** Capitals or title formatting slip. _Capitalise names and the main words of titles; italicise (or underline) long works and put short works in quotation marks._
- **Means:** Misses capitals on proper nouns or sentence starts, or formats titles wrongly.
- **Example:** 'in romeo and juliet, shakespeare...' / 'the poem Ozymandias'.
- **Not `COM_CITATION_FORMAT`:** If the issue is the citation itself (author, page), use COM_CITATION_FORMAT.
- **Next step:** Tier 3: title-format cheat sheet.


## COM: Style & Expression

### `COM_UNCLEAR_SENTENCES` Unclear or Wordy Sentences

- **Shown as:** Sentences are hard to follow. _Say it in fewer words; one idea per sentence is fine._
- **Means:** Sentences are so long, wordy or tangled that the meaning is hard to follow, though no single grammar rule is broken.
- **Example:** 'The thing that the author is trying to show through the way that the character acts is that in a way he is not who he seems to be.'
- **Not `FAC_RUN_ON`:** If the problem is two sentences joined by a comma, use FAC_RUN_ON.
- **Not `COM_WORD_CHOICE`:** If one word is the problem, use COM_WORD_CHOICE.
- **Next step:** Tier 4: sentence-trimming exercise.

### `COM_INFORMAL_REGISTER` Informal Register

- **Shown as:** Too casual for the task. _In formal writing avoid slang, contractions and 'you'._
- **Means:** Uses slang, contractions, text-speak, second person or a chatty tone where a formal register is expected.
- **Example:** 'Macbeth is kinda sus and you can tell he's gonna snap.'
- **Not `COM_AUDIENCE_TONE`:** If the tone is wrong for the audience in a functional piece (a letter, a speech), use COM_AUDIENCE_TONE.
- **Not `COM_HEDGED_CLAIMS`:** If the issue is 'I think' and 'I feel', use COM_HEDGED_CLAIMS.
- **Next step:** Tier 4: formal / informal rewrite pairs.

### `COM_WORD_CHOICE` Imprecise Word Choice

- **Shown as:** Used a word that doesn't quite fit. _Choose the most exact word; if you used a thesaurus, check the word means what you need._
- **Means:** Uses vague words (thing, stuff, good, bad) or words that don't mean what is intended, often from a thesaurus.
- **Example:** 'The author utilises a plethora of imagery to make it more good.'
- **Not `FAC_SPELLING_HOMOPHONE`:** If the right word is spelled as a sound-alike, use FAC_SPELLING_HOMOPHONE.
- **Not `COM_IMPRECISE_TERMS`:** If a specific literary term is replaced by an everyday word, use COM_IMPRECISE_TERMS.
- **Next step:** Tier 4: vague-word swap list.

### `COM_IMPRECISE_TERMS` Imprecise Terms

- **Shown as:** Used an everyday word where a subject term was needed. _Use the exact subject word instead of an everyday one._
- **Means:** The idea is right but is stated with everyday or loose words where a specific scientific term is needed, so the answer is ambiguous.
- **Example:** 'In the paragraph of the poem' (stanza); 'the main guy' (protagonist).
- **Not `COM_WORD_CHOICE`:** COM_WORD_CHOICE is for general vocabulary; this code is for subject terms.
- **Next step:** Tier 4: subject word wall.

### `COM_REPETITION` Repetitive Wording

- **Shown as:** Repeated the same words or sentence pattern. _Vary how sentences start and use synonyms or pronouns for repeated nouns._
- **Means:** Repeats the same words, phrases or sentence openings so the writing becomes monotonous.
- **Example:** Five sentences in a row start with 'This shows that'.
- **Not `STR_OVERLAPPING_POINTS`:** If the same idea is repeated, use STR_OVERLAPPING_POINTS.
- **Next step:** Tier 4: sentence-opening variety drill.

### `COM_HEDGED_CLAIMS` Hedged Claims

- **Shown as:** Weakened claims with 'I think' or 'maybe'. _State your claim directly; your evidence does the persuading._
- **Means:** Weakens claims with unnecessary hedging or first-person qualifiers in analytical writing.
- **Example:** 'I think that maybe Piggy could possibly represent science, in my opinion.'
- **Not `COM_INFORMAL_REGISTER`:** If the language is casual (slang, contractions), use COM_INFORMAL_REGISTER.
- **Next step:** Tier 4: hedge-cutting rewrite.

### `COM_WEAK_TRANSITIONS` Weak Transitions

- **Shown as:** Ideas aren't linked together. _Use linking words (however, as a result, similarly) and begin paragraphs by linking back._
- **Means:** Sentences or paragraphs follow each other without transitions, so connections between ideas are unclear.
- **Example:** Paragraph 2 starts 'Another thing is the setting.' with no link to paragraph 1.
- **Not `STR_ILLOGICAL_ORDER`:** If the ideas are in an illogical order, use STR_ILLOGICAL_ORDER; this code is for sound order without links.
- **Next step:** Tier 4: transition word bank by purpose.

### `COM_CITATION_FORMAT` Citation Format

- **Shown as:** Quote or source cited incorrectly. _Cite with the format your teacher uses (for example MLA: (Golding 45))._
- **Means:** Missing or wrongly formatted citations, page references or works cited entries; quotations not marked as quotations.
- **Example:** Uses a sentence from the novel with no quotation marks or page number.
- **Not `FAC_CAPITALS_TITLES`:** If only the title formatting is wrong, use FAC_CAPITALS_TITLES.
- **Not `PRC_DROPPED_QUOTE`:** If the quote is cited but not introduced, use PRC_DROPPED_QUOTE.
- **Next step:** Tier 4: citation template card.

### `COM_AUDIENCE_TONE` Tone Wrong for Audience

- **Shown as:** Tone doesn't suit the reader. _Ask who will read it (a principal, a newspaper, a friend) and adjust how you say things._
- **Means:** In functional or persuasive writing, the tone does not suit the audience or purpose (rude, overly casual, overly emotional).
- **Example:** Letter to the principal: 'Your rule is honestly the dumbest thing ever.'
- **Not `COM_INFORMAL_REGISTER`:** COM_INFORMAL_REGISTER is about formal essay language; this code is about tone toward a specific reader.
- **Not `CON_PURPOSE_AUDIENCE`:** If the student misreads the audience of a text they are reading, use CON_PURPOSE_AUDIENCE.
- **Next step:** Tier 4: rewrite for three audiences.


## TST: Task Habits

### `TST_BLANK` Blank / Time Attrition

- **Shown as:** Left blank. _This part was left blank._
- **Means:** Leaves a question or part with no attempt, from time pressure or a frustration block.
- **Example:** Leaves the short-answer reading question blank.
- **Not `TST_ABANDONED_WORK`:** If any work was started, use TST_ABANDONED_WORK.
- **Not `TST_SKIPPED_PART`:** If other parts of the same question are answered, use TST_SKIPPED_PART.
- **Next step:** Prerequisite baseline probe on that topic.

### `TST_SKIPPED_PART` Skipped Part

- **Shown as:** Part of the question skipped. _One part of the question was skipped while the others were answered._
- **Means:** Answers some parts of a multi-part question and leaves another out, likely without noticing.
- **Example:** Prompt asks for two examples and their effects; gives one example.
- **Not `TST_BLANK`:** If the whole question is empty, use TST_BLANK.
- **Next step:** Part checklist habit.

### `TST_TEMPTING_OPTION` Tempting Wrong Option

- **Shown as:** Picked an answer that sounds right but isn't supported. _Check each option against the passage, not against what sounds true._
- **Means:** In a multiple-choice reading question, picks an option that is true in general, uses words from the passage, or is half right, instead of the one the passage supports.
- **Example:** Picks 'Bees are important to farming' (true in general) when the question asks what the passage's second paragraph argues.
- **Not `TST_TEXT_NOT_REREAD`:** If a written answer comes from memory instead of the passage, use TST_TEXT_NOT_REREAD; this code is for multiple-choice options.
- **Not `CON_LITERAL_MISREAD`:** If the student clearly misunderstood the passage, use CON_LITERAL_MISREAD.
- **Next step:** Eliminate-with-evidence routine for multiple choice.

### `TST_ABANDONED_WORK` Abandoned Work

- **Shown as:** Gave up partway. _A good start was stopped or crossed out before reaching an answer._
- **Means:** Starts a valid approach, then stops or crosses it out partway with no answer.
- **Example:** Essay stops partway through the second body paragraph.
- **Not `TST_BLANK`:** If nothing was written, use TST_BLANK.
- **Not `TST_LENGTH_MISMATCH`:** If the piece is complete but far too short, use TST_LENGTH_MISMATCH.
- **Next step:** First-step confidence warm-up, then the same problem.

### `TST_LENGTH_MISMATCH` Length Mismatch

- **Shown as:** Much too short or too long. _Check the length asked for (words, paragraphs, lines) and plan to fit it._
- **Means:** Writes far less or far more than the task asks for (a paragraph for an essay, one sentence where a series of paragraphs is set).
- **Example:** Series-of-paragraphs task answered in four lines.
- **Not `TST_ABANDONED_WORK`:** If the writing stops mid-thought, use TST_ABANDONED_WORK.
- **Not `STR_WRONG_FORM`:** If the form itself is wrong, use STR_WRONG_FORM.
- **Next step:** Time-and-length plan before writing.

### `TST_TEXT_NOT_REREAD` Answered Without the Text

- **Shown as:** Answered from memory, not the passage. _Go back to the passage and find the line that answers the question._
- **Means:** Answers a reading question from memory, general knowledge or opinion instead of the passage provided.
- **Example:** Reading question on a passage about bees answered with facts from a science class not in the passage.
- **Not `CON_LITERAL_MISREAD`:** If the student read the passage but understood it wrongly, use CON_LITERAL_MISREAD.
- **Next step:** Line-reference habit for every reading answer.

### `TST_COPIED_PROMPT` Copied Prompt or Passage

- **Shown as:** Copied the question or passage instead of answering. _Use your own words; a quote should support your answer, not replace it._
- **Means:** Restates the prompt or copies long stretches of the passage as the answer, with little or no response of the student's own.
- **Example:** Answer to 'What is the main idea?' is the first three sentences of the passage copied out.
- **Not `PRC_SUMMARY_NOT_ANALYSIS`:** If the student paraphrases the plot in their own words, use PRC_SUMMARY_NOT_ANALYSIS.
- **Next step:** Answer-in-own-words frame.

### `TST_NOT_PROOFREAD` Not Proofread

- **Shown as:** Didn't reread for slips. _Leave two minutes to reread; read it as if someone else wrote it._
- **Means:** A cluster of obvious slips (missing or doubled words, unfinished sentences) the student would likely catch on a reread, in work that otherwise shows they know the conventions.
- **Example:** 'The the boys decide to to build a fire on the.'
- **Not `FAC_SPELLING_HOMOPHONE`:** Use the specific FAC code when a slip shows a real gap (consistent its/it's); use this one when slips look careless and scattered.
- **Next step:** Proofreading checklist and read-aloud habit.
