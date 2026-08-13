import { useEffect, useState } from 'react';

import { EditorReviewMode, loadEditorReviewOverview } from './EditorReviewMode';
import { ReviewMode } from './ReviewMode';
import { claimOjsReviewLaunch } from '../services/peerReviewApi';

export function ReviewPortal() {
  const [editorReviews, setEditorReviews] = useState<Awaited<ReturnType<typeof loadEditorReviewOverview>> | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('ojsReviewLaunch') === '1') {
          const payload = url.searchParams.get('payload') ?? '';
          const signature = url.searchParams.get('signature') ?? '';
          if (!payload || !signature) {
            throw new Error('The OJS reviewer launch data is incomplete.');
          }

          await claimOjsReviewLaunch(payload, signature);

          url.searchParams.delete('ojsReviewLaunch');
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
        setLaunchError(error instanceof Error ? error.message : 'Unable to open the OJS review assignment.');
        setEditorReviews([]);
      }
    })();

    return () => { active = false; };
  }, []);

  if (editorReviews === null) {
    return <main className="review-mode"><div className="review-mode__card"><p>Loading peer review workspace…</p></div></main>;
  }

  if (launchError) {
    return (
      <main className="review-mode">
        <div className="review-mode__card review-mode__error" role="alert">
          <p>{launchError}</p>
          <a className="review-mode__back" href="/">Back to Studio</a>
        </div>
      </main>
    );
  }

  if (editorReviews.length > 0) {
    return <EditorReviewMode initialReviews={editorReviews} />;
  }

  return <ReviewMode />;
}
