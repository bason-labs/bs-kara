import { parseAdminEmails } from '@/features/admin/lib/requireAdmin';

export function WhitelistPanel() {
  const emails = Array.from(parseAdminEmails(process.env.ADMIN_EMAILS)).sort();

  return (
    <section className="rounded-2xl border border-border bg-surface/60 backdrop-blur-md px-5 py-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Whitelist admin</p>
        <p className="mt-0.5 text-[11px] text-muted">
          Danh sách email từ biến môi trường ADMIN_EMAILS. Chỉ đọc.
        </p>
      </div>
      {emails.length === 0 ? (
        <p className="text-sm text-danger">ADMIN_EMAILS chưa được cấu hình.</p>
      ) : (
        <ul className="space-y-1">
          {emails.map((email) => (
            <li key={email} className="text-sm text-fg font-mono">
              {email}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
