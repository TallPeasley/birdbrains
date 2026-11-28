// The three ways a student can send work to Quark from the student portal.
//
//   WORKSHEET_PHOTO  photos of handwritten work, graded now (POST /submissions)
//   SLIDES_DECK      a teacher's slides or a PDF booklet, turned into practice
//   TEXTBOOK_ASSIST  textbook pages or screenshots, for step-by-step hints
//
// Photos go to POST /submissions; slides and textbook pages to POST /submissions/batch.
// A batch is limited to 30 MB in all (Cloud Run caps a request at 32 MiB).
import type { UploadMode } from '@/types/birdBrains';

export type { UploadMode };

export const UPLOAD_MODE_ORDER: UploadMode[] = ['WORKSHEET_PHOTO', 'SLIDES_DECK', 'TEXTBOOK_ASSIST'];

export interface UploadModeConfig {
  /** Card and window title. */
  title: string;
  /** Short tab label inside the upload window. */
  tab: string;
  /** One line on the portal card. */
  blurb: string;
  /** What to upload, shown under the drop area. */
  subtitle: string;
  /** For the file picker's accept attribute. */
  accept: string;
  /** Extensions and MIME types the window accepts (checked on add). */
  allowed: { mimes: string[]; extensions: string[] };
  maxFiles: number;
  maxFileBytes: number;
  /** All files together, in bytes (one request). */
  maxTotalBytes: number;
  /** Photos of handwriting get the sharpness and 1080p check from lib/imageQuality.ts;
   *  digital slides, PDFs and screenshots do not. */
  runBlurCheck: boolean;
  ctaLabel: string;
  topicPlaceholder: string;
  /** True when the live API can take this mode. */
  liveReady: boolean;
}

const IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const UPLOAD_MODES: Record<UploadMode, UploadModeConfig> = {
  WORKSHEET_PHOTO: {
    title: 'Grade Worksheet Photo',
    tab: 'Photo',
    blurb: 'Snap your handwritten work and see why each step went right or wrong.',
    subtitle: 'JPEG, PNG or WebP photos of handwritten work, at least 1080p, up to 6 pages (12 MB each).',
    accept: 'image/jpeg,image/png,image/webp,image/*',
    allowed: { mimes: IMAGES, extensions: ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 6,
    maxFileBytes: 12 * 1024 * 1024,
    maxTotalBytes: 6 * 12 * 1024 * 1024,
    runBlurCheck: true,
    ctaLabel: 'Submit for diagnosis',
    topicPlaceholder: 'e.g. Completing the square',
    liveReady: true,
  },
  SLIDES_DECK: {
    title: 'Generate from Slides',
    tab: 'Slides / PDF',
    blurb: 'Turn your teacher’s slides or a PDF booklet into practice problems.',
    subtitle: 'PowerPoint (.pptx), PDF booklets or long screenshots, up to 25 files (30 MB in total).',
    accept: `.pptx,.pdf,${PPTX},application/pdf,image/png,image/jpeg,image/webp`,
    allowed: { mimes: [PPTX, 'application/pdf', ...IMAGES], extensions: ['.pptx', '.pdf', '.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 25,
    maxFileBytes: 25 * 1024 * 1024,
    maxTotalBytes: 30 * 1024 * 1024,
    runBlurCheck: false,
    ctaLabel: 'Upload slides and make practice',
    topicPlaceholder: 'e.g. Unit 6 · Expressions and equations',
    liveReady: true,
  },
  TEXTBOOK_ASSIST: {
    title: 'Assist Textbook',
    tab: 'Textbook',
    blurb: 'Send textbook pages or screenshots and get step-by-step hints.',
    subtitle: 'Textbook pages as PDF or screenshots, up to 10 files (30 MB in total).',
    accept: '.pdf,application/pdf,image/png,image/jpeg,image/webp',
    allowed: { mimes: ['application/pdf', ...IMAGES], extensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 10,
    maxFileBytes: 25 * 1024 * 1024,
    maxTotalBytes: 30 * 1024 * 1024,
    runBlurCheck: false,
    ctaLabel: 'Upload for textbook hints',
    topicPlaceholder: 'e.g. Chapter 4 · Linear systems',
    liveReady: true,
  },
};

/** Whether a file is one this mode takes (by MIME type, or extension when the browser gives none). */
export function acceptsFile(mode: UploadMode, file: File): boolean {
  const { mimes, extensions } = UPLOAD_MODES[mode].allowed;
  if (file.type && mimes.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return extensions.some((ext) => name.endsWith(ext));
}
