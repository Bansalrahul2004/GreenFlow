import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(d => {
      if (!d) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return !d;
    });
  };

  return (
    <nav className="bg-green-800 text-white p-3 flex flex-wrap items-center justify-between">
      <span className="font-bold text-lg">
        <Link to="/">GreenFlow</Link>
      </span>
      <div className="space-x-4 flex items-center">
        {user && (user.role === 'manager' || user.role === 'supplier') && (
          <Link to="/suppliers" className="hover:underline">Suppliers</Link>
        )}
        {user && (user.role === 'manager' || user.role === 'supplier') && (
          <Link to="/products" className="hover:underline">Products</Link>
        )}
        {user && (user.role === 'manager' || user.role === 'supplier') && (
          <Link to="/shipments" className="hover:underline">Shipments</Link>
        )}
        {user && (user.role === 'manager' || user.role === 'supplier') && (
          <Link to="/waste-alerts" className="hover:underline">Waste Alerts</Link>
        )}
        {user && (
          <Link to="/analytics" className="hover:underline">Analytics</Link>
        )}
        {user && (
          <Link to="/orders" className="hover:underline">Orders</Link>
        )}
        {(user?.role === 'manager' || user?.role === 'admin') && (
          <Link to="/pending-suppliers" className="hover:underline">Pending Suppliers</Link>
        )}
        {user && (
          <>
            <Link to="/profile" className="hover:underline">Profile</Link>
            <button onClick={handleLogout} className="hover:underline ml-2">Logout</button>
          </>
        )}
        {!user && <Link to="/register" className="hover:underline">Register</Link>}
        {!user && <Link to="/login" className="hover:underline">Login</Link>}
        <button
          onClick={toggleDarkMode}
          className="ml-2 p-2 rounded hover:bg-green-700 focus:outline-none"
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </nav>
  );
};

export default Navbar; 