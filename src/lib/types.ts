export type Note = {
  id: string
  title: string
  content: string
  tasks: NoteTask[]
  isCompleted: boolean
  colorCode: string
  createdAt: number
  updatedAt: number
}

export type NoteTask = {
  id: string
  text: string
  colorCode: string
  done: boolean
}

export type UserProfile = {
  id: string
  noteIds: string[]
}
