"use client";

export default function LogoutConfirmModal({
  visible,
  message,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-8"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-[20px] bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-red-50">
          <span className="text-2xl text-red-600">⏻</span>
        </div>
        <h2 className="mb-1.5 text-lg font-extrabold text-slate-800">Log out?</h2>
        <p className="mb-5 text-[13px] leading-[19px] text-slate-500">
          {message ?? "You'll need to log in again to continue."}
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
