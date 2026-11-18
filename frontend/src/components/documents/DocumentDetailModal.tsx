import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Sparkles,
  FileText,
  BookOpen,
  Check,
  Copy,
  RefreshCw,
  Printer,
  Layers,
  Scale,
  FileCode,
  Briefcase,
  GraduationCap,
  Wrench,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowRight,
} from 'lucide-react';
import { IDocument, DocumentSummary, FindingWithPage } from '../../types/document.js';
import { ProcessingStatusBadge } from './ProcessingStatus.js';
import { Button } from '../common/Button.js';
import { LoadingState } from '../common/LoadingState.js';
import { documentService } from '../../services/documentService.js';

interface DocumentDetailModalProps {
  document: IDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenResearch?: (id: string) => void;
  onReprocess?: (id: string) => Promise<void>;
  initialTab?: 'summary' | 'pdf' | 'info';
  initialPage?: number;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onOpenResearch,
  onReprocess,
  initialTab = 'summary',
  initialPage = 1,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'pdf' | 'info'>(initialTab);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Summary state
  const [summaryData, setSummaryData] = useState<DocumentSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Word document chunks preview state
  const [documentChunks, setDocumentChunks] = useState<any[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Authenticated PDF preview state
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdfBlob, setLoadingPdfBlob] = useState(false);
  const [pdfBlobError, setPdfBlobError] = useState<string | null>(null);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const ext = doc ? (doc.originalName.toLowerCase().split('.').pop() || '').trim() : '';
  const isWordDoc = Boolean(
    doc && (doc.fileType === 'docx' || doc.fileType === 'doc' || ext === 'docx' || ext === 'doc')
  );

