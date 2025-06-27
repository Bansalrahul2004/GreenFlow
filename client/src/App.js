import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import Shipments from './pages/Shipments';
import WasteAlerts from './pages/WasteAlerts';
import Analytics from './pages/Analytics';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import ChangePassword from './pages/ChangePassword';
import PendingSuppliers from './pages/PendingSuppliers';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { RequireRole } from './utils/helpers';

function AppContent() {
  const { user } = useContext(AuthContext);
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/suppliers" element={
              <RequireRole allowedRoles={['manager', 'supplier']}>
                <Suppliers />
              </RequireRole>
            } />
            <Route path="/products" element={
              <RequireRole allowedRoles={['manager', 'supplier']}>
                <Products />
              </RequireRole>
            } />
            <Route path="/shipments" element={
              <RequireRole allowedRoles={['manager', 'supplier']}>
                <Shipments />
              </RequireRole>
            } />
            <Route path="/waste-alerts" element={
              <RequireRole allowedRoles={['manager', 'supplier']}>
                <WasteAlerts />
              </RequireRole>
            } />
            <Route path="/analytics" element={
              <RequireRole allowedRoles={['manager', 'supplier', 'consumer']}>
                <Analytics />
              </RequireRole>
            } />
            <Route path="/orders" element={
              <RequireRole allowedRoles={['manager', 'supplier', 'consumer']}>
                <Orders />
              </RequireRole>
            } />
            <Route path="/profile" element={
              <RequireRole allowedRoles={['manager', 'supplier', 'consumer']}>
                <Profile />
              </RequireRole>
            } />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/pending-suppliers" element={<PendingSuppliers />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App; 