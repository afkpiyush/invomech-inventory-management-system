import mysql, { type Pool, type PoolConnection, type ExecuteValues, type QueryValues, type ResultSetHeader } from 'mysql2/promise'
import { config } from './config.js'

export const pool: Pool = mysql.createPool({
  host: config.MYSQL_HOST,
  port: config.MYSQL_PORT,
  database: config.MYSQL_DATABASE,
  user: config.MYSQL_USER,
  password: config.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
})

export const query = <T>(sql: string, values: QueryValues = []) =>
  (pool as unknown as { query: (sql: string, values: QueryValues) => Promise<[unknown, unknown]> })
    .query(sql, values)
    .then(([rows]) => rows as T)

export const execute = (sql: string, values: ExecuteValues = []) =>
  pool.execute<ResultSetHeader>(sql, values)

export const transaction = async <T>(callback: (connection: PoolConnection) => Promise<T>) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
