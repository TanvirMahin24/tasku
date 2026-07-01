import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { SpaceLayout, SpaceHome } from '@/components/SpaceLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ProjectsPage from '@/pages/ProjectsPage';
import DashboardPage from '@/pages/DashboardPage';
import BoardPage from '@/pages/BoardPage';
import BacklogPage from '@/pages/BacklogPage';
import SprintReportPage from '@/pages/SprintReportPage';
import IssuePage from '@/pages/IssuePage';
import TeamsPage from '@/pages/TeamsPage';
import TeamPage from '@/pages/TeamPage';
import OverviewPage from '@/pages/OverviewPage';
import ListPage from '@/pages/ListPage';
import TimelinePage from '@/pages/TimelinePage';
import CalendarPage from '@/pages/CalendarPage';
import SearchPage from '@/pages/SearchPage';
import ReportsPage from '@/pages/ReportsPage';
import ReleasesPage from '@/pages/ReleasesPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Authenticated */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<ProjectsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:id" element={<TeamPage />} />
          <Route path="/projects/:key" element={<SpaceLayout />}>
            <Route index element={<SpaceHome />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="boards/:boardId" element={<BoardPage />} />
            <Route path="list" element={<ListPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="backlog" element={<BacklogPage />} />
            <Route path="report" element={<SprintReportPage />} />
            <Route path="releases" element={<ReleasesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/issues/:issueKey" element={<IssuePage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
