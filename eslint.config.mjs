import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
  {
    ignores: [
      'dist',
      'local',
      'extension',
      'node_modules',
      'src/auto-imports.d.ts',
      'src/components.d.ts'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'vue/no-unused-vars': 'error'
    }
  },
  prettierRecommended,
  {
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
]
