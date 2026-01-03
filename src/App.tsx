import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import { AuthBoarding } from "./view/AuthBoarding";
import { NoteForge } from "./view/NoteForge";

import { useAuth } from './context/AuthContext'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/auth" replace />
  return children
}

function RedirectIfAuthed({ children }: { children: React.ReactElement }) {
  const { currentUser } = useAuth()
  if (currentUser) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <Router>
          <Routes>
            <Route
              path="/auth"
              element={
                <RedirectIfAuthed>
                  <AuthBoarding />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <NoteForge />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </UserProvider>
    </AuthProvider>
  )
}

export default App
