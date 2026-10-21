import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './auth';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Listings from './pages/Listings';
import Users from './pages/Users';
import Scrapers from './pages/Scrapers';

export default function App() {
  const { authed, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-sm text-[#94a3b8]">
        Загрузка панели SofDom...
      </div>
    );
  }

  if (!authed) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/users" element={<Users />} />
        <Route path="/scrapers" element={<Scrapers />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
