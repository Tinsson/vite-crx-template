❌ Bad case - 将 `globalThis.setTimeout`、`clearTimeout`、`fetch` 等原生函数直接保存为实例方法后调用，会改变原生函数的接收者，在 Chrome Service Worker 中触发 `Illegal invocation`，进而导致注册失败（Status code: 15）。
☑️ Good case - 使用箭头函数包装并通过 `globalThis` 显式调用原生函数，例如 `(callback, ms) => globalThis.setTimeout(callback, ms)`，确保接收者上下文正确。
