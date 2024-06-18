import { useLocalStorage } from './useLocalStorage';

export function useUserStyle(key: string): [() => string, (value: string) => void, () => void] {
	const userRoot = document.body;
	const defaultValue = getComputedStyle(userRoot.parentElement as HTMLElement).getPropertyValue(key);
	const [state, setState, removeState] = useLocalStorage(key, defaultValue);
	const initialValue = state() || getComputedStyle(userRoot).getPropertyValue(key);

	function set(value: string) {
		if (value == defaultValue) {
			removeState();
			userRoot.style.removeProperty(key);
		} else {
			setState(value);
			userRoot.style.setProperty(key, value);
		}
	}
	const remove = () => set(defaultValue);

	// Force userRoot to take on local storage styles
	set(initialValue);

	return [state, set, remove];
}
