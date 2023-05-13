import { h, Fragment } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import styles from './versenote.css'
import { NoteContext } from './versenotecontext'
import { NoteType, VerseType, classnames } from '../../utils'
import EditIcon from '../../icons/md-edit.svg'
import paragraphStyles from '../paragraphs/paragraph.css'
import { getParagraphClass } from './paragraph'

interface VerseNoteProps {
	verse: VerseType;
}

export function VerseNote(props: VerseNoteProps) {
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const note = props.verse.note as NoteType
	const [isFormOpen, setFormOpen] = useState(note.isFormOpen)
	const [isNoteOpen, setNoteOpen] = useState(false)

	useEffect(() => {
		if (note.isFormOpen && textAreaRef.current) {
			textAreaRef.current.focus()
		}
	}, [])

	const onSubmit = (ev: any, onNoteSubmit: (note: NoteType) => void) => {
		ev.preventDefault()
		
		onNoteSubmit(note)
		setFormOpen(false)
		setNoteOpen(true)
	}

	const onInput = (ev: any) => {
		note.note = ev.target.value
	}

	const onOpenForm = (_ev: any) => {
		if (textAreaRef.current) {
			textAreaRef.current.focus()
		}

		setFormOpen(isOpen => !isOpen)
		setNoteOpen(false)
	}

	const toggleNoteOpen = (_ev: any) => {
		if (!isFormOpen) {
			setNoteOpen(isOpen => !isOpen)
		} else {
			setFormOpen(false)
		}
	}

	const marginClass = getParagraphClass(props.verse.parent) === paragraphStyles.q
		? styles.inMargin
		: ''

	return (
		<Fragment>
			<sup
				class={styles.sup}
				onClick={toggleNoteOpen}
			>
				N
			</sup>
			{isFormOpen && (
				<NoteContext.Consumer>
					{({ onNoteSubmit, onNoteRemove }) => (
						<form
							onSubmit={(ev: any) => onSubmit(ev, onNoteSubmit)}
							onReset={(_ev: any) => onNoteRemove(note)}
							class={marginClass}
						>
							<div class={styles.textareaContainer}>
								<textarea
									name="note"
									class={styles.textarea}
									onInput={onInput}
									value={note.note}
									placeholder="Add note"
									ref={textAreaRef}
								/>
							</div>
							<input type="reset" value="Remove" />
							<input type="submit" value="Submit" />
						</form>
					)}
				</NoteContext.Consumer>
			)}
			{isNoteOpen && (
				<div class={classnames(styles.note, marginClass)}>
					{note.note}
					<button class={styles.sup} onClick={onOpenForm}>
						<EditIcon width="12px" />
					</button>
				</div>
			)}
		</Fragment>
	)
}
