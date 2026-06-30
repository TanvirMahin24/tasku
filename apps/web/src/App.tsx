import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ProjectsPage from '@/pages/ProjectsPage';
import BoardPage from '@/pages/BoardPage';
import BacklogPage from '@/pages/BacklogPage';
import SprintReportPage from '@/pages/SprintReportPage';
import IssuePage from '@/pages/IssuePage';
import TeamsPage from '@/pages/TeamsPage';
import TeamPage from '@/pages/TeamPage';
import OverviewPage from '@/pages/OverviewPage';
import ListPage from '@/pages/ListPage';
import TimelinePage from '@/pages/TimelinePage';
import SearchPage from '@/pages/SearchPage';
import ReportsPage from '@/pages/ReportsPage';

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
          <Route path="/search" element={<SearchPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:id" element={<TeamPage />} />
          <Route path="/projects/:key/overview" element={<OverviewPage />} />
          <Route path="/projects/:key/reports" element={<ReportsPage />} />
          <Route path="/projects/:key/board" element={<BoardPage />} />
          <Route
            path="/projects/:key/boards/:boardId"
            element={<BoardPage />}
          />
          <Route path="/projects/:key/list" element={<ListPage />} />
          <Route path="/projects/:key/timeline" element={<TimelinePage />} />
          <Route path="/projects/:key/backlog" element={<BacklogPage />} />
          <Route path="/projects/:key/report" element={<SprintReportPage />} />
          <Route path="/issues/:issueKey" element={<IssuePage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
