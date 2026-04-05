# Simon Game

Minimal Simon clone for preview-environment testing.

## Features

- classic 4-color Simon loop
- distinct beep per button
- optional score save on game over
- stable local `player_id` + per-player best score
- saves to Supabase Postgres

## Env

Create `simon-game/.env`:

```env
PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres.<project-ref>
SPRING_DATASOURCE_PASSWORD=<password>
```

You can copy from `.env.example`.

## Local run

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:server
```

Open `http://127.0.0.1:5173`.

## Build + run (no Vite dev server)

```bash
npm run build
npm run start
```

Open `http://127.0.0.1:8080`.

## Docker

Build image:

```bash
docker build -t simon-game .
```

Run container:

```bash
docker run --rm -p 8080:8080 \
  -e SPRING_DATASOURCE_URL="jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require" \
  -e SPRING_DATASOURCE_USERNAME="postgres.<project-ref>" \
  -e SPRING_DATASOURCE_PASSWORD="<password>" \
  simon-game
```

Open `http://127.0.0.1:8080`.

## DB notes

On startup, backend ensures table exists:

- `simon_scores(id, player_id, player_name, score, created_at)`
