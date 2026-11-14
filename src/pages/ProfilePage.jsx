import { useConference, useFetch } from '../lib/store.jsx';
import * as api from '../lib/api.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { Avatar, ErrorState, SectionHeader, Skeleton } from '../components/ui.jsx';

/** Read-only profile of the signed-in attendee; refetches when the switcher changes them. */
export function ProfilePage() {
  const { currentUser } = useConference();
  const id = currentUser?.id;
  const { data: user, loading, error, reload } = useFetch(() => api.getUser(id), [id]);
  useDocumentTitle('My Profile');

  let body;
  if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!user || user.id !== id) body = <Skeleton className="h-64" />;
  else {
    // Empty fields are left out rather than shown as blanks.
    const rows = [
      ['pronouns', 'Pronouns', user.pronouns],
      ['job-title', 'Job title', user.jobTitle],
      ['company', 'Company', user.company],
      ['email', 'Email', user.email],
      ['bio', 'Bio', user.bio],
    ].filter(([, , value]) => value);
    body = (
      <section className="card flex flex-col gap-6 p-6 sm:flex-row" data-testid="profile">
        <Avatar name={user.name} initials={user.initials} accent={user.accent} imageUrl={user.imageUrl} size="xl" />
        <div className="min-w-0 flex-1 space-y-4">
          <h2 className="font-display text-3xl" data-testid="profile-name">{user.name}</h2>
          <dl className="space-y-3">
            {rows.map(([key, label, value]) => (
              <div key={key}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">{label}</dt>
                <dd className="mt-0.5 break-words text-sm text-ink" data-testid={`profile-${key}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Your conference" title="My Profile" />
      {body}
    </div>
  );
}
