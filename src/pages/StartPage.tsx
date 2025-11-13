import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function StartPage() {
	const navigate = useNavigate()

	return (
		<div className='p-5 text-center'>
			<h1 className='text-4xl font-bold mb-4'>Start Page</h1>
			<p className='text-lg mb-5'>Welcome to the application!</p>
			<div className='mt-5'>
				<Button onClick={() => navigate('/login')} className='mx-2'>
					Go to Login
				</Button>
				<Button onClick={() => navigate('/dashboard')} variant='secondary' className='mx-2'>
					Go to Dashboard
				</Button>
			</div>
		</div>
	)
}

export default StartPage
