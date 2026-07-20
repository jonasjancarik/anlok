import type { AppProps } from 'next/app';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/globals.css';
import AppNavbar from '../components/Navbar';
import { authenticationRedirect, isPublicAuthRoute } from '@/lib/authNavigation';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AuthWrapper>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </AuthWrapper>
    </AuthProvider>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  if (isPublicAuthRoute(router.pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="d-flex flex-column vh-100">
      <div className="d-none d-lg-block">
        <AppNavbar />
      </div>
      <div className="flex-grow-1 overflow-auto">
        {children}
      </div>
      <div className="d-lg-none">
        <AppNavbar />
      </div>
    </div>
  );
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, token, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) return;

      try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/verify`,
          {}, // Empty body
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (error) {
        console.error('Token verification failed:', error);
        logout();
        const redirect = authenticationRedirect(router.pathname);
        if (redirect) {
          router.push(redirect);
        }
      }
    };

    verifyToken();
  }, [token, logout, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const redirect = !user ? authenticationRedirect(router.pathname) : null;
  if (redirect) {
    router.push(redirect);
    return null;
  }

  return <>{children}</>;
}

export default MyApp;
