import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ModuleSelector from './pages/ModuleSelector';
import AdminPanel from './features/admin/AdminPanel';
import AmbuTrack from './features/ambulances/AmbuTrack';
import FloorTrace from './features/rtls/FloorTrace';

import EnergyPulse from './features/energy/EnergyPulse';
import AirGuard from './features/air/AirGuard';
import OxygenRaw from './features/oxygen/OxygenRaw';
import DossierPatient from './features/patient/DossierPatient';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Admission from './features/admission/Admission';
import OxygenPage from './pages/OxygenPage';
import OperatingRoomView from './features/operating_room/OperatingRoomView';
import Reporting from './pages/Reporting';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/modules" element={
              <ProtectedRoute>
                <Layout>
                  <ModuleSelector />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/reporting" element={
              <ProtectedRoute>
                <Layout>
                  <Reporting />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <AdminPanel />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ambulances" element={
              <ProtectedRoute requiredModule="ambutrack">
                <Layout>
                  <AmbuTrack />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/rtls" element={
              <ProtectedRoute requiredModule="floortrace">
                <Layout>
                  <FloorTrace />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/energy" element={
              <ProtectedRoute requiredModule="energypulse">
                <Layout>
                  <EnergyPulse />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/air" element={
              <ProtectedRoute requiredModule="airguard">
                <Layout>
                  <AirGuard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/oxygen" element={
              <ProtectedRoute requiredModule="oxyflow">
                <Layout>
                  <OxygenPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/oxygen-raw" element={
              <ProtectedRoute>
                <Layout>
                  <OxygenRaw />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/dossier-patient" element={
              <ProtectedRoute>
                <Layout>
                  <DossierPatient />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/admission" element={
              <ProtectedRoute>
                <Layout>
                  <Admission />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/bloc" element={<OperatingRoomView />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;