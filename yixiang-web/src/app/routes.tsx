import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import HomePage from '@/pages/HomePage';
import ProfilePage from '@/pages/ProfilePage';
import FollowListPage from '@/pages/FollowListPage';
import NotificationPage from '@/pages/NotificationPage';
import CollectionsPage from '@/pages/CollectionsPage';
import SearchPage from '@/pages/SearchPage';
import CircleSquarePage from '@/pages/CircleSquarePage';
import CircleDetailPage from '@/pages/CircleDetailPage';
import PostDetailPage from '@/pages/PostDetailPage';
import StockDetailPage from '@/pages/StockDetailPage';
import CreatePage from '@/pages/CreatePage';
import DraftsPage from '@/pages/DraftsPage';
import SettingsPage from '@/pages/SettingsPage';
import MessagesPage from '@/pages/MessagesPage';
import NotFoundPage from '@/pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<AppLayout />}>
        {/* 公开路由 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/hot" element={<HomePage />} />
        <Route path="/posts/:id" element={<PostDetailPage />} />
        <Route path="/stock/:code" element={<StockDetailPage />} />
        <Route path="/circles" element={<CircleSquarePage />} />
        <Route path="/circles/:id" element={<CircleDetailPage />} />
        <Route path="/users/:id" element={<ProfilePage />} />

        {/* 需要登录 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/following" element={<HomePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:convId" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:tab" element={<ProfilePage />} />
          <Route path="/followlist" element={<FollowListPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/drafts" element={<DraftsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
