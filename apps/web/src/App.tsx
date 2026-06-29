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
          <Route path="/projects/:key/board" element={<BoardPage />} />
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
