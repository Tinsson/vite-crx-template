<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  UPDATE_CHECK_INTERVAL_DEFAULT_MIN,
  UPDATE_CHECK_INTERVAL_MAX_MIN,
  UPDATE_CHECK_INTERVAL_MIN_MIN
} from '@vite-crx/shared'
import { sendMessage } from '~/shared/message'

export default defineComponent({
  setup() {
    const nickname = ref('')
    const enabled = ref(true)
    const saving = ref(false)

    const updateAvailable = ref(false)
    const updateHint = ref('')
    const autoUpdate = ref(true)
    const intervalMinutes = ref(UPDATE_CHECK_INTERVAL_DEFAULT_MIN)
    const savingUpdate = ref(false)

    const load = async () => {
      const nick = await sendMessage('get-setting', { key: 'nickname' })
      nickname.value = nick?.result ?? ''
      const en = await sendMessage('get-setting', { key: 'enabled' })
      enabled.value = en?.result ?? true
    }

    const loadUpdate = async () => {
      const result = await sendMessage('update-status', undefined)
      if (!result?.ok) {
        updateAvailable.value = false
        updateHint.value = '未连接到常驻服务，请先运行 pnpm server:start'
        return
      }
      if (!result.data.enabled) {
        updateAvailable.value = false
        updateHint.value =
          '当前是 dev 构建，自动更新只在生产构建 + daemon 下可用'
        return
      }
      updateAvailable.value = true
      updateHint.value = ''
      autoUpdate.value = result.data.config.autoUpdate
      intervalMinutes.value = result.data.config.checkIntervalMinutes
    }

    const save = async () => {
      saving.value = true
      await sendMessage('set-setting', {
        key: 'nickname',
        value: nickname.value
      })
      await sendMessage('set-setting', { key: 'enabled', value: enabled.value })
      saving.value = false
      ElMessage.success('保存成功')
    }

    const saveUpdate = async () => {
      savingUpdate.value = true
      try {
        const result = await sendMessage('update-set-config', {
          autoUpdate: autoUpdate.value,
          checkIntervalMinutes: intervalMinutes.value
        })
        if (result?.ok) {
          // 服务端会把间隔截断到允许范围，以返回值为准
          intervalMinutes.value = result.data.config.checkIntervalMinutes
          ElMessage.success('更新设置已保存')
        } else {
          const message =
            result && result.ok === false ? result.error.message : '未知异常'
          ElMessage.error(`保存失败：${message}`)
        }
      } finally {
        savingUpdate.value = false
      }
    }

    onMounted(() => {
      load()
      loadUpdate()
    })

    return {
      nickname,
      enabled,
      saving,
      save,
      updateAvailable,
      updateHint,
      autoUpdate,
      intervalMinutes,
      savingUpdate,
      saveUpdate,
      minInterval: UPDATE_CHECK_INTERVAL_MIN_MIN,
      maxInterval: UPDATE_CHECK_INTERVAL_MAX_MIN
    }
  }
})
</script>

<template>
  <div class="options">
    <h2>选项设置</h2>
    <el-form label-width="80px">
      <el-form-item label="昵称">
        <el-input
          v-model="nickname"
          placeholder="请输入昵称"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="enabled" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        >
      </el-form-item>
    </el-form>

    <h2>自动更新</h2>
    <p v-if="updateHint" class="hint">{{ updateHint }}</p>
    <el-form label-width="80px" :disabled="!updateAvailable">
      <el-form-item label="自动更新">
        <el-switch v-model="autoUpdate" />
      </el-form-item>
      <el-form-item label="检查间隔">
        <el-input-number
          v-model="intervalMinutes"
          :min="minInterval"
          :max="maxInterval"
          :step="5"
        />
        <span class="unit">分钟（{{ minInterval }} ~ {{ maxInterval }}）</span>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="savingUpdate" @click="saveUpdate"
          >保存更新设置</el-button
        >
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.options {
  padding: 24px;
}
.hint {
  color: #909399;
  font-size: 13px;
}
.unit {
  margin-left: 8px;
  color: #909399;
}
</style>
