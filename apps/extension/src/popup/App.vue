<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { sendMessage } from '~/shared/message'
import { getCurrentWindowId } from '~/shared/sidePanel'
import type { NetworkErrorCode } from '~/shared/message'

const errorLabels: Record<NetworkErrorCode, string> = {
  SERVICE_UNAVAILABLE: '服务不可用',
  TIMEOUT: '请求超时',
  PROTOCOL_ERROR: '协议错误',
  CONNECTION_CLOSED: '连接已关闭'
}

function formatError(code: NetworkErrorCode, message: string): string {
  return `${errorLabels[code] ?? code}（${message}）`
}

export default defineComponent({
  setup() {
    const enabled = ref(true)
    const count = ref(0)
    const windowId = ref<number | undefined>(undefined)

    const load = async () => {
      const [en, cnt] = await Promise.all([
        sendMessage('get-setting', { key: 'enabled' }),
        sendMessage('get-setting', { key: 'count' })
      ])
      enabled.value = en?.result ?? true
      count.value = cnt?.result ?? 0
    }

    const resolveWindowId = async () => {
      windowId.value = await getCurrentWindowId()
    }

    const toggleEnabled = async () => {
      await sendMessage('set-setting', { key: 'enabled', value: enabled.value })
    }

    const increment = async () => {
      count.value++
      await sendMessage('set-setting', { key: 'count', value: count.value })
    }

    const openOptions = () => chrome.runtime.openOptionsPage()

    const openSidePanel = async () => {
      if (windowId.value === undefined) {
        ElMessage.warning('未获取到当前窗口')
        return
      }
      try {
        await chrome.sidePanel.open({ windowId: windowId.value })
      } catch (e) {
        ElMessage.error('打开侧边栏失败')
      }
    }

    const closeSidePanel = async () => {
      if (windowId.value === undefined) {
        ElMessage.warning('未获取到当前窗口')
        return
      }
      try {
        await chrome.sidePanel.close({ windowId: windowId.value })
      } catch (e) {
        ElMessage.error('关闭侧边栏失败')
      }
    }

    const healthLoading = ref(false)
    const healthText = ref('')

    const checkHealth = async () => {
      healthLoading.value = true
      healthText.value = ''
      try {
        const result = await sendMessage('server-health', undefined)
        if (result.ok === true) {
          healthText.value = `状态：${result.data.status}，时间：${result.data.timestamp}`
        } else {
          const { code, message } = result.error
          healthText.value = `错误：${formatError(code, message)}`
        }
      } catch {
        healthText.value = '错误：未知异常'
      } finally {
        healthLoading.value = false
      }
    }

    const wsStatus = ref('')
    const wsErrorText = ref('')
    const echoText = ref('')
    const echoLoading = ref(false)
    const echoResultText = ref('')

    const refreshWsStatus = async () => {
      try {
        const result = await sendMessage('server-ws-status', undefined)
        wsStatus.value = result.state
        wsErrorText.value = result.error
          ? formatError(result.error.code, result.error.message)
          : ''
      } catch {
        wsStatus.value = 'error'
        wsErrorText.value = '未知异常'
      }
    }

    const sendEcho = async () => {
      if (!echoText.value || echoLoading.value) return
      echoLoading.value = true
      echoResultText.value = ''
      try {
        const result = await sendMessage('server-ws-echo', {
          text: echoText.value
        })
        if (result.ok === true) {
          echoResultText.value = `回显：${result.data.text}`
        } else {
          const { code, message } = result.error
          echoResultText.value = `错误：${formatError(code, message)}`
        }
      } catch {
        echoResultText.value = '错误：未知异常'
      } finally {
        echoLoading.value = false
        await refreshWsStatus()
      }
    }

    onMounted(() => {
      load()
      resolveWindowId()
      refreshWsStatus()
    })

    return {
      enabled,
      count,
      toggleEnabled,
      increment,
      openOptions,
      openSidePanel,
      closeSidePanel,
      healthLoading,
      healthText,
      checkHealth,
      wsStatus,
      wsErrorText,
      refreshWsStatus,
      echoText,
      echoLoading,
      echoResultText,
      sendEcho
    }
  }
})
</script>

<template>
  <div class="popup">
    <h3>popup 设置示例</h3>
    <div class="row">
      <span>功能开关</span>
      <el-switch v-model="enabled" @change="toggleEnabled" />
    </div>
    <div class="row">
      <span>计数器</span>
      <el-button size="small" @click="increment">{{ count }}</el-button>
    </div>
    <el-button size="small" link type="primary" @click="openOptions">
      打开设置页
    </el-button>
    <div class="row">
      <el-button size="small" type="primary" @click="openSidePanel">
        打开侧边栏
      </el-button>
      <el-button size="small" @click="closeSidePanel">关闭侧边栏</el-button>
    </div>

    <el-divider />

    <h3>HTTP 健康检查</h3>
    <div class="row">
      <el-button
        size="small"
        type="primary"
        :loading="healthLoading"
        :disabled="healthLoading"
        @click="checkHealth"
      >
        检查健康
      </el-button>
    </div>
    <div v-if="healthText" class="result">{{ healthText }}</div>

    <el-divider />

    <h3>WebSocket 回显</h3>
    <div class="row">
      <span>连接状态：{{ wsStatus || '未知' }}</span>
      <el-button size="small" @click="refreshWsStatus">刷新</el-button>
    </div>
    <div v-if="wsErrorText" class="result error">{{ wsErrorText }}</div>
    <div class="row echo-row">
      <el-input
        v-model="echoText"
        size="small"
        placeholder="输入回显文本"
        @keyup.enter="sendEcho"
      />
      <el-button
        size="small"
        type="primary"
        :disabled="!echoText || echoLoading"
        :loading="echoLoading"
        @click="sendEcho"
      >
        发送
      </el-button>
    </div>
    <div v-if="echoResultText" class="result">{{ echoResultText }}</div>
  </div>
</template>

<style scoped>
.popup {
  padding: 12px;
  min-width: 160px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.echo-row {
  gap: 8px;
}
.result {
  font-size: 12px;
  color: #606266;
  margin-bottom: 8px;
  word-break: break-all;
}
.result.error {
  color: #f56c6c;
}
</style>
