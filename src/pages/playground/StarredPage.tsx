import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function StarredPage() {
	// Mock starred items data
	const starredItems = [
		{
			id: 1,
			title: 'Advanced Neural Network Architecture',
			description:
				'A complex deep learning model with custom layers and attention mechanisms',
			tags: ['Deep Learning', 'Neural Networks', 'AI'],
			lastModified: '2 days ago',
			stars: 23
		},
		{
			id: 2,
			title: 'Real-time Data Processing Framework',
			description:
				'Scalable streaming data processing pipeline with Apache Kafka integration',
			tags: ['Data Processing', 'Streaming', 'Kafka'],
			lastModified: '5 days ago',
			stars: 18
		},
		{
			id: 3,
			title: 'Microservices Authentication System',
			description:
				'JWT-based authentication service with OAuth2 integration and rate limiting',
			tags: ['Authentication', 'Microservices', 'Security'],
			lastModified: '1 week ago',
			stars: 31
		},
		{
			id: 4,
			title: 'GraphQL API Generator',
			description: 'Automated GraphQL schema and resolver generation from database models',
			tags: ['GraphQL', 'API', 'Code Generation'],
			lastModified: '2 weeks ago',
			stars: 45
		}
	]

	return (
		<div className='flex flex-1 flex-col gap-4 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-2xl font-bold'>Starred</h1>
					<p className='text-sm text-muted-foreground'>
						Your bookmarked experiments and favorite playground items
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<div className='relative'>
						<Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
						<Input placeholder='Search starred items...' className='pl-8 w-[250px]' />
					</div>
					<Button variant='outline' size='sm'>
						<Filter className='h-4 w-4 mr-2' />
						Filter
					</Button>
				</div>
			</div>

			<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-1'>
				{starredItems.map((item) => (
					<Card
						key={item.id}
						className='hover:shadow-md transition-shadow cursor-pointer'>
						<CardHeader className='pb-3'>
							<div className='flex items-start justify-between'>
								<div className='flex-1'>
									<div className='flex items-center gap-2 mb-1'>
										<CardTitle className='text-lg'>{item.title}</CardTitle>
										<Star className='h-4 w-4 fill-yellow-400 text-yellow-400' />
									</div>
									<CardDescription className='mt-1'>
										{item.description}
									</CardDescription>
								</div>
								<div className='flex items-center gap-1 text-sm text-muted-foreground'>
									<Star className='h-4 w-4' />
									{item.stars}
								</div>
							</div>
						</CardHeader>
						<CardContent className='pt-0'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-2 flex-wrap'>
									{item.tags.map((tag) => (
										<span
											key={tag}
											className='inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10'>
											{tag}
										</span>
									))}
								</div>
								<div className='flex items-center gap-2'>
									<span className='text-sm text-muted-foreground'>
										Modified {item.lastModified}
									</span>
									<Button variant='ghost' size='sm'>
										Open
									</Button>
									<Button variant='ghost' size='sm'>
										<Star className='h-4 w-4' />
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{starredItems.length === 0 && (
				<div className='flex flex-col items-center justify-center py-12 text-center'>
					<Star className='h-12 w-12 text-muted-foreground mb-4' />
					<h3 className='text-lg font-semibold'>No starred items yet</h3>
					<p className='text-sm text-muted-foreground max-w-sm'>
						Star your favorite experiments and projects to find them easily here.
					</p>
				</div>
			)}
		</div>
	)
}
