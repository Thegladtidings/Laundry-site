import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import SiteLayout from './components/SiteLayout';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NewOrderPage from './pages/NewOrderPage';
import RegisterPage from './pages/RegisterPage';
import OperationsPage from './pages/OperationsPage';

function AppRoutes() {
    const { user } = useAuth();

    return (
        <Routes>
            <Route element={<SiteLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
                <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={user?.role === 'admin' || user?.role === 'cashier' ? <OperationsPage /> : <DashboardPage />} />
                    <Route path="/orders/new" element={<NewOrderPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

export default function App() {
    const { loading } = useAuth();
    if (loading) {
        return <div className="app-loading"><span className="spinner" />Preparing your fresh start…</div>;
    }
    return <AppRoutes />;
}
