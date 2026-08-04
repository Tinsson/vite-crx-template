import { describe, it, expect } from 'vitest'
import db from '../background/db'
import { chromeMock } from '../test/setup'

describe('CrxIndexDB', () => {
  it('setValue / getValue 往返', async () => {
    await db.setValue('k1', { a: 1 })
    expect(await db.getValue('k1')).toEqual({ a: 1 })
  })

  it('deleteValue 后 getValue 返回 undefined', async () => {
    await db.setValue('k2', 'v2')
    await db.deleteValue('k2')
    expect(await db.getValue('k2')).toBeUndefined()
  })

  it('通过消息层 get-value-bg 读取', async () => {
    await db.setValue('msg-key', 'hello')
    const res = await chromeMock.runtime.sendMessage({
      taskId: 'get-value-bg',
      params: { keyName: 'msg-key' }
    })
    expect(res).toEqual({ result: 'hello' })
  })

  it('通过消息层 set-value-bg 写入、del-value-bg 删除', async () => {
    await chromeMock.runtime.sendMessage({
      taskId: 'set-value-bg',
      params: { keyName: 'msg-key2', value: 123 }
    })
    expect(await db.getValue('msg-key2')).toBe(123)

    await chromeMock.runtime.sendMessage({
      taskId: 'del-value-bg',
      params: { keyName: 'msg-key2' }
    })
    expect(await db.getValue('msg-key2')).toBeUndefined()
  })

  it('读取不存在的 key 返回 result: null（不抛错）', async () => {
    const res = await chromeMock.runtime.sendMessage({
      taskId: 'get-value-bg',
      params: { keyName: 'no-such-key' }
    })
    expect(res).toEqual({ result: null })
  })
})
