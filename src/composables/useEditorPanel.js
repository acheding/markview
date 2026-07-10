import { nextTick, ref } from 'vue'
import { useLocalStoragePreference } from './useLocalStoragePreference.js'
import { waitForAnimationFrame, waitForTransition } from '../utils/transition.js'

const TRANSITION_PROPERTIES = ['width', 'min-width', 'height', 'min-height']

export const useEditorPanel = ({ editorRef, previewRef, storageKey }) => {
    const isEditorCollapsed = useLocalStoragePreference(storageKey, false)
    const isScrollSyncEnabled = ref(!isEditorCollapsed.value)
    let transitionRunId = 0

    const setEditorPanelCollapsed = async (collapsed) => {
        const runId = ++transitionRunId
        isScrollSyncEnabled.value = false
        isEditorCollapsed.value = collapsed
        await nextTick()

        if (collapsed) {
            previewRef.value?.focus()
            return { expanded: false, settled: true }
        }

        editorRef.value?.focus({ preventScroll: true })
        await waitForTransition(editorRef.value?.getPanelElement(), TRANSITION_PROPERTIES)
        if (runId !== transitionRunId || isEditorCollapsed.value) return { expanded: false, settled: false }

        // CodeMirror 在容器尺寸稳定后重新测量，下一帧再开放滚动同步。
        editorRef.value?.requestMeasure()
        await waitForAnimationFrame()
        if (runId !== transitionRunId || isEditorCollapsed.value) return { expanded: false, settled: false }

        isScrollSyncEnabled.value = true
        return { expanded: true, settled: true }
    }

    return {
        isEditorCollapsed,
        isScrollSyncEnabled,
        setEditorPanelCollapsed
    }
}
