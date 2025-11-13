import { Check, ExternalLink } from "lucide-react";
import { VersionLabel } from "./components/components";
import { Separator } from "./components/ui/separator";
import Store from "./Store";

const features = [
	{ label: 'PWA Support', link:'https://www.w3.org/TR/appmanifest/'},
	{ label: 'Vite Support', link:'https://vite.dev/'},
	{ label: 'React Support', link:'https://react.dev/'},
	{ label: 'TypeScript Support', link:'https://www.typescriptlang.org/'},
	{ label: 'SCSS Support', link:'https://sass-lang.com/'},
	{ label: 'Prettier Support', link:'https://prettier.io/'},
	{ label: 'ESLint Support', link:'https://eslint.org/'},
	{ label: 'Jest Support', link:'https://jestjs.io/'},
	{ label: 'React Testing Library Support', link:'https://testing-library.com/'},
	{ label: 'Electron Support', link:'https://www.electronjs.org/'},
	{ label: 'Shadcn Support', link:'https://ui.shadcn.com/'},
	{ label: 'Tailwind Support', link:'https://tailwindcss.com/'},
	{ label: 'React Router Support', link:'https://reactrouter.com/'},
	{ label: 'React Resizable Panels Support', link:'https://react-resizable-panels.com/'},
	{ label: 'Monaco Editor Support', link:'https://github.com/microsoft/monaco-editor'},
	{ label: 'Dexie Support', link:'https://dexie.org/'},
	{ label: 'Zustand Support', link:'https://zustand.docs.pmnd.rs/'},
	{ label: 'Localforage Support', link:'https://localforage.github.io/localForage/'},
]

export default function App() {
	return (
		<>
			<div className='app flex items-center justify-center '>
				<div className='flex flex-col gap-2 bg-card rounded-xl p-6 w-full max-w-md'>
					<h1>{'Demo App ' + Store.config?.version}</h1>
					<h4>This is a demo app for the Demo App Template.</h4>
					<Separator className="my-4" />
					<div className="flex flex-col gap-2 text-sm">
						{features.map((feature, index) => (
							<div key={index} className="flex items-center gap-2">
								<Check size={16} />
								{feature.label}
								<a href={feature.link} target="_blank" rel="noopener noreferrer">
									<ExternalLink size={16} />
								</a>
							</div>
						))}
					</div>

					<VersionLabel />
				</div>
			</div>
		</>
	)
}