  useEffect(() => {
    if (!isOpen || !doc?._id || isWordDoc) return;

    let active = true;
    setLoadingPdfBlob(true);
    setPdfBlobError(null);

    const loadBlob = async () => {
      try {
        const blob = await documentService.getFileBlob(doc._id);
        if (!active) return;
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = url;
        setPdfBlobUrl(url);
      } catch (err: any) {
        if (!active) return;
        const msg =
          err.response?.status === 401
            ? 'Your session has expired. Please log in again.'
            : err.message || 'Failed to securely load PDF preview.';
        setPdfBlobError(msg);
      } finally {
        if (active) setLoadingPdfBlob(false);
      }
    };

    loadBlob();

    return () => {
      active = false;
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
        setPdfBlobUrl(null);
      }
    };
  }, [isOpen, doc?._id, isWordDoc]);

  const loadSummary = useCallback(
    async (regenerate: boolean = false) => {
      if (!doc) return;
      try {
        if (regenerate) {
          setIsRegenerating(true);
        } else {
          setLoadingSummary(true);
        }
        setSummaryError(null);

        const data = await documentService.summarize(doc._id, regenerate);
        setSummaryData(data);
      } catch (err: any) {
        console.warn('[DocumentDetailModal] Summary fetch error:', err);
        setSummaryError(err.message || 'Unable to generate summary at this moment.');
      } finally {
        setLoadingSummary(false);
        setIsRegenerating(false);
      }
    },
    [doc]
  );

  useEffect(() => {
    if (isOpen && doc) {
      setActiveTab(initialTab);
      setCurrentPage(initialPage || 1);
      setZoomLevel(100);

      // Load summary
      loadSummary(false);

      // If Word document, load chunks for in-app preview
      if (isWordDoc) {
        setLoadingChunks(true);
        documentService
          .getChunks(doc._id)
          .then((chunks) => setDocumentChunks(chunks))
          .catch((err) => console.warn('Failed to load document chunks for preview:', err))
          .finally(() => setLoadingChunks(false));
      } else {
        setDocumentChunks([]);
      }
    } else {
      setSummaryData(null);
      setSummaryError(null);
      setDocumentChunks([]);
    }
  }, [isOpen, doc, initialTab, initialPage, isWordDoc, loadSummary]);

  if (!isOpen || !doc) return null;

  const docTitle = doc.title || doc.originalName.replace(/\.(pdf|docx|doc|txt)$/i, '');
  const formattedSize = (doc.fileSize / (1024 * 1024)).toFixed(2) + ' MB';
  const formattedDate = new Date(doc.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'Research Paper':
      case 'Academic Article':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'Legal Document':
        return <Scale className="w-3.5 h-3.5" />;
      case 'Technical Document':
        return <FileCode className="w-3.5 h-3.5" />;
      case 'Business Report':
        return <Briefcase className="w-3.5 h-3.5" />;
      case 'Educational Material':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'User Manual':
        return <Wrench className="w-3.5 h-3.5" />;
      default:
        return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const handleJumpToPage = (pageNum: number) => {
    const validPage = Math.max(1, Math.min(pageNum, doc.pageCount || 1000));
    setCurrentPage(validPage);
    setActiveTab('pdf');
  };

  const handleCopySummary = () => {
    if (!summaryData) return;
    const textToCopy = doc.summaryText || summaryData.summary || summaryData.overview || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportMarkdown = () => {
    if (!summaryData) return;
    const textToExport = doc.summaryText || summaryData.summary || summaryData.overview || '';
    const blob = new Blob([textToExport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${doc.originalName.replace(/\.pdf$/i, '')}_summary.md`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadOriginal = () => {
    documentService.downloadFile(doc._id, doc.originalName);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                {getCategoryIcon(doc.category || summaryData?.category)}
                <span>{doc.category || summaryData?.category || 'General Document'}</span>
              </span>

              <ProcessingStatusBadge status={doc.status} />

              <span className="text-xs text-slate-500 font-medium">
                {isWordDoc
                  ? `${documentChunks.length > 0 ? documentChunks.length : (doc.chunkCount || 1)} sections · ${formattedSize}`
                  : `${doc.pageCount > 0 ? `${doc.pageCount} pages` : '1 page'} · ${formattedSize}`}
              </span>
            </div>

            <h2
              className="text-lg font-bold text-slate-900 truncate leading-snug"
              title={docTitle}
            >
              {docTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenResearch && doc.status === 'ready' && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpenResearch(doc._id);
                }}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Research
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadOriginal}
              icon={<Download className="w-3.5 h-3.5" />}
              title="Download original file"
            >
              Download
            </Button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors"
              title="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'summary'
                  ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Summary & Understanding</span>
            </button>

            <button
              onClick={() => setActiveTab('pdf')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'pdf'
                  ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{isWordDoc ? 'Word Document Sections' : 'Original PDF Preview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('info')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'info'
                  ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Document Details</span>
            </button>
          </div>

          {/* Quick tab contextual controls */}
          {activeTab === 'summary' && summaryData && (
            <div className="hidden sm:flex items-center gap-1.5 py-2">
              <button
                onClick={handleCopySummary}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
                title="Copy full summary"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                onClick={handleExportMarkdown}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
                title="Download markdown summary"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .md</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
                title="Print summary"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                onClick={() => loadSummary(true)}
                disabled={isRegenerating}
                className="px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg flex items-center gap-1.5 transition-colors border border-brand-200 disabled:opacity-50"
                title="Regenerate summary from document text"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
              </button>
            </div>
          )}

          {activeTab === 'pdf' && (
            isWordDoc ? (
              <div className="flex items-center gap-2 py-2">
                <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                  {ext} Document
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {documentChunks.length > 0 ? `${documentChunks.length} sections indexed` : 'Structured view'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs border border-slate-200">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-white"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono text-slate-700">
                    Page {currentPage} / {doc.pageCount || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(doc.pageCount || 1000, p + 1))}
                    disabled={doc.pageCount > 0 && currentPage >= doc.pageCount}
                    className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-white"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-0.5 text-xs border border-slate-200">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-white"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono text-slate-700">{zoomLevel}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-white"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!pdfBlobUrl}
                  onClick={() => {
                    if (pdfBlobUrl) {
                      window.open(`${pdfBlobUrl}#page=${currentPage}`, '_blank');
                    }
                  }}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50 rounded-lg border border-slate-200 transition-colors"
                  title="Open PDF in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* TAB 1: AI SUMMARY */}
          {activeTab === 'summary' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {loadingSummary && (
                <div className="py-12">
                  <LoadingState message="Synthesizing intelligent document summary..." />
                </div>
              )}

              {summaryError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
                  <span>{summaryError}</span>
                  <Button size="sm" variant="outline" onClick={() => loadSummary(true)}>
                    Retry
                  </Button>
                </div>
              )}

              {summaryData && !loadingSummary && (
                <div className="space-y-6">
                  {/* Fallback notice if degraded */}
                  {summaryData.degraded && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {summaryData.degradedReason ||
                          'Quick structural summary extracted directly from document passages.'}
                      </span>
                    </div>
                  )}

                  {/* Overview Section */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-600" />
                      <span>Overview</span>
                    </h3>
                    <p className="text-sm text-slate-800 leading-relaxed">
                      {summaryData.overview || summaryData.summary}
                    </p>
                  </div>

                  {/* Key Findings Section */}
                  {summaryData.keyFindings && summaryData.keyFindings.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Key Findings & Insights</span>
                      </h3>
                      <div className="space-y-2.5">
                        {summaryData.keyFindings.map((findingItem, index) => {
                          const findingText =
                            typeof findingItem === 'string' ? findingItem : findingItem.finding;
                          const pageNum =
                            typeof findingItem === 'object' ? (findingItem as FindingWithPage).pageNumber : undefined;

                          return (
                            <div
                              key={index}
                              className="text-xs text-slate-800 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 p-3.5 rounded-xl flex items-start justify-between gap-3 transition-colors"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                  {index + 1}
                                </span>
                                <span className="leading-relaxed">{findingText}</span>
                              </div>

                              {pageNum && (
                                <button
                                  onClick={() => handleJumpToPage(pageNum)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded text-[11px] font-semibold border border-brand-200 shrink-0 transition-colors cursor-pointer"
                                  title={`Jump to Page ${pageNum} in PDF preview`}
                                >
                                  <span>Page {pageNum}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quantitative Data / Metrics Table */}
                  {summaryData.importantData && summaryData.importantData.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-600" />
                        <span>Key Quantitative Data & Metrics</span>
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                              <th className="py-2 pr-4">Metric / Evaluated Factor</th>
                              <th className="py-2 px-4">Value / Result</th>
                              <th className="py-2 pl-4 text-right">Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {summaryData.importantData.map((d, i) => (
                              <tr key={i} className="hover:bg-slate-50/80">
                                <td className="py-2.5 pr-4 font-medium text-slate-800">
                                  {d.metric}
                                  {d.context && (
                                    <span className="block text-[11px] text-slate-400 font-normal">
                                      {d.context}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 font-bold text-brand-700 font-mono">
                                  {d.value}
                                </td>
                                <td className="py-2.5 pl-4 text-right">
                                  {d.pageNumber ? (
                                    <button
                                      onClick={() => handleJumpToPage(d.pageNumber!)}
                                      className="px-2 py-0.5 bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-700 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                                    >
                                      Page {d.pageNumber}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Adaptive Domain Sections */}
                  {summaryData.sections && summaryData.sections.length > 0 && (
                    <div className="space-y-4">
                      {summaryData.sections.map((section, sIdx) => (
                        <div
                          key={sIdx}
                          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              {section.title}
                            </h3>
                            {section.pageNumber && (
                              <button
                                onClick={() => handleJumpToPage(section.pageNumber!)}
                                className="text-[10px] text-brand-600 hover:underline"
                              >
                                Source: Page {section.pageNumber}
                              </button>
                            )}
                          </div>

                          {section.content && (
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {section.content}
                            </p>
                          )}

                          {section.items && section.items.length > 0 && (
                            <ul className="space-y-1.5 pl-4 list-disc text-xs text-slate-700">
                              {section.items.map((it, itemIdx) => (
                                <li key={itemIdx} className="leading-relaxed">
                                  {it}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Methodology & Limitations Grid */}
                  {(summaryData.methodology || summaryData.limitations) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {summaryData.methodology && (
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span>Methodology & Approach</span>
                          </h4>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {summaryData.methodology}
                          </p>
                        </div>
                      )}

                      {summaryData.limitations && (
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Limitations & Considerations</span>
                          </h4>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {summaryData.limitations}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conclusion */}
                  {summaryData.conclusion && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Conclusion
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {summaryData.conclusion}
                      </p>
                    </div>
                  )}

                  {/* Legal Disclaimer */}
                  {summaryData.legalDisclaimer && (
                    <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-amber-900 text-xs">
                      {summaryData.legalDisclaimer}
                    </div>
                  )}

                  {/* Citations List */}
                  {summaryData.citations && summaryData.citations.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>Referenced Document Passages ({summaryData.citations.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {summaryData.citations.map((c, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              if (isWordDoc) {
                                setActiveTab('pdf');
                              } else if (c.pageNumber) {
                                handleJumpToPage(c.pageNumber);
                              }
                            }}
                            className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 space-y-1 cursor-pointer transition-colors"
                            title={c.pageNumber ? `Jump to Page ${c.pageNumber}` : 'View section in document'}
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                              <span className="truncate">{c.documentName}</span>
                              <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-mono text-[10px] border border-brand-200">
                                {c.pageNumber
                                  ? `Page ${c.pageNumber}`
                                  : c.heading || c.section || 'Passage'}
                              </span>
                            </div>
                            <p className="text-slate-500 italic line-clamp-2">"{c.excerpt}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ORIGINAL DOCUMENT PREVIEW */}
          {activeTab === 'pdf' && (
            isWordDoc ? (
              <div className="h-full flex flex-col bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                      {ext}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {doc.originalName} — Formatted Content View
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadOriginal}
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Download Original .{ext}
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {loadingChunks ? (
                    <div className="py-12 flex justify-center">
                      <LoadingState message="Loading document sections..." />
                    </div>
                  ) : documentChunks.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No parsed sections available for preview.
                    </div>
                  ) : (
                    documentChunks.map((chunk, cIdx) => (
                      <div
                        key={cIdx}
                        id={`chunk-${chunk.chunkIndex}`}
                        className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-brand-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                            {chunk.heading || chunk.section || 'Content'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            {chunk.paragraphNumber ? `Para ${chunk.paragraphNumber}` : `Section ${chunk.chunkIndex}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-sans">
                          {chunk.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                {loadingPdfBlob && (
                  <div className="py-24 flex justify-center items-center">
                    <LoadingState message="Fetching secure PDF preview..." />
                  </div>
                )}
                {pdfBlobError && !loadingPdfBlob && (
                  <div className="max-w-md mx-auto p-6 bg-white rounded-xl border border-rose-200 shadow-sm text-center space-y-3 my-12">
                    <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Unable to load document</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{pdfBlobError}</p>
                  </div>
                )}
                {pdfBlobUrl && !loadingPdfBlob && !pdfBlobError && (
                  <div
                    className="flex-1 w-full relative"
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <iframe
                      src={`${pdfBlobUrl}#page=${currentPage}`}
                      title={doc.originalName}
                      className="w-full h-full border-0 min-h-[68vh]"
                      allow="fullscreen"
                    />
                  </div>
                )}
              </div>
            )
          )}

          {/* TAB 3: DOCUMENT METADATA */}
          {activeTab === 'info' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                  Document Specifications
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Title</span>
                    <span className="font-semibold text-slate-800">{docTitle}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Original Filename</span>
                    <span className="font-semibold text-slate-800 break-all">{doc.originalName}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Document Category</span>
                    <span className="font-semibold text-brand-700">{doc.category || 'General Document'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Collection / Group</span>
                    <span className="font-semibold text-slate-800">{doc.collectionName || 'General'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">File Format & Size</span>
                    <span className="font-semibold text-slate-800">
                      {doc.mimeType} · {formattedSize}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">
                      {isWordDoc ? 'Sections' : 'Page Count'}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {isWordDoc
                        ? `${documentChunks.length > 0 ? documentChunks.length : (doc.chunkCount || 1)} sections`
                        : (doc.pageCount > 0 ? `${doc.pageCount} pages` : '1 page')}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Upload Date</span>
                    <span className="font-semibold text-slate-800">{formattedDate}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block mb-0.5">Processing Status</span>
                    <div className="mt-0.5">
                      <ProcessingStatusBadge status={doc.status} />
                    </div>
                  </div>

                  {doc.authors && doc.authors.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 md:col-span-2">
                      <span className="text-slate-400 block mb-0.5">Authors</span>
                      <span className="font-semibold text-slate-800">{doc.authors.join(', ')}</span>
                    </div>
                  )}

                  {doc.abstract && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 md:col-span-2">
                      <span className="text-slate-400 block mb-0.5">Extracted Abstract</span>
                      <p className="text-slate-700 leading-relaxed font-normal">{doc.abstract}</p>
                    </div>
                  )}

                  {(doc.warning || doc.isLowTextDensity) && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 md:col-span-2 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Text Density Notice</span>
                        <span className="text-[11px] leading-relaxed">
                          {doc.warning ||
                            'Low text density detected. If this is a scanned document or slide presentation, OCR is recommended.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {onReprocess && (
                    <div className="pt-3 md:col-span-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onReprocess(doc._id);
                          onClose();
                        }}
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                      >
                        Reprocess Document
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
