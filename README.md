# Cashmir Biotech Platform

Premium biotech storytelling website:

- Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion
- PostgreSQL + Prisma ORM
- Dark-themed public site (scroll-driven hero storytelling, products, patents, board)
- Secure admin console (JWT cookie auth) for editing homepage, products, patents, and board members
- Newsletter subscription API backed by a `Subscriber` table

## 1) Environment setup

Install Node 20+ (e.g. via nvm), then:

```bash
npm install
```

`prisma generate` runs automatically after install.

## 2) Configure env

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — at least 32 characters, signs the admin session cookie
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH` — bcrypt hash, generate with:

```bash
node -e "console.log(require('bcryptjs').hashSync('StrongPassword123!', 12))"
```

Optional:

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — enables edge rate limiting for admin login and the newsletter API
- `NEXT_PUBLIC_SITE_URL` — canonical URL used for `sitemap.xml`, `robots.txt`, and OpenGraph metadata
- `LOG_LEVEL` — pino log level (default `info` in production)

## 3) Database

One-shot setup (creates the DB if missing, applies migrations, seeds demo content):

```bash
npm run db:setup
```

Or step by step:

```bash
npm run db:create
npx prisma migrate deploy
npm run db:seed
```

After pulling new migrations (e.g. the `Subscriber` table), run `npx prisma migrate deploy` again.

## 4) Run

```bash
npm run dev
```

- Site: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin/login`

Production:

```bash
npm run build
npm start
```

## API

| Method | Path              | Description                                             |
| ------ | ----------------- | ------------------------------------------------------- |
| POST   | `/api/newsletter` | Subscribe an email. Body: `{ "email": "a@b.com" }`. Rate limited (5/min per IP) when Upstash is configured. |

## Project structure

- `src/app/(public)` — public pages (home, products, patents, team)
- `src/app/(admin)` — admin login + dashboard (server actions, zod-validated)
- `src/app/api` — route handlers
- `src/components/ui` — reusable shadcn-style primitives
- `src/components/home` — homepage storytelling sections
- `src/modules/cms` — content services + validation schemas
- `src/lib` — auth, db client, logging, rate limiting
- `prisma` — schema, migrations, seed
