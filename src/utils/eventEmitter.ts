type Listener = (...args: any) => void

const events = { } as { [key: string]: Listener[] }

export function unsubscribe(event: string, listener: Listener) {
	for (let i = 0; i < events[event].length; i++) {
		if (events[event][i] === listener) {
			events[event].splice(i, 1)
		}
	}
}

export function emit(event: string, ...args: any) {
	const listeners = events[event] || []
	listeners.forEach(listener => listener(...args))
}
