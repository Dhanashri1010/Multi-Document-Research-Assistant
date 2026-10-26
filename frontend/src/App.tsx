import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WorkspaceProvider } from './context/WorkspaceContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { DocumentsPage } from './pages/DocumentsPage.js';
import { ResearchPage } from './pages/ResearchPage.js';
import { ComparePage } from './pages/ComparePage.js';

export function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}

export default App;
