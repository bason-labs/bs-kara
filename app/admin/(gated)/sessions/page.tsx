import { SessionsShell } from '@/features/admin/components/SessionsShell';

export default function SessionsPage() {
  return (
    <div className="px-6 py-8 space-y-6">
      <header>
        <h1 className="text-lg font-bold text-fg">Phiên hoạt động</h1>
        <p className="mt-1 text-xs text-muted">
          IP, loại thiết bị và thời lượng của từng phiên tham gia phòng.
        </p>
      </header>
      <SessionsShell />
    </div>
  );
}
