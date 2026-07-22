import { DatabaseSync } from 'node:sqlite'

export class TestSqliteDatabase {
  private readonly database = new DatabaseSync(':memory:')

  exec(sql: string) {
    return this.database.exec(sql)
  }

  prepare(sql: string) {
    return this.database.prepare(sql)
  }

  transaction<T extends (...args: any[]) => any>(operation: T) {
    return (...args: Parameters<T>): ReturnType<T> => {
      this.database.exec('BEGIN')
      try {
        const result = operation(...args)
        this.database.exec('COMMIT')
        return result
      } catch (error) {
        this.database.exec('ROLLBACK')
        throw error
      }
    }
  }

  close() {
    this.database.close()
  }
}
