import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MewBot Companion',
    short_name: 'MewBot',
    description: 'Private Companion Dashboard untuk MewBot Frog Pet & Love Mail',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fcfbf7',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Kirim Love Mail',
        short_name: 'Love Mail',
        description: 'Tulis pesan manis langsung ke layar MewBot',
        url: '/love-mail',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Message Memories',
        short_name: 'Kenangan',
        description: 'Buka arsip surat yang telah diterima MewBot',
        url: '/memories',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Quick Notes',
        short_name: 'Notes',
        description: 'Kirim template surat kilat',
        url: '/notes',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}

