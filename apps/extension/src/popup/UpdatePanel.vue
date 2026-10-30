<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref } from 'vue'
import type { UpdateStatus } from '@vite-crx/shared'
import { sendMessage } from '~/shared/message'
import type { LocalVersionInfo, NetworkResult } from '~/shared/message'
import {
  BLOCK_REASON_LABELS,
  UPDATE_STEPS,
  formatTime
} from '~/shared/updateLabels'

export default defineComponent({
  setup() {
    const local = ref<LocalVersionInfo | null>(null)
    const status = ref<UpdateStatus | null>(null)
    const offline = ref(false)
    const errorText = ref('')
    const checking = ref(false)
    const starting = ref(false)
    const showLog = ref(false)

    const apply = (result: NetworkResult<UpdateStatus> | undefined) => {
      if (result?.ok) {
        status.value = result.data
        offline.value = false
        errorText.value = ''
      } else {
        offline.value = true
        errorText.value =
          result && result.ok === false ? result.error.message : '未知异常'
      }
    }

    const refresh = async () => {
      apply(await sendMessage('update-status', undefined))
    }

    const check = async () => {
      checking.value = true
      try {
        apply(await sendMessage('update-check', undefined))
      } finally {
        checking.value = false
      }
    }

    const run = async () => {
      starting.value = true
      try {
        apply(await sendMessage('update-run', undefined))
      } finally {
        starting.value = false
      }
    }

    const running = computed(() => status.value?.job?.state === 'running')
    const activeStep = computed(() => {
      const job = status.value?.job
      if (!job) return -1
      const index = UPDATE_STEPS.findIndex((s) => s.step === job.step)
      return job.state === 'success' ? UPDATE_STEPS.length : index
    })
    const blockText = computed(() => {
      const s = status.value
      if (!s?.blockedBy) return ''
      const base = BLOCK_REASON_LABELS[s.blockedBy]
      return s.dirtyFiles.length
        ? `${base}：${s.dirtyFiles.slice(0, 3).join('、')}${s.dirtyFiles.length > 3 ? ' 等' : ''}`
        : base
    })

    const listener = (message: any) => {
      if (message?.taskId === 'update-changed') {
        status.value = message.params
        offline.value = false
      }
    }

    onMounted(async () => {
      chrome.runtime.onMessage.addListener(listener)
      local.value = await sendMessage('update-local-info', undefined)
      await refresh()
    })
    onUnmounted(() => chrome.runtime.onMessage.removeListener(listener))

    return {
      local,
      status,
      offline,
      errorText,
      checking,
      starting,
      showLog,
      running,
      activeStep,
      blockText,
      steps: UPDATE_STEPS,
      formatTime,
      check,
      run
    }
  }
})
</script>

<template>
  <div class="update-panel">
    <h3>扩展更新</h3>
    <div class="row">
      <span>当前版本</span>
      <span class="value">{{ local?.versionName ?? '-' }}</span>
    </div>

    <div v-if="offline" class="result error">
      未连接到常驻服务（{{ errorText }}），请先运行 pnpm server:start
    </div>
    <div v-else-if="status && !status.enabled" class="result">
      当前连接的是 dev 服务端，自动更新只在生产构建（extension/）+ daemon 下可用
    </div>

    <template v-else-if="status">
      <div class="row">
        <span>分支</span>
        <span class="value">{{ status.branch ?? '-' }}</span>
      </div>
      <div class="row">
        <span>远端版本</span>
        <span class="value">
          {{ status.remoteVersion ?? '-' }}
          <el-tag v-if="status.updateAvailable" size="small" type="warning">
            有新版本
          </el-tag>
        </span>
      </div>
      <div class="row small">
        <span>上次检查 {{ formatTime(status.lastCheckAt) }}</span>
        <span>
          下次
          {{
            status.config.autoUpdate ? formatTime(status.nextCheckAt) : '已关闭'
          }}
        </span>
      </div>
      <div v-if="blockText" class="result warn">{{ blockText }}</div>
      <div v-if="status.lastCheckError" class="result error">
        检查失败：{{ status.lastCheckError }}
      </div>

      <el-steps
        v-if="status.job"
        :active="activeStep"
        :process-status="status.job.state === 'failed' ? 'error' : 'process'"
        finish-status="success"
        size="small"
        simple
        class="steps"
      >
        <el-step v-for="s in steps" :key="s.step" :title="s.label" />
      </el-steps>
      <div
        v-if="status.job && !running"
        class="result"
        :class="{ error: status.job.state === 'failed' }"
      >
        {{ status.job.message }}
        <el-button
          v-if="status.job.logTail.length"
          link
          size="small"
          @click="showLog = !showLog"
        >
          {{ showLog ? '收起日志' : '查看日志' }}
        </el-button>
      </div>
      <pre v-if="showLog && status.job" class="log">{{
        status.job.logTail.join('\n')
      }}</pre>

      <div class="row">
        <el-button
          size="small"
          :loading="checking"
          :disabled="running"
          @click="check"
        >
          检查更新
        </el-button>
        <el-button
          size="small"
          type="primary"
          :loading="starting || running"
          :disabled="running"
          @click="run"
        >
          {{ running ? '更新中' : '拉取并更新' }}
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}
.row.small {
  font-size: 12px;
  color: #909399;
}
.value {
  font-size: 12px;
  color: #303133;
}
.steps {
  margin-bottom: 8px;
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
.result.warn {
  color: #e6a23c;
}
.log {
  max-height: 160px;
  overflow: auto;
  font-size: 11px;
  background: #f5f7fa;
  padding: 6px;
  margin: 0 0 8px;
  white-space: pre-wrap;
}
</style>
