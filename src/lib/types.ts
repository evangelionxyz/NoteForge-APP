export type Note = {
  id: string
  title: string
  colorCode: string
  content: string
  tasks: NoteTask[]
  isCompleted: boolean
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
