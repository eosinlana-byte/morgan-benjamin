# Morgan Benjamin

Singer site. Black and cream. Not a copy of Jackson Ryder.

Same kind of engine:
- Public site
- Admin at `/admin`
- Tracks, work samples, messages
- File uploads stored in the database (`/media/:id`)
- Contact form saved in admin. Emails if SMTP is set.

No fake bio. No fake songs. Add real tracks in admin.

## Run

```
npm install
node server.js
```

Site: http://localhost:8090  
Admin: http://localhost:8090/admin  

Login: `admin` / `MorganArts`  
Change `ADMIN_PASSWORD` on Render.

## Render

- Node
- Build: `npm install`
- Start: `node server.js`
- Optional env: `DATABASE_URL` (Neon). If you skip it, SQLite is used. Put a disk on `data/` if you want SQLite to survive restarts.
- Do not paste DATABASE_URL in chat.

## GitHub

Repo name: `morgan-benjamin` under your account. Upload the folder. Not a zip.
