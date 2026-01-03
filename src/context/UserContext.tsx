/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { toUserId } from '../lib/ids'

type UserContextType = {
	userId: string | null
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function useUser() {
	const ctx = useContext(UserContext)
	if (!ctx) throw new Error('useUser must be within a UserProvider')
	return ctx
}

export function UserProvider({ children }: { children: ReactNode }) {
	const { currentUser } = useAuth()

	const value = useMemo<UserContextType>(() => {
		return { userId: currentUser ? toUserId(currentUser.uid) : null }
	}, [currentUser])

	return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
