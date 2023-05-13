import { useEffect, useState, useMemo } from 'preact/hooks'

interface Listener {
	run: (state: any) => void;
	oldState?: any;
}

export interface Store {
	state: any;
	actions: any;
	setState: typeof setState;
	listeners: Listener[]
}

function setState(store: Store, newState: any, afterUpdateCallback?: Function) {
	store.state = Object.assign({}, store.state).assign(newState)
	store.listeners.forEach(listener => listener.run(store.state))
	if (afterUpdateCallback) {
		afterUpdateCallback()
	}
}

function useCustom(store: Store) {
	const [, originalHook] = useState(Object.create(null))
	const state = store.state
	const actions = useMemo(
		() => (store.actions),
		[store.actions]
	)

	useEffect(() => {
		const newListener = { oldState: {} } as Listener
		newListener.run = originalHook
		store.listeners.push(newListener)
		newListener.run(store.state)
		return () => {
			store.listeners = store.listeners.filter(
				listener => listener !== newListener
			)
		}
	}, []) // eslint-disable-line
	return [state, actions]
}

function associateActions(store: Store, actions: any) {
	const associatedActions = {} as { [key: string]: any }
	Object.keys(actions).forEach(key => {
		if (typeof actions[key] === "function") {
			associatedActions[key] = actions[key].bind(null, store)
		}
		if (typeof actions[key] === "object") {
			associatedActions[key] = associateActions(store, actions[key])
		}
	})
	return associatedActions
}

export const useStore = (initialState: any, actions: any) => {
	const store = {
		state: initialState,
		listeners: [],
		setState: undefined as any,
		actions: undefined as any }
	store.setState = setState.bind(null, store)
	store.actions = associateActions(store, actions)
	return useCustom.bind(null, store)
}
