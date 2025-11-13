# App-TemplateSetup for React + TypeScript + Vite

### versions:

```bash
Cursor Version: 1.7.46 (system setup)
VSCode Version: 1.99.3
Commit: b9e5948c1ad20443a5cecba6b84a3c9b99d62580
Date: 2025-10-14T01:21:46.830Z
Electron: 34.5.8
electron-builder  version=26.0.12
Chromium: 132.0.6834.210
Node.js: 20.19.1 (v24.6.0)
V8: 13.2.152.41-electron.0
OS: Windows_NT x64 10.0.19045
```

### guide:

- https://vite.dev/guide/

### globals:

`npm -i -g concurrently`

### install:

`npm create vite@latest
-> app-template.5
-> Typescript SWC`

### first start:

`npm run dev`

### build:

`npm run build`

-> initial commit

---

## BASIC SETUP:

### scss support:

- `npm i sass`

- rename App.css to App.scss

### config prettier:

- .prettierrc.yaml

```yaml
singleQuote: true
jsxSingleQuote: true
semi: false
printWidth: 100
trailingComma: none
tabWidth: 4
useTabs: true
bracketSameLine: true
```

- .prettierignore

```yaml
# files and folders to ignore from Prettier formatting
README.md
SETUP.md
.specstory
.vscode
.git
.gitignore
.prettierrc.yaml
.prettierignore
.eslintrc.yaml
.eslintignore
.eslintrc.js
```

### update gitignore:

- .gitignore

```bash
build/
backup/
.specstory/
*-lock.json
*.lock
```

### update vite config with port 4000 and hotreload:

- vite.config.ts:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	base: './', // Use relative paths instead of absolute paths
	build: {
		outDir: 'build'
	},
	server: {
		port: 4000,
		open: true
	}
})
```


-------------------------------------------------------------------------------
## add Electron support

### install:
`npm i -D electron electron-builder cross-env`

### add files:
```bash
electron/
	├── installer.nsh
	└── main.js
public/
	├── icons/
	│   ├──	logo192.png
	│   └── logo512.png
	└── favicon.ico
```

### update package
- package.json:
```json
	"name": "demo-app-template",
	"private": true,
	"version": "1.0.0",
	"type": "module",

	"description": "Demo App Template",
	"author": "a.lang@jtm.digital",
	"license": "MIT",
	"main": "electron/main.js",
	"homepage": "./",

	"scripts": {
		"web": "vite",
		"build": "tsc -b && vite build",
		"web:preview": "vite preview",
		"app": "cross-env NODE_ENV=development concurrently \"vite\" \"electron .\"",
		"dist": "npm run build && electron-builder",
		"app:preview": "cross-env NODE_ENV=production electron .",
		"lint": "eslint ."
	},
	"build": {
		"appId": "com.demo.app.template",
		"productName": "Demo App Template",
		"directories": {
			"output": "dist",
			"buildResources": "build"
		},
		"files": [
			"build/**/*",
			"electron/**/*",
			"!dist/**/*"
		],
		"win": {
			"target": "nsis",
			"icon": "./public/icons/logo512.png",
			"asar": true
		},
		"nsis": {
			"artifactName": "Demo-App-Template-${version}.exe",
			"allowToChangeInstallationDirectory": false,
			"oneClick": true,
			"include": "./electron/installer.nsh",
			"shortcutName": "Demo-App-Template",
			"deleteAppDataOnUninstall": true,
			"runAfterFinish": true
		}
	},
	...
```

### update main.js:
- electron/main.js:
```javascript
	const win = new BrowserWindow({
		width: 1200,
		height: 900,
		autoHideMenuBar: true,
		webPreferences: {
			nodeIntegration			: true,		//important for node support
			nodeIntegrationInWorker : true,
			nodeIntegrationInSubFrames: true,	//node support in iframes
			webSecurity				: false,	//disable cors
			nativeWindowOpen 		: true,		//to use Chrome's built-in window.open() method and not BrowserWindowProxy
			backgroundThrottling 	: false,	//disabel throttling if minimized
			enableRemoteModule		: true,
			contextIsolation		: false,	//disable context isolation to use window.require()
			sandbox: false,
			// 	preload: join(__dirname, 'preload.cjs'),
		}
	})
