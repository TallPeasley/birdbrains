const DEFAULT_API_URL = 'https://birdbrains-api-28737473918.northamerica-northeast1.run.app';
const DEFAULT_SITE_URL = 'https://birdbrain-514606.web.app';
const MAX_BYTES = 12 * 1024 * 1024;
const MIN_SHORT_EDGE = 1080;
const BLURRY_BELOW = 60;

const state = {
  apiUrl: DEFAULT_API_URL,
  siteUrl: DEFAULT_SITE_URL,
  firebaseKey: '',
  token: null,
  profile: null,
  demo: false,
  blob: null,
  sharpnessScore: 80,
};

const $ = (id) => document.getElementById(id);

function show(el, visible) {
  el.classList.toggle('hidden', !visible);
}

async function loadConfig() {
  const stored = await chrome.storage.local.get(['apiUrl', 'siteUrl', 'firebaseKey', 'token', 'profile', 'demo']);
  state.apiUrl = (stored.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
  state.siteUrl = (stored.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
  state.firebaseKey = stored.firebaseKey || '';
  state.token = stored.token || null;
  state.profile = stored.profile || null;
  state.demo = Boolean(stored.demo);

  $('cfg-api-url').value = state.apiUrl;
  $('cfg-site-url').value = state.siteUrl;
  $('cfg-firebase-key').value = state.firebaseKey;
}

function renderAuth() {
  const signedIn = Boolean(state.profile && (state.token || state.demo));
  show($('auth-view'), !signedIn);
  show($('capture-view'), signedIn);

  if (signedIn) {
    $('user-name').textContent = state.profile.name || 'Student';
    const plan = state.demo ? 'demo' : state.profile.plan || 'free';
    const badge = $('user-plan');
    badge.textContent = plan;
    badge.classList.toggle('pro', plan === 'pro');
    $('student-id-input').value = state.profile.studentId || state.profile.childStudentIds?.[0] || 'stu_demo_001';
    if (state.profile.course) {
      $('course-select').value = state.profile.course;
    }
  }
}

async function apiJson(path, opts = {}) {
  const res = await fetch(`${state.apiUrl}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${state.token}`,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // ignore non-JSON body
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function computeSharpness(img) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const resolutionOk = Math.min(width, height) >= MIN_SHORT_EDGE;

  const scale = Math.min(1, 800 / Math.max(width, height));
  const w = Math.max(3, Math.round(width * scale));
  const h = Math.max(3, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const grey = new Float32Array(w * h);
  for (let i = 0, p = 0; i < grey.length; i++, p += 4) {
    grey[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = grey[i - w] + grey[i + w] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = n ? sum / n : 0;
  const variance = n ? sumSq / n - mean * mean : 0;
  const score = Math.round(Math.min(100, Math.max(0, (Math.log10(Math.max(variance, 1)) / Math.log10(1000)) * 100)));

  return { width, height, resolutionOk, variance: Math.round(variance), score, passed: resolutionOk && variance >= BLURRY_BELOW };
}

function handleBlob(blob) {
  if (blob.size > MAX_BYTES) {
    setStatus('error', 'File too large', 'Please choose a photo under 12 MB.');
    return;
  }
  state.blob = blob;
  const url = URL.createObjectURL(blob);
  const img = $('preview-img');
  img.onload = () => {
    const q = computeSharpness(img);
    state.sharpnessScore = q.score;
    const pill = $('quality-badge');
    pill.classList.remove('ok', 'warn');
    if (q.passed) {
      pill.classList.add('ok');
      pill.textContent = `Ready (${q.width}×${q.height} · Sharpness ${q.score}/100)`;
    } else if (!q.resolutionOk) {
      pill.classList.add('warn');
      pill.textContent = `Low resolution (${q.width}×${q.height}). At least 1080p recommended.`;
    } else {
      pill.classList.add('warn');
      pill.textContent = `Looks slightly blurry (score ${q.score}/100). Try a clearer capture.`;
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
  show($('preview-card'), true);
  show($('status-card'), false);
}

function setStatus(mode, title, detail) {
  show($('status-card'), true);
  const dot = $('status-dot');
  dot.classList.remove('done', 'error');
  if (mode === 'done') dot.classList.add('done');
  if (mode === 'error') dot.classList.add('error');
  $('status-title').textContent = title;
  $('status-detail').textContent = detail;
  show($('result-actions'), mode === 'done');
  show($('upgrade-actions'), mode === 'upgrade');
}

async function pollUntilGraded(submissionId) {
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const sub = await apiJson(`/submissions/${submissionId}`);
    if (sub.status === 'GRADED' || sub.status === 'NEEDS_RETAKE' || sub.status === 'FAILED') {
      return sub;
    }
  }
  return null;
}

async function runUpload() {
  if (!state.blob) return;
  const studentId = $('student-id-input').value.trim();
  const course = $('course-select').value;
  const unitTopic = $('topic-input').value.trim() || 'General Math Practice';

  $('upload-btn').disabled = true;
  try {
    if (state.demo) {
      setStatus('working', 'Uploading (Demo)…', 'Creating one-time upload ticket…');
      await new Promise((r) => setTimeout(r, 500));
      setStatus('working', 'Diagnosing (Demo)…', 'Running 4-pillar error analysis…');
      await new Promise((r) => setTimeout(r, 700));
      $('result-link').href = `${state.siteUrl}/student`;
      setStatus('done', 'Diagnostic Ready!', 'Demo submission graded. Open BirdBrains to view step-by-step feedback.');
      return;
    }

    setStatus('working', 'Requesting upload link…', 'Checking monthly allowance and preparing upload ticket.');
    const ticket = await apiJson('/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        course,
        unitTopic,
        sharpnessScore: state.sharpnessScore,
      }),
    });

    setStatus('working', 'Uploading image…', 'Sending page securely to BirdBrains (names are automatically blurred).');
    const putRes = await fetch(`${state.apiUrl}${ticket.uploadUrl}`, {
      method: ticket.method || 'PUT',
      headers: { 'Content-Type': state.blob.type || 'image/png' },
      body: state.blob,
    });
    if (!putRes.ok) {
      let detail = putRes.statusText;
      try {
        const b = await putRes.json();
        if (b.detail) detail = b.detail;
      } catch {
        // ignore
      }
      const err = new Error(detail);
      err.status = putRes.status;
      throw err;
    }
    const submission = await putRes.json();

    setStatus('working', 'Diagnosing work…', 'Checking steps against the 4-pillar taxonomy.');
    const processed = await apiJson(`/submissions/${submission.submissionId}/process`, { method: 'POST' });

    let finalSub = processed.submission;
    if (finalSub.status !== 'GRADED' && finalSub.status !== 'NEEDS_RETAKE' && finalSub.status !== 'FAILED') {
      const polled = await pollUntilGraded(submission.submissionId);
      if (polled) finalSub = polled;
    }

    if (finalSub.status === 'NEEDS_RETAKE') {
      setStatus('error', 'Photo needs a retake', 'Please capture a sharper, well-lit view of the full page.');
      return;
    }
    if (finalSub.status === 'FAILED') {
      setStatus('error', 'Diagnosis failed', 'Something went wrong while grading. Please try again.');
      return;
    }

    $('result-link').href = `${state.siteUrl}/student?submission=${encodeURIComponent(finalSub.submissionId)}`;
    setStatus('done', 'Diagnostic Ready!', `Submission ${finalSub.submissionId} is graded.`);
  } catch (err) {
    if (err.status === 402) {
      $('upgrade-link').href = `${state.siteUrl}/plans`;
      setStatus('upgrade', 'Free monthly limit reached', err.message || 'Upgrade to Pro for unlimited uploads.');
    } else if (err.status === 409) {
      setStatus('error', 'Duplicate photo', 'This exact photo was already uploaded earlier.');
    } else if (err.status === 410) {
      setStatus('error', 'Upload link expired', 'Please click Diagnose Work again to get a fresh link.');
    } else {
      setStatus('error', 'Upload failed', err.message || 'Could not reach BirdBrains.');
    }
  } finally {
    $('upload-btn').disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  renderAuth();

  $('settings-toggle').addEventListener('click', () => {
    show($('settings-panel'), $('settings-panel').classList.contains('hidden'));
  });

  $('cfg-save').addEventListener('click', async () => {
    state.apiUrl = ($('cfg-api-url').value.trim() || DEFAULT_API_URL).replace(/\/$/, '');
    state.siteUrl = ($('cfg-site-url').value.trim() || DEFAULT_SITE_URL).replace(/\/$/, '');
    state.firebaseKey = $('cfg-firebase-key').value.trim();
    await chrome.storage.local.set({
      apiUrl: state.apiUrl,
      siteUrl: state.siteUrl,
      firebaseKey: state.firebaseKey,
    });
    show($('settings-panel'), false);
  });

  $('cfg-reset').addEventListener('click', async () => {
    state.apiUrl = DEFAULT_API_URL;
    state.siteUrl = DEFAULT_SITE_URL;
    state.firebaseKey = '';
    $('cfg-api-url').value = DEFAULT_API_URL;
    $('cfg-site-url').value = DEFAULT_SITE_URL;
    $('cfg-firebase-key').value = '';
    await chrome.storage.local.set({ apiUrl: DEFAULT_API_URL, siteUrl: DEFAULT_SITE_URL, firebaseKey: '' });
  });

  $('demo-btn').addEventListener('click', async () => {
    state.demo = true;
    state.token = null;
    state.profile = { name: 'Alex Mercer (Demo)', studentId: 'stu_zvd02PynvXEK', course: 'MPM2D', plan: 'free' };
    await chrome.storage.local.set({ demo: true, token: null, profile: state.profile });
    renderAuth();
  });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    show($('auth-error'), false);
    const email = $('login-email').value.trim();
    const password = $('login-password').value;

    if (!state.firebaseKey) {
      $('auth-error').textContent = 'Add your Firebase Web API Key in ⚙ Settings, or click Try Demo Mode.';
      show($('auth-error'), true);
      return;
    }

    $('login-btn').disabled = true;
    try {
      const fbRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(state.firebaseKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      const fbData = await fbRes.json();
      if (!fbRes.ok) {
        throw new Error(fbData.error?.message || 'Sign-in failed');
      }
      state.token = fbData.idToken;
      state.demo = false;
      state.profile = await apiJson('/me');
      await chrome.storage.local.set({ token: state.token, profile: state.profile, demo: false });
      renderAuth();
    } catch (err) {
      $('auth-error').textContent = err.message || 'Sign-in failed';
      show($('auth-error'), true);
    } finally {
      $('login-btn').disabled = false;
    }
  });

  $('signout-btn').addEventListener('click', async () => {
    state.token = null;
    state.profile = null;
    state.demo = false;
    state.blob = null;
    await chrome.storage.local.remove(['token', 'profile', 'demo']);
    show($('preview-card'), false);
    show($('status-card'), false);
    renderAuth();
  });

  $('capture-tab-btn').addEventListener('click', async () => {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      handleBlob(blob);
    } catch (err) {
      setStatus('error', 'Capture failed', err.message || 'Could not capture the active tab.');
    }
  });

  $('file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleBlob(file);
  });

  $('upload-btn').addEventListener('click', runUpload);

  $('reset-btn').addEventListener('click', () => {
    state.blob = null;
    show($('preview-card'), false);
    show($('status-card'), false);
  });
});
