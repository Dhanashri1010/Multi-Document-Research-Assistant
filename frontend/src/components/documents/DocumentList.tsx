import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  GitCompare,
  FileText,
  CheckSquare,
  Square,
  Folder,
  ArrowUpDown,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { IDocument } from '../../types/document.js';
import { DocumentCard } from './DocumentCard.js';
import { Button } from '../common/Button.js';
import { EmptyState } from '../common/EmptyState.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';

interface DocumentListProps {
  documents: IDocument[];
  onDeleteDocument: (id: string) => Promise<void>;
  onReprocessDocument: (id: string) => Promise<void>;
  onSummarizeDocument: (id: string) => void;
  onOpenPdf: (id: string) => void;
  onOpenUpload: () => void;
  onUpdateCollection?: (id: string, col: string) => Promise<void>;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onDeleteDocument,
  onReprocessDocument,
  onSummarizeDocument,
  onOpenPdf,
  onOpenUpload,
  onUpdateCollection,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'processing' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'word' | 'txt'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'pages-desc' | 'pages-asc'
  >('newest');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const navigate = useNavigate();
  const { selectedDocIds, toggleSelectDoc, selectAllDocs, clearSelectedDocs } = useWorkspace();

  // Dynamic collections & categories
  const collections = useMemo(() => {
    return Array.from(new Set(documents.map((d) => d.collectionName || 'General'))).sort();
  }, [documents]);

  const categories = useMemo(() => {
    return Array.from(new Set(documents.map((d) => d.category || 'General Document'))).sort();
  }, [documents]);

