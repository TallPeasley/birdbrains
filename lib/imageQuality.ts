export const MIN_SHORT_EDGE = 1080; // "1080p" = shorter side at least 1080px

export type QualityTier = 'EXCELLENT' | 'ACCEPTABLE' | 'TOO_BLURRY';

export interface ImageQualityResult {
  width: number;
  height: number;
  resolutionOk: boolean;
  laplacianVariance: number;
  sharpnessScore: number; // 0..100
  tier: QualityTier;
  passed: boolean;
}

// Variance thresholds on a downscaled greyscale image. Tuned for phone photos of
// handwritten work; adjust once real samples are available.
const BLURRY_BELOW = 60;
const EXCELLENT_ABOVE = 250;
const ANALYSIS_LONG_EDGE = 800;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name} as an image`));
    };
    img.src = url;
  });
}

/**
 * Computes the variance of the Laplacian (3x3 kernel 0,1,0 / 1,-4,1 / 0,1,0)
 * over a greyscale, downscaled copy of the image. Low variance = few sharp edges = blur.
 */
export function laplacianVariance(data: Uint8ClampedArray, w: number, h: number): number {
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
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function varianceToScore(variance: number): number {
  // Log-scale mapping so the score spreads usefully across typical photo values.
  const score = (Math.log10(Math.max(variance, 1)) / Math.log10(1000)) * 100;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export async function analyzeImage(file: File): Promise<ImageQualityResult> {
  const img = await loadImage(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const resolutionOk = Math.min(width, height) >= MIN_SHORT_EDGE;

  const scale = Math.min(1, ANALYSIS_LONG_EDGE / Math.max(width, height));
  const w = Math.max(3, Math.round(width * scale));
  const h = Math.max(3, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, w, h);
  const variance = laplacianVariance(ctx.getImageData(0, 0, w, h).data, w, h);

  const tier: QualityTier =
    variance < BLURRY_BELOW ? 'TOO_BLURRY' : variance > EXCELLENT_ABOVE ? 'EXCELLENT' : 'ACCEPTABLE';

  return {
    width,
    height,
    resolutionOk,
    laplacianVariance: Math.round(variance),
    sharpnessScore: varianceToScore(variance),
    tier,
    passed: resolutionOk && tier !== 'TOO_BLURRY',
  };
}
