import type { Note, NoteTask, UserProfile } from './types'
import { newId, newNoteId, newUserId } from './ids'

const STORAGE_PREFIX = 'noteforge'
const USER_KEY = `${STORAGE_PREFIX}:user`
const NOTES_KEY = `${STORAGE_PREFIX}:notes`

export function ensureUserAndNotes(): { user: UserProfile; notes: Record<string, Note> } {
  const existingUser = getUserOrNull()
  const existingNotes = getAllNotes()

  if (!existingUser) {
    const firstUser: UserProfile = { id: newUserId(), noteIds: [] }
    const { user, notes } = createNote(firstUser, existingNotes)
    setUser(user)
    setAllNotes(notes)
    return { user, notes }
  }

  const cleanedUser = {
    ...existingUser,
    noteIds: existingUser.noteIds.filter((id) => Boolean(existingNotes[id])),
  }

  setUser(cleanedUser)
  return { user: cleanedUser, notes: existingNotes }
}

export function getUser(): UserProfile {
  return getUserOrNull() ?? { id: newUserId(), noteIds: [] }
}

export function setActiveUser(nextUserId: string, notes: Record<string, Note>): { user: UserProfile; notes: Record<string, Note> } {
  const nextUser: UserProfile = { id: nextUserId, noteIds: [] }

  // Keep notes global for now; user only stores references.
  // If you later scope notes by user in your API, this becomes a backend concern.
  if (Object.keys(notes).length === 0) {
    const created = createNote(nextUser, notes)
    return created
  }

  setUser(nextUser)
  return { user: nextUser, notes }
}

export function getAllNotes(): Record<string, Note> {
  const raw = localStorage.getItem(NOTES_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}

    const record = parsed as Record<string, unknown>
    const normalized: Record<string, Note> = {}
    for (const [id, value] of Object.entries(record)) {
      const note = normalizeNote(id, value)
      if (note) normalized[id] = note
    }
    return normalized
  } catch {
    return {}
  }
}

export function createNote(
  user: UserProfile,
  notes: Record<string, Note>,
): { user: UserProfile; notes: Record<string, Note>; createdId: string } {
  const now = Date.now()
  const id = newNoteId()

  const note: Note = {
    id,
    title: 'New note',
    content: '',
    tasks: [],
    isCompleted: false,
    color: '#808080',
    createdAt: now,
    updatedAt: now,
  }

  const nextNotes = { ...notes, [id]: note }
  const nextUser: UserProfile = { ...user, noteIds: [id, ...user.noteIds] }

  setAllNotes(nextNotes)
  setUser(nextUser)

  return { user: nextUser, notes: nextNotes, createdId: id }
}

export function updateNote(
  notes: Record<string, Note>,
  id: string,
  patch: Partial<Pick<Note, 'title' | 'content' | 'tasks' | 'isCompleted' | 'color'>>,
): { notes: Record<string, Note> } {
  const current = notes[id]
  if (!current) return { notes }

  const next: Note = {
    ...current,
    title: patch.title ?? current.title,
    content: patch.content ?? current.content,
    tasks: patch.tasks ?? current.tasks,
    isCompleted: patch.isCompleted ?? current.isCompleted,
    color: patch.color ?? current.color,
    updatedAt: Date.now(),
  }

  const nextNotes = { ...notes, [id]: next }
  setAllNotes(nextNotes)
  return { notes: nextNotes }
}

export function addTask(
  notes: Record<string, Note>,
  noteId: string,
  text: string,
): { notes: Record<string, Note> } {
  const current = notes[noteId]
  if (!current) return { notes }

  const trimmed = text.trim()
  if (!trimmed) return { notes }

  const task: NoteTask = { id: newId('task'), text: trimmed, done: false }
  const nextTasks = [task, ...current.tasks]

  return updateNote(notes, noteId, { tasks: nextTasks, isCompleted: false })
}

