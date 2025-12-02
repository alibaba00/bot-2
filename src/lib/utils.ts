import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import React from 'react'
const os = (window as any).require?.('os')
const process = (window as any).process
const navigator = (window as any).navigator

//----------------------------------------------------------------------------- cn
export const cn = (...inputs: ClassValue[]) => {
	return twMerge(clsx(inputs))
}

//----------------------------------------------------------------------------- logSystem
export const logSystem = () => {
	const log = (...val) => {
		//colorized log output
		console.log('%c' + val.join(' '), 'color:#8b0')
	}

	const sys = getSystem()

	log('=================================================')
	log('agent            :', sys.agent)
	log('location         :', sys.location)
	log('environment      :', sys.environment)
	log('os               :', sys.os)
	if (os) {
		//electron
		log('computername     :', sys.computername)
		log('username         :', sys.username)
	}
	log('browser          :', sys.browser)
	log('device           :', sys.device)
	log('runtime          :', sys.runtime)

	if (process?.versions) {
		//electron
		log('node version     :', sys.version.node)
		log('chrome version   :', sys.version.chrome)
		log('electron version :', sys.version.electron)
	}

	log('react version    :', sys.version.react)
	log('=================================================')

	// global.system = sys;
	// global.isDev = sys.environment === 'development'	//short-key für development mode

	console.log('window:', window)
	if (os) console.log('os:', os)
	console.log('location:', window.location.href, window.location)
	console.log('navigator:', window.navigator)

	return sys
}

//----------------------------------------------------------------------------- getSystem
export const getSystem = () => {
	const sys = {} as any
	sys.agent = navigator.userAgent
	sys.location = window.location.href
	sys.environment = process?.env?.NODE_ENV || import.meta.env?.MODE || 'production' //development | production

	if (os) {
		sys.os = os.version?.() || getOs()

		//hotfix for windows 11 version
		if (sys.os.startsWith('Windows') && sys.release) {
			const ver = Number(sys.release.split('.').pop())
			if (ver >= 22000) sys.os = sys.os.replace('10', '11')
		}

		sys.os += ', ' + os.release?.() + ', ' + os.platform?.() + ' ' + os.arch?.()

		sys.computername = os.hostname?.()
		sys.username = os.userInfo?.().username
	} else {
		sys.os = getOs()
	}

	sys.browser = getBrowser()
	sys.device = getDevice()
	sys.runtime = getRuntime()
	sys.version = {
		react: React.version
	}

	if (process?.versions) {
		const v = process.versions || {}
		sys.version.node = v.node || ''
		sys.version.chrome = v.chrome || ''
		sys.version.electron = v.electron || ''
	}

	return sys
}

//----------------------------------------------------------------------------- getOs
export const getOs = () => {
	const ua = window.navigator.userAgent
	if (ua.indexOf('Win') !== -1) return 'Windows'
	if (ua.indexOf('Mac') !== -1) return 'MacOS'
	if (ua.indexOf('X11') !== -1) return 'UNIX'
	if (ua.indexOf('Linux') !== -1) return 'Linux'
	return 'unknown'
}

//----------------------------------------------------------------------------- getBrowser
export const getBrowser = () => {
	//https://developer.mozilla.org/en-US/docs/Web/API/Window/navigator
	let sBrowser = navigator.userAgent
	// The order matters here, and this may report false positives for unlisted browsers.
	if (sBrowser.indexOf('Firefox') > -1) {
		sBrowser = 'Mozilla Firefox'
		// "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:61.0) Gecko/20100101 Firefox/61.0"
	} else if (sBrowser.indexOf('SamsungBrowser') > -1) {
		sBrowser = 'Samsung Internet'
		// "Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G955F Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/9.4 Chrome/67.0.3396.87 Mobile Safari/537.36
	} else if (sBrowser.indexOf('Opera') > -1 || sBrowser.indexOf('OPR') > -1) {
		sBrowser = 'Opera'
		// "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 OPR/57.0.3098.106"
	} else if (sBrowser.indexOf('Trident') > -1) {
		sBrowser = 'Microsoft Internet Explorer'
		// "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; Zoom 3.6.0; wbx 1.0.0; rv:11.0) like Gecko"
	} else if (sBrowser.indexOf('Edge') > -1) {
		sBrowser = 'Microsoft Edge'
		// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299"
	} else if (sBrowser.indexOf('Chrome') > -1) {
		sBrowser = 'Google Chrome or Chromium'
		// "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/66.0.3359.181 Chrome/66.0.3359.181 Safari/537.36"
	} else if (sBrowser.indexOf('Safari') > -1) {
		sBrowser = 'Apple Safari'
		// "Mozilla/5.0 (iPhone; CPU iPhone OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15E148 Safari/604.1 980x1306"
	} else {
		sBrowser = 'unknown'
	}

	// console.log('browser:', sBrowser);
	return sBrowser
}

//----------------------------------------------------------------------------- getDevice
export const getDevice = () => {
	//https://dev.to/itsabdessalam/detect-current-device-type-with-javascript-490j
	const ua = navigator.userAgent
	if (ua.includes('Electron')) {
		return 'desktop'
	}
	// if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {	//macintosh can also be a mac
	if (/(tablet|ipad|macintosh|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
		return 'tablet' //macbook is like a tablet
	}
	if (
		/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
			ua
		)
	) {
		return 'mobile'
	}
	return 'browser'
}

//----------------------------------------------------------------------------- getRuntime
export const getRuntime = () => {
	return typeof process !== 'undefined' && process?.release?.name === 'node' ? 'node' : 'web'
}
