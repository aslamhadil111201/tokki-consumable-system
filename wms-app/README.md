# TOKKI Consumable System (wms-app)

Frontend React + Vite dengan API serverless (`/api/*`) di Vercel.

## Fitur Backend Saat Ini

- Database persisten: MongoDB Atlas
- Auth: JWT + hash password (`bcryptjs`)
- Upload gambar barang: Cloudinary (simpan URL, bukan base64)

## Environment Variables

Salin dari `.env.example` lalu isi nilai yang benar:

```
VITE_API_URL=
MONGO_URI=
MONGO_DB_NAME=tokki_consumable
JWT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Catatan:

- Untuk Vercel, set variabel di Project Settings -> Environment Variables.
- Jika `VITE_API_URL` kosong, frontend akan pakai `/api` saat production.

## Jalankan Lokal

```bash
npm install
npm run dev
```

## Backend Lokal Yang Dipakai

- Gunakan backend utama di folder workspace `c:\WHS\wms-backend`.
- Jalankan backend utama pada port `3001` agar frontend tetap konsisten ke `http://localhost:3001/api`.
- Hindari menjalankan dua backend sekaligus (`c:\WHS\wms-backend` dan `c:\WHS\wms-app\wms-backend`) karena bisa menyebabkan perilaku berbeda saat testing.

## Login Default Seed

- username: `admin`
- password: `admin123`

Seed otomatis dijalankan saat koleksi `users` masih kosong.
