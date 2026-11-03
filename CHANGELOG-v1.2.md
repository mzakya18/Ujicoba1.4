# Bicara PECS v1.2 — FASE 2

- Menambahkan lapisan IndexedDB (`js/database.js`).
- Memigrasikan `pecs_custom_images` dari LocalStorage ke IndexedDB dengan verifikasi sebelum salinan lama dihapus.
- Menjaga LocalStorage sebagai fallback bila IndexedDB tidak tersedia/gagal.
- Backup JSON sekarang menyertakan data gambar dari IndexedDB; restore memasukkannya kembali ke IndexedDB.
- Reset aplikasi juga meminta penghapusan IndexedDB.
- Cache Service Worker dinaikkan ke v21.

Catatan: data lain (preferensi, kartu, label, riwayat, dan cache ARASAAC) masih menggunakan LocalStorage pada tahap ini. Migrasi dilakukan bertahap agar risiko kehilangan data rendah.
