# Bicara PECS v1.2 — Panduan Upload

1. Backup repository dan ekspor cadangan dari aplikasi sebelum mengganti file.
2. Ekstrak ZIP ini. Upload seluruh ISI folder ke root repository GitHub Pages, timpa file dengan versi baru.
3. Commit perubahan dan tunggu GitHub Pages selesai deploy.
4. Buka aplikasi dengan internet aktif satu kali agar `database.js` dan Service Worker terbaru terunduh.
5. Buka menu Cadangan & Pulihkan Data dan buat file backup baru.
6. Uji tambah/edit/hapus kartu bergambar, reload aplikasi, tutup-buka browser, backup, dan restore.
7. Jangan hapus data browser atau uninstall aplikasi sebelum uji backup/restore berhasil.

## Perubahan penyimpanan
Gambar kartu kustom (`pecs_custom_images`) dipindahkan ke IndexedDB. Pengaturan, PIN, label, daftar kartu, riwayat, dan cache ARASAAC masih memakai LocalStorage. Ini migrasi bertahap, bukan pemindahan semua data sekaligus.

Jika ada peringatan penyimpanan, jangan reset aplikasi. Ekspor backup dan laporkan teks error.
