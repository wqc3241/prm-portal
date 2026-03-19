import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useDocument,
  useDocuments,
  useDownloadDocument,
  useDeleteDocument,
} from '../../hooks/useDocuments';
import {
  PageHeader,
  Skeleton,
  CardSkeleton,
} from '../../components/shared';
import { formatDate, formatDateTime, humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  ArrowDownTrayIcon,
  TrashIcon,
  PencilSquareIcon,
  DocumentIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  TableCellsIcon,
  PresentationChartBarIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import type { Document } from '../../types';

const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: DocumentTextIcon,
  doc: DocumentTextIcon,
  docx: DocumentTextIcon,
  xls: TableCellsIcon,
  xlsx: TableCellsIcon,
  ppt: PresentationChartBarIcon,
  pptx: PresentationChartBarIcon,
  png: PhotoIcon,
  jpg: PhotoIcon,
  gif: PhotoIcon,
  mp4: FilmIcon,
  zip: ArchiveBoxIcon,
  other: DocumentIcon,
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const {
    data: doc,
    isLoading,
    isError,
  } = useDocument(id);

  // Related documents in same folder
  const { data: relatedData } = useDocuments(
    doc?.folder_id ? { folder_id: doc.folder_id, per_page: 5 } : undefined
  );
  const relatedDocs = (relatedData?.data ?? []).filter(
    (d) => d.id !== id
  );

  const downloadMutation = useDownloadDocument();
  const deleteMutation = useDeleteDocument();

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CardSkeleton />
          </div>
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Document not found
        </h2>
        <p className="text-gray-500 mb-4">
          This document does not exist or you do not have access to it.
        </p>
        <button
          onClick={() => navigate('/library')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Library
        </button>
      </div>
    );
  }

  const Icon = FILE_TYPE_ICONS[doc.file_type] ?? DocumentIcon;

  return (
    <div>
      <PageHeader
        title={doc.title}
        breadcrumbs={[
          { label: 'Library', to: '/library' },
          { label: doc.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadMutation.mutate(doc.id)}
              disabled={downloadMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy disabled:opacity-50 transition-colors"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {downloadMutation.isPending ? 'Downloading...' : 'Download'}
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  deleteMutation.mutate(doc.id, {
                    onSuccess: () => navigate('/library'),
                  });
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Document details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center">
                <Icon className="h-7 w-7 text-gray-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  {doc.title}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {doc.file_name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label="File Type" value={doc.file_type.toUpperCase()} />
              <InfoField label="File Size" value={formatFileSize(doc.file_size)} />
              <InfoField label="Uploaded By" value={doc.uploaded_by_name} />
              <InfoField label="Downloads" value={String(doc.download_count)} />
              <InfoField label="Folder" value={doc.folder_name} />
              <InfoField label="Created" value={formatDateTime(doc.created_at)} />
            </div>

            {doc.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Description
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {doc.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {doc.tags && doc.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => downloadMutation.mutate(doc.id)}
                disabled={downloadMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download File
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Metadata
            </h3>
            <div className="space-y-3">
              <InfoField label="Document ID" value={doc.id} />
              <InfoField label="Last Updated" value={formatDateTime(doc.updated_at)} />
              <InfoField
                label="Tier Restricted"
                value={doc.tier_restricted ? 'Yes' : 'No'}
              />
            </div>
          </div>

          {/* Related documents */}
          {relatedDocs.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Related Documents
              </h3>
              <div className="space-y-2">
                {relatedDocs.map((relDoc) => {
                  const RelIcon =
                    FILE_TYPE_ICONS[relDoc.file_type] ?? DocumentIcon;
                  return (
                    <button
                      key={relDoc.id}
                      onClick={() => navigate(`/library/${relDoc.id}`)}
                      className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
                    >
                      <RelIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">
                        {relDoc.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5">{value ?? '-'}</p>
    </div>
  );
}
