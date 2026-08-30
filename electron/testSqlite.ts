import { DatabaseSync } from 'node:sqlite'

export class TestSqliteDatabase {
  private readonly database = new DatabaseSync(':memory:')
  private transactionDepth = 0

  exec(sql: string) {
    return this.database.exec(sql)
  }

  prepare(sql: string) {
    return this.database.prepare(sql)
  }

  pragma(source: string, options?: { simple?: boolean }) {
    const rows = this.database.prepare(`PRAGMA ${source}`).all() as Array<Record<string, unknown>>
    if (options?.simple) {
      return rows[0] ? Object.values(rows[0])[0] : undefined
    }
    return rows
  }

  transaction<T extends (...args: any[]) => any>(operation: T) {
    return (...args: Parameters<T>): ReturnType<T> => {
      const depth = this.transactionDepth
      const savepoint = `test_transaction_${depth}`
      this.transactionDepth += 1
      this.database.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${savepoint}`)
      try {
        const result = operation(...args)
        this.database.exec(depth === 0 ? 'COMMIT' : `RELEASE SAVEPOINT ${savepoint}`)
        return result
      } catch (error) {
        if (depth === 0) {
          this.database.exec('ROLLBACK')
        } else {
          this.database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`)
          this.database.exec(`RELEASE SAVEPOINT ${savepoint}`)
        }
        throw error
      } finally {
        this.transactionDepth -= 1
      }
    }
  }

  close() {
    this.database.close()
  }
}
