import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { navigate, useRoute } from './router';
import Landing from './landing/Landing';

const SignIn = lazy(() => import('./auth/SignIn'));
const Studio = lazy(() => import('./studio/Studio'));

function Splash() { return <div className="splash" role="status" aria-label="Loading"><span className="loader"/></div>; }

function Routes() {
  const route = useRoute();
  const { user, ready } = useAuth();
  const protectedRoute = route === '/studio' || route === '/history';

  useEffect(() => {
    if (!ready) return;
    if (protectedRoute && !user) navigate('/signin', { replace: true });
    if (route === '/signin' && user && !user.guest) navigate('/studio', { replace: true });
  }, [ready, user, route, protectedRoute]);

  if (route === '/') return <Landing/>;
  if (!ready || (protectedRoute && !user)) return <Splash/>;
  return <Suspense fallback={<Splash/>}>
    {route === '/signin' ? <SignIn/> : <Studio key={user!.id} view={route === '/history' ? 'history' : 'studio'} user={user!}/>}
  </Suspense>;
}

export default function App() {
  return <AuthProvider><Routes/></AuthProvider>;
}
