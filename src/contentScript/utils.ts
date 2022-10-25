export const onMessage = (taskId: string, callback) => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { params } = request
    if (request.taskId === taskId) {
      const result = callback(params)
      if (result && result.then) {
        result.then((info) => {
          sendResponse(info)
        })
      } else {
        sendResponse(result)
      }
    }
  })
}

export const sendMessage = (taskId: string, params: any) => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        taskId,
        params
      },
      (result) => {
        resolve(result)
      }
    )
  })
}

export const getCache = async (keyName: string): Promise<any> => {
  const res = await sendMessage('get-value-bg', {
    keyName
  })
  return res
}

export const setCache = async (keyName: string, value: any) => {
  const res = await sendMessage('set-value-bg', {
    keyName,
    value
  })
  return res
}

export const delCache = async (keyName: string) => {
  const res = await sendMessage('del-value-bg', {
    keyName
  })
  return res
}
