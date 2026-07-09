import readmeContent from '../../README.md?raw'

export const LEGACY_STORAGE_KEY = 'markdown-preview-content'
export const DOCUMENTS_STORAGE_KEY = 'markdown-preview-documents'
export const DEFAULT_DOCUMENT_NAME = '新文档.md'

export const PRESET_DOCUMENTS = [
    { name: 'README.md', content: readmeContent },
]
