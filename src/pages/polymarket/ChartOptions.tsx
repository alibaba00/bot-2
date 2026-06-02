export const heatmapChartOptions = {
	tooltip: {
		show: false,
		trigger: 'axis'
	},
	xAxis: {
		type: 'category',
		// data: ['0-3', '3-6', '6-9', '9-12', '12-15'],
		data: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
	},
	yAxis: {
		type: 'category',
		// data: ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9'],
		// data: ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9'],
		data: Array.from({length: 40}, (_, i) => ((i - 20)/20).toFixed(1)),
	},
	visualMap: {
		min: -1,
		max: 1,
		calculable: true,
		orient: 'horizontal',
		left: 'center',
		// bottom: '15%',
		inRange: {
			color: [
			'#f00c',
			'#3333',
			'#3f0c',
			]
		  }
	  },	
	series: [
		{
			type: 'heatmap',
			data: []	as any
		}
	],
	grid: {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
		containLabel: true
	}
} as any

export const scatterChartOptions = {
	xAxis: {
		type: 'value',
		min: 0,
		max: 15,
		name: 'Minuten',
		splitLine: {
			show: true,
			lineStyle: {
				color: '#fff3',
				width: 0.5
			}
		}
	},
	yAxis: {
		type: 'value',
		splitLine: {
			show: true,
			lineStyle: {
				color: '#fff3',
				width: 0.5
			}
		}
	},
	series: [
		{
			type: 'scatter',
			name: 'Up',
			data: [] as any[],
			itemStyle: {
				color: 'green'
			},
			symbolSize: 5,
		},
		{
			type: 'scatter',
			name: 'Down',
			data: [] as any[],
			itemStyle: {
				color: 'red'
			},
			symbolSize: 5,
		}
	],
	grid: {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
	}
} as any

export const barChartOptions = {
	xAxis: {
		type: 'category',
	},
	yAxis: {
		type: 'value',
		splitLine: {
			show: true,
			lineStyle: {
				color: '#fff3',
				width: 0.5
			}
		}
	},
	series: [
		{
			data: [] as any[],
			type: 'bar',
			barGap: 0,
			barCategoryGap: 0
		}
	],
	grid: {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
		// containLabel: true
	}
} as any

export const barChartOptions2 = {
	xAxis: {
		type: 'category',
	},
	yAxis: {
		type: 'value',
		splitLine: {
			show: true,
			lineStyle: {
				color: '#fff3',
				width: 0.5
			}
		}
	},
	series: [
		{
			data: [] as any[],
			type: 'line',
			symbolSize: 0,
		}
	],
	grid: {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
		// containLabel: true
	}
} as any

export const distChartOptions = {
	useUTC: true,
	tooltip: {
		show: true,
		trigger: 'axis',
	},

	xAxis: [
		{
			type: 'time',
			boundaryGap: false,
			axisLabel: {
				showMinLabel: true,
				showMaxLabel: true,
			},
			data: [] as any[],
			// show a vertical line every X minutes
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 1,
					type: 'dashed'
				}
			}
		}
	],
	yAxis: [
		{
			type: 'value',
			scale: false,
			min: 0,
			max: 1,
			interval: 0.1,
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 0.5
				}
			}
		},
		{
			type: 'value',
			scale: false,
			min: -2,
			max: 2,
			interval: 0.2,
			splitLine: {
				show: true,
				lineStyle: {
					color: (value: number) => value === 0 ? '#FF6600' : '#fff3',
					width: (value: number) => value === 0 ? 2 : 0.5,
				}
			}
		},
	],
	dataZoom: [
		{
			type: 'inside',
			xAxisIndex: 0
		},
		{
			type: 'slider',
			xAxisIndex: 0
		}
	],
	series: [
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#0f0c',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
			tooltip: {
				show: true,
			},
			name: "chain",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#06fc',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
			tooltip: {
				show: true,
			},
			name: "dist",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#f00c',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
			yAxisIndex: 1,
			tooltip: {
				show: true,
			},
			name: "up/down",
		}
	],
	grid: {
		top: 0,
		left: 0,
		right: 0,
		// containLabel: true
	}
} as any

export const lineChartOptions = {
	// Choose axis ticks based on UTC time.
	useUTC: true,
	// title: {
	// 	text: 'Intraday Chart with Breaks (Single Day)',
	// 	left: 'center'
	// },
	tooltip: {
		show: true,
		trigger: 'axis',
	},
	xAxis: [
		{
			type: 'time',
			boundaryGap: false,
			axisLabel: {
				showMinLabel: true,
				showMaxLabel: true,
			},
			data: [] as any[],
			// show a vertical line every X minutes
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 1,
					type: 'dashed'
				}
			}
		}
	],
	yAxis: [
		{
			type: 'value',
			scale: false,
			min: 0,
			max: 1,
			interval: 0.1,
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 0.5
				}
			}
		},
		{
			type: 'value',
			scale: false,
			min: -2,
			max: +2,
			data: [] as any[],
			splitLine: {
				show: true,
				lineStyle: {
					color: (value: number) => value === 0 ? '#FF6600' : '#fff3',
					width: (value: number) => value === 0 ? 2 : 0.5,
				}
			},
		}
	],
	dataZoom: [
		{
			type: 'inside',
			xAxisIndex: 0
		},
		{
			type: 'slider',
			xAxisIndex: 0
		}
	],
	series: [
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#0f0c',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
			tooltip: {
				show: true,
			},
			name: "up",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#f00c',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
			tooltip: {
				show: true,
			},
			name: "down",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#06fc', // set to visible color (e.g. yellow)
			},
			symbolSize: 0,
			data: [] as any[],
			yAxisIndex: 1,
			step: 'end',
			tooltip: {
				show: false,
			},
			name: "chainlink",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#93fc',
			},
			symbolSize: 0,
			data: [] as any[],
			yAxisIndex: 1,
			step: 'end',
			tooltip: {
				show: false,
			},
			name: "polling",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#ff06',
			},
			symbolSize: 0,
			data: [] as any[],
			yAxisIndex: 1,
			step: 'end',
			tooltip: {
				show: false,
			},
			name: "coinbase",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: 'green',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
			tooltip: {
				show: false,
			},
			name: "grid",
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: 'violet',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
			tooltip: {
				show: false,
			},
			name: "binance",
		}
	],
	grid: {
		top: 0,
		left: 0,
		right: 0,
	}
} as any