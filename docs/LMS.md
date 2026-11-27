# Canvas and Brightspace

Pro teachers connect their school's Canvas or Brightspace in the Teacher Hub, import the
photos students handed in for an assignment, and send Quark's scores and feedback back.
Anyone at a school that has set Quark up can also **sign in** with their Canvas or
Brightspace account.

Unlike Google Classroom, there is no one Quark app for everyone: **each school registers
Quark on its own Canvas or Brightspace site** and gives us a client ID and secret. So the
beta is gated per school, not per teacher:

1. A Pro teacher presses **Connect** and types their school's address
   (e.g. `https://maplehigh.instructure.com`). If the school is not set up, Quark notes
   the request and tells the teacher it will be ready once their school's admin approves it.
2. Maalik sees the request (`tools/lms_schools.py`), contacts the school's LMS admin and
   sends them the steps below.
3. The admin sends back a client ID and secret. Maalik stores them with
   `tools/lms_schools.py --add ...`. Every Pro teacher at that school can now connect,
   and anyone there can sign in with it.

Code: `backend/birdbrains/lms.py` (providers), the "School LMS" part of
`backend/birdbrains/api.py`, tests in `backend/tests/test_lms.py`.

## Security

- Quark only ever calls LMS addresses in the `lmsschools` list. A typed-in address that is
  not set up never gets a request, so the API cannot be pointed at another server.
- Schools' client secrets and teachers' tokens are encrypted ("sealed") with
  `BIRDBRAINS_LMS_KEY` before they go in Firestore. The key is the Secret Manager secret
  `birdbrains-lms-token-key`, which `backend/deploy.sh` creates once. **Do not rotate it**:
  stored school keys and teachers' connections could no longer be read.
- Sign-in keeps no LMS token: Quark reads who the person is, then deletes the token.
  The Quark account id includes the school's site, so user 17 at one school can never
  sign in as user 17 at another.
- The sign-in token comes back to the site in the address fragment (`/#ssoToken=...`),
  which browsers never send to a server.

## Redirect URI (the same for connecting and signing in)

| LMS | Redirect URI |
| --- | --- |
| Canvas | `https://birdbrains-api-28737473918.northamerica-northeast1.run.app/lms/canvas/callback` |
| Brightspace | `https://birdbrains-api-28737473918.northamerica-northeast1.run.app/lms/brightspace/callback` |

These are on the API, not the website, so they do not change when the site address
does. (If the API ever moves, every school must update its redirect URI.)

## Steps to send a school's Canvas admin

> Quark grades photos of students' handwritten math. To let your teachers import their
> students' photo hand-ins and send scores back, please create a developer key:
>
> 1. **Admin > (your account) > Developer Keys > + Developer Key > + API Key.**
> 2. Key name: **Quark**. Owner email: (ours). Redirect URIs:
>    `https://birdbrains-api-28737473918.northamerica-northeast1.run.app/lms/canvas/callback`
> 3. Turn on **Enforce Scopes** and tick only these:
>    - Courses: `GET /api/v1/courses`
>    - Assignments: `GET /api/v1/courses/:course_id/assignments`
>    - Users: `GET /api/v1/courses/:course_id/users` and `GET /api/v1/users/:user_id/profile`
>    - Submissions: `GET /api/v1/courses/:course_id/assignments/:assignment_id/submissions`
>      and `PUT /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id`
> 4. Save, set the key's state to **ON**, and send us the **ID** (the long number under
>    Details) and the **Key** (press Show Key). Please send the key by a private channel.
>
> Teachers each approve Quark themselves the first time they connect, and can remove it
> any time under Account > Settings > Approved Integrations.

If the admin would rather not enforce scopes, store the school with `--unscoped`.

## Steps to send a school's Brightspace admin

> 1. **Admin Tools > Manage Extensibility > OAuth 2.0 > Register an app.**
> 2. Application name: **Quark**. Redirect URI:
>    `https://birdbrains-api-28737473918.northamerica-northeast1.run.app/lms/brightspace/callback`
> 3. Scope (paste exactly):
>    `enrollment:own_enrollment:read enrollment:orgunit:read dropbox:folders:read dropbox:folders:write users:own_profile:read`
> 4. Access token lifetime: 3600. Tick **Enable refresh tokens**. Leave "Prompt for user
>    consent" ticked.
> 5. Accept the developer agreement, register, and send us the **Client ID** and
>    **Client Secret** by a private channel.

Brightspace saves Quark's scores as **draft** feedback on the assignment folder: the
teacher still publishes it to students in Brightspace.

## Admin tool

```bash
TOKEN="$(gcloud secrets versions access latest --secret=birdbrains-batch-token)"
API=https://birdbrains-api-28737473918.northamerica-northeast1.run.app
python backend/tools/lms_schools.py --url $API --batch-token "$TOKEN"            # waiting requests
python backend/tools/lms_schools.py --url $API --batch-token "$TOKEN" --all      # every school
python backend/tools/lms_schools.py --url $API --batch-token "$TOKEN" \
    --add canvas https://maplehigh.instructure.com --name "Maple High"           # prompts for ID and secret
python backend/tools/lms_schools.py --url $API --batch-token "$TOKEN" \
    --decline canvas https://maplehigh.instructure.com                           # turns it off, disconnects teachers
```

The secret is typed at a hidden prompt, never on the command line.

## Testing it ourselves

- **Canvas:** Instructure's free teacher accounts at `canvas.instructure.com` cannot make
  developer keys (no admin). Options: a trial or partner sandbox from Instructure, or a
  school that agrees to pilot. Once a site is set up, test with a teacher and a student
  account there.
- **Brightspace:** D2L gives partner developers a sandbox through its developer/partner
  programme. A pilot school also works.

## Not done yet

- Students do not see their Canvas or Brightspace assignments in Quark (Google Classroom
  has this); only teachers import.
- Microsoft Teams for Education is in the same code but uses one app-wide registration
  (`MICROSOFT_OAUTH_CLIENT_ID`/`SECRET`) and has not been tried against a real tenant.
- LTI 1.3 (launching Quark from inside Canvas or Brightspace) is not built. OAuth is the
  lighter first step; LTI is what large districts usually ask for next.
