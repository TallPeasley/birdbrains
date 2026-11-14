'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, IS_LIVE } from '@/lib/api';
import type { GradeCourse, UserProfile } from '@/types/birdBrains';

/**
 * Sign-in state.
 *
 * - Demo (no NEXT_PUBLIC_API_URL): nobody signs in, pages show the mock data.
 * - Live: Firebase email/password. The ID token is sent to the API on every call.
 * - NEXT_PUBLIC_AUTH_MODE=dev: for a locally running backend with BIRDBRAINS_AUTH=dev.
 *   Any email signs in, no password check. Never set this on a deployed site.
 */
const DEV_AUTH = process.env.NEXT_PUBLIC_AUTH_MODE === 'dev';
const DEV_KEY = 'birdbrains.devUid';
const DEMO_KEY = 'birdbrains.demo';

function readDemoFlag(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('demo') === '1') return true;
    return window.sessionStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

export interface NewProfile {
  role: 'student' | 'parent';
  name: string;
  course?: GradeCourse;
}

interface SessionValue {
  /** True when this visitor uses the real API (a live build, not in demo mode). */
  live: boolean;
  /** Demo mode: sample data on a live build. Always true on a build with no API URL. */
  demo: boolean;
  setDemo: (on: boolean) => void;
  /** False until the first sign-in check has finished. */
  ready: boolean;
  signedIn: boolean;
  /** Null when signed out, or signed in but the profile has not been created yet. */
  profile: UserProfile | null;
  /** The student whose data the dashboards show: yourself, or the selected child. */
  activeStudentId: string | null;
  setActiveStudentId: (id: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: NewProfile) => Promise<void>;
  createProfile: (profile: NewProfile) => Promise<void>;
  linkChild: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string>;
  /** Bumped after an upload finishes so dashboards refetch. */
  dataVersion: number;
  bumpData: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

async function firebaseAuth() {
  const [{ initializeApp, getApps }, auth] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  return { auth, instance: auth.getAuth(app) };
}

function friendlyAuthError(err: unknown): Error {
  const code = (err as { code?: string }).code ?? '';
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return new Error('Email or password is incorrect.');
  if (/email-already-in-use/.test(code)) return new Error('An account with that email already exists. Sign in instead.');
  if (/weak-password/.test(code)) return new Error('Choose a password with at least 6 characters.');
  if (/invalid-email/.test(code)) return new Error('That email address does not look right.');
  if (/too-many-requests/.test(code)) return new Error('Too many attempts. Wait a minute and try again.');
  return err instanceof Error ? err : new Error('Sign-in failed.');
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!IS_LIVE);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [demoOn, setDemoOn] = useState(false);
  const devUid = useRef<string | null>(null);

  const getToken = useCallback(async () => {
    if (DEV_AUTH) {
      if (!devUid.current) throw new ApiError(401, 'Sign in required');
      return `dev:${devUid.current}`;
    }
    const { instance } = await firebaseAuth();
    if (!instance.currentUser) throw new ApiError(401, 'Sign in required');
    return instance.currentUser.getIdToken();
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api.me(await getToken()));
    } catch (err) {
      // 403 = signed in, but no profile yet: the home page asks for the details.
      if (err instanceof ApiError && err.status === 403) setProfile(null);
      else throw err;
    }
  }, [getToken]);

  useEffect(() => {
    if (IS_LIVE && readDemoFlag()) setDemoOn(true);
  }, []);

  const setDemo = useCallback((on: boolean) => {
    setDemoOn(on);
    try {
      if (on) window.sessionStorage.setItem(DEMO_KEY, '1');
      else window.sessionStorage.removeItem(DEMO_KEY);
    } catch {
      /* storage blocked: demo lasts until reload */
    }
  }, []);

  useEffect(() => {
    if (!IS_LIVE) return;
    let unsubscribe = () => {};
    let cancelled = false;
    const settle = async (isSignedIn: boolean) => {
      if (cancelled) return;
      setSignedIn(isSignedIn);
      if (isSignedIn) await loadProfile().catch(() => setProfile(null));
      else setProfile(null);
      if (!cancelled) setReady(true);
    };
    if (DEV_AUTH) {
      devUid.current = window.localStorage.getItem(DEV_KEY);
      void settle(devUid.current !== null);
    } else {
      firebaseAuth()
        .then(({ auth, instance }) => {
          unsubscribe = auth.onAuthStateChanged(instance, (user) => void settle(user !== null));
        })
        .catch(() => setReady(true));
    }
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<SessionValue>(() => {
    const devSignIn = (email: string) => {
      devUid.current = email.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64);
      window.localStorage.setItem(DEV_KEY, devUid.current);
      setSignedIn(true);
    };
    const createProfile = async (p: NewProfile) => {
      setProfile(await api.register(await getToken(), p));
    };
    return {
      live: IS_LIVE && !demoOn,
      demo: !IS_LIVE || demoOn,
      setDemo,
      ready: ready || demoOn,
      signedIn,
      profile,
      activeStudentId: profile
        ? profile.role === 'student'
          ? (profile.studentId ?? null)
          : selectedChild && profile.childStudentIds.includes(selectedChild)
            ? selectedChild
            : (profile.childStudentIds[0] ?? null)
        : null,
      setActiveStudentId: setSelectedChild,
      signIn: async (email, password) => {
        if (DEV_AUTH) devSignIn(email);
        else {
          const { auth, instance } = await firebaseAuth();
          await auth.signInWithEmailAndPassword(instance, email, password).catch((e) => {
            throw friendlyAuthError(e);
          });
          setSignedIn(true);
        }
        await loadProfile();
      },
      signUp: async (email, password, p) => {
        if (DEV_AUTH) devSignIn(email);
        else {
          const { auth, instance } = await firebaseAuth();
          await auth.createUserWithEmailAndPassword(instance, email, password).catch((e) => {
            throw friendlyAuthError(e);
          });
          setSignedIn(true);
        }
        await createProfile(p);
      },
      createProfile,
      linkChild: async (code) => {
        setProfile(await api.linkChild(await getToken(), code));
      },
      signOut: async () => {
        if (DEV_AUTH) {
          devUid.current = null;
          window.localStorage.removeItem(DEV_KEY);
        } else {
          const { auth, instance } = await firebaseAuth();
          await auth.signOut(instance);
        }
        setSignedIn(false);
        setProfile(null);
      },
      getToken,
      dataVersion,
      bumpData: () => setDataVersion((v) => v + 1),
    };
  }, [ready, signedIn, profile, selectedChild, dataVersion, getToken, loadProfile, demoOn, setDemo]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
