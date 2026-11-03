# Bicara PECS — Changelog v1.4

Hasil dari audit stabilitas v1.3 (lihat AUDIT-STABILITAS.md).

## Perbaikan
1. **Label kartu tidak terpotong di HP** (P1). Di layar lebar ≤ 600 px, kartu menyesuaikan tinggi isinya (tidak lagi dipaksa kotak). Sebelumnya 53 dari 54 kartu terpotong pada layar 390 px. Desktop tidak berubah.
2. **Reset pengaturan hanya menghapus data Bicara PECS** (`pecs_*`). Sebelumnya seluruh LocalStorage domain ikut terhapus (P1, regresi).
3. **Cetak kartu di aplikasi terpasang** memakai dokumen cetak terpisah (A4, 4 kolom), bukan dialog cetak di dalam aplikasi (P1, regresi dari tahap 9).
4. **Subjek dan Predikat tampil di level 1** agar kalimat dasar bisa dibuat secara default (keputusan atas C1 di audit; dapat dikembalikan dengan mengubah `minLevel` di `js/app.js`).
5. **ID ganda `placeholder-text`** dihilangkan dari salinan dinamis (P3).
6. Cache service worker naik ke v23.

## Pengujian
- Regresi otomatis: 34 skenario, 32 lulus (termasuk M1: 0 dari 79 kartu terpotong; L1: reset aman; D1 mobile lulus).
- Restore file rusak dan gambar rusak: data tidak berubah (diuji terpisah).
- Cetak di aplikasi terpasang: dialog cetak tidak dipanggil, dokumen cetak terbuka.
- **Belum diuji:** gulir di iPhone aplikasi terpasang, cetak PDF di HP, gambar ARASAAC (tidak ada internet), pengingat tanggal 1.

## Tidak diubah
Communication Board, Sentence Builder, TTS, riwayat, PIN dan penguncian, backup/restore, Generator, PWA, penyimpanan offline, Glass Theme.
