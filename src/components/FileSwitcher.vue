<template>
    <div ref="switcherRef" class="file-switcher">
        <button
            class="file-switcher__trigger"
            type="button"
            :aria-expanded="isOpen"
            aria-haspopup="listbox"
            v-tooltip="'切换文档'"
            @click="isOpen = !isOpen"
        >
            <span
                v-if="disk.isLinked(activeFileId)"
                class="file-switcher__link-badge"
                :style="{ '--icon-url': `url(${fileLinkIcon})` }"
                aria-hidden="true"
            />
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
                <button class="file-switcher__select" type="button" :title="file.name" @click="selectFile(file.id)">
                    <span
                        v-if="disk.isLinked(file.id)"
                        class="file-switcher__link-badge"
                        title="已关联本地文件"
                        aria-label="已关联本地文件"
                        :style="{ '--icon-url': `url(${fileLinkIcon})` }"
                    />
                    <span class="file-switcher__select-name">{{ file.name }}</span>
                </button>

                <button
                    class="file-switcher__delete"
                    type="button"
                    v-tooltip="'删除文档'"
                    aria-label="删除文档"
                    @click.stop="deleteFile(file)"
                >
                    <span
                        class="file-switcher__delete-icon"
                        :style="{ '--icon-url': `url(${deleteFileIcon})` }"
                        aria-hidden="true"
                    />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import deleteFileIcon from '../assets/delete-file.svg'
import fileLinkIcon from '../assets/file-link.svg'
import { useWorkspace } from '../workspace/workspaceKey.js'

const { documents, disk, confirm } = useWorkspace()
const files = documents.files
const activeFileId = documents.activeFileId

const isOpen = ref(false)
const switcherRef = ref(null)
const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value))

const closeOnOutsideClick = (event) => {
    if (!switcherRef.value?.contains(event.target)) {
        isOpen.value = false
    }
}

const selectFile = (id) => {
    documents.select(id)
    isOpen.value = false
}

// 关联本地文件的文档：删除只是移除工作区里的工作副本与文件关联（句柄清理见 fileSession），
// 磁盘源文件不受影响，文案需明确说清，避免用户误以为会删掉本地文件。
const deleteFile = async (file) => {
    const isLinked = disk.isLinked(file.id)
    const ok = await confirm.ask({
        title: isLinked ? '移除文档' : '删除文档',
        message: isLinked
            ? `确定要移除「${file.name}」吗？只会移除 MarkView 中的文档，本地文件不会被删除；尚未写回的编辑将会丢失。`
            : `确定要删除「${file.name}」吗？删除后无法恢复。`,
        confirmLabel: isLinked ? '移除' : '删除',
        tone: 'danger'
    })
    if (!ok) return

    documents.remove(file.id)
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
    font-size: var(--font-size-md);
    font-weight: 650;
    transition: color var(--duration-fast) ease;
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

.file-switcher__menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: var(--z-file-menu);
    width: max-content;
    max-width: 100%;
    /* 280px ≈ 8.75 行，露半行暗示可滚动；calc 兜底防手机横屏等矮视口溢出（120px ≈ 工具栏 + 触发器 + 边距） */
    max-height: min(280px, calc(100vh - 120px));
    overflow-y: auto;
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-menu);
}

.file-switcher__option {
    display: flex;
    align-items: center;
    min-height: 32px;
    border-radius: var(--radius-md);
    transition: background var(--duration-fast) ease;
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
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0 8px;
    overflow: hidden;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: var(--font-size-md);
    text-align: left;
}

.file-switcher__select-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 关联本地文件的标识：链形小图标，随文字颜色 */
.file-switcher__link-badge {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    background: currentColor;
    mask: var(--icon-url) center / contain no-repeat;
    -webkit-mask: var(--icon-url) center / contain no-repeat;
    opacity: 0.72;
}

.file-switcher__delete {
    width: 24px;
    height: 24px;
    margin-right: 2px;
    display: inline-grid;
    place-items: center;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 5px;
    background: var(--color-surface);
    color: var(--color-subtle);
    cursor: pointer;
    transition:
        background var(--duration-fast) ease,
        border-color var(--duration-fast) ease,
        color var(--duration-fast) ease;
}

.file-switcher__delete:hover {
    border-color: color-mix(in srgb, var(--color-danger) 26%, #ffffff);
    background: var(--color-danger-soft);
    color: var(--color-danger);
}

.file-switcher__delete-icon {
    width: 16px;
    height: 16px;
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
