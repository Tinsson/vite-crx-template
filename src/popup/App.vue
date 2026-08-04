<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { sendMessage } from '~/shared/message'
import { getCurrentWindowId } from '~/shared/sidePanel'

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

    onMounted(() => {
      load()
      resolveWindowId()
    })

    return {
      enabled,
      count,
      toggleEnabled,
      increment,
      openOptions,
      openSidePanel,
      closeSidePanel
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
</style>
