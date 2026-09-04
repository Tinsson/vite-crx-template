<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { sendMessage } from '~/shared/message'
import { getCurrentWindowId } from '~/shared/sidePanel'

export default defineComponent({
  setup() {
    const nickname = ref('')
    const count = ref(0)

    const load = async () => {
      const [nick, cnt] = await Promise.all([
        sendMessage('get-setting', { key: 'nickname' }),
        sendMessage('get-setting', { key: 'count' })
      ])
      nickname.value = nick?.result ?? ''
      count.value = cnt?.result ?? 0
    }

    const closePanel = async () => {
      const windowId = await getCurrentWindowId()
      if (windowId !== undefined) {
        chrome.sidePanel.close({ windowId })
      }
    }

    onMounted(load)

    return {
      nickname,
      count,
      closePanel
    }
  }
})
</script>

<template>
  <div class="sidepanel">
    <h3>侧边栏示例</h3>
    <div class="row">
      <span>昵称</span>
      <span>{{ nickname || '未设置' }}</span>
    </div>
    <div class="row">
      <span>计数器</span>
      <span>{{ count }}</span>
    </div>
    <el-button size="small" @click="closePanel">关闭侧边栏</el-button>
  </div>
</template>

<style scoped>
.sidepanel {
  padding: 12px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}
</style>
