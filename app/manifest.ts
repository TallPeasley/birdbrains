import type { MetadataRoute } from 'next';

// Web app manifest: lets phones and Chrome install Quark as an app ("Add to Home Screen").
// Built into out/manifest.webmanifest by the static export.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Quark',
    short_name: 'Quark',
    description: 'Four-pillar math diagnostics for students and parents.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc', // slate-50, the page background
    theme_color: '#4f46e5', // indigo-600, the logo tile
    categories: ['education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Upload work', short_name: 'Upload', url: '/student?capture=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Parent dashboard', short_name: 'Parent', url: '/parent', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
