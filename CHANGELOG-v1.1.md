# Bicara PECS — Changelog v1.1

## Perubahan
- Memisahkan CSS inline dari `index.html` ke `css/app.css`.
- Memisahkan JavaScript aplikasi ke `js/app.js`.
- Mempertahankan JavaScript sebagai classic script (bukan ES module) agar fungsi global dan inline event handler lama tetap kompatibel.
- Memperbarui cache PWA dari `bicara-pecs-v19` menjadi `bicara-pecs-v20`.
- Menambahkan CSS dan JS eksternal ke App Shell Service Worker.
- Mempertahankan manifest, ikon, CNAME, serta semua markup dan fungsi aplikasi lainnya.

## Sengaja belum diubah
- Belum ada migrasi LocalStorage ke IndexedDB.
- Belum ada backend, autentikasi, atau sistem lisensi.
- Belum ada perubahan UI/UX maupun perilaku fitur.

## Catatan keamanan
JavaScript tetap menggunakan pola global lama agar kompatibel. CSP masih mengizinkan inline script karena HTML saat ini memiliki inline event handler. Penguatan CSP harus dilakukan setelah handler dipindahkan secara bertahap dan diuji.
