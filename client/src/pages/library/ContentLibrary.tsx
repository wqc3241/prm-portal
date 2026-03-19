import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useDocuments,
  useFolders,
  useDownloadDocument,
  useDeleteDocument,
  useUploadDocument,
  useCreateFolder,
} from '../../hooks/useDocuments';
import {
  PageHeader,
  SearchBar,
  Skeleton,
  CardSkeleton,
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
} from '../../components/shared';
import { humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  PlusIcon,
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  TableCellsIcon,
  PresentationChartBarIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronRightIcon,
  ArchiveBoxIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import type {
  Document,
  Folder,
  FileType,
  DocumentQueryParams,
} from '../../types';

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

export function ContentLibrary() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [search, setSearch] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType | ''>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  const params = useMemo<DocumentQueryParams>(() => {
    const p: DocumentQueryParams = { page, per_page: 20 };
    if (search) p.search = search;
    if (selectedFolderId) p.folder_id = selectedFolderId;
    if (fileTypeFilter) p.file_type = fileTypeFilter;
    return p;
  }, [page, search, selectedFolderId, fileTypeFilter]);

  const { data: docsData, isLoading: docsLoading } = useDocuments(params);
  const documents = docsData?.data ?? [];
  const meta = docsData?.meta;

  const { data: folders, isLoading: foldersLoading } = useFolders();

  const downloadMutation = useDownloadDocument();
  const deleteMutation = useDeleteDocument();

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleSelectFolder = useCallback(
    (folderId: string | null) => {
      setSelectedFolderId(folderId);
      setPage(1);
    },
    []
  );

  if (docsLoading && !documents.length) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Content Library"
        subtitle="Access partner resources, documentation, and marketing materials"
        breadcrumbs={[{ label: 'Library' }]}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateFolderModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                <FolderIcon className="h-4 w-4" />
                New Folder
              </button>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy transition-colors"
              >
                <CloudArrowUpIcon className="h-4 w-4" />
                Upload Document
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left sidebar: folder tree */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Folders
            </h3>
            <button
              onClick={() => handleSelectFolder(null)}
              className={cn(
                'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                selectedFolderId === null
                  ? 'bg-navy-50 text-panw-navy font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <FolderOpenIcon className="h-4 w-4 flex-shrink-0" />
              All Documents
            </button>

            {foldersLoading ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : (
              <div className="mt-1 space-y-0.5">
                {(folders ?? [])
                  .filter((f) => !f.parent_id)
                  .map((folder) => (
                    <FolderTreeItem
                      key={folder.id}
                      folder={folder}
                      allFolders={folders ?? []}
                      selectedId={selectedFolderId}
                      expandedIds={expandedFolders}
                      onSelect={handleSelectFolder}
                      onToggle={toggleFolder}
                      depth={0}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Search and filters */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <SearchBar
              placeholder="Search documents..."
              onSearch={handleSearch}
              className="w-full sm:max-w-md"
            />
            <select
              value={fileTypeFilter}
              onChange={(e) => {
                setFileTypeFilter(e.target.value as FileType | '');
                setPage(1);
              }}
              className="rounded-md border-0 py-2 pl-3 pr-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            >
              <option value="">All Types</option>
              <option value="pdf">PDF</option>
              <option value="doc">Word</option>
              <option value="xls">Excel</option>
              <option value="ppt">PowerPoint</option>
              <option value="png">Images</option>
              <option value="mp4">Video</option>
            </select>

            {/* View mode toggle */}
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5',
                  viewMode === 'grid'
                    ? 'bg-panw-blue text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                )}
                aria-label="Grid view"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5',
                  viewMode === 'list'
                    ? 'bg-panw-blue text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                )}
                aria-label="List view"
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Documents */}
          {documents.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <DocumentIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900">
                No documents found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {search || selectedFolderId || fileTypeFilter
                  ? 'Try adjusting your filters.'
                  : 'No documents have been uploaded yet.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onView={() => navigate(`/library/${doc.id}`)}
                  onDownload={() => downloadMutation.mutate(doc.id)}
                  onDelete={
                    isAdmin
                      ? () => deleteMutation.mutate(doc.id)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">
                      Document
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">
                      Type
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">
                      Size
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">
                      Downloads
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => {
                    const Icon =
                      FILE_TYPE_ICONS[doc.file_type] ?? DocumentIcon;
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/library/${doc.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {doc.title}
                              </p>
                              {doc.description && (
                                <p className="text-xs text-gray-500 truncate max-w-[300px]">
                                  {doc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 uppercase">
                          {doc.file_type}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {doc.download_count}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadMutation.mutate(doc.id);
                            }}
                            className="text-panw-navy hover:text-panw-blue"
                            aria-label="Download"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(meta.page - 1) * meta.per_page + 1} to{' '}
                {Math.min(meta.page * meta.per_page, meta.total)} of{' '}
                {meta.total} documents
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= meta.total_pages}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      {isAdmin && (
        <UploadDocumentModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          folders={folders ?? []}
        />
      )}

      {/* Create Folder Modal */}
      {isAdmin && (
        <CreateFolderModal
          open={createFolderModalOpen}
          onClose={() => setCreateFolderModalOpen(false)}
          folders={folders ?? []}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

function FolderTreeItem({
  folder,
  allFolders,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  depth,
}: {
  folder: Folder;
  allFolders: Folder[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth: number;
}) {
  const children = allFolders.filter((f) => f.parent_id === folder.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded text-sm transition-colors cursor-pointer',
          isSelected
            ? 'bg-navy-50 text-panw-navy font-medium'
            : 'text-gray-700 hover:bg-gray-50'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(folder.id);
            }}
            className="p-0.5"
          >
            <ChevronRightIcon
              className={cn(
                'h-3 w-3 transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          onClick={() => onSelect(folder.id)}
          className="flex items-center gap-2 py-1.5 flex-1 text-left"
        >
          <FolderIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span className="truncate">{folder.name}</span>
          {folder.document_count != null && (
            <span className="text-[10px] text-gray-400 ml-auto">
              {folder.document_count}
            </span>
          )}
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  document: doc,
  onView,
  onDownload,
  onDelete,
}: {
  document: Document;
  onView: () => void;
  onDownload: () => void;
  onDelete?: () => void;
}) {
  const Icon = FILE_TYPE_ICONS[doc.file_type] ?? DocumentIcon;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <button
            onClick={onView}
            className="text-left"
          >
            <h4 className="text-sm font-semibold text-gray-900 hover:text-panw-navy transition-colors truncate">
              {doc.title}
            </h4>
          </button>
          {doc.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {doc.description}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {doc.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600"
            >
              {tag}
            </span>
          ))}
          {doc.tags.length > 3 && (
            <span className="text-[10px] text-gray-400">
              +{doc.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {doc.file_type.toUpperCase()} - {formatFileSize(doc.file_size)}
        </span>
        <span>{doc.download_count} downloads</span>
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1 text-sm font-medium text-panw-navy hover:text-panw-blue transition-colors"
        >
          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
          Download
        </button>
        <button
          onClick={onView}
          className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors ml-auto"
        >
          Details
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-sm font-medium text-red-600 hover:text-red-500 transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function UploadDocumentModal({
  open,
  onClose,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = useUploadDocument();

  const handleSubmit = () => {
    if (!title.trim() || !file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (folderId) formData.append('folder_id', folderId);
    if (tags) formData.append('tags', tags);

    uploadMutation.mutate(formData, {
      onSuccess: () => {
        onClose();
        setTitle('');
        setDescription('');
        setFolderId('');
        setTags('');
        setFile(null);
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload Document" size="lg">
      <div className="space-y-4">
        <FormField label="File" htmlFor="doc-file" required>
          <input
            id="doc-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-navy-50 file:text-panw-navy hover:file:bg-navy-100"
          />
        </FormField>

        <FormField label="Title" htmlFor="doc-title" required>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
          />
        </FormField>

        <FormField label="Description" htmlFor="doc-desc">
          <Textarea
            id="doc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description..."
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Folder" htmlFor="doc-folder">
            <Select
              id="doc-folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Tags (comma-separated)" htmlFor="doc-tags">
            <Input
              id="doc-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., firewall, technical"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploadMutation.isPending || !title.trim() || !file}
            className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateFolderModal({
  open,
  onClose,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
}) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');

  const createFolder = useCreateFolder();

  const handleSubmit = () => {
    if (!name.trim()) return;
    createFolder.mutate(
      {
        name,
        parent_id: parentId || undefined,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setName('');
          setParentId('');
          setDescription('');
        },
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Folder">
      <div className="space-y-4">
        <FormField label="Folder Name" htmlFor="folder-name" required>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sales Collateral"
          />
        </FormField>

        <FormField label="Parent Folder" htmlFor="folder-parent">
          <Select
            id="folder-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Root (no parent)</option>
            {folders
              .filter((f) => !f.parent_id)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </Select>
        </FormField>

        <FormField label="Description" htmlFor="folder-desc">
          <Textarea
            id="folder-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createFolder.isPending || !name.trim()}
            className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
          >
            {createFolder.isPending ? 'Creating...' : 'Create Folder'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
