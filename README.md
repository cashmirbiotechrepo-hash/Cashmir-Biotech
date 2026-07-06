# Cashmir Biotech Platform

Premium biotech storytelling website built with Node.js stack:

- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma ORM
- Dark/light mode
- Secure admin panel (JWT cookie auth) for editing homepage, products, patents, and board members

## 1) Environment setup

This machine currently has no Node runtime installed. Install Node 20+ first:

- Linux with nvm:
  - `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`
  - restart shell
  - `nvm install 20`
  - `node -v`

Then install dependencies:

```bash
npm install
```

## 2) Configure env

```bash
cp .env.example .env
```

Set:

- `DATABASE_URL` (PostgreSQL connection)
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH` (bcrypt hash)

Generate hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('StrongPassword123!', 12))"
```

## 3) Database

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

## 4) Run app

```bash
npm run dev
```

Open:

- Site: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin/login`

## shadcn structure note

This project uses the standard shadcn-style UI path:

- `src/components/ui/*`

Keeping reusable primitives in this folder is important because:

- it centralizes design tokens and components,
- makes imports predictable (`@/components/ui/...`),
- simplifies scaling and future component generation.
