import { createContext } from 'preact'
import { NoteType } from '../../utils'

interface NoteContextType {
	onNoteSubmit: (note: NoteType) => void;
	onNoteRemove: (note: NoteType) => void;
}

export const NoteContext = createContext({
	onNoteSubmit: (_note: NoteType) => {},
	onNoteRemove: (_note: NoteType) => {},
} as NoteContextType)
