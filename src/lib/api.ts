// Firestore-backed data access for users and notes.

import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'

export type ApiUser = {
  _id: string
  userId: string
  userName: string
  email: string
  displayName?: string | null
  noteRefs: string[]
}

export type ApiNoteTask = {
  title: string
  completed: boolean
}

export type ApiNote = {
  _id: string
  id: string // noteId in API schema
  title: string
  colorCode: string
  descriptions?: string | null
  createdDate?: string | null
  updatedDate?: string | null
  completed: boolean
  tasks: ApiNoteTask[]
  _softDelete?: string
}

function normalizeUser(id: string, data: unknown, fallback: { email: string; displayName?: string | null }): ApiUser {
  if (!data || typeof data !== 'object') {
    const userName = fallback.email.split('@')[0] ?? id
    return {
      _id: id,
      userId: id,
      userName,
      email: fallback.email,
      displayName: fallback.displayName ?? null,
      noteRefs: [],
    }
  }

  const d = data as Partial<ApiUser> & { email?: string; noteRefs?: unknown }
  const email = typeof d.email === 'string' ? d.email : fallback.email
  const userName = typeof d.userName === 'string' ? d.userName : email.split('@')[0] ?? id
  const displayName =
    typeof d.displayName === 'string' || d.displayName === null ? d.displayName : fallback.displayName ?? null
  const noteRefs = Array.isArray(d.noteRefs)
    ? d.noteRefs.filter((x): x is string => typeof x === 'string')
    : []

  return {
    _id: id,
    userId: typeof d.userId === 'string' ? d.userId : id,
    userName,
    email,
    displayName,
    noteRefs,
  }
}

function normalizeNote(id: string, data: unknown): ApiNote {
  const d = (data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) as Record<string, unknown>

  const title = typeof d.title === 'string' ? d.title : ''
  const colorCode = typeof d.colorCode === 'string' ? d.colorCode : '#808080'
  const descriptions = typeof d.descriptions === 'string' ? d.descriptions : null
  const createdDate = typeof d.createdDate === 'string' ? d.createdDate : null
  const updatedDate = typeof d.updatedDate === 'string' ? d.updatedDate : createdDate
  const completed = typeof d.completed === 'boolean' ? d.completed : false

  const rawTasks = Array.isArray(d.tasks) ? (d.tasks as unknown[]) : []
  const tasks: ApiNoteTask[] = rawTasks
    .map((t) => {
      if (!t || typeof t !== 'object') return null
      const tt = t as Partial<ApiNoteTask>
      return {
        title: typeof tt.title === 'string' ? tt.title : '',
        completed: typeof tt.completed === 'boolean' ? tt.completed : false,
      } satisfies ApiNoteTask
    })
    .filter((x): x is ApiNoteTask => Boolean(x))

  const softDelete = typeof d._softDelete === 'string' ? d._softDelete : undefined

  return {
    _id: id,
    id: typeof d.id === 'string' ? (d.id as string) : id,
    title,
    colorCode,
    descriptions,
    createdDate,
    updatedDate,
    completed,
    tasks,
    _softDelete: softDelete,
  }
}

// -------- Users --------

export async function getUserByEmail(email: string): Promise<ApiUser | null> {
  if (!email) return null
  const usersRef = collection(db, 'users')
  const q = query(usersRef, where('email', '==', email))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return normalizeUser(docSnap.id, docSnap.data(), { email, displayName: null })
}

export async function createUserFromGoogle(profile: {
  uid: string
  email: string
  displayName?: string | null
}): Promise<ApiUser> {
  const usersRef = collection(db, 'users')
  const userDoc = doc(usersRef, profile.uid)

  const base = normalizeUser(userDoc.id, {}, { email: profile.email, displayName: profile.displayName })

  await setDoc(userDoc, {
    userId: base.userId,
    userName: base.userName,
    email: base.email,
    displayName: base.displayName,
    noteRefs: base.noteRefs,
  })

  return base
}

