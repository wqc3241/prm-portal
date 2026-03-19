import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { getApiErrorMessage } from '../../api/client';
import { FormField, Input } from '../../components/shared/FormField';
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      setSent(true);
      toast.success('Check your email for reset instructions.');
    } catch (err) {
      // The API always returns 200, but handle network errors
      const message = getApiErrorMessage(err);
      toast.error(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                <EnvelopeIcon className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Check your email
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for <strong>{email}</strong>, we've sent
                password reset instructions.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-panw-navy hover:text-panw-blue"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Forgot your password?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <FormField
                  label="Email address"
                  htmlFor="email"
                  error={error}
                  required
                >
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    hasError={!!error}
                    placeholder="you@company.com"
                  />
                </FormField>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full justify-center rounded-md bg-panw-blue px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-panw-navy hover:text-panw-blue"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
