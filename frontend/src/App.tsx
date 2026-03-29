import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Result from './pages/Result'
import Leaderboard from './pages/Leaderboard'
import Stats from './pages/Stats'
import Badge from './pages/Badge'
import Compare from './pages/Compare'
import History from './pages/History'

function OAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const error = params.get('error')

    if (token) {
      localStorage.setItem('vibecheck_session', token)
    }
    if (error) {
      console.error('OAuth error:', error)
    }

    // Clean URL and go home
    navigate('/', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Logging you in…</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/r/:owner/:repo" element={<Result />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/callback" element={<OAuthCallback />} />
        <Route path="/badge" element={<Badge />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  )
}
