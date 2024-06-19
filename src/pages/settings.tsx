import { For, useContext } from 'solid-js';
import { Reader } from '../components';
import { Interaction, CssVars } from '../settings';
import styles from './settings.module.css';

function capitalize(s: string) {
	return s.substring(0, 1).toUpperCase() + s.substring(1);
}

export function Settings() {
	const cssVars = useContext(CssVars);
	const interaction = useContext(Interaction);
	const onReset = (ev: Event) => {
		ev.preventDefault();
		type UseType = [() => any, (val: any) => void, () => void];
		Object.values(cssVars as unknown as UseType[]).forEach(i => i[2]());
		Object.values(interaction as unknown as UseType[]).forEach(i => i[2]());
	};

	return (
		<>
			<form class={styles.form} onReset={onReset}>
				<h2>Interaction</h2>
				<For each={Object.entries(interaction ?? {})}>
					{([key, [getter, setter]]) =>
						<Setting key={key} getter={getter as any} setter={setter as any} />
					}
				</For>

				<h2>CSS Variables</h2>
				<For each={Object.entries(cssVars ?? {})}>
					{([key, [getter, setter]]) =>
						<Setting key={key} getter={getter} setter={setter} />
					}
				</For>
				<input type="reset" value="Reset all" />
			</form>
			<Reader text="en_ust" book="PSA" chapter={119} canClose={false} />
		</>
	);
}

interface SettingProps<T> {
	key: string;
	getter: () => T;
	setter: (v: T) => void
}
function Setting<T>(props: SettingProps<T>) {
	return (
		<p>
			<label>{capitalize(props.key.replaceAll('-', ' ').trim())}</label>
			<SettingInput {...props} />
		</p>
	);
}

interface SettingInputProps<T> {
	key: string;
	getter: () => T;
	setter: (v: T) => void
}
function SettingInput<T>(props: SettingInputProps<T>) {
	const val = props.getter();
	switch (typeof val) {
	case 'boolean':
		return (
			<input
				type="checkbox"
				checked={props.getter() as boolean}
				onInput={ev => props.setter(ev.target.checked as T)}
			/>
		);
	case 'string':
		if (props.key.includes('color')) {
			return (
				<input
					type="color"
					value={'' + props.getter()}
					onInput={(ev: any) => props.setter(ev.target.value)}
				/>
			);
		}
		for (const u of ['rem', 'em', 'px']) {
			if (val.endsWith(u)) {
				return (
					<span>
						<input
							type="number"
							min={0.5}
							max={2}
							step={0.01}
							value={'' + Number.parseFloat(props.getter())}
							onInput={(ev: any) => props.setter(ev.target.value + u)}
						/>
						{u}
					</span>
				);
			}
		}
		return (
			<input
				value={'' + props.getter()}
				onInput={(ev: any) => props.setter(ev.target.value)}
			/>
		);
	}
	if (Array.isArray(val)) {
		return (
			<ol>
				<For each={val}>
					{(_, index) =>
						<li>
							<SettingInput
								key={props.key}
								getter={() => (props.getter() as unknown[])[index()]}
								setter={v => {
									const old = (props.getter() as unknown[])[index()] as unknown[];
									old[index()] = v;
									props.setter(old as T);
								}}
							/>
						</li>
					}
				</For>
			</ol>
		);
	} else {
		console.warn('unknown setting type', typeof val);
	}
}
