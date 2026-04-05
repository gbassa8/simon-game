import { Client } from 'pg'
import { getDatabaseSchema, getPoolConfig, getQualifiedTableName, quoteIdentifier } from '../database.js'

async function main(): Promise<void> {
  const client = new Client(getPoolConfig())
  const schema = getDatabaseSchema()
  const scoresTable = getQualifiedTableName('simon_scores')

  await client.connect()

  try {
    await client.query(`create schema if not exists ${quoteIdentifier(schema)}`)
    await client.query(`
      create table if not exists ${scoresTable} (
        id bigint generated always as identity primary key,
        player_id text not null,
        player_name text not null,
        score integer not null check (score >= 0),
        created_at timestamptz not null default now()
      )
    `)
    await client.query(`create index if not exists simon_scores_player_id_score_idx on ${scoresTable} (player_id, score desc, id desc)`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown migration error'
  console.error(message)
  process.exit(1)
})
