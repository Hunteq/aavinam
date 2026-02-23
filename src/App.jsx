import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BranchProvider, useBranch } from './context/BranchContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Farmers from './pages/Farmers';
import Rates from './pages/Rates';
import Entries from './pages/Entries';
import Products from './pages/Products';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Branches from './pages/Branches';
import Billing from './pages/Billing';
import Reports from './pages/Reports';
import Onboarding from './pages/Onboarding';
import { UserProvider, useUser } from './context/UserContext';
import { LanguageProvider } from './context/LanguageContext';
// PWA UI Components
import InstallAppCard from './components/InstallAppCard';
import UpdatePrompt from './components/UpdatePrompt';
import OfflineIndicator from './components/OfflineIndicator';

// A simple wrapper to handle empty branch state
import { db, resetDatabase } from './db/db';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const { user } = useUser();
  if (!user) return <Navigate to="/onboarding" />;
  return children;
};

const AppContent = () => {
  const { currentBranch, loading, dbError } = useBranch();
  const { user } = useUser();

  if (loading) return <div className="loading">Loading...</div>;

  if (dbError) {
    return (
      <div className="error-screen" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', margin: '100px auto' }}>
        <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: '20px' }} />
        <h1>Database Error</h1>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>
          We encountered an issue with the local database on your device (most likely due to a schema update conflict).
        </p>
        <div className="error-box" style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', color: '#b91c1c', fontSize: '0.9rem', marginBottom: '30px', textAlign: 'left' }}>
          <code>{dbError}</code>
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', gap: '10px' }}
          onClick={async () => {
            if (confirm("This will clear all local data on this device and fix the error. Continue?")) {
              await resetDatabase();
              window.location.reload();
            }
          }}
        >
          <RefreshCcw size={20} /> Reset App & Fix Error
        </button>
      </div>
    );
  }


  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/farmers" element={<Farmers />} />
              <Route path="/rates" element={<Rates />} />
              <Route path="/entries" element={<Entries />} />
              <Route path="/products" element={<Products />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/branches" element={<Branches />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

function App() {
  return (
    <UserProvider>
      <LanguageProvider>
        <BranchProvider>
          <Router>
            <AppContent />
          </Router>
          {/* PWA UI — rendered outside Router so they persist across all pages */}
          <InstallAppCard />
          <UpdatePrompt />
          <OfflineIndicator />
        </BranchProvider>
      </LanguageProvider>
    </UserProvider>
  );
}

export default App;
