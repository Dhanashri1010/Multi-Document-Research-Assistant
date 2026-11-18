import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { WorkspaceProvider } from './context/WorkspaceContext.js';
import { ProtectedRoute } from './components/common/ProtectedRoute.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { DocumentsPage } from './pages/DocumentsPage.js';
import { ResearchPage } from './pages/ResearchPage.js';
import { ComparePage } from './pages/ComparePage.js';
import { WorkflowGuidePage } from './pages/WorkflowGuidePage.js';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            {/* Public Authentication Pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Application Pages */}
            <Route element={<AppLayout />}>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <DocumentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/research"
                element={
                  <ProtectedRoute>
                    <ResearchPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compare"
                element={
                  <ProtectedRoute>
                    <ComparePage />
                  </ProtectedRoute>
                }
              />
              {/* Technical Workflow & Architecture Guide (Public for mentors and evaluators) */}
              <Route path="/workflow-guide" element={<WorkflowGuidePage />} />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
