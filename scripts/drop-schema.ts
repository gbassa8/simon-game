import { Client } from 'pg'
import { getDatabaseSchema, getPoolConfig, quoteIdentifier } from '../database.js'

async function main(): Promise<void> {
  const client = new Client(getPoolConfig())
  const schema = getDatabaseSchema()

  await client.connect()

  try {
    await client.query(`drop schema if exists ${quoteIdentifier(schema)} cascade`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown schema cleanup error'
  console.error(message)
  process.exit(1)
})
