import '../App.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note, NoteTask } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { type ApiNote, type ApiNoteTask, createNote as apiCreateNote, deleteNote as apiDeleteNote, listNotes, patchUser, updateNote as apiUpdateNote } from '../lib/api'
import { newId, newNoteId } from '../lib/ids'

type ActivePane = 'list' | 'editor'

const NOTE_COLOR_PRESETS = [
  '#808080',
  '#0ea5e9',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#64748b',
]

const apiNoteToUi = (note: ApiNote): Note => {
  const createdAt = note.createdDate ? new Date(note.createdDate).getTime() : Date.now()
  const updatedAt = note.updatedDate ? new Date(note.updatedDate).getTime() : createdAt
  const tasks: NoteTask[] = (note.tasks ?? []).map((t, idx) => ({
    id: `${note.id}-task-${idx}`,
    text: t.title,
    done: t.completed,
  }))

  return {
    id: note.id,
    title: note.title,
    content: note.descriptions ?? '',
    tasks,
    isCompleted: note.completed,
    color: '#808080',
    createdAt,
    updatedAt,
  }
}

const uiTasksToApi = (tasks: NoteTask[]): ApiNoteTask[] => tasks.map((t) => ({ title: t.text, completed: t.done }))

const canMarkComplete = (note: Note): boolean => note.tasks.length > 0 && note.tasks.every((t) => t.done)

