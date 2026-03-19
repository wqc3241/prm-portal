import { useState, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { getApiErrorMessage } from '../../api/client';
import { FormField, Input } from '../../components/shared/FormField';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Invalid Reset Link
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 text-sm font-medium text-panw-navy hover:text-panw-blue"
          >
            Request new reset link
          </Link>
        </div>
      </div>
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8)
      errs.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await authApi.resetPassword({
        token,
        password,
        password_confirmation: confirmPassword,
      });
      setSuccess(true);
      toast.success('Password reset successful!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const message = getApiErrorMessage(err);
      toast.error(message);
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {success ? (
          <div className="text-center">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Password Reset Complete
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been successfully reset. You will be redirected
              to the login page.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-panw-navy hover:text-panw-blue"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Set new password
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter your new password below.
            </p>

            {errors.form && (
              <div
                className="mb-4 rounded-md bg-red-50 border border-red-200 p-3"
                role="alert"
              >
                <p className="text-sm text-red-700">{errors.form}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <FormField
                label="New Password"
                htmlFor="password"
                error={errors.password}
                required
                hint="Must be at least 8 characters"
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hasError={!!errors.password}
                  placeholder="Create a strong password"
                />
              </FormField>

              <FormField
                label="Confirm Password"
                htmlFor="confirmPassword"
                error={errors.confirmPassword}
                required
              >
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  hasError={!!errors.confirmPassword}
                  placeholder="Confirm your password"
                />
              </FormField>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-panw-blue px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
