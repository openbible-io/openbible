import { useState, StateUpdater } from 'preact/hooks'

export function useLocalStorage<S>(key: string, initialValue: S): [S, StateUpdater<S>] {
	const [storedValue, setStoredValue] = useState(() => {
		const item = window.localStorage.getItem(key);
		return item ? JSON.parse(item) : initialValue;
	});
	const setValue = (value: any) => {
		setStoredValue(value);
		window.localStorage.setItem(key, JSON.stringify(value));
	};

	return [storedValue, setValue];
}