  // Client-side filtering & sorting
  const filteredAndSortedDocs = useMemo(() => {
    let result = documents.filter((doc) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.originalName.toLowerCase().includes(q);
        const matchesTitle = (doc.title || '').toLowerCase().includes(q);
        const matchesAbstract = (doc.abstract || '').toLowerCase().includes(q);
        const matchesCategory = (doc.category || '').toLowerCase().includes(q);
        const matchesAuthors = (doc.authors || []).some((a) => a.toLowerCase().includes(q));
        if (!matchesName && !matchesTitle && !matchesAbstract && !matchesCategory && !matchesAuthors) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'processing') {
          if (doc.status !== 'processing' && doc.status !== 'uploaded') return false;
        } else if (doc.status !== statusFilter) {
          return false;
        }
      }

      // File Type
      if (typeFilter !== 'all') {
        const ext = (doc.originalName.toLowerCase().split('.').pop() || '').trim();
        const isPdf = doc.fileType === 'pdf' || doc.mimeType === 'application/pdf' || ext === 'pdf';
        const isWord = doc.fileType === 'docx' || doc.fileType === 'doc' || ext === 'docx' || ext === 'doc';
        if (typeFilter === 'pdf' && !isPdf) return false;
        if (typeFilter === 'word' && !isWord) return false;
        if (typeFilter === 'txt' && (isPdf || isWord)) return false;
      }

      // Category
      if (categoryFilter !== 'all') {
        if ((doc.category || 'General Document') !== categoryFilter) return false;
      }

      // Collection
      if (selectedCollection !== 'all') {
        if ((doc.collectionName || 'General') !== selectedCollection) return false;
      }

      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc':
          return (a.title || a.originalName).localeCompare(b.title || b.originalName);
        case 'name-desc':
          return (b.title || b.originalName).localeCompare(a.title || a.originalName);
        case 'pages-desc':
          return (b.pageCount || 0) - (a.pageCount || 0);
        case 'pages-asc':
          return (a.pageCount || 0) - (b.pageCount || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [
    documents,
    searchQuery,
    statusFilter,
    typeFilter,
    categoryFilter,
    selectedCollection,
    sortBy,
  ]);

  // Reset page when filter changes
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: 'all' | 'ready' | 'processing' | 'failed') => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (val: 'all' | 'pdf' | 'txt') => {
    setTypeFilter(val);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (val: string) => {
    setCategoryFilter(val);
    setCurrentPage(1);
  };

  const handleCollectionFilterChange = (val: string) => {
    setSelectedCollection(val);
    setCurrentPage(1);
  };

  const handleSortChange = (
    val: 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'pages-desc' | 'pages-asc'
  ) => {
    setSortBy(val);
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalItems = filteredAndSortedDocs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDocs = filteredAndSortedDocs.slice(startIndex, startIndex + pageSize);

  // Multi-select helpers
  const readyDocs = filteredAndSortedDocs.filter((d) => d.status === 'ready');
  const allCurrentReadySelected =
    paginatedDocs.filter((d) => d.status === 'ready').length > 0 &&
    paginatedDocs
      .filter((d) => d.status === 'ready')
      .every((d) => selectedDocIds.includes(d._id));

  const handleToggleSelectPage = () => {
    const readyPageIds = paginatedDocs.filter((d) => d.status === 'ready').map((d) => d._id);
    if (allCurrentReadySelected) {
      // Remove these page ids from selection
      const remaining = selectedDocIds.filter((id) => !readyPageIds.includes(id));
      selectAllDocs(remaining);
    } else {
      // Add missing page ids to selection
      const combined = Array.from(new Set([...selectedDocIds, ...readyPageIds]));
      selectAllDocs(combined);
    }
  };

  const handleResearchSelected = () => {
    navigate('/research');
  };

  const handleCompareSelected = () => {
    navigate('/compare');
  };

  const handleSingleDocResearch = (id: string) => {
    selectAllDocs([id]);
    navigate('/research');
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    selectedCollection !== 'all' ||
    sortBy !== 'newest';

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
    setSelectedCollection('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Search, Filter & Controls Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        {/* Row 1: Search & Sort */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search documents by title, filename, author, or content..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as any)}
              className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="newest">Recently Uploaded</option>
              <option value="oldest">Oldest Uploaded</option>
              <option value="name-asc">Document Name (A-Z)</option>
              <option value="name-desc">Document Name (Z-A)</option>
              <option value="pages-desc">Page Count (High to Low)</option>
              <option value="pages-asc">Page Count (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Filter Badges & Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Filters:
            </span>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as any)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>

            {/* File Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value as any)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All File Types</option>
              <option value="pdf">PDF Documents (.pdf)</option>
              <option value="word">Word Documents (.docx, .doc)</option>
              <option value="txt">Text Files (.txt)</option>
            </select>

            {/* Category Filter */}
            {categories.length > 1 && (
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryFilterChange(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Collection Filter */}
            {collections.length > 1 && (
              <div className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedCollection}
                  onChange={(e) => handleCollectionFilterChange(e.target.value)}
                  className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Collections ({documents.length})</option>
                  {collections.map((c) => (
                    <option key={c} value={c}>
                      {c} ({documents.filter((d) => (d.collectionName || 'General') === c).length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-brand-600 hover:text-brand-800 font-semibold px-2 py-1 rounded hover:bg-brand-50 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Results count label */}
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{totalItems}</strong> document
            {totalItems === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Multi-Selection Floating Action Bar */}
      {selectedDocIds.length > 0 && (
        <div className="bg-brand-900 text-white p-3.5 px-5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-brand-500/30 text-brand-200 flex items-center justify-center font-bold text-xs">
              {selectedDocIds.length}
            </span>
            <span className="text-xs font-semibold text-slate-200">
              {selectedDocIds.length} document{selectedDocIds.length > 1 ? 's' : ''} selected for research
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleResearchSelected}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Research in Workspace
            </Button>

            {selectedDocIds.length >= 2 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCompareSelected}
                icon={<GitCompare className="w-3.5 h-3.5" />}
              >
                Cross-Compare ({selectedDocIds.length})
              </Button>
            )}

            <button
              onClick={clearSelectedDocs}
              className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Select All on Page action */}
      {readyDocs.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button
            onClick={handleToggleSelectPage}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-2 select-none"
          >
            {allCurrentReadySelected ? (
              <CheckSquare className="w-4 h-4 text-brand-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {allCurrentReadySelected
                ? 'Deselect Page Documents'
                : 'Select All Ready on Current Page'}
            </span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="6">6</option>
              <option value="9">9</option>
              <option value="12">12</option>
              <option value="24">24</option>
            </select>
          </div>
        </div>
      )}

      {/* Document Grid */}
      {filteredAndSortedDocs.length === 0 ? (
        documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Documents Uploaded Yet"
            description="Upload research papers, technical reports, or articles to begin intelligent semantic retrieval and AI analysis."
            action={
              <Button variant="primary" size="md" onClick={onOpenUpload}>
                Upload First Document
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No Matching Documents Found"
            description="No documents matched your search or filter criteria. Try adjusting keywords or clearing active filters."
            action={
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset All Filters
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedDocs.map((doc) => (
            <DocumentCard
              key={doc._id}
              document={doc}
              isSelected={selectedDocIds.includes(doc._id)}
              onToggleSelect={toggleSelectDoc}
              onDelete={onDeleteDocument}
              onReprocess={onReprocessDocument}
              onSummarize={onSummarizeDocument}
              onOpenPdf={onOpenPdf}
              onOpenResearch={handleSingleDocResearch}
              onUpdateCollection={onUpdateCollection}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 bg-white p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{' '}
            <strong className="text-slate-800">
              {Math.min(startIndex + pageSize, totalItems)}
            </strong>{' '}
            of <strong className="text-slate-800">{totalItems}</strong> documents
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => setCurrentPage(pageNumber)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                  currentPage === pageNumber
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
