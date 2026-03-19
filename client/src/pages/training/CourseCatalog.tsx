import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCourses, useEnrollCourse } from '../../hooks/useCourses';
import {
  PageHeader,
  SearchBar,
  StatusBadge,
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
  AcademicCapIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type {
  Course,
  CourseCategory,
  CourseDifficulty,
  CourseQueryParams,
  CreateCourseRequest,
} from '../../types';
import { useCreateCourse, useDeleteCourse } from '../../hooks/useCourses';

const CATEGORY_OPTIONS: { value: CourseCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'sales', label: 'Sales' },
  { value: 'technical', label: 'Technical' },
  { value: 'product', label: 'Product' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'onboarding', label: 'Onboarding' },
];

const DIFFICULTY_COLORS: Record<CourseDifficulty, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
};

export function CourseCatalog() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CourseCategory | ''>('');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const params = useMemo<CourseQueryParams>(() => {
    const p: CourseQueryParams = { page, per_page: 12 };
    if (search) p.search = search;
    if (category) p.category = category;
    return p;
  }, [page, search, category]);

  const { data: coursesData, isLoading } = useCourses(params);
  const courses = coursesData?.data ?? [];
  const meta = coursesData?.meta;

  const enrollMutation = useEnrollCourse();
  const deleteMutation = useDeleteCourse();

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const handleEnroll = useCallback(
    (courseId: string) => {
      enrollMutation.mutate({ courseId });
    },
    [enrollMutation]
  );

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Training Catalog"
        subtitle="Browse and enroll in partner training courses"
        breadcrumbs={[{ label: 'Training' }]}
        actions={
          isAdmin ? (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Create Course
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <SearchBar
          placeholder="Search courses..."
          onSearch={handleSearch}
          className="w-full sm:max-w-md"
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as CourseCategory | '');
            setPage(1);
          }}
          className="rounded-md border-0 py-2 pl-3 pr-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Course grid */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">
            No courses found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {search || category
              ? 'Try adjusting your filters or search query.'
              : 'No training courses are available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEnroll={handleEnroll}
              onView={() => navigate(`/training/${course.id}`)}
              onDelete={
                isAdmin
                  ? () => deleteMutation.mutate(course.id)
                  : undefined
              }
              isEnrolling={enrollMutation.isPending}
              isPartner={hasRole('partner_admin', 'partner_rep')}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(meta.page - 1) * meta.per_page + 1} to{' '}
            {Math.min(meta.page * meta.per_page, meta.total)} of {meta.total}{' '}
            courses
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

      {/* Create Course Modal */}
      {isAdmin && (
        <CreateCourseModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

function CourseCard({
  course,
  onEnroll,
  onView,
  onDelete,
  isEnrolling,
  isPartner,
}: {
  course: Course;
  onEnroll: (id: string) => void;
  onView: () => void;
  onDelete?: () => void;
  isEnrolling: boolean;
  isPartner: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Card top accent */}
      <div className="h-1.5 bg-panw-blue" />

      <div className="p-5">
        {/* Category & difficulty badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            {humanize(course.category)}
          </span>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
              DIFFICULTY_COLORS[course.difficulty]
            )}
          >
            {humanize(course.difficulty)}
          </span>
          {course.is_required && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
              Required
            </span>
          )}
        </div>

        {/* Title & description */}
        <button onClick={onView} className="text-left w-full">
          <h3 className="text-base font-semibold text-gray-900 hover:text-panw-navy transition-colors line-clamp-2">
            {course.title}
          </h3>
        </button>
        {course.description && (
          <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Meta info */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {course.duration_minutes} min
          </span>
          <span>
            Pass: {course.passing_score}%
          </span>
          {course.certification_valid_months && (
            <span>
              Valid: {course.certification_valid_months} mo
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          {isPartner && (
            <button
              onClick={() => onEnroll(course.id)}
              disabled={isEnrolling}
              className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50 transition-colors"
            >
              <AcademicCapIcon className="h-4 w-4" />
              Enroll
            </button>
          )}
          <button
            onClick={onView}
            className="text-sm font-medium text-panw-navy hover:text-panw-blue transition-colors"
          >
            View Details
          </button>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-sm font-medium text-red-600 hover:text-red-500 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateCourseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<CreateCourseRequest>({
    title: '',
    description: '',
    category: 'product',
    difficulty: 'beginner',
    duration_minutes: 60,
    passing_score: 70,
    certification_valid_months: 12,
  });

  const createCourse = useCreateCourse();

  const handleSubmit = () => {
    if (!formData.title.trim()) return;
    createCourse.mutate(formData, {
      onSuccess: () => {
        onClose();
        setFormData({
          title: '',
          description: '',
          category: 'product',
          difficulty: 'beginner',
          duration_minutes: 60,
          passing_score: 70,
          certification_valid_months: 12,
        });
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Course" size="lg">
      <div className="space-y-4">
        <FormField label="Title" htmlFor="course-title" required>
          <Input
            id="course-title"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g., PANW Firewall Administration"
          />
        </FormField>

        <FormField label="Description" htmlFor="course-desc">
          <Textarea
            id="course-desc"
            value={formData.description ?? ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={3}
            placeholder="Course overview and learning objectives..."
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category" htmlFor="course-category" required>
            <Select
              id="course-category"
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  category: e.target.value as CourseCategory,
                }))
              }
            >
              {CATEGORY_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Difficulty" htmlFor="course-difficulty" required>
            <Select
              id="course-difficulty"
              value={formData.difficulty}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  difficulty: e.target.value as CourseDifficulty,
                }))
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Duration (min)" htmlFor="course-duration" required>
            <Input
              id="course-duration"
              type="number"
              min="1"
              value={String(formData.duration_minutes)}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  duration_minutes: Number(e.target.value),
                }))
              }
            />
          </FormField>

          <FormField label="Passing Score (%)" htmlFor="course-score" required>
            <Input
              id="course-score"
              type="number"
              min="0"
              max="100"
              value={String(formData.passing_score)}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  passing_score: Number(e.target.value),
                }))
              }
            />
          </FormField>

          <FormField label="Cert Valid (months)" htmlFor="course-cert-months">
            <Input
              id="course-cert-months"
              type="number"
              min="0"
              value={String(formData.certification_valid_months ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  certification_valid_months: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
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
            disabled={createCourse.isPending || !formData.title.trim()}
            className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
          >
            {createCourse.isPending ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
