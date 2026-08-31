import { useEffect, useState, type ReactNode } from 'react';

import { claimOmpReviewLaunch } from '../services/ompReviewApi';
import { claimOjsReviewLaunch } from '../services/peerReviewApi';
import { AssignmentStudioMenu } from './AssignmentStudioMenu';
import { EditorReviewMode, loadEditorReviewOverview } from './EditorReviewMode';
import { ReviewMode } from './ReviewMode';
import { ReviewPortalHeader } from './ReviewPortalHeader';

export function ReviewPortal() {
  const [editorReviews, setEditorReviews] = useState<Awaited<ReturnType<typeof loadEditorReviewOverview>> | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const url = new URL(window.location.href);
        const ojsLaunch = url.searchParams.get('ojsReviewLaunch') === '1';
        const ompLaunch = url.searchParams.get('ompReviewLaunch') === '1';

        if (ojsLaunch || ompLaunch) {
          const payload = url.searchParams.get('payload') ?? '';
          const signature = url.searchParams.get('signature') ?? '';
          if (!payload || !signature) {
            throw new Error(
              ompLaunch
                ? 'The OMP reviewer launch data is incomplete.'
                : 'The OJS reviewer launch data is incomplete.',
            );
          }

          if (ompLaunch) await claimOmpReviewLaunch(payload, signature);
          else await claimOjsReviewLaunch(payload, signature);

          url.searchParams.delete('ojsReviewLaunch');
          url.searchParams.delete('ompReviewLaunch');
          url.searchParams.delete('payload');
          url.searchParams.delete('signature');
          window.history.replaceState(
            null,
            '',
            `${url.pathname}${url.search}${url.hash}`,
          );
        }

        const reviews = await loadEditorReviewOverview();
        if (active) setEditorReviews(reviews);
      } catch (error) {
        if (!active) return;
        setLaunchError(
          error instanceof Error ? error.message : 'Unable to open the external review assignment.',
        );
        setEditorReviews([]);
      }
    })();

    return () => { active = false; };
  }, []);

  let content: ReactNode;

  if (editorReviews === null) {
    content = (
      <main className="review-mode">
        <div className="review-mode__card">
          <p>Loading peer review workspace…</p>
        </div>
      </main>
    );
  } else if (launchError) {
    content = (
      <main className="review-mode">
        <div className="review-mode__card review-mode__error" role="alert">
          <p>{launchError}</p>
          <a className="review-mode__back" href="/">Back to Studio</a>
        </div>
      </main>
    );
  } else if (editorReviews.length > 0) {
    content = <EditorReviewMode initialReviews={editorReviews} />;
  } else {
    content = <ReviewMode />;
  }

  return (
    <>
      <ReviewPortalHeader onOpenMenu={() => setMenuOpen(true)} />
      {content}
      <AssignmentStudioMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}
