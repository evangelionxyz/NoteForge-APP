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

    const buttonLabel = busy ? 'Signing in…' : 'Continue with Google'

    return (
        <div className="nf-auth-root">
            <div className="nf-auth-card" role="dialog" aria-labelledby="nf-auth-title">
                <div className="nf-auth-header">
                    <h1 id="nf-auth-title" className="nf-auth-title">NoteForge</h1>
                    <p className="nf-auth-subtitle">Capture quick notes and tasks, synced to your account.</p>
                </div>

                {currentUser ? (
                    <div className="nf-auth-content">
                        <div className="nf-auth-account">
                            <div className="nf-auth-account-label">Signed in as</div>
                            <div className="nf-auth-account-name">{currentUser.displayName ?? currentUser.email ?? currentUser.uid}</div>
                        </div>

                        <button className="nf-button nf-button--ghost" onClick={handleSignOut} disabled={busy}>
                            Sign out
                        </button>
                    </div>
                ) : (
                    <div className="nf-auth-content">
                        <button
                            type="button"
                            className="nf-button nf-button--google"
                            onClick={handleSignIn}
                            disabled={busy}
                        >
                            <span className="nf-google-logo" aria-hidden="true">G</span>
                            <span>{buttonLabel}</span>
                        </button>
                        <p className="nf-auth-hint">We only use your Google account to authenticate and sync your notes.</p>
                    </div>
                )}

                {error ? (
                    <div className="nf-auth-error" role="alert">
                        {error}
                    </div>
                ) : null}
            </div>
        </div>
    )
}