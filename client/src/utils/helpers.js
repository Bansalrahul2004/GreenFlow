// Utility helper functions for GreenFlow frontend

import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString();
}

export function RequireRole({ allowedRoles, children }) {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
} 