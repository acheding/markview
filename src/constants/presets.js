import readmeContent from '../../README.md?raw'

// 首次启动、IndexedDB 为空时写入的预置文档。
export const PRESET_DOCUMENTS = [{ name: 'README.md', content: readmeContent }]
