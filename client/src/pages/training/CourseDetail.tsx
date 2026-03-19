import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useCourse,
  useCertifications,
  useEnrollCourse,
  useRecordCompletion,
} from '../../hooks/useCourses';
import {
  PageHeader,
  StatusBadge,
  Skeleton,
  CardSkeleton,
  Modal,
  FormField,
  Input,
  Select,
} from '../../components/shared';
import { formatDate, formatDateTime, humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  AcademicCapIcon,
  ClockIcon,
  CheckCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import type { Certification, CertificationStatus } from '../../types';

const STATUS_COLORS: Record<CertificationStatus, string> = {
  enrolled: 'bg-blue-100 text-blue-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-700',
};

export function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isPartner = hasRole('partner_admin', 'partner_rep');

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [score, setScore] = useState('');

  const {
    data: course,
    isLoading: courseLoading,
    isError: courseError,
  } = useCourse(id);

  // Fetch certifications for this course
  const { data: certsData } = useCertifications({
    course_id: id,
    per_page: 50,
  });
  const certifications = certsData?.data ?? [];

  // Find current user's certification
  const myCert = certifications.find((c) => c.user_id === user?.id);

  const enrollMutation = useEnrollCourse();
  const completionMutation = useRecordCompletion();

  const handleEnroll = useCallback(() => {
    if (!id) return;
    enrollMutation.mutate({ courseId: id });
  }, [id, enrollMutation]);

  const handleRecordCompletion = useCallback(() => {
    if (!selectedCertId || !score) return;
    completionMutation.mutate(
      { certId: selectedCertId, data: { score: Number(score) } },
      {
        onSuccess: () => {
          setRecordModalOpen(false);
          setSelectedCertId('');
          setScore('');
        },
      }
    );
  }, [selectedCertId, score, completionMutation]);

  if (courseLoading) {
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

  if (courseError || !course) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Course not found
        </h2>
        <p className="text-gray-500 mb-4">
          This course does not exist or you do not have access to it.
        </p>
        <button
          onClick={() => navigate('/training')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Training
        </button>
      </div>
    );
  }

  const canEnroll =
    isPartner && (!myCert || myCert.status === 'expired' || myCert.status === 'failed');

  return (
    <div>
      <PageHeader
        title={course.title}
        breadcrumbs={[
          { label: 'Training', to: '/training' },
          { label: course.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canEnroll && (
              <button
                onClick={handleEnroll}
                disabled={enrollMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy disabled:opacity-50 transition-colors"
              >
                <AcademicCapIcon className="h-4 w-4" />
                {enrollMutation.isPending ? 'Enrolling...' : 'Enroll'}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setRecordModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Record Completion
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Course info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Course details card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Course Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label="Category" value={humanize(course.category)} />
              <InfoField
                label="Difficulty"
                value={humanize(course.difficulty)}
              />
              <InfoField
                label="Duration"
                value={`${course.duration_minutes} minutes`}
              />
              <InfoField
                label="Passing Score"
                value={`${course.passing_score}%`}
              />
              <InfoField
                label="Certification Validity"
                value={
                  course.certification_valid_months
                    ? `${course.certification_valid_months} months`
                    : 'No expiry'
                }
              />
              <InfoField
                label="Required"
                value={course.is_required ? 'Yes' : 'No'}
              />
            </div>
            {course.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Description
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {course.description}
                </p>
              </div>
            )}
          </div>

          {/* My enrollment status */}
          {myCert && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Your Enrollment
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <StatusBadge status={myCert.status} size="md" />
                {myCert.score !== null && (
                  <span className="text-sm font-medium text-gray-700">
                    Score: {myCert.score}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField
                  label="Enrolled At"
                  value={formatDateTime(myCert.enrolled_at)}
                />
                {myCert.completed_at && (
                  <InfoField
                    label="Completed At"
                    value={formatDateTime(myCert.completed_at)}
                  />
                )}
                {myCert.certified_at && (
                  <InfoField
                    label="Certified At"
                    value={formatDateTime(myCert.certified_at)}
                  />
                )}
                {myCert.expires_at && (
                  <InfoField
                    label="Expires At"
                    value={formatDate(myCert.expires_at)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Enrollments table (admin/CM view) */}
          {hasRole('admin', 'channel_manager') && certifications.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Enrollments ({certifications.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">
                        User
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">
                        Organization
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">
                        Status
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">
                        Score
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">
                        Enrolled
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">
                        Expires
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {certifications.map((cert) => (
                      <tr key={cert.id}>
                        <td className="py-2 text-sm text-gray-900">
                          {cert.user_name ?? '-'}
                        </td>
                        <td className="py-2 text-sm text-gray-600">
                          {cert.organization_name ?? '-'}
                        </td>
                        <td className="py-2">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
                              STATUS_COLORS[cert.status]
                            )}
                          >
                            {humanize(cert.status)}
                          </span>
                        </td>
                        <td className="py-2 text-right text-sm text-gray-700">
                          {cert.score !== null ? `${cert.score}%` : '-'}
                        </td>
                        <td className="py-2 text-sm text-gray-500 text-xs">
                          {formatDate(cert.enrolled_at)}
                        </td>
                        <td className="py-2 text-sm text-gray-500 text-xs">
                          {cert.expires_at ? formatDate(cert.expires_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column - Quick info */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Quick Info
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">
                  {course.duration_minutes} minutes
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AcademicCapIcon className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">
                  Pass mark: {course.passing_score}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <UserGroupIcon className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">
                  {course.enrollment_count ?? certifications.length} enrolled
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Metadata
            </h3>
            <div className="space-y-3">
              <InfoField label="Created" value={formatDateTime(course.created_at)} />
              <InfoField label="Last Updated" value={formatDateTime(course.updated_at)} />
              <InfoField label="Course ID" value={course.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Record Completion Modal (admin only) */}
      <Modal
        open={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        title="Record Course Completion"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select an enrolled user and enter their score. Pass/fail will be
            determined automatically based on the passing score of{' '}
            {course.passing_score}%.
          </p>

          <FormField label="Enrolled User" htmlFor="cert-select" required>
            <Select
              id="cert-select"
              value={selectedCertId}
              onChange={(e) => setSelectedCertId(e.target.value)}
            >
              <option value="">Select a user...</option>
              {certifications
                .filter((c) => c.status === 'enrolled')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.user_name ?? c.user_email ?? c.user_id}
                    {c.organization_name ? ` (${c.organization_name})` : ''}
                  </option>
                ))}
            </Select>
          </FormField>

          <FormField label="Score (%)" htmlFor="completion-score" required>
            <Input
              id="completion-score"
              type="number"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g., 85"
            />
            {score && (
              <p
                className={cn(
                  'text-xs mt-1 font-medium',
                  Number(score) >= course.passing_score
                    ? 'text-green-700'
                    : 'text-red-600'
                )}
              >
                {Number(score) >= course.passing_score
                  ? 'PASS'
                  : 'FAIL'}{' '}
                (passing score: {course.passing_score}%)
              </p>
            )}
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRecordModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordCompletion}
              disabled={
                completionMutation.isPending || !selectedCertId || !score
              }
              className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
            >
              {completionMutation.isPending
                ? 'Recording...'
                : 'Record Completion'}
            </button>
          </div>
        </div>
      </Modal>
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
