import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export const AuthBoarding = () => {
    const { currentUser, signInWithGoogle, signOut } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function handleSignIn() {
        setError(null)
        setBusy(true)
        try {
            await signInWithGoogle()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Sign-in failed')
        } finally {
            setBusy(false)
        }
    }

    async function handleSignOut() {
        setError(null)
        setBusy(true)
        try {
            await signOut()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Sign-out failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div style={{ maxWidth: 520, margin: '48px auto', padding: 16 }}>
            <h1 style={{ margin: 0 }}>NoteForge</h1>
            <p style={{ marginTop: 8, opacity: 0.8 }}>Sign in to continue.</p>

            {currentUser ? (
                <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Signed in as</div>
                        <div>{currentUser.displayName ?? currentUser.email ?? currentUser.uid}</div>
                    </div>

                    <button onClick={handleSignOut} disabled={busy}>
                        Sign out
                    </button>
                </div>
            ) : (
                <button onClick={handleSignIn} disabled={busy}>
                    Continue with Google
                </button>
            )}

            {error ? (
                <div style={{ marginTop: 12, color: '#b91c1c' }} role="alert">
                    {error}
                </div>
            ) : null}
        </div>
    )
}