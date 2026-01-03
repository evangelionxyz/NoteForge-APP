/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../lib/firebase";
import type { User, UserCredential } from "firebase/auth";
import type { ReactNode } from "react";
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";

import { ensureUserByEmail } from "../lib/api";
import type { ApiUser } from "../lib/api";

interface AuthContextType {
    currentUser: User | null;
    apiUser: ApiUser | null;
    apiUserLoading: boolean;
    loading: boolean;
    signInWithGoogle: () => Promise<UserCredential>;
    signOut: () => Promise<void>;
    refreshApiUser: () => Promise<ApiUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be within an AuthProvider");
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({children}: AuthProviderProps) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [apiUser, setApiUser] = useState<ApiUser | null>(null);
    const [apiUserLoading, setApiUserLoading] = useState<boolean>(true);
    const [loading, setLoading] = useState(true);

    const signInWithGoogle = () => {
        return signInWithPopup(auth, googleProvider);
    }

    const signOut = async () => {
        setApiUser(null);
        return firebaseSignOut(auth);
    }

    const refreshApiUser = async (): Promise<ApiUser | null> => {
        if (!currentUser?.email) return null;
        setApiUserLoading(true);
        try {
            const apiUser = await ensureUserByEmail({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
            });
            setApiUser(apiUser);
            return apiUser;
        } catch (err) {
            console.error("Failed to ensure backend user", err);
            return null;
        } finally {
            setApiUserLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setApiUser(null);

            if (user?.email) {
                setApiUserLoading(true);
                try {
                    const apiUser = await ensureUserByEmail({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                    });
                    setApiUser(apiUser);
                } catch (err) {
                    console.error("Failed to ensure backend user", err);
                } finally {
                    setApiUserLoading(false);
                }
            } else {
                setApiUserLoading(false);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value: AuthContextType = {
        currentUser,
        apiUser,
        apiUserLoading,
        loading,
        signInWithGoogle,
        signOut,
        refreshApiUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}