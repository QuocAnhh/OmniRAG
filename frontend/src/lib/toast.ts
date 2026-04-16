import hotToast, { type ToastOptions } from 'react-hot-toast';

/**
 * Wrapper over `react-hot-toast` with warm Claude-inspired defaults.
 * Prefer this module over importing `toast` from `react-hot-toast` directly
 * so styling stays consistent.
 */

const baseOptions: ToastOptions = {
  duration: 4000,
};

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    hotToast.success(message, { ...baseOptions, ...options }),
  error: (message: string, options?: ToastOptions) =>
    hotToast.error(message, { ...baseOptions, duration: 5000, ...options }),
  info: (message: string, options?: ToastOptions) =>
    hotToast(message, { ...baseOptions, ...options }),
  loading: (message: string, options?: ToastOptions) =>
    hotToast.loading(message, { ...baseOptions, ...options }),
  promise: hotToast.promise,
  dismiss: hotToast.dismiss,
  remove: hotToast.remove,
} as const;
