import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { NotificationsBootstrap } from './components/NotificationsBootstrap'
import { HomePage } from './pages/HomePage'
import { CompetitionsPage } from './pages/CompetitionsPage'
import { ScoresPage } from './pages/ScoresPage'
import { ClubsPage } from './pages/ClubsPage'
import { ClubDetailPage } from './pages/ClubDetailPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { MatchDetailPage } from './pages/MatchDetailPage'
import { LiveMatchDetailPage } from './pages/LiveMatchDetailPage'
import { TeamPage } from './pages/TeamPage'
import { NotificationsPage } from './pages/NotificationsPage'

export default function App() {
  return (
    <BrowserRouter>
      <NotificationsBootstrap />
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
          <Route path="/scores" element={<ScoresPage />} />
          <Route path="/clubs" element={<ClubsPage />} />
          <Route path="/clubs/:id" element={<ClubDetailPage />} />
          <Route path="/favoris" element={<FavoritesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/match/:id" element={<MatchDetailPage />} />
          <Route path="/live/:id" element={<LiveMatchDetailPage />} />
          <Route path="/equipe/:name" element={<TeamPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
