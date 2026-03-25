import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user' | 'guest';
  requiredModule?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole, 
  requiredModule 
}: ProtectedRouteProps) {
  const { user, hasModuleAccess } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (requiredModule && !hasModuleAccess(requiredModule)) {
    return <Navigate to="/modules" replace />;
  }

  return <>{children}</>;
}