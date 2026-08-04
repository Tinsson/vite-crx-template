import { IDBPDatabase, openDB } from 'idb'
import { onMessage } from '../shared/message'

/**
 *  封装indexDB方便background进行本地缓存
 *  暴露三个公共方法（异步调用）：
 *  getValue
 *  setValue
 *  deleteValue
 *
 *  同时注册这三个方法的Message消息，便于contentScript调用
 */
class CrxIndexDB {
  private database: string
  private tableName: string
  private db: any
  private dbPromise: Promise<void>

  constructor(database: string, tableName: string) {
    this.database = database
    this.tableName = tableName
    this.dbPromise = this.createObjectStore()
    this.registerMessage()
  }

  public async getValue(keyName: string): Promise<any> {
    await this.dbPromise
    const { tableName } = this
    const tx = this.db.transaction(tableName, 'readonly')
    const store = tx.objectStore(tableName)
    const result = await store.get(keyName)
    return result?.value
  }

  public async setValue(keyName: string, value: any) {
    await this.dbPromise
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
    await this.dbPromise
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

  private registerMessage() {
    onMessage('get-value-bg', async (params) => {
      try {
        return {
          result: (await this.getValue(params.keyName)) ?? null
        }
      } catch {
        return {
          result: null
        }
      }
    })
    onMessage('set-value-bg', async (params) => {
      try {
        return {
          result: await this.setValue(params.keyName, params.value)
        }
      } catch {
        return {
          result: null
        }
      }
    })
    onMessage('del-value-bg', async (params) => {
      try {
        return {
          result: await this.deleteValue(params.keyName)
        }
      } catch {
        return {
          result: null
        }
      }
    })
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
    } catch {
      this.db = null
    }
  }
}

const db = new CrxIndexDB('crx_index_db', 'crx_bg_table')
export default db
