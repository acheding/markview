<template>
    <div ref="switcherRef" class="file-switcher">
        <button
            class="file-switcher__trigger"
            type="button"
            :aria-expanded="isOpen"
            aria-haspopup="listbox"
            title="切换文件"
            @click="isOpen = !isOpen"
        >
            <span class="file-switcher__name">{{ activeFile?.name || '未命名.md' }}</span>
            <span class="file-switcher__chevron" aria-hidden="true" />
        </button>

        <div v-if="isOpen" class="file-switcher__menu" role="listbox">
            <div
                v-for="file in files"
                :key="file.id"
                class="file-switcher__option"
                :class="{ 'is-active': file.id === activeFileId }"
                role="option"
                :aria-selected="file.id === activeFileId"
            >
                <button
                    class="file-switcher__select"
                    type="button"
                    :title="file.name"
                    @click="selectFile(file.id)"
                >
                    {{ file.name }}
                </button>

                <button
                    class="file-switcher__delete"
                    type="button"
                    title="删除文件"
                    aria-label="删除文件"
                    @click.stop="deleteFile(file)"
                >
                    <span class="file-switcher__delete-icon" :style="{ '--icon-url': `url(${deleteFileIcon})` }" aria-hidden="true" />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import deleteFileIcon from '../assets/delete-file.svg'

const props = defineProps({
    files: {
        type: Array,
        default: () => [],
    },
    activeFileId: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['select-file', 'delete-file'])

const isOpen = ref(false)
const switcherRef = ref(null)
const activeFile = computed(() => props.files.find((file) => file.id === props.activeFileId))

const closeOnOutsideClick = (event) => {
    if (!switcherRef.value?.contains(event.target)) {
        isOpen.value = false
    }
}

const selectFile = (id) => {
    emit('select-file', id)
    isOpen.value = false
}

const deleteFile = (file) => {
    if (!confirm(`确定要删除「${file.name}」吗？`)) return

    emit('delete-file', file.id)
    isOpen.value = false
}

onMounted(() => {
    document.addEventListener('pointerdown', closeOnOutsideClick)
})

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', closeOnOutsideClick)
})
</script>

<style scoped>
.file-switcher {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    max-width: 100%;
}

.file-switcher__trigger,
.file-switcher__delete,
.file-switcher__select {
    font: inherit;
}

.file-switcher__trigger {
    display: inline-flex;
    align-items: center;
    width: 100%;
    height: 32px;
    gap: 8px;
    padding: 0 4px 0 0;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: 13px;
    font-weight: 650;
    transition: color 0.15s ease;
}

.file-switcher__trigger:hover {
    color: var(--color-accent);
}

.file-switcher__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-switcher__chevron {
    width: 7px;
    height: 7px;
    border-right: 1.6px solid currentColor;
    border-bottom: 1.6px solid currentColor;
    transform: translateY(-2px) rotate(45deg);
    flex-shrink: 0;
}

.file-switcher__delete {
    display: inline-grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    cursor: pointer;
}

.file-switcher__menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    width: 100%;
    max-height: 280px;
    overflow-y: auto;
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    box-shadow: var(--shadow-menu);
}

.file-switcher__option {
    display: flex;
    align-items: center;
    min-height: 32px;
    border-radius: 6px;
    transition: background 0.15s ease;
}

.file-switcher__option:hover,
.file-switcher__option.is-active {
    background: var(--color-surface-soft);
}

.file-switcher__option.is-active .file-switcher__select {
    color: var(--color-accent);
    font-weight: 650;
}

.file-switcher__select {
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0 8px;
    overflow: hidden;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: 13px;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-switcher__delete {
    width: 24px;
    height: 24px;
    margin-right: 2px;
    border-color: transparent;
    border-radius: 5px;
    color: var(--color-subtle);
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.file-switcher__delete:hover {
    border-color: color-mix(in srgb, var(--color-danger) 26%, #ffffff);
    background: var(--color-danger-soft);
    color: var(--color-danger);
}

.file-switcher__delete-icon {
    width: 14px;
    height: 14px;
    background: currentColor;
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
}

@media (max-width: 768px) {
    .file-switcher {
        width: min(52vw, 190px);
    }
}
</style>
