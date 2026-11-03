# Laporan Audit v1.3

## Penyebab BUG 1 (gambar hilang setelah restore)
Sumber masalah ada di **penyimpanan kartu baru**, bukan di restore:
- `saveCardToStorage` menaruh gambar di `userCards[].imageUrl` dan tidak menulis ke IndexedDB.
- `persistUserCards` menghapus `imageUrl` sebelum menulis LocalStorage.
- Hasilnya gambar hanya ada di memori. Backup yang diunggah (`BicaraPECS-cadangan-2026-11-03`) terbukti: 3 kartu, 0 gambar, tanpa `imageUrl`.
- Restore hanya bisa memulihkan apa yang ada di backup; karena gambar memang tidak pernah tersimpan, restore tidak bisa mengembalikannya.

## Penyebab BUG 2 (ukuran gambar merusak tata letak)
- `.pecs-card .card-custom-img` memiliki `width/height: 68px` dengan `object-fit: cover`, lalu aturan lain menimpanya menjadi `height: auto`.
- Gambar portrait menjadi tinggi dan mendorong label; gambar landscape terpotong dan tampak kecil.
- Label tidak memiliki tinggi minimum, sehingga ukurannya berubah antar kartu.

## File yang berubah
- `js/app.js`: `saveCardToStorage`, `persistCardImage`, `saveEditCard`, `submitNewCustomCard`, `collectBackupData`, `restoreFromFile`.
- `css/app.css`: blok v1.3 di akhir berkas (gambar dan label kartu).
- `sw.js`: versi cache v22.
- Tidak berubah: `index.html`, `js/database.js`, `manifest.json`, ikon.

## Risiko terhadap fitur lain
- Penyimpanan kartu sekarang menunggu IndexedDB. Jika IndexedDB tidak tersedia, aplikasi memakai LocalStorage sebagai cadangan (perilaku ini sudah ada sebelumnya).
- Restore membaca dan menulis IndexedDB; rollback dijalankan bila gagal.
- Backup versi 3 tidak dapat diimpor oleh aplikasi versi lama yang belum v1.3 bila ada gambar (versi lama membaca `pecs_custom_images` dari LocalStorage). Sebaliknya, aplikasi v1.3 membaca backup versi 1 dan 2.

## Pengujian
- Dilakukan: pemeriksaan sintaks (`node --check`) untuk `js/app.js` dan `js/database.js`, serta simulasi validasi file backup yang diunggah.
- **Belum dilakukan di perangkat.** Daftar uji manual di bawah ini wajib dijalankan sebelum rilis.

### Checklist manual
- [ ] Tambah kartu dengan gambar square, portrait, dan landscape. Label terbaca di semua kartu.
- [ ] Tambah gambar beresolusi besar. Kartu tetap rapi.
- [ ] Refresh browser: gambar kartu baru masih ada.
- [ ] Tutup dan buka kembali aplikasi: gambar masih ada.
- [ ] Ekspor backup. Buka JSON: `counts.images` sama dengan jumlah kartu yang punya gambar.
- [ ] Hapus data pengujian, lalu restore backup: semua gambar kembali dan terhubung ke kartu yang benar.
- [ ] Restore JSON rusak: muncul pesan, data tidak berubah.
- [ ] Restore backup dengan gambar rusak: pemulihan dibatalkan sebelum data disentuh.
- [ ] Restore backup versi 2 (tanpa gambar terpisah): kartu tetap muncul.
- [ ] Edit gambar kartu lalu restart: gambar baru tersimpan.
- [ ] Hapus kartu buatan: gambarnya ikut terhapus dari penyimpanan.
- [ ] Offline setelah dibuka sekali: aplikasi tetap berjalan.
- [ ] Communication Board, Sentence Builder, TTS, PIN, backup/restore, dan Generator berjalan seperti biasa.