export function toggleTask(
  notes: Record<string, Note>,
  noteId: string,
  taskId: string,
): { notes: Record<string, Note> } {
  const current = notes[noteId]
  if (!current) return { notes }

  const nextTasks = current.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
  const allDone = nextTasks.length > 0 && nextTasks.every((t) => t.done)

  // If tasks become incomplete, note can no longer be completed.
  const nextCompleted = current.isCompleted ? allDone : current.isCompleted
  return updateNote(notes, noteId, { tasks: nextTasks, isCompleted: nextCompleted })
}

export function removeTask(
  notes: Record<string, Note>,
  noteId: string,
  taskId: string,
): { notes: Record<string, Note> } {
  const current = notes[noteId]
  if (!current) return { notes }

  const nextTasks = current.tasks.filter((t) => t.id !== taskId)
  if (nextTasks.length === current.tasks.length) return { notes }

  const allDone = nextTasks.length > 0 && nextTasks.every((t) => t.done)
  const nextCompleted = current.isCompleted ? allDone : false
  return updateNote(notes, noteId, { tasks: nextTasks, isCompleted: nextCompleted })
}

export function canMarkComplete(note: Note): boolean {
  return note.tasks.length > 0 && note.tasks.every((t) => t.done)
}

export function markNoteComplete(notes: Record<string, Note>, noteId: string): { notes: Record<string, Note> } {
  const current = notes[noteId]
  if (!current) return { notes }
  if (!canMarkComplete(current)) return { notes }
  return updateNote(notes, noteId, { isCompleted: true })
}

export function deleteNote(
  user: UserProfile,
  notes: Record<string, Note>,
  id: string,
): { user: UserProfile; notes: Record<string, Note>; nextSelectedId: string | null } {
  if (!notes[id]) {
    return { user, notes, nextSelectedId: user.noteIds[0] ?? null }
  }

  const rest = { ...notes }
  delete rest[id]
  const nextUser: UserProfile = { ...user, noteIds: user.noteIds.filter((nid) => nid !== id) }

  setAllNotes(rest)
  setUser(nextUser)

  return { user: nextUser, notes: rest, nextSelectedId: nextUser.noteIds[0] ?? null }
}

function getUserOrNull(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null

    const candidate = parsed as Partial<UserProfile>
    if (!candidate.id || typeof candidate.id !== 'string') return null

    const noteIds = Array.isArray(candidate.noteIds)
      ? candidate.noteIds.filter((x): x is string => typeof x === 'string')
      : []

    return { id: candidate.id, noteIds }
  } catch {
    return null
  }
}

function normalizeNote(id: string, value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Note>

  const title = typeof v.title === 'string' ? v.title : ''
  const content = typeof v.content === 'string' ? v.content : ''
  const createdAt = typeof v.createdAt === 'number' ? v.createdAt : Date.now()
  const updatedAt = typeof v.updatedAt === 'number' ? v.updatedAt : createdAt
  const isCompleted = typeof v.isCompleted === 'boolean' ? v.isCompleted : false
  const color = typeof v.color === 'string' ? v.color : '#808080'

  const tasksRaw = Array.isArray(v.tasks) ? (v.tasks as unknown[]) : []
  const tasks: NoteTask[] = tasksRaw
    .map((t) => {
      if (!t || typeof t !== 'object') return null
      const tt = t as Partial<NoteTask>
      if (!tt.id || typeof tt.id !== 'string') return null
      return {
        id: tt.id,
        text: typeof tt.text === 'string' ? tt.text : '',
        done: typeof tt.done === 'boolean' ? tt.done : false,
      } satisfies NoteTask
    })
    .filter((x): x is NoteTask => Boolean(x))

  const normalized: Note = {
    id,
    title,
    content,
    tasks,
    isCompleted: isCompleted && tasks.length > 0 ? tasks.every((t) => t.done) : isCompleted,
    color,
    createdAt,
    updatedAt,
  }

  return normalized
}

function setUser(user: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function setAllNotes(notes: Record<string, Note>): void {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}
