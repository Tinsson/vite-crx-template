import { describe, it, expect, beforeEach } from 'vitest'
import { getCache, setCache, delCache } from './utils'
import { chromeMock } from '../test/setup'

describe('contentScript 缓存封装', () => {
  beforeEach(() => {
    chromeMock.runtime.sendMessage.mockReset()
    chromeMock.runtime.sendMessage.mockResolvedValue({ result: null })
  })

  it('getCache 发送 get-value-bg', () => {
    getCache('k1')
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      taskId: 'get-value-bg',
      params: { keyName: 'k1' }
    })
  })

  it('setCache 发送 set-value-bg（含 value）', () => {
    setCache('k1', { a: 1 })
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      taskId: 'set-value-bg',
      params: { keyName: 'k1', value: { a: 1 } }
    })
  })

  it('delCache 发送 del-value-bg', () => {
    delCache('k1')
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      taskId: 'del-value-bg',
      params: { keyName: 'k1' }
    })
  })
})
