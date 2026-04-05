import { config } from 'dotenv'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolConfig } from 'pg'

type ScorePayload = {
  playerId?: string
  name?: string
  score?: number
}

type BestScoreResponse = {
  bestScore: number | null
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.basename(currentDir) === 'server-dist' ? path.dirname(currentDir) : currentDir

config({ path: path.join(rootDir, '.env') })

function getPort(): number {
  const value = Number(process.env.PORT ?? '8080')

  if (Number.isNaN(value) || value <= 0) {
    return 8080
  }

  return value
}

function getPoolConfig(): PoolConfig {
  const jdbcUrl = process.env.SPRING_DATASOURCE_URL
  const user = process.env.SPRING_DATASOURCE_USERNAME
  const password = process.env.SPRING_DATASOURCE_PASSWORD

  if (!jdbcUrl || !user || !password) {
    throw new Error('Missing database config')
  }

  const parsed = new URL(jdbcUrl.replace(/^jdbc:/, ''))

  return {
    host: parsed.hostname,
    port: Number(parsed.port || '5432'),
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
    user,
    password,
    ssl: parsed.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined,
  }
}

const pool = new Pool(getPoolConfig())
const app = express()
const distDir = path.join(rootDir, 'dist')

app.use(express.json())

app.get<{ playerId: string }, BestScoreResponse | { error: string }>('/api/players/:playerId/best', async (request, response) => {
  const playerId = request.params.playerId.trim()

  if (playerId === '' || playerId.length > 64) {
    response.status(400).json({ error: 'Invalid player id' })
    return
  }

  try {
    const result = await pool.query<{ score: number }>('select score from simon_scores where player_id = $1 order by score desc, id desc limit 1', [playerId])
    response.json({ bestScore: result.rows[0]?.score ?? null })
  } catch {
    response.status(500).json({ error: 'Could not load best score' })
  }
})

app.post<{}, { ok: true } | { error: string }, ScorePayload>('/api/scores', async (request, response) => {
  const { playerId, name, score } = request.body

  if (
    typeof playerId !== 'string' ||
    playerId.trim() === '' ||
    playerId.length > 64 ||
    typeof name !== 'string' ||
    name.trim() === '' ||
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0
  ) {
    response.status(400).json({ error: 'Invalid score payload' })
    return
  }

  try {
    await pool.query('insert into simon_scores (player_id, player_name, score) values ($1, $2, $3)', [playerId.trim(), name.trim().slice(0, 40), score])
    response.status(201).json({ ok: true })
  } catch {
    response.status(500).json({ error: 'Could not save score' })
  }
})

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'))
  })
}

async function start(): Promise<void> {
  await pool.query(`
    create table if not exists simon_scores (
      id bigint generated always as identity primary key,
      player_id text not null,
      player_name text not null,
      score integer not null check (score >= 0),
      created_at timestamptz not null default now()
    )
  `)

  await pool.query('create index if not exists simon_scores_player_id_score_idx on simon_scores (player_id, score desc, id desc)')

  app.listen(getPort(), () => {
    console.log(`simon-game listening on ${getPort()}`)
  })
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown server error'
  console.error(message)
  process.exit(1)
})
