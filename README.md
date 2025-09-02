# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/10d869e7-db60-4898-9850-c3555c77335a

# Daily Drop Shell

🚀 **Daily Drop Shell** è il boilerplate React + Supabase del progetto **DailyDrops**.  
Fornisce l’infrastruttura di base (auth, UI kit, DB) su cui costruire funzionalità di discovery e feed AI-driven.

---

## ⚡️ Stack Tecnologico

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) per i componenti
- [Supabase](https://supabase.com/) (Auth, Database, Storage, Edge Functions)
- ESLint + Prettier per linting & formattazione

---

## 📦 Requisiti

- **Node.js** ≥ 18  
- **pnpm** (consigliato) o npm  
- **Supabase CLI** (per lanciare il DB in locale, richiede Docker)

---

## 🚀 Setup locale

Clona il repo:

```bash
git clone https://github.com/quadroce/daily-drop-shell.git
cd daily-drop-shell
Installa le dipendenze:

bash
Copia codice
pnpm install
# oppure
npm install
Copia il file .env.example in .env e imposta le variabili:

bash
Copia codice
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
Avvia Supabase in locale:

bash
Copia codice
supabase start
supabase db reset   # carica schema e migrazioni da supabase/
Lancia il dev server:

bash
Copia codice
pnpm dev
# oppure
npm run dev
👉 L’app sarà disponibile su http://localhost:5173 (o la porta configurata in vite.config.ts).

📂 Struttura Progetto
arduino
Copia codice
daily-drop-shell/
├── public/              # asset statici
├── src/                 # codice React (App, routes, componenti UI)
├── supabase/            # schema DB, migrazioni, seed
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
🛠 Script principali
bash
Copia codice
pnpm dev       # avvia dev server
pnpm build     # build di produzione
pnpm preview   # anteprima della build
pnpm lint      # lint con ESLint
☁️ Deployment
Vercel consigliato per il frontend React

Supabase Cloud per DB, auth e storage

📌 Roadmap
 Autenticazione Google e magic link

 Integrazione feed AI (YouTube, RSS, Reddit)

 Preferenze utente + onboarding

 Admin dashboard per moderazione e ingestion
