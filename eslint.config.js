import js from '@eslint/js'
import globals from 'globals'
import vue from 'eslint-plugin-vue'

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'pnpm-lock.yaml']
    },
    js.configs.recommended,
    ...vue.configs['flat/recommended'],
    {
        files: ['**/*.{js,vue}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2024
            }
        },
        rules: {
            'no-alert': 'off',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'vue/attributes-order': 'off',
            'vue/html-closing-bracket-newline': 'off',
            'vue/html-self-closing': 'off',
            'vue/html-indent': 'off',
            'vue/max-attributes-per-line': 'off',
            'vue/multi-word-component-names': 'off',
            'vue/no-v-html': 'off',
            'vue/singleline-html-element-content-newline': 'off'
        }
    }
]
