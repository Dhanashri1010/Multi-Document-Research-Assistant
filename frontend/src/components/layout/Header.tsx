import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { UploadCloud, Sparkles, Files } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { Button } from '../common/Button.js';

interface HeaderProps {
  onOpenUpload?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenUpload }) => {
  const location = useLocation();
  const { selectedDocIds } = useWorkspace();

  const getPageMeta = () => {
    switch (location.pathname) {
      case '/dashboard':
        return {
          title: 'Research Dashboard',
          description: 'Overview of your uploaded documents and research activity.',
        };
      case '/documents':
        return {
          title: 'Document Management',
          description: 'Upload, view, and organize your research documents.',
        };
      case '/research':
        return {
          title: 'Research Workspace',
          description: 'Ask questions across your selected documents with verified source citations.',
        };
      case '/compare':
        return {
          title: 'Compare Documents',
          description: 'Cross-paper comparative analysis across objectives, models, metrics, and results.',
        };
      case '/workflow-guide':
        return {
          title: 'Project Workflow & Technology Guide',
          description: 'System architecture, NLP algorithms, and technology stack.',
        };
      default:
        return {
          title: 'Multi-Document Research Assistant',
          description: 'AI-assisted document research and analysis.',
        };
    }
  };

  const meta = getPageMeta();

  return (
    <header className="h-16 px-8 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-lg font-bold text-slate-800 leading-tight">{meta.title}</h2>
        <p className="text-xs text-slate-500 hidden sm:block">{meta.description}</p>
      </div>

      <div className="flex items-center gap-3">
        {selectedDocIds.length > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-xs font-semibold text-brand-700">
            <Files className="w-3.5 h-3.5" />
            <span>{selectedDocIds.length} Document{selectedDocIds.length > 1 ? 's' : ''} Selected</span>
          </div>
        )}

        {location.pathname !== '/documents' && onOpenUpload && (
          <Button
            size="sm"
            variant="outline"
            icon={<UploadCloud className="w-4 h-4" />}
            onClick={onOpenUpload}
          >
            Upload
          </Button>
        )}

        {location.pathname !== '/research' && (
          <Link to="/research">
            <Button size="sm" variant="primary" icon={<Sparkles className="w-4 h-4" />}>
              Open Workspace
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
};
