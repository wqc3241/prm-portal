import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '../../utils/cn';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface FileUploadProps {
  onUpload: (files: File[]) => void;
  accept?: string;
  maxSize?: number; // bytes
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
}

interface PreviewFile {
  file: File;
  preview: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function FileUpload({
  onUpload,
  accept,
  maxSize = 10 * 1024 * 1024, // 10 MB default
  multiple = false,
  className,
  disabled = false,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndAdd = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(incoming);
      const validated: PreviewFile[] = [];

      for (const file of fileArray) {
        if (file.size > maxSize) {
          setError(`${file.name} exceeds max size of ${formatFileSize(maxSize)}`);
          return;
        }
        validated.push({
          file,
          preview: isImageFile(file) ? URL.createObjectURL(file) : null,
        });
      }

      if (!multiple && validated.length > 1) {
        validated.splice(1);
      }

      const next = multiple ? [...files, ...validated] : validated;
      setFiles(next);
      onUpload(next.map((f) => f.file));
    },
    [files, maxSize, multiple, onUpload]
  );

  const handleDrag = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true);
      } else if (e.type === 'dragleave') {
        setDragActive(false);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        validateAndAdd(e.dataTransfer.files);
      }
    },
    [disabled, validateAndAdd]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        validateAndAdd(e.target.files);
      }
    },
    [validateAndAdd]
  );

  const removeFile = useCallback(
    (index: number) => {
      const next = files.filter((_, i) => i !== index);
      // Revoke the preview URL to free memory
      if (files[index].preview) {
        URL.revokeObjectURL(files[index].preview!);
      }
      setFiles(next);
      onUpload(next.map((f) => f.file));
    },
    [files, onUpload]
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors',
          dragActive
            ? 'border-navy-400 bg-navy-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
      >
        <CloudArrowUpIcon className="h-10 w-10 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-panw-navy">Click to upload</span> or
          drag and drop
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {accept ? `Accepted: ${accept}` : 'Any file type'} (max {formatFileSize(maxSize)})
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {files.map((pf, idx) => (
            <li
              key={`${pf.file.name}-${idx}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              {pf.preview ? (
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
              ) : isImageFile(pf.file) ? (
                <PhotoIcon className="h-10 w-10 text-gray-400 flex-shrink-0" />
              ) : (
                <DocumentIcon className="h-10 w-10 text-gray-400 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {pf.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(pf.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
                aria-label={`Remove ${pf.file.name}`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
