import { createSignal } from 'solid-js'
import styles from './toolbar.module.css'
import { AddCommentIcon, UndoIcon, RedoIcon, FormatBoldIcon, FormatItalicIcon, FormatUnderlinedIcon, TextColorIcon, HighlightColorIcon } from '../../icons/index'
import { emit } from '../../utils/eventEmitter'
import { ColorPalette } from './colorpalette'

export function Toolbar() {
	const [textColor, setTextColor] = createSignal('rgb(255,0,0)')
	const [highlightColor, setHighlightColor] = createSignal('rgb(255,0,0)')
	const [isTextColorPaletteOpen, setTextColorPaletteOpen] = createSignal(false)
	const [isHighlightPaletteOpen, setHighlightPaletteOpen] = createSignal(false)

	const onToggleTextPaletteOpen = () => {
		setTextColorPaletteOpen(open => !open)
		setHighlightPaletteOpen(false)
	}

	const onToggleHighlightPaletteOpen = () => {
		setHighlightPaletteOpen(open => !open)
		setTextColorPaletteOpen(false)
	}

	return (
		<div class={styles.toolbar} role="toolbar">
			<button class={styles.button}>
				<UndoIcon style={{ fill: '#5f6368' }} />
				<span class={styles.tooltip}>Undo</span>
			</button>
			<button class={styles.button}>
				<RedoIcon style={{ fill: '#5f6368' }} />
				<span class={styles.tooltip}>Redo</span>
			</button>
			<button class={styles.button}>
				<FormatBoldIcon style={{ fill: '#5f6368' }} />
				<span class={styles.tooltip}>Bold</span>
			</button>
			<button class={styles.button}>
				<FormatItalicIcon style={{ fill: '#5f6368' }} />
				<span class={styles.tooltip}>Italic</span>
			</button>
			<button class={styles.button}>
				<FormatUnderlinedIcon style={{ fill: '#5f6368' }} />
				<span class={styles.tooltip}>Underline</span>
			</button>
			<button class={styles.button} onClick={onToggleTextPaletteOpen}>
				<TextColorIcon style={{ fill: '#5f6368', borderBottom: `4px solid ${textColor}` }} />
				<span class={styles.tooltip}>Text color</span>
				{isTextColorPaletteOpen &&
					<ColorPalette onSelect={(color: string) => {
						console.log('color', color)
						setTextColor(color)
					}} />
				}
			</button>
			<button class={styles.button} onClick={onToggleHighlightPaletteOpen}>
				<HighlightColorIcon style={{ fill: '#5f6368', borderBottom: `4px solid ${highlightColor}` }} />
				<span class={styles.tooltip}>Highlight color</span>
				{isHighlightPaletteOpen &&
					<ColorPalette onSelect={(color: string) => {
						setHighlightColor(color)
						emit('ADD_HIGHLIGHT', color)
					}} />
				}
			</button>
			<button class={styles.button} onClick={() => emit('ADD_NOTE')}>
				<AddCommentIcon style={{ fill: '#5f6368' }} />
				<span class={styles.tooltip}>Add comment</span>
			</button>
			{/* <Dropdown
				isRight
				icon="▼"
				selected={<HighlighterIcon height="12px" style="fill: #5f6368" />}
				onSelect={(index: number) => {
					this.setState({ selectedColor: highlighterColors[index] })
					this.onHighlight(highlighterColors[index])
				}}
				onClick={() => this.onHighlight(selectedColor)}
				style={{ borderBottom: `4px solid ${this.state.selectedColor}` }}
			>
				{highlighterColors.map(color =>
					<HighlighterIcon value={color} height="12px" style={`fill: ${color};`} />
				)}
			</Dropdown> */}
		</div>
	)
}
