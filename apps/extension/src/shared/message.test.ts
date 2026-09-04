import { describe, it, expect, beforeEach, vi } from 'vitest'
import { onMessage, sendMessage, sendMessageToTab } from '../shared/message'
import { chromeMock } from '../test/setup'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('onMessage', () => {
  beforeEach(() => {
    chromeMock._listeners.length = 0
  })

  it('匹配 taskId 时把 params 传给回调并同步返回响应', () => {
    onMessage('get-setting', (params) => {
      expect(params).toEqual({ key: 'a' })
      return { result: 1 }
    })
    const sendResponse = vi.fn()
    const ret = chromeMock._listeners[0](
      { taskId: 'get-setting', params: { key: 'a' } },
      undefined,
      sendResponse
    )
    expect(sendResponse).toHaveBeenCalledWith({ result: 1 })
    expect(ret).toBeUndefined()
  })

  it('忽略非匹配的 taskId', () => {
    const cb = vi.fn()
    onMessage('get-setting', cb)
    chromeMock._listeners[0](
      { taskId: 'other-task', params: {} },
      undefined,
      vi.fn()
    )
    expect(cb).not.toHaveBeenCalled()
  })

  it('异步回调时返回 true 保持通道，并异步 sendResponse', async () => {
    onMessage('get-setting', async (params) => ({ result: params.key }))
    const sendResponse = vi.fn()
    const ret = chromeMock._listeners[0](
      { taskId: 'get-setting', params: { key: 'x' } },
      undefined,
      sendResponse
    )
    expect(ret).toBe(true)
    await flush()
    expect(sendResponse).toHaveBeenCalledWith({ result: 'x' })
  })

  it('回调抛错时不会留下未处理的 rejection', async () => {
    onMessage('get-setting', async () => {
      throw new Error('boom')
    })
    const sendResponse = vi.fn()
    chromeMock._listeners[0](
      { taskId: 'get-setting', params: undefined },
      undefined,
      sendResponse
    )
    await flush()
    expect(sendResponse).toHaveBeenCalledWith(undefined)
  })
})

describe('sendMessage / sendMessageToTab', () => {
  beforeEach(() => {
    chromeMock._listeners.length = 0
    chromeMock.runtime.sendMessage.mockClear()
    chromeMock.tabs.sendMessage.mockClear()
  })

  it('sendMessage 以 { taskId, params } 发送并返回响应', async () => {
    onMessage('get-setting', () => ({ result: 42 }))
    const res = await sendMessage('get-setting', { key: 'k' })
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      taskId: 'get-setting',
      params: { key: 'k' }
    })
    expect(res).toEqual({ result: 42 })
  })

  it('sendMessageToTab 发给指定标签页', async () => {
    onMessage('ping-content', () => ({
      url: 'u',
      title: 't',
      injectedAt: 1
    }))
    const res = await sendMessageToTab(7, 'ping-content', undefined)
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(7, {
      taskId: 'ping-content',
      params: undefined
    })
    expect(res).toEqual({ url: 'u', title: 't', injectedAt: 1 })
  })

  it('无人响应时抛出异常', async () => {
    await expect(sendMessage('get-setting', { key: 'k' })).rejects.toThrow()
  })
})
