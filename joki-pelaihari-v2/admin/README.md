# Joki Pelaihari V2 — Ruang Admin

Lokasi: https://joki-pelaihari-v2.vercel.app/admin/

## Implementasi
- Panel terpisah dari website publik, autentikasi password melalui Supabase Auth
- Sesi tersimpan dalam cookie HttpOnly Secure SameSite Strict; tidak memakai localStorage untuk token
- Endpoint admin memvalidasi token melalui Supabase Auth dan whitelist pemilik / jp_admin_users
- Database untuk pesanan, review moderasi, harga, event agregat, log audit, rate limit
- Semua tabel RLS ON tanpa kebijakan akses anon/authenticated; service role hanya di server
- Harga publik memakai override dari database bila penyimpanan sudah diaktifkan
- Form order dan review menulis ke database jika JP_PUBLIC_WRITE_ENABLED=true
- Saat belum terhubung, website publik tetap memakai perilaku lama tanpa perubahan tampilan
- Review baru dari website masuk status pending; hanya yang disetujui bisa tampil
- Badge Verified Order tidak boleh diberikan tanpa pesanan asli yang selesai
- Event analitik anonim menyimpan jenis event dan waktu, bukan identitas pengguna

## Prasyarat pengaktifan (belum diselesaikan)
1. Buat project Supabase **baru khusus Joki Pelaihari**, jangan pakai database proyek lain tanpa izin pemilik
2. Jalankan satu kali migration database/schema.sql di SQL editor Supabase proyek baru
3. Buat pengguna di Supabase Authentication > Users dengan email admin yang telah diverifikasi
4. Vercel Project joki-pelaihari-v2 > Settings > Environment Variables > Production:
   - SUPABASE_URL = https://<project-ref>.supabase.co
   - SUPABASE_PUBLISHABLE_KEY = sb_publishable_... (atau anon key aktif)
   - SUPABASE_SERVICE_ROLE_KEY = secret/service role Supabase (server only, encrypted)
   - JP_ADMIN_EMAILS = email pemilik yang diizinkan, dipisah koma jika lebih dari satu
   - JP_PUBLIC_WRITE_ENABLED = true hanya setelah SQL + Auth + API lulus uji
5. Deploy ulang branch main tanpa mengubah project/rootDirectory
6. Login /admin/ lalu validasi tes CRUD, RLS, harga dan penerimaan review/order

Jangan menaruh service role key, password, atau nilai cookie di GitHub, HTML, JS publik atau pesan chat

## API
- GET /api/public?resource=status: database + readiness flags tanpa mengungkap kunci
- GET /api/public?resource=reviews: approved reviews only
- GET /api/public?resource=prices: override harga tersimpan; 204 jika belum ada
- POST /api/public?resource=reviews: review masuk pending saat writes aktif
- POST /api/public?resource=orders: menyimpan permintaan pelanggan
- POST /api/public?resource=event: event anonim terbatasi
- POST /api/admin?action=login: Supabase Auth, whitelist, cookie server
- GET /api/admin?action=session: sesi terverifikasi
- POST /api/admin?action=logout: mengakhiri sesi
- GET /api/admin?resource=dashboard/orders/reviews/prices/analytics/audit
- PATCH /api/admin?resource=orders: status, pembayaran, nilai, catatan
- POST /api/admin?resource=orders: input pesanan manual
- PATCH /api/admin?resource=reviews: moderasi
- POST /api/admin?resource=prices: simpan JSON harga dengan optimistic version

## Keamanan dan kepatuhan
- Backend menolak konfigurasi yang belum lengkap (503), tidak membuka admin tanpa login
- Semua request mutasi harus berasal dari origin website yang sama
- Data pelanggan tidak diikutsertakan ke event analytics
- Rate limit per IP dianonimkan dengan HMAC dan dihitung atomik di Postgres
- Review publik tidak punya akses langsung ke tabel Supabase
- Perubahan admin dicatat ke audit log
- Disarankan memasang Cloudflare Turnstile/anti-bot tambahan sebelum trafik tinggi
- Buat backup database, kebijakan retensi, serta akun admin pemulihan setelah aktif
- Environment secret harus dirotasi jika terpapar; jangan pernah ditaruh di source
