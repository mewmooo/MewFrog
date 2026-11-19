import React from 'react';

/**
 * Memasang kelas `dark` pada <html> sebelum paint pertama.
 *
 * Skrip ini harus sinkron dan berada di <head>. Kalau dijalankan setelah body
 * digambar, pengguna melihat halaman terang sekejap lalu berkedip gelap.
 */
export default function ThemeScript() {
  const script = `
(function(){
  try {
    var stored = localStorage.getItem('mewbot-theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (stored === 'light') {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
