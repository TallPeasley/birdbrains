# BirdBrains Privacy Policy

*Draft. Last updated: [date]. Effective: [launch date].*

BirdBrains is run by [legal name of the business, e.g. Swift Skills] in Ontario,
Canada ("we"). It looks at photos of a student's math work and explains where
the mistakes came from. This page says what we collect, why, where it is kept
and how to delete it. We wrote it to be read by parents and by students.

## The short version

- We collect as little as we can: an account, photos of math work, and the
  results we produce from them.
- Names and other personal details written on a photo are blurred before the
  photo is saved or analysed.
- Photos, results and analysis are stored and processed in Canada (Montréal).
- Photos are deleted automatically after 90 days.
- We do not sell personal information, show ads, or build advertising profiles.
- You can delete an account and everything in it at any time, from Settings.

## What we collect

**Account details.** Email address and password (the password is handled by our
sign-in provider; we never see it), a display name, whether the account is a
student or a parent, and for students their course or grade. Parents and
students are connected with a link code. If a student joins a class, we store
which class.

**Photos of math work.** The pictures a student or parent uploads. Before a
photo is stored:
- location and device details inside the image file are removed;
- the name, date, class, period, teacher and student-number fields are found
  and what is written in them is blurred;
- other names, dates, email addresses and phone numbers found on the page are
  blurred.

No automatic check is perfect. Please do not write personal details in the
working area of the page.

**What we produce from the photo.** A typed copy of the math steps, which steps
were right or wrong, the type of each mistake, scores, a feedback message, a
record of progress over time, and practice worksheets.

**Mood and effort signals (Pro plan only).** On the Pro plan, BirdBrains also
estimates how a piece of work felt for the student (for example confident,
struggling or frustrated) from visible signs on the page such as cross-outs and
rewrites, so that feedback and worksheets can be gentler when needed and
parents can see where support helps. This is an estimate, not a diagnosis. On
the Free plan it is not shown and not stored.

**Usage records.** How many uploads an account has made in the month, its plan,
and basic technical logs (time, type of request, errors) needed to run and
secure the service.

We do not collect home addresses, phone numbers, government ID numbers, school
records or payment card numbers. [If paid plans launch with Stripe: payments are
handled by Stripe; we receive only the plan, payment status and a customer
reference.]

## Why we use it

- to produce the diagnosis, feedback, progress view and worksheets;
- to let a parent see their own child's results;
- to keep the service working and secure, and to apply plan limits;
- to improve accuracy, using results with student identifiers removed.

We use personal information only for these purposes. We do not use students'
information for advertising, and we do not sell or rent it.

## Artificial intelligence

The analysis is done by Google's Gemini models through Google Cloud (Vertex AI),
running in Montréal. Photos reach the model only after the blurring described
above, and are labelled with a random student code, never a name. Under Google
Cloud's terms, Google does not use this data to train its models. Results are
produced automatically and can be wrong; see the Terms of Use.

## Where information is kept, and who helps us

| Provider | What for | Where |
|---|---|---|
| Google Cloud (Cloud Run, Cloud Storage, Firestore, Vertex AI, Cloud DLP) | Running the service, storing photos and results, the AI analysis, finding and blurring personal details | Montréal, Canada |
| Google Firebase Authentication | Sign-in (email address, password check) | [confirm: Firebase Authentication may process account data in the United States] |
| Netlify | Delivering the website's pages (no student data is stored there) | Global network, based in the United States |

These providers act on our instructions and may not use the information for
their own purposes. We may disclose information if the law requires it.

## How long we keep it

- **Photos:** deleted automatically 90 days after upload.
- **Results, progress and worksheets:** kept while the account exists, so that
  progress can be shown over time.
- **Accounts:** kept until deleted by the user, or after [24] months of no use.
- **Technical logs:** up to [30] days.
- **Deleted accounts:** removed from the live service right away, and from
  backups within [30] days.

## Your choices and rights

- **See and correct:** your name and details are in Settings. Ask us for a copy
  of everything we hold.
- **Delete:** "Delete my data" in Settings removes a student's photos, results,
  progress, worksheets and account. A linked parent can do this for their child.
- **Withdraw consent:** you can stop using BirdBrains and delete the account at
  any time.
- **Ask or complain:** write to our privacy contact below. If you are not
  satisfied you can contact the Office of the Privacy Commissioner of Canada
  (priv.gc.ca).

## Children and students

BirdBrains is meant for students in grades 3 to 12. A student under 13 may use
it only if a parent or guardian creates or approves the account and agrees to
this policy for them. Students aged 13 to 17 should read this page with a
parent or guardian. A parent or guardian can ask to see or delete their child's
information at any time. [If schools sign up: when a school provides BirdBrains
to its students, the school decides what is collected and authorises its use,
and requests can also go through the school.]

## Security

Information is encrypted in transit and at rest. Photos are private and can be
opened only by the signed-in student or their linked parent. Each family's and
each school's records are kept separate. If a breach creates a real risk of
significant harm, we will notify the people affected and the Privacy
Commissioner as the law requires.

## Changes

If we change this policy in a way that matters, we will tell account holders by
email or in the app before the change takes effect.

## Contact

Privacy contact: [name], [email address], [mailing address].

---

*Open points for Maalik before publishing (delete this section):*
1. Legal business name, privacy contact name, email and mailing address.
2. Firebase Authentication: confirm where account data is processed. If it is
   the United States, either say so plainly in the table (as drafted) or move
   sign-in to a provider with Canadian residency. The "everything stays in
   Canada" claim must not be made while this is unresolved.
3. Retention numbers in brackets (inactive accounts, logs, backups). Automatic
   deletion of inactive accounts is not built yet.
4. "Ask us for a copy": there is no export button yet; requests would be handled by hand.
5. Under-13 flow: the product does not yet ask for age or record parental consent
   (Gemini's Dec 8 consent task).
6. Lawyer review, especially if schools (MFIPPA) or US users (COPPA, FERPA) come in.