export async function ensureUserByEmail(profile: {
  uid: string
  email: string
  displayName?: string | null
}): Promise<ApiUser> {
  const usersRef = collection(db, 'users')
  const userDoc = doc(usersRef, profile.uid)
  const snap = await getDoc(userDoc)

  const fallback = { email: profile.email, displayName: profile.displayName }

  if (!snap.exists()) {
    const created = normalizeUser(userDoc.id, {}, fallback)
    await setDoc(userDoc, {
      userId: created.userId,
      userName: created.userName,
      email: created.email,
      displayName: created.displayName,
      noteRefs: created.noteRefs,
    })
    return created
  }

  const existing = normalizeUser(userDoc.id, snap.data(), fallback)
  // Keep Firestore doc in sync with latest profile details
  await setDoc(
    userDoc,
    {
      userId: existing.userId,
      userName: existing.userName,
      email: existing.email,
      displayName: existing.displayName,
      noteRefs: existing.noteRefs,
    },
    { merge: true },
  )

  return existing
}

// -------- Notes --------

export async function listNotes(userId?: string): Promise<ApiNote[]> {
  const notesRef = collection(db, 'notes')
  let snap
  if (userId) {
    const q = query(notesRef, where('userId', '==', userId))
    snap = await getDocs(q)
  } else {
    snap = await getDocs(notesRef)
  }

  return snap.docs.map((d) => normalizeNote(d.id, d.data())).filter((n) => !n._softDelete)
}

export async function createNote(note: {
  id: string
  userId: string
  title: string
  colorCode: string
  descriptions?: string | null
  tasks?: ApiNoteTask[]
}): Promise<ApiNote> {
  const notesRef = collection(db, 'notes')
  const noteDoc = doc(notesRef, note.id)

  const nowIso = new Date().toISOString()
  const payload = {
    id: note.id,
    userId: note.userId,
    title: note.title,
    colorCode: note.colorCode,
    descriptions: note.descriptions ?? null,
    tasks: (note.tasks ?? []).map((t) => ({ title: t.title, completed: t.completed })),
    completed: false,
    createdDate: nowIso,
    updatedDate: nowIso,
  }

  await setDoc(noteDoc, payload)

  return normalizeNote(noteDoc.id, payload)
}

export async function updateNote(
  noteId: string,
  patch: Partial<Pick<ApiNote, 'title' | 'descriptions' | 'colorCode' | 'completed' | 'tasks'>>,
): Promise<ApiNote> {
  const noteDoc = doc(db, 'notes', noteId)
  const snap = await getDoc(noteDoc)
  if (!snap.exists()) {
    throw new Error('Note not found')
  }

  const existing = snap.data()

  const toUpdate: Record<string, unknown> = {
    updatedDate: new Date().toISOString(),
  }

  if (patch.title !== undefined) toUpdate.title = patch.title
  if (patch.descriptions !== undefined) toUpdate.descriptions = patch.descriptions
  if (patch.colorCode !== undefined) toUpdate.colorCode = patch.colorCode
  if (patch.completed !== undefined) toUpdate.completed = patch.completed
  if (patch.tasks !== undefined)
    toUpdate.tasks = patch.tasks.map((t) => ({ title: t.title, completed: t.completed }))

  await updateDoc(noteDoc, toUpdate)

  const merged = { ...existing, ...toUpdate }
  return normalizeNote(noteId, merged)
}

export async function deleteNote(noteId: string): Promise<void> {
  const noteDoc = doc(db, 'notes', noteId)
  await deleteDoc(noteDoc)
}

export async function patchUser(
  userIdOrObjectId: string,
  patch: Partial<Pick<ApiUser, 'noteRefs' | 'displayName' | 'userName'>>,
): Promise<ApiUser> {
  const userDoc = doc(db, 'users', userIdOrObjectId)
  const snap = await getDoc(userDoc)
  if (!snap.exists()) {
    throw new Error('User not found')
  }

  const existing = normalizeUser(userDoc.id, snap.data(), {
    email: (snap.data() as { email?: string }).email ?? '',
    displayName: (snap.data() as { displayName?: string | null }).displayName ?? null,
  })

  const toUpdate: Record<string, unknown> = {}
  if (patch.displayName !== undefined) toUpdate.displayName = patch.displayName
  if (patch.userName !== undefined) toUpdate.userName = patch.userName
  if (patch.noteRefs !== undefined) toUpdate.noteRefs = patch.noteRefs

  await updateDoc(userDoc, toUpdate)

  const merged = { ...existing, ...toUpdate }
  return normalizeUser(userDoc.id, merged, { email: existing.email, displayName: existing.displayName })
}
