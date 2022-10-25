<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  setup() {
    const counter = ref<number>(1)
    return {
      counter
    }
  }
})
</script>

<template>
  <div data-root="true" class="root">test</div>
  <div>{{ counter }}</div>
</template>

<style scoped>
.root {
  font-size: 18px;
}
</style>
