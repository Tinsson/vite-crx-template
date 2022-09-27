<script setup lang="ts">
import { ref } from 'vue'

const dialogVisible = ref(false)
function handleOpen() {
  dialogVisible.value = true
}

const handleClose = () => {
  dialogVisible.value = false
}
</script>

<template>
  <div data-root="true" class="root">
    <el-button type="primary" @click="handleOpen">Start Test</el-button>

    <el-dialog
      v-model="dialogVisible"
      title="Tips"
      width="30%"
      :before-close="handleClose"
    >
      <span>This is a test message for ContentScript</span>
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
}
.big-text {
  font-size: 50px;
  font-weight: bold;
}
</style>
