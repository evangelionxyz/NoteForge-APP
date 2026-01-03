// Simple API client for NoteForge FastAPI backend.
// Assumes Vite; set VITE_API_BASE (e.g., http://localhost:8000).

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export type ApiUser = {
  _id: string;
  userId: string;
  userName: string;
  email: string;
  displayName?: string | null;
  noteRefs: string[];
};

export type ApiNoteTask = {
  title: string;
  completed: boolean;
};

export type ApiNote = {
  _id: string;
  id: string; // noteId in API schema
  title: string;
  colorCode: string;
  descriptions?: string | null;
  createdDate?: string | null;
  updatedDate?: string | null;
  completed: boolean;
  tasks: ApiNoteTask[];
  _softDelete?: string;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cacheBuster = init?.method && ['PATCH', 'POST', 'PUT', 'DELETE'].includes(init.method) ? `?_=${Date.now()}` : '';
  const q = `${API_BASE}${path}${cacheBuster}`;
  const res = await fetch(q, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// -------- Users --------

export async function getUserByEmail(email: string): Promise<ApiUser | null> {
  if (!email) return null;
  const res = await fetch(`${API_BASE}/users/by-email/${encodeURIComponent(email)}?create=true`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch user by email: ${res.status}`);
  return (await res.json()) as ApiUser;
}

export async function createUserFromGoogle(profile: {
  uid: string;
  email: string;
  displayName?: string | null;
}): Promise<ApiUser> {
  // userId: stable domain id (use firebase uid or auth uid)
  // userName: fallback to email prefix
  const userName = profile.email?.split('@')[0] ?? profile.uid;
  return apiFetch<ApiUser>('/users', {
    method: 'POST',
    body: JSON.stringify({
      userId: profile.uid,
      userName,
      email: profile.email,
      displayName: profile.displayName,
      noteRefs: [],
    }),
  });
}

export async function ensureUserByEmail(profile: {
  uid: string;
  email: string;
  displayName?: string | null;
}): Promise<ApiUser> {
  return apiFetch<ApiUser>('/users/ensure', {
    method: 'POST',
    body: JSON.stringify({
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
    }),
  });
}

// -------- Notes --------

export async function listNotes(userId?: string): Promise<ApiNote[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiFetch<ApiNote[]>(`/notes${qs}`);
}

export async function createNote(note: {
  id: string;
  title: string;
  colorCode: string;
  descriptions?: string | null;
  tasks?: ApiNoteTask[];
}): Promise<ApiNote> {
  return apiFetch<ApiNote>('/notes', {
    method: 'POST',
    body: JSON.stringify({
      id: note.id,
      title: note.title,
      colorCode: note.colorCode,
      descriptions: note.descriptions ?? null,
      tasks: note.tasks ?? [],
      completed: false,
    }),
  });
}

export async function updateNote(noteId: string, patch: Partial<Pick<ApiNote, 'title' | 'descriptions' | 'colorCode' | 'completed' | 'tasks'>>): Promise<ApiNote> {
  return apiFetch<ApiNote>(`/notes/${encodeURIComponent(noteId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteNote(noteId: string): Promise<void> {
  await apiFetch<void>(`/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  });
}

export async function patchUser(userIdOrObjectId: string, patch: Partial<Pick<ApiUser, 'noteRefs' | 'displayName' | 'userName'>>): Promise<ApiUser> {
  return apiFetch<ApiUser>(`/users/${encodeURIComponent(userIdOrObjectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
