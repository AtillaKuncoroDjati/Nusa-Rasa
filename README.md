# Nusa Rasa

Aplikasi berbagi resep Nusantara dengan desain oleh **Atilla Kuncoro Djati**. Dari menemukan menu rumahan hingga membagikan kreasi sendiri, Nusa Rasa menghubungkan pencinta masakan Indonesia dalam satu dapur digital.

[Lihat desain Figma](https://www.figma.com/design/L2yJLqEXoqZ5mpSdUfSZTI/Nusa-Rasa-Project?node-id=300-442)

## Tampilan dan fitur

Sidebar oranye, kartu foto makanan, dan tipografi Poppins mengikuti arah desain Figma. Navigasi menyesuaikan layar desktop dan HP.

| Halaman            | Yang bisa dilakukan                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Beranda & Jelajahi | Melihat resep, mencari judul/deskripsi, menyaring daerah, mengurutkan resep terbaru atau paling disukai            |
| Detail resep       | Membaca bahan dan langkah, mencentang bahan yang siap, menyukai, menandai, membagikan tautan, dan memberi komentar |
| Unggah resep       | Mengunggah foto, mengisi informasi, bahan, dan cara membuat dalam dua langkah                                      |
| Dapur Saya         | Melihat resep sendiri serta mengedit profil dan foto                                                               |
| Penanda            | Mengumpulkan resep favorit per akun                                                                                |
| Notifikasi         | Melihat pemberitahuan suka dan komentar dari pengguna lain                                                         |
| Akun               | Daftar, masuk, keluar, dan pemulihan kata sandi melalui SMTP bila dikonfigurasi                                    |

Enam resep contoh tersedia untuk mencoba aplikasi. Akun editorial **Dapur Nusa Rasa** tidak memiliki kata sandi dan tidak dapat digunakan untuk masuk. Buat akun sendiri melalui **Daftar**.

## Teknologi

- **Frontend:** React, React Router, Vite, CSS responsif, Lucide, Poppins.
- **Backend:** Node.js dan Express.
- **Database:** MySQL / MariaDB melalui `mysql2`, cocok dengan layanan **MySQL di XAMPP**.
- **Foto:** Multer dan Sharp; berkas disimpan di folder `uploads/`.
- **Email:** Nodemailer untuk tautan pemulihan kata sandi.

XAMPP menyediakan database. Aplikasi dijalankan dengan Node.js, sehingga folder proyek tidak perlu dipindah ke `htdocs`. Apache diperlukan hanya jika ingin membuka phpMyAdmin.

## Jalankan dengan XAMPP

Kebutuhan: **Node.js 24**, npm, dan XAMPP dengan MySQL/MariaDB aktif. Pengujian lokal menggunakan MariaDB 10.4.32 dari XAMPP.

1. Buka XAMPP Control Panel, lalu nyalakan **MySQL**.
2. Buka terminal di folder proyek dan pasang dependensi:

   ```sh
   npm ci
   ```

3. Salin `.env.example` menjadi `.env`. Di PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Sesuaikan koneksi di `.env`:

   ```dotenv
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=nusa_rasa
   DB_USER=root
   DB_PASSWORD=
   PORT=4180
   HOST=127.0.0.1
   APP_ORIGIN=http://127.0.0.1:4180
   ```

   Nilai tersebut mengikuti instalasi XAMPP lokal standar. Jika MySQL kamu menggunakan kata sandi atau port lain, sesuaikan nilainya. `.env` tidak masuk Git.

5. Buat database, tabel, dan resep contoh, lalu jalankan aplikasi:

   ```sh
   npm run db:setup
   npm run dev
   ```

6. Buka **http://127.0.0.1:4180/** dan daftar akun baru.

Gunakan alamat yang sama dengan `APP_ORIGIN`. Jika mengganti host atau port, ubah keduanya. Server memeriksa asal formulir untuk melindungi sesi pengguna.

`db:setup` membuat database bila belum ada, membuat tabel yang belum ada, serta mengisi contoh hanya ketika tabel pengguna kosong. Perintah ini tidak menghapus data yang sudah ada. Perubahan struktur tabel di versi berikutnya memerlukan migrasi tersendiri.

### Melihat database di phpMyAdmin

Nyalakan **Apache** di XAMPP, buka **http://localhost/phpmyadmin/**, lalu pilih database **nusa_rasa**. Tabel pengguna, resep, komentar, penanda, dan lainnya bisa dilihat di sana.

Alternatif penyiapan manual: buat database `nusa_rasa` dengan collation `utf8mb4_unicode_ci`, pilih database tersebut, lalu impor [`database/schema.sql`](database/schema.sql). Jalankan `npm run db:setup` setelahnya bila ingin menambahkan resep contoh.

### Pemulihan kata sandi

Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, serta `MAIL_FROM` di `.env`, kemudian mulai ulang server. Gunakan akun SMTP yang kamu miliki. Jangan masukkan kredensial ke GitHub.

Tanpa SMTP, pendaftaran dan login tetap berfungsi; halaman pemulihan menjelaskan bahwa pengiriman email belum tersedia. Tautan pemulihan berlaku 30 menit, hanya bisa dipakai satu kali, dan membatalkan sesi lama setelah kata sandi diubah.

## Perintah

| Perintah           | Fungsi                                                 |
| ------------------ | ------------------------------------------------------ |
| `npm run db:setup` | Membuat tabel dan mengisi data awal                    |
| `npm run dev`      | Server aplikasi dan frontend dengan pembaruan otomatis |
| `npm test`         | Pengujian integrasi terhadap MySQL yang aktif          |
| `npm run build`    | Menghasilkan frontend siap distribusi di `dist/`       |
| `npm start`        | Menjalankan backend dan hasil build frontend           |

Tes menggunakan database sementara bernama `nusa_rasa_test_<acak>`, lalu membersihkannya. Pengguna database untuk tes harus memiliki izin membuat dan menghapus database sementara. Tes tidak mengosongkan database aplikasi.

## Struktur

```text
database/schema.sql  Struktur database untuk MySQL dan phpMyAdmin
server/              API, autentikasi, koneksi database, dan seed
src/                 Halaman serta komponen React
public/assets/       Foto resep contoh dari desain Figma
tests/               Pengujian integrasi API dan database
uploads/             Foto pengguna; lokal dan tidak masuk Git
.env.example         Contoh konfigurasi tanpa kredensial pribadi
```

Penjelasan relasi data dan alur aplikasi tersedia di [dokumentasi arsitektur](docs/architecture.md). Lihat juga [panduan kontribusi](CONTRIBUTING.md).

## Penyimpanan dan hosting

Data akun dan resep disimpan di MySQL; foto di `uploads/`. Cadangkan keduanya bersama-sama, misalnya ekspor SQL melalui phpMyAdmin dan salin folder foto saat tidak ada perubahan data. Jangan mengunggah cadangan berisi akun pengguna ke repositori publik.

Untuk hosting, gunakan layanan yang menjalankan Node.js, koneksi MySQL yang tersedia, dan penyimpanan foto persisten. Tetapkan `NODE_ENV=production` serta `APP_ORIGIN` HTTPS, dan gunakan akun database khusus aplikasi. Menaruh hasil `dist/` saja di hosting statis tidak menjalankan API, login, atau database.

## Pengembangan berikutnya

- Pagination untuk koleksi besar; daftar saat ini dibatasi 100 resep/komentar.
- Verifikasi email serta pelaporan dan moderasi konten.
- Penyimpanan foto ke object storage dan pembersihan foto yang tidak lagi digunakan.
- Video tutorial, penyesuaian takaran bahan, dan koleksi resep tematik.
- Migrasi database berversi ketika struktur data berkembang.

## Kredit

Konsep dan desain antarmuka: **Atilla Kuncoro Djati**, berdasarkan proyek Figma Nusa Rasa. Foto makanan contoh berasal dari aset desain yang diberikan; hak atas foto tetap pada pemilik aslinya. Ikon menggunakan [Lucide](https://lucide.dev/), font menggunakan [Poppins](https://fonts.google.com/specimen/Poppins). Konten resep contoh disiapkan untuk demonstrasi aplikasi.
