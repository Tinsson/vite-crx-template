import { IDBPDatabase, openDB } from 'idb'

/**
 *  封装indexDB方便background进行本地缓存
 *  暴露三个公共方法（异步调用）：
 *  getValue
 *  setValue
 *  deleteValue
 */

class CrxIndexDB {
  private database: string
  private tableName: string
  private db: any

  private sleep = (num): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true)
      }, num * 1000)
    })
  }

  private async dbReady() {
    if (!this.db) {
      await this.sleep(0.5)
      return await this.dbReady()
    }
    return true
  }

  private async createObjectStore() {
    const tableName = this.tableName
    try {
      this.db = await openDB(this.database, 1, {
        upgrade(db: IDBPDatabase) {
          if (db.objectStoreNames.contains(tableName)) {
            return
          }
          db.createObjectStore(tableName, {
            keyPath: 'keyName'
          })
        }
      })
    } catch (error) {
      return false
    }
  }

  constructor(database: string, tableName: string) {
    this.database = database
    this.tableName = tableName
    this.createObjectStore()
  }

  public async getValue(keyName: string): Promise<any> {
    await this.dbReady()
    const { tableName } = this
    const tx = this.db.transaction(tableName, 'readonly')
    const store = tx.objectStore(tableName)
    const result = await store.get(keyName)
    return result.value
  }

  public async setValue(keyName: string, value: any) {
    await this.dbReady()
    const { tableName } = this
    const tx = this.db.transaction(tableName, 'readwrite')
    const store = tx.objectStore(tableName)
    const result = await store.put({
      keyName,
      value
    })
    return result
  }

  public async deleteValue(keyName: string) {
    await this.dbReady()
    const { tableName } = this
    const tx = this.db.transaction(tableName, 'readwrite')
    const store = tx.objectStore(tableName)
    const result = await store.get(keyName)
    if (!result) {
      return result
    }
    await store.delete(keyName)
    return keyName
  }
}

const db = new CrxIndexDB('crx_index_db', 'crx_bg_table')
export default db
