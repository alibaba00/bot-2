import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface Props {
	children: ReactNode
	fallback?: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
}

export class PolymarketErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error('Polymarket Error Boundary caught an error:', error, errorInfo)
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null })
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}

			return (
				<Card className='border-destructive m-4'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2 text-destructive'>
							<AlertCircle className='h-5 w-5' />
							Something went wrong
						</CardTitle>
						<CardDescription>
							An error occurred in the Polymarket component
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							{this.state.error && (
								<div className='p-3 bg-destructive/10 rounded-md'>
									<p className='text-sm font-mono text-destructive'>
										{this.state.error.message}
									</p>
								</div>
							)}
							<Button onClick={this.handleReset}>Try Again</Button>
						</div>
					</CardContent>
				</Card>
			)
		}

		return this.props.children
	}
}
