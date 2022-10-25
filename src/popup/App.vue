<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  setup() {
    const counter = ref<number>(1)
    const handleClick = () => {
      counter.value++
    }

    return {
      counter,
      handleClick
    }
  }
})
</script>

<template>
  <div data-root="true" class="root" @click="handleClick">test</div>
  <div>{{ counter }}</div>
</template>

<style scoped>
.root {
  font-size: 20px;
  color: #000;
}
</style>
