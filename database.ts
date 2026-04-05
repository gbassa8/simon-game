import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type PoolConfig } from 'pg'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.basename(currentDir) === 'server-dist' ? path.dirname(currentDir) : currentDir
const identifierPattern = /^[a-z_][a-z0-9_]*$/

config({ path: path.join(rootDir, '.env') })

function normalizeDatabaseUrl(value: string): URL {
  return new URL(value.replace(/^jdbc:/, ''))
}

function getSslConfig(url: URL): PoolConfig['ssl'] {
  return url.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined
}

export function getPoolConfig(): PoolConfig {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL')
  }

  const normalizedUrl = normalizeDatabaseUrl(databaseUrl)

  return {
    connectionString: normalizedUrl.toString(),
    ssl: getSslConfig(normalizedUrl),
  }
}

export function getDatabaseSchema(): string {
  const schema = process.env.DATABASE_SCHEMA ?? 'public'

  if (!identifierPattern.test(schema)) {
    throw new Error(`Invalid database schema: ${schema}`)
  }

  return schema
}

export function getQualifiedTableName(tableName: string): string {
  if (!identifierPattern.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }

  return `${quoteIdentifier(getDatabaseSchema())}.${quoteIdentifier(tableName)}`
}

export function quoteIdentifier(value: string): string {
  if (!identifierPattern.test(value)) {
    throw new Error(`Invalid identifier: ${value}`)
  }

  return `"${value}"`
}
