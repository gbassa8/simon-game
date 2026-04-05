import { Client } from 'pg'
import { getDatabaseSchema, getPoolConfig, quoteIdentifier } from '../database.js'

async function main(): Promise<void> {
  const client = new Client(getPoolConfig())
  const schema = getDatabaseSchema()

  await client.connect()

  try {
    await client.query(`create schema if not exists ${quoteIdentifier(schema)}`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown schema creation error'
  console.error(message)
  process.exit(1)
})
