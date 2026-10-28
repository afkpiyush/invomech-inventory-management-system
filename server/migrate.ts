import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import 'dotenv/config'

async function setupDatabase() {
  console.log('Connecting to MySQL server at', process.env.MYSQL_HOST || '127.0.0.1', 'as', process.env.MYSQL_USER || 'root')
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true,
  })

  console.log('Connected! Creating database if not exists...')
  const dbName = process.env.MYSQL_DATABASE || 'invomech_inventory'
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)
  console.log(`Database \`${dbName}\` created or verified.`)

  await connection.query(`USE \`${dbName}\`;`)

  const migrationPath = path.resolve('database/migrations/001_initial.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')
  console.log('Applying migration 001_initial.sql...')
  await connection.query(sql)
  console.log('Migration applied successfully!')

  await connection.end()
  console.log('Database initialization complete.')
}

setupDatabase().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
