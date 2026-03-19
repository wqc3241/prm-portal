import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { FormField, Input } from '../../components/shared/FormField';
import toast from 'react-hot-toast';

type Step = 'company' | 'user';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('company');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Company info
  const [companyName, setCompanyName] = useState('');

  // User info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function validateCompanyStep(): boolean {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = 'Company name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateUserStep(): boolean {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = 'Invalid email format';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8)
      errs.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleCompanyNext(e: FormEvent) {
    e.preventDefault();
    if (validateCompanyStep()) {
      setStep('user');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateUserStep()) return;

    setLoading(true);
    try {
      await register({
        company_name: companyName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      toast.success('Registration successful! Welcome to PRM Portal.');
      navigate('/', { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err);
      toast.error(message);
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel -- branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-950 text-white items-center justify-center p-12">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-4">PRM Portal</h1>
          <p className="text-navy-300 text-lg leading-relaxed">
            Join our partner program and unlock deal registration, co-marketing
            funds, lead distribution, and more.
          </p>
          <div className="mt-8 space-y-3 text-navy-300 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-white font-bold text-sm">
                1
              </div>
              <span
                className={
                  step === 'company' ? 'text-white font-semibold' : ''
                }
              >
                Company Information
              </span>
            </div>
            <div className="ml-4 border-l-2 border-navy-800 h-4" />
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-white font-bold text-sm">
                2
              </div>
              <span
                className={step === 'user' ? 'text-white font-semibold' : ''}
              >
                Admin Account
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel -- form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <h1 className="text-3xl font-bold text-navy-950">PRM Portal</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 'company' ? 'Company Information' : 'Create Admin Account'}
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            {step === 'company'
              ? 'Tell us about your company to get started.'
              : 'Set up your administrator account.'}
          </p>

          {/* Progress bar (mobile) */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>Step {step === 'company' ? '1' : '2'} of 2</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full">
              <div
                className="h-full bg-panw-blue rounded-full transition-all duration-300"
                style={{ width: step === 'company' ? '50%' : '100%' }}
              />
            </div>
          </div>

          {errors.form && (
            <div
              className="mb-4 rounded-md bg-red-50 border border-red-200 p-3"
              role="alert"
            >
              <p className="text-sm text-red-700">{errors.form}</p>
            </div>
          )}

          {step === 'company' ? (
            <form onSubmit={handleCompanyNext} className="space-y-5" noValidate>
              <FormField
                label="Company Name"
                htmlFor="companyName"
                error={errors.companyName}
                required
              >
                <Input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  hasError={!!errors.companyName}
                  placeholder="Acme Security Partners"
                />
              </FormField>

              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-panw-blue px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue transition-colors"
              >
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="First Name"
                  htmlFor="firstName"
                  error={errors.firstName}
                  required
                >
                  <Input
                    id="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    hasError={!!errors.firstName}
                    placeholder="Jane"
                  />
                </FormField>

                <FormField
                  label="Last Name"
                  htmlFor="lastName"
                  error={errors.lastName}
                  required
                >
                  <Input
                    id="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    hasError={!!errors.lastName}
                    placeholder="Smith"
                  />
                </FormField>
              </div>

              <FormField
                label="Email"
                htmlFor="email"
                error={errors.email}
                required
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  hasError={!!errors.email}
                  placeholder="you@company.com"
                />
              </FormField>

              <FormField
                label="Password"
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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('company')}
                  className="flex-1 rounded-md bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-md bg-panw-blue px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-panw-navy hover:text-panw-blue"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
