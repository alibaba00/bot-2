import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { FileCode, Download, Copy, Save } from 'lucide-react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor';
// Import workers via Vite to ensure correct MIME type and URLs in web builds
// These are classes that construct Workers
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

interface FileContent {
	[key: string]: string
}

export default function EditorPage() {
	const [selectedFile, setSelectedFile] = useState<string>('package.json')
	const [fileContent, setFileContent] = useState<string>('')
	const [isLoading, setIsLoading] = useState<boolean>(true)

	const availableFiles = ['package.json', 'config.json']

	// Configure Monaco Editor loader with Vite workers
	useEffect(() => {
		// Configure Monaco Environment to return proper Worker instances
		if (typeof window !== 'undefined') {
			(window as Window & { MonacoEnvironment?: any }).MonacoEnvironment = {
				getWorker: function (_moduleId: string, label: string) {
					if (label === 'json') return new JsonWorker()
					if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
					if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
					if (label === 'typescript' || label === 'javascript') return new TsWorker()
					return new EditorWorker()
				}
			} as any
		}

		loader.config({ monaco });
		
		// Initialize the loader
		loader.init().then((monaco) => {
			console.log('Monaco Editor loaded successfully:', monaco)
		}).catch((error) => {
			console.error('Failed to load Monaco Editor:', error)
		})

	}, [])

	// Mock file contents - in a real app, these would be fetched from the server
	const fileContents: FileContent = useMemo(() => ({
		'package.json': `{
	"name": "app-template.2",
	"private": true,
	"version": "1.0.1",
	"type": "module",
	"description": "Demo App",
	"author": "Demo App",
	"main": "electron/main.js",
	"scripts": {
		"web": "vite",
		"web:build": "tsc -b && vite build",
		"web:build:subdir": "cross-env BASE_PATH=./ tsc -b && cross-env BASE_PATH=./ vite build",
		"web:build:custom": "tsc -b && vite build",
		"web:preview": "vite preview",
		"lint": "eslint .",
		"format": "prettier --write .",
		"format:check": "prettier --check .",
		"app": "cross-env NODE_ENV=development concurrently \\"vite\\" \\"electron .\\"",
		"app:build": "npm run web:build && electron-builder",
		"app:preview": "cross-env NODE_ENV=production electron ."
	},
	"build": {
		"appId": "com.demo.app",
		"productName": "Demo App",
		"directories": {
			"output": "dist"
		},
		"files": [
			"build/**/*",
			"electron/**/*"
		],
		"win": {
			"target": "nsis",
			"icon": "./public/assets/shadcn.jpg",
			"asar": true
		},
		"nsis": {
			"artifactName": "Demo-App-\\\\"+.exe",
			"allowToChangeInstallationDirectory": false,
			"oneClick": true,
			"include": "./electron/installer.nsh",
			"shortcutName": "Demo-App",
			"deleteAppDataOnUninstall": true,
			"runAfterFinish": true
		}
	},
	"dependencies": {
		"@radix-ui/react-avatar": "^1.1.10",
		"@radix-ui/react-collapsible": "^1.1.12",
		"@radix-ui/react-dialog": "^1.1.15",
		"@radix-ui/react-dropdown-menu": "^2.1.16",
		"@radix-ui/react-label": "^2.1.7",
		"@radix-ui/react-separator": "^1.1.7",
		"@radix-ui/react-slot": "^1.2.3",
		"@radix-ui/react-switch": "^1.2.6",
		"@radix-ui/react-tooltip": "^1.2.8",
		"@tailwindcss/vite": "^4.1.12",
		"class-variance-authority": "^0.7.1",
		"clsx": "^2.1.1",
		"localforage": "^1.10.0",
		"lucide-react": "^0.542.0",
		"react": "^19.1.1",
		"react-dom": "^19.1.1",
		"react-router-dom": "^7.8.2",
		"tailwind-merge": "^3.3.1",
		"tailwindcss": "^4.1.12",
		"zustand": "^5.0.8"
	},
	"devDependencies": {
		"@eslint/js": "^9.33.0",
		"@types/node": "^24.3.0",
		"@types/react": "^19.1.10",
		"@types/react-dom": "^19.1.7",
		"@vitejs/plugin-react": "^5.0.0",
		"cross-env": "^10.0.0",
		"electron": "^37.3.1",
		"electron-builder": "^26.0.12",
		"eslint": "^9.33.0",
		"eslint-plugin-react-hooks": "^5.2.0",
		"eslint-plugin-react-refresh": "^0.4.20",
		"globals": "^16.3.0",
		"prettier": "^3.6.2",
		"tw-animate-css": "^1.3.7",
		"typescript": "~5.8.3",
		"typescript-eslint": "^8.39.1",
		"vite": "^7.1.2"
	}
}`,
		'config.json': `{
	"name": "demo",
	"info": "welcome in the demo app",
	"version": "1.0.2",
	"release": "01.09.2025",
	"userConfig": "c:/jtcore/userConfig.json"
}`
	}), [])

	const loadFileContent = useCallback((filename: string) => {
		setIsLoading(true)
		// Simulate loading delay
		setTimeout(() => {
			setFileContent(fileContents[filename] || '')
			setIsLoading(false)
		}, 300)
	}, [fileContents])

	useEffect(() => {
		loadFileContent(selectedFile)
	}, [selectedFile, loadFileContent])

	const handleFileChange = (filename: string) => {
		setSelectedFile(filename)
	}

	const handleCopyContent = () => {
		navigator.clipboard.writeText(fileContent)
	}

	const handleDownloadFile = () => {
		const blob = new Blob([fileContent], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = selectedFile
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	const handleSaveFile = () => {
		// In a real app, this would save to the server
		console.log('Saving file:', selectedFile, fileContent)
		// Show success message or handle save logic
	}

	return (
		<div className='flex flex-1 flex-col gap-4 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-2xl font-bold'>Editor</h1>
					<p className='text-sm text-muted-foreground'>
						Edit and view configuration files with syntax highlighting
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<Select value={selectedFile} onValueChange={handleFileChange}>
						<SelectTrigger className='w-[200px]'>
							<SelectValue placeholder='Select a file' />
						</SelectTrigger>
						<SelectContent>
							{availableFiles.map((file) => (
								<SelectItem key={file} value={file}>
									<FileCode className='h-4 w-4 mr-2' />
									{file}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button variant='outline' size='sm' onClick={handleCopyContent}>
						<Copy className='h-4 w-4 mr-2' />
						Copy
					</Button>
					<Button variant='outline' size='sm' onClick={handleDownloadFile}>
						<Download className='h-4 w-4 mr-2' />
						Download
					</Button>
					<Button size='sm' onClick={handleSaveFile}>
						<Save className='h-4 w-4 mr-2' />
						Save
					</Button>
				</div>
			</div>

			<Card className='flex-1'>
				<CardHeader className='pb-3'>
					<CardTitle className='text-lg flex items-center gap-2'>
						<FileCode className='h-5 w-5' />
						{selectedFile}
					</CardTitle>
					<CardDescription>
						{isLoading ? 'Loading file...' : `${fileContent.split('\n').length} lines`}
					</CardDescription>
				</CardHeader>
				<CardContent className='pt-0 h-[600px]'>
					{isLoading ? (
						<div className='flex items-center justify-center h-full'>
							<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
						</div>
					) : (
						<Editor
							height='100%'
							defaultLanguage='json'
							value={fileContent}
							onChange={(value) => setFileContent(value || '')}
							theme='vs-dark'
							options={{
								readOnly: false,
								minimap: { enabled: true },
								scrollBeyondLastLine: false,
								fontSize: 14,
								wordWrap: 'on',
								automaticLayout: true,
								tabSize: 2,
								insertSpaces: true,
								detectIndentation: true,
								trimAutoWhitespace: true,
								largeFileOptimizations: true
							}}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
