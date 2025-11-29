# Loggen

En enkel loggapplikation för personalen att skriva meddelanden.

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + Prisma
- **Databas:** PostgreSQL

## Lokal utveckling

1. **Installera beroenden:**
   ```bash
   npm install
   ```

2. **Konfigurera miljövariabler:**
   ```bash
   cp .env.example .env
   # Uppdatera DATABASE_URL med din PostgreSQL-anslutning
   ```

3. **Kör databasmigrering:**
   ```bash
   npx prisma migrate dev
   ```

4. **Starta utvecklingsservern:**
   ```bash
   npm run dev
   ```

   Frontend körs på `http://localhost:5173`
   Backend körs på `http://localhost:3001`

## Deploy till Coolify

### 1. Skapa PostgreSQL-databas i Coolify
- Lägg till en ny PostgreSQL-resurs
- Kopiera `DATABASE_URL`

### 2. Skapa ny applikation
- Välj **GitHub** som källa
- Välj ditt repository

### 3. Konfigurera Build Settings
Nixpacks upptäcker automatiskt projektet. Ställ in följande:

| Setting | Value |
|---------|-------|
| Build Command | `npm run build` |
| Start Command | `npm run db:migrate && npm start` |
| Install Command | `npm install` |

### 4. Miljövariabler
Lägg till följande i Coolify:

```
DATABASE_URL=<din-postgresql-url>
NODE_ENV=production
PORT=3000
```

### 5. Deploy
Klicka **Deploy** - Nixpacks bygger och startar automatiskt.

## Projektstruktur

```
├── src/                  # React frontend
│   ├── components/       # React-komponenter
│   ├── App.tsx          # Huvudkomponent
│   └── index.css        # Styling
├── server/              # Express backend
│   └── index.ts         # API-server
├── prisma/              # Prisma schema
│   └── schema.prisma    # Databasschema
├── CHANGELOG.md         # Versionshistorik
└── package.json         # Beroenden och scripts
```

## API Endpoints

| Method | Endpoint | Beskrivning |
|--------|----------|-------------|
| GET | `/api/logs` | Hämta alla loggar |
| POST | `/api/logs` | Skapa ny logg |
| GET | `/api/version` | Hämta appversion |
| GET | `/api/changelog` | Hämta changelog |

