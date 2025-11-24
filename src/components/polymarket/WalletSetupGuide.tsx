import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ExternalLink } from 'lucide-react'

export function WalletSetupGuide() {
	return (
		<Card className="border-orange-200 dark:border-orange-800">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
					<AlertCircle className="h-5 w-5" />
					Wallet Setup Required
				</CardTitle>
				<CardDescription>
					To use the API, you need a wallet with a private key
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<p className="text-sm">
						Your Polymarket account was created with email authentication, which uses a custodial wallet. 
						The CLOB API requires a private key to authenticate.
					</p>
					
					<div className="space-y-3 mt-4">
						<h4 className="font-semibold text-sm">Option 1: Connect a Wallet to Your Account</h4>
						<ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
							<li>Go to <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">polymarket.com <ExternalLink className="h-3 w-3" /></a></li>
							<li>Log in with your email account</li>
							<li>Navigate to Settings or Account settings</li>
							<li>Look for "Connect Wallet" or "Export Account" option</li>
							<li>Connect MetaMask or another wallet</li>
							<li>Export the private key from your connected wallet</li>
						</ol>
					</div>

					<div className="space-y-3 mt-4">
						<h4 className="font-semibold text-sm">Option 2: Create a New Wallet</h4>
						<ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
							<li>Create a new MetaMask wallet (or use an existing one)</li>
							<li>Export the private key from MetaMask</li>
							<li>Add the private key and public key (wallet address) to your .env file</li>
							<li>Transfer funds from your email account to the new wallet address</li>
							<li>Use the new wallet for API trading</li>
						</ol>
					</div>

					<div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md mt-4">
						<p className="text-xs text-blue-900 dark:text-blue-100">
							<strong>Note:</strong> Your current balance on polymarket.com is in a custodial wallet managed by Polymarket. 
							To trade via API, you'll need to either connect a wallet you control or transfer funds to a wallet you own.
						</p>
					</div>

					<div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md mt-4">
						<p className="text-xs text-yellow-900 dark:text-yellow-100">
							<strong>Security Warning:</strong> Never share your private key. Store it securely in your .env file 
							(which should be in .gitignore) and never commit it to version control.
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