```

### add vite.config:
- vite.config.ts:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	base: './', // Use relative paths instead of absolute paths
	build: {
		outDir: 'build'
	},
	server: {
		port: 4000,
		open: false
	}
})
```

### add .env:
```bash
VITE_PORT=4000
```

### start app:
`yarn app`

### start web:
`yarn web`

### build:
`yarn build` -> build

### dist:
`yarn dist` -> dist



-------------------------------------------------------------------------------
## add tailwind:

### guide:
https://tailwindcss.com/docs/installation/using-vite

### install:
`npm i tailwindcss @tailwindcss/vite`

### update vite.config.ts:
```typescript
...
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
	plugins: [
		react(),
		tailwindcss()
	],
})
```

### update index.css:
```css
@import 'tailwindcss';
```

---

## add shadcn:

### guide:

https://ui.shadcn.com/docs/installation/vite

### update tsconfig.json & tsconfig.app.json & tsconfig.node.json:

```json
	"compilerOptions": {
		...
		"baseUrl": ".",
		"paths": {
			"@/*": ["./src/*"]
		}
	}
```

### install types/node:

`npm i -D @types/node`

### update vite.config:

- vite.config.ts:

```ts
...
import path from 'path'

export default defineConfig({
	...
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	}
})
```

### clear index.css

### install CLI:

`npx shadcn@latest init`
-> Neutral

### switch default theme to dark:

- index.html:
  `<html lang="en" class="dark">`

### add button component:

`npx shadcn@latest add button`

### fixing the avatar issue:
- src/components/app-sidebar.tsx:
```ts
	avatar: './icons/shadcn.jpg'
```


-------------------------------------------------------------------------------
## add blocks for shadcn:

### add blocks sidebar-07:

- guide:
  https://ui.shadcn.com/blocks

- install:
  `npx shadcn@latest add sidebar-07`

### create Dashboard page:

create pages/DashboardPage.tsx
and copy code to pages/DashboardPage.tsx

### fixing the VariantProps issue:

`npm i -D class-variance-authority@latest`

H:\DEV\VITE\app-template.2\src\components\ui\sidebar.tsx
`import { cva, type VariantProps } from "class-variance-authority"`

### add login page:

https://ui.shadcn.com/blocks/login#login-01
`npx shadcn@latest add login-01`
and copy code to pages/LoginPage.tsx



-------------------------------------------------------------------------------
### set tweakcn styling:

## from:
https://tweakcn.com/editor/theme

Tanegerine:
original:
`npx shadcn@latest add https://tweakcn.com/r/themes/tangerine.json`
modified:
`npx shadcn@latest add https://tweakcn.com/r/themes/cmfv41au0000j04jrghhq5vzg`

## add Theme-Provider for dark mode:
- guide:
https://ui.shadcn.com/docs/dark-mode/vite
- add components/mode-toggle.tsx
- add components/theme-provider.tsx

add Theme-Provider to the App.tsx
```tsx
	...
	return (
		<ThemeProvider defaultTheme='dark'>
			...
		</ThemeProvider>				
	)
```

add logout-button to DashboardPage.tsx

add <ModeToggle /> to DashboardPage.tsx



-------------------------------------------------------------------------------
## add routing:

- guide:
https://reactrouter.com/

- install:
`npm i react-router-dom`


-------------------------------------------------------------------------------
## esling config:

- .eslintrc.js:
```javascript
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
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off'
		}
	}
]
```
config.json
version
"@radix-ui/react-avatar": "^1.1.10",
"@radix-ui/react-checkbox": "^1.3.3",
"@radix-ui/react-collapsible": "^1.1.12",
"@radix-ui/react-dialog": "^1.1.15",
"@radix-ui/react-dropdown-menu": "^2.1.16",
"@radix-ui/react-label": "^2.1.7",
"@radix-ui/react-select": "^2.2.6",
"@radix-ui/react-separator": "^1.1.7",
"@radix-ui/react-slider": "^1.3.6",
"@radix-ui/react-slot": "^1.2.3",
"@radix-ui/react-switch": "^1.2.6",
"@radix-ui/react-toggle": "^1.1.10",
"@radix-ui/react-toggle-group": "^1.1.11",
"@radix-ui/react-tooltip": "^1.2.8",
monaco-editor
dexie
zustand
localforage
react-resizable-panels
PageView
radix-ui for tabs



