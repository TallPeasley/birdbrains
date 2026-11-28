// Where a visitor came from: the link's UTM tags and ?ref= invite code, the host of
// the page that linked here, the landing page, and which ad click ids were present
// (never their values). See backend/birdbrains/attribution.py.
//
// Cookies are only written after the visitor allows them in the cookie banner:
//   quark_consent  the choice itself ("granted" / "denied"), 1 year
//   quark_vid      a random visitor id, for counting one visit a day, 1 year
//   quark_ft       the first touch, 90 days, never overwritten
//   quark_lt       the latest touch that carried a link tag or outside referrer, 90 days
// Without consent the touch from this visit is kept in memory only, so an account made
// in the same visit can still say which link it came from, and nothing is stored on
// the device.
import { api, IS_LIVE } from '@/lib/api';

export interface TouchPoint {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  ref?: string;
  referrerHost?: string;
  landingPath?: string;
  clickIds?: string[];
  at?: string;
}

export type Consent = 'granted' | 'denied' | null;

const CONSENT = 'quark_consent';
const VISITOR = 'quark_vid';
const FIRST = 'quark_ft';
const LAST = 'quark_lt';
const YEAR = 365 * 24 * 3600;
const NINETY_DAYS = 90 * 24 * 3600;
const CLICK_IDS = ['gclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id'];
const OWN_HOSTS = ['quark.study', 'boson-quark.web.app', 'boson-quark.firebaseapp.com', 'localhost'];
export const CONSENT_EVENT = 'quark-consent-change';

let memoryTouch: TouchPoint | null = null;
let visitSent = false;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function clean(v: string | null, max: number, pattern?: RegExp): string | undefined {
  if (!v) return undefined;
  const t = v.trim().slice(0, max);
  if (!t || (pattern && !pattern.test(t))) return undefined;
  return t;
}

/** The touch for the page as loaded now (UTM tags, ?ref=, referrer host, path). */
export function currentTouch(): TouchPoint {
  const params = new URLSearchParams(location.search);
  let referrerHost: string | undefined;
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    if (host && !OWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) referrerHost = host.slice(0, 120);
  } catch {
    referrerHost = undefined;
  }
  const touch: TouchPoint = {
    source: clean(params.get('utm_source'), 100),
    medium: clean(params.get('utm_medium'), 100),
    campaign: clean(params.get('utm_campaign'), 150),
    content: clean(params.get('utm_content'), 150),
    term: clean(params.get('utm_term'), 150),
    ref: clean(params.get('ref'), 40, /^[A-Za-z0-9_-]+$/)?.toUpperCase(),
    referrerHost,
    landingPath: location.pathname.slice(0, 200),
    clickIds: CLICK_IDS.filter((k) => params.has(k)),
    at: new Date().toISOString(),
  };
  if (!touch.clickIds?.length) delete touch.clickIds;
  for (const k of Object.keys(touch) as (keyof TouchPoint)[]) if (touch[k] === undefined) delete touch[k];
  return touch;
}

/** True when the touch says something beyond "typed the address" (a tag, code or referrer). */
function hasSignal(t: TouchPoint): boolean {
  return Boolean(t.source || t.medium || t.campaign || t.ref || t.referrerHost || t.clickIds?.length);
}

function parse(raw: string | null): TouchPoint | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TouchPoint;
  } catch {
    return null;
  }
}

export function getConsent(): Consent {
  const v = readCookie(CONSENT);
  return v === 'granted' || v === 'denied' ? v : null;
}

function visitorId(): string {
  let id = readCookie(VISITOR);
  if (!id || !/^v_[A-Za-z0-9]{16}$/.test(id)) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    id = 'v_' + Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }
  writeCookie(VISITOR, id, YEAR);
  return id;
}

/** Save the touch in cookies (consent given) and count one visit for today. */
function persist() {
  if (!memoryTouch) return;
  if (!readCookie(FIRST)) writeCookie(FIRST, JSON.stringify(memoryTouch), NINETY_DAYS);
  if (hasSignal(memoryTouch) || !readCookie(LAST)) writeCookie(LAST, JSON.stringify(memoryTouch), NINETY_DAYS);
  if (IS_LIVE && !visitSent) {
    visitSent = true;
    void api.recordVisit({ visitorId: visitorId(), touch: memoryTouch }).catch(() => undefined);
  } else {
    visitorId();
  }
}

/** Call once per page load (AttributionCapture does). */
export function captureArrival() {
  if (memoryTouch) return;
  memoryTouch = currentTouch();
  if (getConsent() === 'granted') persist();
}

export function setConsent(choice: 'granted' | 'denied') {
  writeCookie(CONSENT, choice, YEAR);
  if (choice === 'granted') persist();
  else [VISITOR, FIRST, LAST].forEach(deleteCookie);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** What to send with a new account: cookies when allowed, else just this visit's touch. */
export function attributionForSignup(): { first?: TouchPoint; last?: TouchPoint } | undefined {
  const first = getConsent() === 'granted' ? parse(readCookie(FIRST)) : null;
  const last = getConsent() === 'granted' ? parse(readCookie(LAST)) : null;
  const now = memoryTouch && hasSignal(memoryTouch) ? memoryTouch : null;
  const out = { first: first ?? now ?? undefined, last: last ?? now ?? undefined };
  return out.first || out.last ? out : undefined;
}
