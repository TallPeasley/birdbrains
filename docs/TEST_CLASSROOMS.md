# Test classrooms

Three ways to test the Classroom import, from no account needed to the real thing.

## 1. Demo Classroom (no Google account, runs anywhere except Cloud Run)

`backend/birdbrains/demo_classroom.py` is a pretend Google Classroom with invented students and no network calls.

| Class | Assignments | Notes |
|---|---|---|
| MPM2D-01 (Period 2) | Trigonometry II station work (BB-W11), Mixed review (BB-W12), Linear systems exit ticket | The first student on W11 and W12 hands in the real filled-in test photos |
| MPM2D-03 (Period 4) | Quadratics check-in, Analytic geometry quiz | |
| MTH1W-02 (Period 1) | Linear relations practice | Grade 9 |

Each assignment has eight students: five handed in with a photo, one returned work, one missing (not handed in) and one PDF the importer must skip. So an import reads six photos and skips two. The rest of the photos are generated pages, different every time so the duplicate check passes. Names are made up.

Run it locally (Pro teacher account, dev sign-in):

```bash
cd backend
BIRDBRAINS_BACKEND=local BIRDBRAINS_MODEL=fake BIRDBRAINS_AUTH=dev BIRDBRAINS_BATCH_TOKEN=dev \
BIRDBRAINS_CLASSROOM=demo uvicorn birdbrains.api:app --port 8080
# frontend: NEXT_PUBLIC_API_URL=http://localhost:8080 NEXT_PUBLIC_AUTH_MODE=dev
```

Sign in as a teacher, make the account Pro (`POST /internal/users/<uid>/plan`), press Connect Classroom. The demo skips the Google consent screen. `backend/tests/test_demo_classroom.py` runs the whole flow.

## 2. A real Google Classroom (needs Maalik)

Needs the Google OAuth client from `backend/README.md` ("Turning on Stripe and Google Classroom") with your teacher account under Test users. Then:
1. classroom.google.com with the teacher account: create a class "BB Test MPM2D".
2. Create two extra Google accounts as test students (any free Gmail) and invite them with the class code.
3. Post an assignment, hand in a photo as each test student (the filled test photos in project files `test-worksheets/` work).
4. In BirdBrains, as a Pro teacher: Connect Classroom, pick the class and the assignment, import.

Testing-mode connections expire after 7 days, so reconnect weekly.

## 3. Brightspace

Not built yet. The plan puts Canvas and Brightspace (LTI 1.3) after launch because they need a school's or D2L's developer account. A Brightspace test room needs one of these from you:
- a school or board that gives us a Brightspace sandbox, or
- a D2L partner developer account.

Once there is one, the demo Classroom's three classes can be copied into it and the same shape (classes, assignments, submissions) reused for the importer.
