import { h } from 'preact'
import styles from './colorpalette.module.css'

interface ColorPaletteProps {
	onSelect: (color: string) => void;
}

export function ColorPalette(props: ColorPaletteProps) {
	const paletteRows = [
		[
			'rgb(0,0,0)',
			'rgb(67,67,67)',
			'rgb(102,102,102)',
			'rgb(153,153,153)',
			'rgb(183,183,183)',
			'rgb(204,204,204)',
			'rgb(217,217,217)',
			'rgb(239,239,239)',
			'rgb(243,243,243)',
			'rgb(255,255,255)',
		],
		[
			'rgb(152,0,0)',
			'rgb(255,0,0)',
			'rgb(255,153,0)',
			'rgb(255,255,0)',
			'rgb(0,255,0)',
			'rgb(0,255,255)',
			'rgb(74,134,232)',
			'rgb(0,0,255)',
			'rgb(153,0,255)',
			'rgb(255,0,255)',
		],
	]

	return (
		<table class={styles.table}>
			<tbody>
				{paletteRows.map(row =>
					<tr>
						{row.map(color =>
							<td>
								<div
									class={styles.swatch}
									style={{ background: color }}
									onClick={() => props.onSelect(color)}></div>
							</td>
						)}
					</tr>
				)}
			</tbody>
		</table>
	)
}
