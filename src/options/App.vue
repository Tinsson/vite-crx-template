<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { sendMessage } from '~/shared/message'

export default defineComponent({
  setup() {
    const nickname = ref('')
    const enabled = ref(true)
    const saving = ref(false)

    const load = async () => {
      const nick = await sendMessage('get-setting', { key: 'nickname' })
      nickname.value = nick?.result ?? ''
      const en = await sendMessage('get-setting', { key: 'enabled' })
      enabled.value = en?.result ?? true
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

    onMounted(load)

    return {
      nickname,
      enabled,
      saving,
      save
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
  </div>
</template>

<style scoped>
.options {
  padding: 24px;
}
</style>
