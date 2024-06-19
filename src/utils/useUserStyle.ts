import { useLocalStorage } from './useLocalStorage';

export function useUserStyle(key: string): [() => string, (value: string) => void, () => void] {
	const root = document.documentElement;
	const defaultValue = getComputedStyle(root).getPropertyValue(key);
	const [state, setState, removeState] = useLocalStorage(key, defaultValue);
	const initialValue = state();

	function set(value: string) {
		if (value == defaultValue) {
			removeState();
			root.style.removeProperty(key);
		} else {
			setState(value);
			root.style.setProperty(key, value);
		}
	}
	const remove = () => set(defaultValue);

	// Force userRoot to take on local storage styles
	set(initialValue);

	return [state, set, remove];
}
