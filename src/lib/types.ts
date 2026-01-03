export type Note = {
  id: string
  title: string
  content: string
  tasks: NoteTask[]
  isCompleted: boolean
  color: string
  createdAt: number
  updatedAt: number
}

export type NoteTask = {
  id: string
  text: string
  done: boolean
}

export type UserProfile = {
  id: string
  noteIds: string[]
}