-------------------------------------------------------------------------------
## add monaco editor:
npm i @monaco-editor/react
npm i monaco-editor


todo:
pwa support


-------------------------------------------------------------------------------
## pwa support:

- guide:
https://vite-pwa-org.netlify.app/guide/
https://www.w3.org/TR/appmanifest/

- install:
`npm i -D vite-plugin-pwa workbox-window`

- update vite.config.ts:
```ts
import { VitePWAOptions } from 'vite-plugin-pwa'

const pwaOptions: VitePWAOptions = {
	registerType: 'autoUpdate',
	disable: process.env.NODE_ENV === 'development',
	includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
	manifest: {
		name: 'Demo App',
		short_name: 'Demo App',
		description: 'Demo App Template',
		theme_color: '#000000',
		background_color: '#000000',
		display: 'standalone',
		orientation: 'portrait',
		scope: './',
		start_url: './',
		icons: [
			{
				src: 'pwa-192x192.png',
				sizes: '192x192',
				type: 'image/png'
			},
			{
				src: 'pwa-512x512.png',
				sizes: '512x512',
				type: 'image/png'
			},
			{
				src: 'pwa-512x512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any maskable'
			}
		]
	},
	workbox: {
		globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
		runtimeCaching: [
			{
				urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
				handler: 'CacheFirst',
				options: {
					cacheName: 'google-fonts-cache',
					expiration: {
						maxEntries: 10,
						maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
					}
				}
			},
			{
				urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
				handler: 'CacheFirst',
				options: {
					cacheName: 'gstatic-fonts-cache',
					expiration: {
						maxEntries: 10,
						maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
					}
				}
			}
		]
	}
}

export default defineConfig({
	...
	plugins: [
		...
		VitePWA(pwaOptions)
	]
})
```

- vite-env.d.ts:
```ts
/// <reference types="vite-plugin-pwa/client" />
```

### add files:
```bash
src/
	├── components/
	│	└── PWAInstallPrompt.tsx
	└── hooks/
		└── use-pwa.ts
```

### update package.json:
```json
	"scripts": {
		"build": "vite build",
		"preview": "vite preview",
		"pwa": "vite build --mode pwa"
	}
```

### update index.html:
```html
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Demo App</title>
	</head>
```

### update AppDemo.tsx:
```tsx
import { PWAInstallPrompt } from './components/PWAInstallPrompt'

return (
	<>
		...
		<PWAInstallPrompt />
	</>
)
```



-------------------------------------------------------------------------------
## GIT-REPO

- App-Template:
  https://gitlab.com/ali-jt/app-template

- clone with SSH:
  git clone git@gitlab.com:ali-jt/app-template.git

- clone with HTTPS:
  git clone https://gitlab.com/ali-jt/app-template.git

- apply git source:
  git remote add origin git@gitlab.com:ali-jt/app-template.git



-------------------------------------------------------------------------------
### online demo:
https://www.cid.co.at/apps/demo/
https://www.cid.co.at/demo/

### Dynamic Base Path Configuration:
The application supports dynamic base path configuration using the Store:

1. **Store Integration**: The Store already includes `getBasename()` function
   - Automatically detects base path from current URL
   - Handles Electron, file protocol, and development environments
   - Access via: `Store.basename`

2. **Environment Variable**: Set `VITE_BASE_PATH` for build-time configuration
   ```bash
   VITE_BASE_PATH=/apps/demo/
   ```

3. **Build Configuration**: 
   - Development: Uses relative paths (`./`)
   - Production: Uses `VITE_BASE_PATH` or defaults to `/apps/demo/`
   - Runtime: Store handles dynamic detection automatically



-------------------------------------------------------------------------------
## TOOLS:

taskkill /F /IM node.exe
taskkill /F /IM electron.exe
npx prettier --check .
npx prettier --write .


-------------------------------------------------------------------------------
## Issues:
"dotenv": "^17.2.3",
