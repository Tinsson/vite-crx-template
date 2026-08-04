<script lang="ts">
import { defineComponent, ref } from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import { onMessage, setCache, getCache } from './utils'

export default defineComponent({
  components: {
    ElButton,
    ElDialog
  },
  setup() {
    const dialogVisible = ref<boolean>(false)
    const cache = ref<string>('')

    // background 通过右键菜单触发，经 tabs.sendMessage 推送到本页面
    onMessage('ping-content', () => {
      return {
        url: location.href,
        title: document.title,
        injectedAt: Date.now()
      }
    })

    const handleOpen = async () => {
      dialogVisible.value = true
      await setCache('key1', Date.now())
      const data = await getCache('key1')
      cache.value = data.result
    }

    const handleClose = () => {
      dialogVisible.value = false
    }
    return {
      cache,
      dialogVisible,
      handleClose,
      handleOpen
    }
  }
})
</script>

<template>
  <div data-root="true" class="root">
    <el-button type="primary" @click="handleOpen">Open</el-button>

    <el-dialog
      v-model="dialogVisible"
      title="IndexedDB 缓存示例"
      width="30%"
      :before-close="handleClose"
    >
      <span>写入后读取的值：{{ cache }}</span>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="dialogVisible = false"
            >Confirm</el-button
          >
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.root {
  position: fixed;
  top: 68px;
  right: 36px;
  z-index: 1000;
  font-size: 14px;
}
</style>
