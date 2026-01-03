export function newId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallbackUuid()
  return `${prefix}_${uuid}`
}

export function toUserId(firebaseUid: string): string {
  return `nf-user-${firebaseUid}`
}

export function newUserId(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallbackUuid()
  return `nf-user-${uuid}`
}

export function newNoteId(): string {
  return `nf-note-${randomHash()}`
}

function randomHash(bytesLength: number = 16): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(bytesLength)
    crypto.getRandomValues(bytes)
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback: not cryptographically strong, but fine for local IDs.
  let out = ''
  for (let i = 0; i < bytesLength; i++) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
  }
  return out
}

function fallbackUuid(): string {
  // RFC4122-ish v4 fallback (best-effort)
  const bytes = new Uint8Array(16)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
