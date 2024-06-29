import { For, useContext, JSX, Switch, Match } from 'solid-js';
import { Reader } from '../components';
import { cssVars, CssVars, CssVar, CssVarControl } from '../settings';
import styles from './settings.module.css';

function capitalize(s: string) {
	return s.substring(0, 1).toUpperCase() + s.substring(1);
}

export function Settings() {
	const cssVars = useContext(CssVars);
	const onReset = (ev: Event) => {
		ev.preventDefault();
		type UseType = [() => any, (val: any) => void, () => void];
		Object.values(cssVars as unknown as UseType[]).forEach(i => i[2]());
	};

	return (
		<>
			<form class={styles.form} onReset={onReset}>
				<h2>CSS Variables</h2>
				<table>
					<tbody>
					<For each={Object.entries(cssVars ?? {})}>
						{([key, [getter, setter]]) =>
							<Setting key={key as CssVar} getter={getter} setter={setter} />
						}
					</For>
					</tbody>
				</table>
				<input type="reset" value="Reset all" />
			</form>
			<Reader class={styles.settingsReader} version="en_ust" book="psa" chapter={119} canClose={false} />
		</>
	);
}

interface SettingProps {
	key: CssVar;
	getter: () => string;
	setter: (v: string) => void
}
function Setting(props: SettingProps) {
	const control = cssVars[props.key] as Partial<CssVarControl>;
	const label = control.label ?? capitalize(props.key.replaceAll('-', ' ').trim());
	return (
		<tr>
			<td>
				<label for={props.key}>
					{label}
				</label>
			</td>
			<td>
				<SettingInput {...props} />
			</td>
		</tr>
	);
}

interface SettingInputProps {
	key: CssVar;
	getter: () => string;
	setter: (v: string) => void
}
function SettingInput(props: SettingInputProps) {
	const control = cssVars[props.key] as Partial<CssVarControl>;
	let type = control.type;
	let suffix = '';
	let inputProps: Partial<JSX.InputHTMLAttributes<HTMLInputElement>> = {
		id: props.key,
	};
	let toString = cssVars[props.key].toString ?? (a => a.toString());

	if (!type) {
		if (props.key.endsWith('color')) {
			type = 'color';
		} else if (props.key.endsWith('size')) {
			type = 'number';
			suffix = props.getter().replace(/\d+(\.\d+)?/, '');
			inputProps = {
				...inputProps,
				min: control.min ?? 1,
				max: control.max ?? 100,
				step: control.step ?? 1,
			};
		} else {
			type = 'text';
		}
	}

	return (
		<Switch fallback={`Need control for ${type}`}>
			<Match when={type == 'number'}>
				<span>
					<input
						type={type}
						value={parseFloat(props.getter())}
						onInput={(ev: any) => props.setter(ev.target.value + suffix)}
						{...inputProps}
					/>
					{suffix}
				</span>
			</Match>
			<Match when={type == 'checkbox'}>
				<input
					type={type}
					checked={props.getter() == toString(true)}
					onInput={(ev: any) => props.setter(toString(ev.target.checked))}
					{...inputProps}
				/>
			</Match>
			<Match when={['color', 'text'].includes(type)}>
				<input
					type={type}
					value={props.getter()}
					onInput={(ev: any) => props.setter(ev.target.value)}
					{...inputProps}
				/>
			</Match>
		</Switch>
	);
}
