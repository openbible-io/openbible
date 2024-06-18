import { createSignal } from 'solid-js';

interface LocalStorageOptions<T> {
	serializer?: (value: T) => string;
	deserializer?: (value: string) => T;
}

export function useLocalStorage<T>(
	key: string,
	initialValue: T,
	options?: LocalStorageOptions<T>
): [() => T, (value: T) => void, () => void] {
	const serializer = options?.serializer ?? JSON.stringify;
	const deserializer = options?.deserializer ?? JSON.parse;

	function getStoredValue() {
		try {
			const raw = localStorage.getItem(key);
			if (raw) return deserializer(raw);
		} catch (error) {
			console.error(error);
		}

		return initialValue;
	};

	const [state, setState] = createSignal<T>(getStoredValue());

	function set(value: T) {
		try {
			localStorage.setItem(key, serializer(value));
			setState(value as any);
		} catch (error) {
			console.error(error);
		}
	};

	function remove() {
		try {
			localStorage.removeItem(key);
			setState(() => initialValue);
		} catch (error) {
			console.error(error);
		}
	};

	return [state, set, remove];
}
