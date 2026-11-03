# Bicara PECS — Changelog v1.3

## Perbaikan
1. **Gambar kartu baru hilang setelah restart atau restore (BUG 1).**
   Penyebab: saat kartu baru dibuat, gambar hanya disimpan di memori sebagai `imageUrl` pada kartu. Fungsi penyimpanan kartu lalu menghapus `imageUrl` sebelum menulis ke LocalStorage, dan gambar tidak pernah ditulis ke IndexedDB. Akibatnya gambar tampil sampai halaman dimuat ulang, lalu hilang. Backup pun tidak punya gambar untuk disimpan.
   Perbaikan: gambar kartu baru disimpan ke IndexedDB dan diverifikasi sebelum kartu dianggap tersimpan. Jika gagal, perubahan dibatalkan dan pengguna diberi tahu.
2. **Penyimpanan gambar tidak ditunggu (race condition).** `persistCardImage` sekarang `async` dan ditunggu oleh pemanggilnya.
3. **Ekspor backup (versi 3).**
   - Membaca seluruh gambar dari IndexedDB dan menggabungkannya dengan kondisi aplikasi.
   - Memvalidasi setiap gambar. Jika ada yang rusak, ekspor dibatalkan dengan pesan jelas.
   - Menyertakan `counts` (jumlah kartu dan gambar).
4. **Impor backup yang aman.**
   - Memvalidasi JSON, versi, dan isi gambar sebelum data lama disentuh.
   - Menulis gambar ke IndexedDB lalu membacanya kembali untuk verifikasi.
   - Jika ada langkah yang gagal, data lama dikembalikan otomatis (rollback).
   - Kompatibel dengan backup versi 1 dan 2: gambar yang tersimpan di dalam data kartu dipindahkan ke penyimpanan gambar.
5. **Tampilan kartu konsisten (BUG 2).** Gambar memakai kotak 72×72 dengan `object-fit: contain`, sehingga gambar portrait, landscape, dan square tidak terpotong dan tidak mendorong label. Label memiliki tinggi minimum dan selalu terlihat.
6. Cache service worker naik ke v22.

## Tidak diubah
Communication Board, Sentence Builder, TTS, kategori, ARASAAC, tambah/edit/hapus kartu, riwayat, PIN dan penguncian, Card/PDF Generator, PWA, penyimpanan offline.

## Catatan untuk pengguna
Kartu yang dibuat sebelum v1.3 dan backup `BicaraPECS-cadangan-2026-11-03` tidak memiliki gambar tersimpan (gambar sudah hilang sebelum backup dibuat). Kartu tersebut perlu diedit dan gambarnya dipilih ulang sekali.
