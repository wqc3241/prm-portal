import { Fragment } from 'react';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const variantStyles = {
  danger: {
    icon: 'bg-red-100 text-red-600',
    button: 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600',
  },
  warning: {
    icon: 'bg-yellow-100 text-yellow-600',
    button: 'bg-yellow-600 hover:bg-yellow-500 focus-visible:outline-yellow-600',
  },
  info: {
    icon: 'bg-blue-100 text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-500 focus-visible:outline-blue-600',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant];

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div
                      className={cn(
                        'mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10',
                        styles.icon
                      )}
                    >
                      <ExclamationTriangleIcon
                        className="h-6 w-6"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <DialogTitle
                        as="h3"
                        className="text-base font-semibold leading-6 text-gray-900"
                      >
                        {title}
                      </DialogTitle>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">{message}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    disabled={loading}
                    className={cn(
                      'inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto disabled:opacity-50',
                      styles.button
                    )}
                    onClick={onConfirm}
                  >
                    {loading ? 'Processing...' : confirmLabel}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={onClose}
                  >
                    {cancelLabel}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
