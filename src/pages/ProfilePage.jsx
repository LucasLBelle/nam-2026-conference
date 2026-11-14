import { useState, useEffect } from 'react';
import { useConference, useFetch } from '../lib/store.jsx';
import * as api from '../lib/api.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { useToast } from '../components/Toaster.jsx';
import { Avatar, ErrorState, SectionHeader, Skeleton } from '../components/ui.jsx';

/** Topic chips: each click saves the whole list at once; a failed save keeps the old selection. */
function Interests({ userId, saved }) {
  const { tags } = useConference();
  const toast = useToast();
  const [selected, setSelected] = useState(saved);
  useEffect(() => setSelected(saved), [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const topics = tags.filter((t) => t.kind === 'topic');

  const toggle = async (name) => {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name];
    try {
      const res = await api.putInterests(userId, next);
      setSelected(res.interests);
    } catch (err) {
      toast({ message: err.message, icon: 'alert' });
    }
  };

  return (
    <section className="card space-y-3 p-6" data-testid="profile-interests">
      <h3 className="font-display text-xl">Interests</h3>
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => {
          const on = selected.includes(t.name);
          return (
            <button
              key={t.name}
              type="button"
              aria-pressed={on}
              data-testid="interest-chip"
              onClick={() => toggle(t.name)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${on
                ? 'border-violet-400/60 bg-violet-400/20 text-ink'
                : 'border-hairline bg-overlay/60 text-faint hover:text-ink'}`}
            >
              {t.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const ACCESS_OPTIONS = [
  ['step-free', 'Step-free / wheelchair access'],
  ['hearing', 'Hearing loop or captions'],
  ['quiet', 'Quiet space'],
];

/** Accessibility needs: each click saves the whole set; a failed save keeps the old selection. */
function AccessNeeds({ userId, saved }) {
  const toast = useToast();
  const [selected, setSelected] = useState(saved);
  useEffect(() => setSelected(saved), [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (key) => {
    const next = selected.includes(key) ? selected.filter((n) => n !== key) : [...selected, key];
    try {
      const res = await api.putAccessNeeds(userId, next);
      setSelected(res.accessNeeds);
    } catch (err) {
      toast({ message: err.message, icon: 'alert' });
    }
  };

  return (
    <section className="card space-y-3 p-6" data-testid="profile-access-needs">
      <h3 className="font-display text-xl">Accessibility needs</h3>
      <div className="flex flex-wrap gap-2">
        {ACCESS_OPTIONS.map(([key, label]) => {
          const on = selected.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              data-testid="access-need"
              onClick={() => toggle(key)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${on
                ? 'border-violet-400/60 bg-violet-400/20 text-ink'
                : 'border-hairline bg-overlay/60 text-faint hover:text-ink'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const DIET_OPTIONS = [
  ['vegan', 'Vegan'],
  ['vegetarian', 'Vegetarian'],
  ['gluten-free', 'Gluten-free'],
];

/** Dietary requirement: one at a time, click the chosen one again to clear; the Food page starts from it. */
function Diet({ userId, saved }) {
  const toast = useToast();
  const [selected, setSelected] = useState(saved);
  useEffect(() => setSelected(saved), [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (key) => {
    try {
      const res = await api.putDiet(userId, selected === key ? null : key);
      setSelected(res.diet);
    } catch (err) {
      toast({ message: err.message, icon: 'alert' });
    }
  };

  return (
    <section className="card space-y-3 p-6" data-testid="profile-diet">
      <h3 className="font-display text-xl">Dietary requirements</h3>
      <div className="flex flex-wrap gap-2">
        {DIET_OPTIONS.map(([key, label]) => {
          const on = selected === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              data-testid="diet-option"
              onClick={() => choose(key)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${on
                ? 'border-violet-400/60 bg-violet-400/20 text-ink'
                : 'border-hairline bg-overlay/60 text-faint hover:text-ink'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Profile of the signed-in attendee; refetches when the switcher changes them. */
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
      <>
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
      <Interests userId={id} saved={user.interests} />
      <AccessNeeds userId={id} saved={user.accessNeeds} />
      <Diet userId={id} saved={user.diet} />
      </>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Your conference" title="My Profile" />
      {body}
    </div>
  );
}
