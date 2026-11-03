# Bicara PECS — Audit & Implementasi Hybrid v1

## Ringkasan
Proyek awal adalah PWA front-end statis dengan satu `index.html` besar, `manifest.json`, `sw.js`, ikon, dan CNAME. Tidak ditemukan backend atau sistem akun/server.

## Fitur lama yang dipertahankan
- Papan komunikasi dan strip penyusunan kalimat
- Text-to-speech
- Database kosakata bawaan dan kategori
- Kartu kustom, edit label, dan penggantian gambar
- Pencarian piktogram ARASAAC
- Mode edit, mode gambar saja, dan penguncian anak/PIN
- Tema terang/gelap dan Glass Theme
- Riwayat penggunaan kata
- Pengaturan tingkat kosakata
- Backup dan restore JSON
- PWA/service worker

## Implementasi pada versi ini
1. Menambahkan menu **Generator Kartu & PDF**.
2. Menambahkan halaman generator terpisah agar alur papan utama tidak berubah.
3. Generator membaca kosakata bawaan, label/gambar kustom, serta kartu buatan pengguna.
4. Pengguna dapat memfilter kategori, memilih kartu, memilih ukuran, lalu mencetak atau menyimpan PDF melalui dialog cetak browser.
5. Data generator hanya menggunakan data yang sudah ada; tidak membuat backend atau mengirim data anak ke server.
6. Versi cache service worker dinaikkan dari v18 ke v19 agar pembaruan PWA dapat dimuat.
7. Memperbaiki reset agar hanya menghapus key milik Bicara PECS (`pecs_*`), bukan seluruh LocalStorage pada origin yang sama.

## Temuan teknis dan risiko yang masih perlu ditangani
- `index.html` masih monolitik. Pemisahan modul CSS/JS perlu dilakukan bertahap pada iterasi berikutnya, dengan pengujian regresi.
- LocalStorage memiliki kapasitas terbatas, terutama karena gambar kustom dapat disimpan sebagai data URL. Rencana berikutnya: IndexedDB untuk aset gambar.
- Pencarian ARASAAC memerlukan koneksi saat data belum tersedia di cache.
- PIN berbasis penyimpanan browser bukan pengamanan setara autentikasi/server; jangan menyimpan informasi sensitif anak.
- Backup JSON perlu diperlakukan sebagai file privat karena dapat memuat gambar dan pengaturan lokal.
- Label tahap kemampuan saat ini sebaiknya dipahami sebagai pengaturan kosakata aplikasi, bukan hasil asesmen atau diagnosis klinis.
- Materi kartu visual/AAC tidak otomatis sama dengan penerapan protokol PECS formal.

## Validasi yang dilakukan
- JavaScript inline diperiksa menggunakan `node --check` dan lolos tanpa syntax error.
- Struktur proyek dan file PWA dipertahankan.
- Pengujian interaksi lintas perangkat dan cetak fisik masih perlu dilakukan di browser Android/iOS/desktop.

## Cara uji manual
1. Buka aplikasi dan pastikan papan utama, susun kalimat, bicara, edit kartu, riwayat, tema, PIN, backup/restore tetap berfungsi.
2. Buka Menu > Generator Kartu & PDF.
3. Pilih kategori dan beberapa kartu, termasuk kartu kustom.
4. Tekan Cetak/Simpan PDF, lalu pilih Save as PDF.
5. Periksa hasil A4: gambar, tulisan, batas kartu, dan pemenggalan halaman.
6. Uji offline setelah aplikasi pernah dibuka online.

## Tahap berikutnya yang disarankan
- Pisahkan kode menjadi `css/app.css`, `js/data.js`, `js/storage.js`, `js/app.js`, dan `js/generator.js` tanpa mengubah API fungsi global yang dipakai HTML.
- Tambahkan template First-Then dan Choice Board.
- Migrasikan penyimpanan gambar kustom ke IndexedDB.
- Tambahkan pengujian regresi sebelum merilis setiap versi.


## FASE 2 — perubahan v1.2
- IndexedDB ditambahkan untuk gambar kartu kustom.
- Migrasi menyalin, membaca ulang, membandingkan, baru menghapus LocalStorage lama.
- Backup/restore mendukung penyimpanan gambar IndexedDB.
- Data lain tetap di LocalStorage sampai tahap migrasi berikutnya.
