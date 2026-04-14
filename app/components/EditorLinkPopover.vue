<script setup lang="ts">
import { ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor
  autoOpen?: boolean
}>()

const url = ref('')
const isOpen = ref(props.autoOpen || false)

const setLink = () => {
  if (url.value === '') {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
  } else {
    props.editor.chain().focus().extendMarkRange('link').setLink({ href: url.value }).run()
  }
  isOpen.value = false
  url.value = ''
}

const removeLink = () => {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
    isOpen.value = false
}

</script>

<template>
  <UPopover v-model:open="isOpen">
    <UButton
      color="gray"
      variant="ghost"
      icon="i-lucide-link"
      size="sm"
      :class="{ 'bg-gray-100 dark:bg-gray-800': editor.isActive('link') }"
      title="Dodaj link"
    />

    <template #panel>
      <div class="p-2 flex items-center gap-2 w-64">
        <UInput
          v-model="url"
          placeholder="Wklej link..."
          class="flex-1"
          size="sm"
          @keydown.enter="setLink"
        />
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-check"
          @click="setLink"
        />
        <UButton
          v-if="editor.isActive('link')"
          color="red"
          variant="soft"
          size="sm"
          icon="i-lucide-trash"
          @click="removeLink"
        />
      </div>
    </template>
  </UPopover>
</template>