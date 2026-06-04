import Swal from 'sweetalert2';

interface ConfirmActionOptions {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'warning';
}

export async function confirmAction({
  title,
  text,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'warning',
}: ConfirmActionOptions): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text,
    icon: tone === 'danger' ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: tone === 'danger' ? '#dc2e52' : '#4f8ef0',
    cancelButtonColor: '#57534e',
    background: '#0d0d1c',
    color: '#eef0f6',
  });

  return result.isConfirmed;
}
