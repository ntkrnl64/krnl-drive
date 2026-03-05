import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { FluentProvider, webLightTheme, webDarkTheme, Spinner, makeStyles } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import LoginPage from './pages/LoginPage.tsx';
import InitPage from './pages/InitPage.tsx';
import DrivePage from './pages/DrivePage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import SharePage from './pages/SharePage.tsx';
import SharesPage from './pages/SharesPage.tsx';
import Layout from './components/Layout.tsx';
import { initApi } from './api.ts';
import type { ReactNode } from 'react';

const useStyles = makeStyles({
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--colorNeutralBackground1)',
  }
});

function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Layout>{children}</Layout>;
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const styles = useStyles();
  const { loading, config, user } = useAuth();
  const [initialized, setInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    initApi.status()
      .then(r => setInitialized(r.initialized))
      .catch(() => setInitialized(true)); // assume initialized on error
  }, []);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = config.siteIconUrl || '/favicon.ico';
  }, [config.siteIconUrl]);

  if (loading || initialized === null) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner label="Loading..." size="large" />
      </div>
    );
  }

  if (!initialized) {
    return <InitPage onComplete={() => setInitialized(true)} />;
  }

  return (
    <Routes>
      {/* Public share page — no auth required */}
      <Route path="/share/:token" element={<SharePage />} />

      {/* Auth — redirect to / if already logged in */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedLayout><DrivePage /></ProtectedLayout>} />
      <Route path="/shares" element={<ProtectedLayout><SharesPage /></ProtectedLayout>} />
      <Route path="/settings" element={<ProtectedLayout><SettingsPage /></ProtectedLayout>} />
      <Route path="/admin" element={
        <ProtectedLayout>
          <AdminGuard><AdminPage /></AdminGuard>
        </ProtectedLayout>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ThemeWrapper({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} style={{ height: '100%' }}>
      {children}
    </FluentProvider>
  );
}

export default function App() {
  return (
    <ThemeWrapper>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeWrapper>
  );
}
