function requireEnv(key: string): string {
    const value = (import.meta as unknown as { env: Record<string, string | boolean | undefined> }).env[key]
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required env var: ${key}`)
    }
    return value
}

export const env = {
    firebase: {
        apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
        authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
        storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
        messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
        appId: requireEnv('VITE_FIREBASE_APP_ID'),
    },
}