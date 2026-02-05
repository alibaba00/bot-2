import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
	{
		ignores: ['dist/**']
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.cjs'],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.node,
			sourceType: 'commonjs'
		},
		rules: {
			'import/no-commonjs': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-var-requires': 'off'
		}
	},
	{
		files: ['electron/**/*.js'],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.node,
			sourceType: 'module'
		}
	},
	{
		files: ['**/*.{ts,tsx}'],
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh
		},
		languageOptions: {
			ecmaVersion: 2020,
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': [
				'warn',
				{ allowConstantExport: true },
			],
			'prefer-const': 'error',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off'
		}
	}
]