export const NoteForge = () => {
  const { currentUser, apiUser, apiUserLoading, signOut } = useAuth()

  const [notes, setNotes] = useState<Record<string, Note>>({})
  const [noteIds, setNoteIds] = useState<string[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [activePane, setActivePane] = useState<ActivePane>('list')
  const [newTaskText, setNewTaskText] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [mutationBusy, setMutationBusy] = useState(false)
  const colorPopoverRef = useRef<HTMLDetailsElement | null>(null)
  const userMenuRef = useRef<HTMLDetailsElement | null>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)

  // Load notes when backend user is ready
  useEffect(() => {
    const load = async () => {
      if (!apiUser) {
        setNotes({})
        setNoteIds([])
        setSelectedNoteId(null)
        return
      }
      setLoadingNotes(true)
      try {
        const apiNotes = await listNotes(apiUser.userId)
        const mapped = apiNotes.map(apiNoteToUi)
        const byId = Object.fromEntries(mapped.map((n) => [n.id, n] as const))
        const order = apiUser.noteRefs.length > 0 ? apiUser.noteRefs : mapped.map((n) => n.id)
        setNotes(byId)
        setNoteIds(order)
        setSelectedNoteId(order[0] ?? null)
        setActivePane(order[0] ? 'editor' : 'list')
      } catch (err) {
        console.error('Failed to load notes', err)
      } finally {
        setLoadingNotes(false)
      }
    }
    load()
  }, [apiUser])

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null
    return notes[selectedNoteId] ?? null
  }, [notes, selectedNoteId])

  const noteList = useMemo(() => {
    return noteIds
      .map((id) => notes[id])
      .filter((n): n is Note => Boolean(n))
  }, [notes, noteIds])

  async function handleCreateNote() {
    if (!apiUser) return
    setMutationBusy(true)
    try {
      const id = newNoteId()
      const created = await apiCreateNote({
        id,
        title: 'New note',
        colorCode: '#808080', // default color
        descriptions: '',
        tasks: [],
      })
      const ui = apiNoteToUi(created)
      const nextNotes = { ...notes, [ui.id]: ui }
      const nextOrder = [ui.id, ...noteIds]
      setNotes(nextNotes)
      setNoteIds(nextOrder)
      setSelectedNoteId(ui.id)
      setActivePane('editor')

      try {
        await patchUser(apiUser.userId, { noteRefs: nextOrder })
      } catch (err) {
        console.warn('Note created but failed to update user noteRefs', err)
      }
    } finally {
      setMutationBusy(false)
    }
  }

  async function handleDeleteSelected() {
    if (!selectedNoteId || !apiUser) return
    setMutationBusy(true)
    try {
      await apiDeleteNote(selectedNoteId)
      const nextNotes = { ...notes }
      delete nextNotes[selectedNoteId]
      const nextOrder = noteIds.filter((id) => id !== selectedNoteId)
      setNotes(nextNotes)
      setNoteIds(nextOrder)
      const nextSelected = nextOrder[0] ?? null
      setSelectedNoteId(nextSelected)
      setActivePane(nextSelected ? 'editor' : 'list')

      try {
        await patchUser(apiUser.userId, { noteRefs: nextOrder })
      } catch (err) {
        console.warn('Note deleted but failed to update user noteRefs', err)
      }
    } finally {
      setMutationBusy(false)
    }
  }

  function handleSelectNote(id: string) {
    setSelectedNoteId(id)
    setActivePane('editor')
  }

  async function persistNote(noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'tasks' | 'isCompleted'>>) {
    const current = notes[noteId]
    if (!current) return
    setMutationBusy(true)
    try {
      const next: Note = {
        ...current,
        title: patch.title ?? current.title,
        content: patch.content ?? current.content,
        tasks: patch.tasks ?? current.tasks,
        isCompleted: patch.isCompleted ?? current.isCompleted,
        updatedAt: Date.now(),
      }
      setNotes({ ...notes, [noteId]: next })

      await apiUpdateNote(noteId, {
        title: next.title,
        descriptions: next.content,
        completed: next.isCompleted,
        tasks: uiTasksToApi(next.tasks),
      })
    } catch (err) {
      console.error('Failed to update note', err)
    } finally {
      setMutationBusy(false)
    }
  }

  function handleUpdateSelected(patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'tasks' | 'isCompleted'>>) {
    if (!selectedNoteId) return
    // color is local-only
    if (patch.color !== undefined) {
      const current = notes[selectedNoteId]
      if (!current) return
      setNotes({ ...notes, [selectedNoteId]: { ...current, color: patch.color } })
      return
    }
    void persistNote(selectedNoteId, patch)
  }

  function handleSetSelectedColor(color: string) {
    handleUpdateSelected({ color })
    colorPopoverRef.current?.removeAttribute('open')
  }

  function handleAddTask() {
    if (!selectedNoteId) return
    const current = notes[selectedNoteId]
    if (!current) return
    const trimmed = newTaskText.trim()
    if (!trimmed) return
    const nextTasks: NoteTask[] = [{ id: newId('task'), text: trimmed, done: false }, ...current.tasks]
    setNewTaskText('')
    handleUpdateSelected({ tasks: nextTasks, isCompleted: false })
  }

  function handleToggleTask(taskId: string) {
    if (!selectedNoteId) return
    const current = notes[selectedNoteId]
    if (!current) return
    const nextTasks = current.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    const allDone = nextTasks.length > 0 && nextTasks.every((t) => t.done)
    handleUpdateSelected({ tasks: nextTasks, isCompleted: current.isCompleted ? allDone : current.isCompleted })
  }

  function handleRemoveTask(taskId: string) {
    if (!selectedNoteId) return
    const current = notes[selectedNoteId]
    if (!current) return
    const nextTasks = current.tasks.filter((t) => t.id !== taskId)
    const allDone = nextTasks.length > 0 && nextTasks.every((t) => t.done)
    handleUpdateSelected({ tasks: nextTasks, isCompleted: current.isCompleted ? allDone : false })
  }

  function handleMarkComplete() {
    if (!selectedNoteId) return
    const current = notes[selectedNoteId]
    if (!current) return
    if (!canMarkComplete(current)) return
    handleUpdateSelected({ isCompleted: true })
  }

  async function handleSignOut() {
    setSignOutBusy(true)
    try {
      await signOut()
      setNotes({})
      setNoteIds([])
      setSelectedNoteId(null)
    } finally {
      setSignOutBusy(false)
      userMenuRef.current?.removeAttribute('open')
    }
  }

  return (
    <div className="nf-app" role="application" aria-label="NoteForge">
      <header className="nf-header">
        <div className="nf-brand">
          <div className="nf-title">NoteForge</div>
          <div className="nf-subtitle">Minimal notes</div>
        </div>

        <div className="nf-user">
          <div className="nf-user-row">
            {currentUser ? (
              <details className="nf-popover" ref={userMenuRef}>
                <summary className="nf-button" style={{listStyle: 'none'}} aria-label="User menu">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt=""
                        width={20}
                        height={20}
                        style={{ borderRadius: "100%", display: 'block' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                      {currentUser.displayName ?? currentUser.email ?? 'Account'}
                    </span>
                  </span>
                </summary>
                <div className="nf-popover-panel" role="dialog" aria-label="User settings">
                  <div className="nf-color-title">Account</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
                    {apiUserLoading ? 'Loading profile…' : apiUser?.email ?? currentUser.email}
                  </div>
                  <button className="nf-button nf-button--danger" onClick={handleSignOut} disabled={signOutBusy}>
                    Sign out
                  </button>
                </div>
              </details>
            ) : (
              <div className="nf-empty">Sign in to manage notes.</div>
            )}
          </div>
        </div>
      </header>

      <main className="nf-main">
        <aside className={`nf-sidebar ${activePane === 'list' ? 'is-active' : ''}`}>
          <div className="nf-sidebar-top">
            <button className="nf-button" onClick={handleCreateNote} disabled={!apiUser || mutationBusy}>
              New note
            </button>
          </div>

          <div className="nf-list" role="list">
            {loadingNotes || apiUserLoading ? (
              <div className="nf-empty">Loading…</div>
            ) : noteList.length === 0 ? (
              <div className="nf-empty">No notes yet.</div>
            ) : (
              noteList.map((n) => (
                <button
                  key={n.id}
                  className={`nf-note-item ${n.id === selectedNoteId ? 'is-selected' : ''} ${
                    n.isCompleted ? 'is-completed' : ''
                  }`}
                  onClick={() => handleSelectNote(n.id)}
                  role="listitem"
                  style={{ ['--note-color' as never]: n.color }}
                >
                  <div className="nf-note-row">
                    <div className="nf-note-title">{n.title || 'Untitled'}</div>
                    {n.isCompleted ? <div className="nf-badge">Completed</div> : null}
                  </div>
                  <div className="nf-note-meta">
                    {new Date(n.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className={`nf-editor ${activePane === 'editor' ? 'is-active' : ''}`}>
          <div className="nf-editor-top">
            <div className="nf-editor-actions">
              <button
                className="nf-button nf-button--ghost nf-mobile-only"
                onClick={() => setActivePane('list')}
              >
                Back
              </button>

              {selectedNote ? (
                <details className="nf-popover" ref={colorPopoverRef}>
                  <summary className="nf-button nf-color-trigger" aria-label="Choose note color">
                    <span
                      className="nf-color-dot"
                      aria-hidden="true"
                      style={{ backgroundColor: selectedNote.color }}
                    />
                    Color
                  </summary>
                  <div className="nf-popover-panel" role="dialog" aria-label="Note color">
                    <div className="nf-color-title">Color</div>
                    <div className="nf-color-grid" role="list" aria-label="Color presets">
                      {NOTE_COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`nf-swatch ${selectedNote.color.toLowerCase() === c ? 'is-selected' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => handleSetSelectedColor(c)}
                          aria-label={`Set color ${c}`}
                          role="listitem"
                        />
                      ))}
                    </div>

                    <div className="nf-color-custom">
                      <div className="nf-color-label">Custom</div>
                      <input
                        className="nf-color-input"
                        type="color"
                        value={selectedNote.color}
                        onChange={(e) => handleSetSelectedColor(e.target.value)}
                        aria-label="Custom note color"
                      />
                    </div>
                  </div>
                </details>
              ) : null}

              <button
                className="nf-button"
                onClick={handleMarkComplete}
                disabled={!selectedNote || selectedNote.isCompleted || !canMarkComplete(selectedNote) || mutationBusy}
                title={
                  !selectedNote
                    ? 'Select a note'
                    : selectedNote.isCompleted
                      ? 'Already completed'
                      : canMarkComplete(selectedNote)
                        ? 'Mark as complete'
                        : 'Complete all tasks first'
                }
              >
                {selectedNote?.isCompleted ? 'Completed' : 'Mark complete'}
              </button>

              <button
                className="nf-button nf-button--danger"
                onClick={handleDeleteSelected}
                disabled={!selectedNote || mutationBusy}
              >
                Delete
              </button>
            </div>
          </div>

          {!selectedNote ? (
            <div className="nf-empty nf-empty--editor">
              Create a note to start writing.
            </div>
          ) : (
            <div className="nf-editor-body">
              <div className="nf-editor-row">
                <input
                  className="nf-title-input"
                  value={selectedNote.title}
                  placeholder="Title"
                  onChange={(e) => handleUpdateSelected({ title: e.target.value })}
                />
              </div>

              <textarea
                className="nf-textarea"
                value={selectedNote.content}
                placeholder="Write your note…"
                onChange={(e) => handleUpdateSelected({ content: e.target.value })}
              />

              <div className="nf-section">
                <div className="nf-section-header">
                  <div className="nf-section-title">Tasks</div>
                  <form
                    className="nf-task-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAddTask()
                    }}
                  >
                    <input
                      className="nf-input nf-task-input"
                      value={newTaskText}
                      placeholder='e.g. "Create a pull request"'
                      onChange={(e) => setNewTaskText(e.target.value)}
                    />
                    <button className="nf-button" type="submit" disabled={!newTaskText.trim() || mutationBusy}>
                      Add
                    </button>
                  </form>
                </div>

                <div className="nf-task-list" role="list">
                  {selectedNote.tasks.length === 0 ? (
                    <div className="nf-empty">No tasks yet.</div>
                  ) : (
                    selectedNote.tasks.map((t) => (
                      <label key={t.id} className={`nf-task ${t.done ? 'is-done' : ''}`} role="listitem">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => handleToggleTask(t.id)}
                        />
                        <span className="nf-task-text">{t.text}</span>
                        <button
                          type="button"
                          className="nf-task-delete"
                          aria-label="Delete task"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemoveTask(t.id)
                          }}
                        >
                          ×
                        </button>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
