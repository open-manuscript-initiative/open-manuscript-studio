import { useEffect, useState, type ReactNode } from 'react';

import { claimOmpReviewLaunch } from '../services/ompReviewApi';
import { listNativeEditorialInbox, type NativeSubmission } from '../services/nativeEditorialWorkflowApi';
import { claimOjsReviewLaunch } from '../services/peerReviewApi';
import { AssignmentStudioMenu } from './AssignmentStudioMenu';
import { EditorReviewMode, loadEditorReviewOverview } from './EditorReviewMode';
import { NativeEditorialInbox } from './NativeEditorialInbox';
import { ReviewMode } from './ReviewMode';
import { ReviewPortalHeader } from './ReviewPortalHeader';

export function ReviewPortal() {
  const [editorReviews, setEditorReviews] = useState<Awaited<ReturnType<typeof loadEditorReviewOverview>> | null>(null);
  const [nativeSubmissions, setNativeSubmissions] = useState<NativeSubmission[]>([]);
  const [externalAssignmentId, setExternalAssignmentId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const url = new URL(window.location.href);
        const ojsLaunch = url.searchParams.get('ojsReviewLaunch') === '1';
        const ompLaunch = url.searchParams.get('ompReviewLaunch') === '1';
        let claimedAssignmentId = url.searchParams.get('reviewAssignment')?.trim() || null;

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

          claimedAssignmentId = ompLaunch
            ? await claimOmpReviewLaunch(payload, signature)
            : await claimOjsReviewLaunch(payload, signature);

          url.searchParams.delete('ojsReviewLaunch');
          url.searchParams.delete('ompReviewLaunch');
          url.searchParams.delete('payload');
          url.searchParams.delete('signature');
          url.searchParams.set('reviewAssignment', claimedAssignmentId);
          window.history.replaceState(
            null,
            '',
            `${url.pathname}${url.search}${url.hash}`,
          );
        }

        if (claimedAssignmentId) {
          if (active) {
            setExternalAssignmentId(claimedAssignmentId);
            setEditorReviews([]);
          }
          return;
        }

        const [reviews, submissions] = await Promise.all([
          loadEditorReviewOverview(),
          listNativeEditorialInbox(),
        ]);
        if (active) {
          setEditorReviews(reviews);
          setNativeSubmissions(submissions);
        }
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
  } else if (nativeSubmissions.length > 0 || editorReviews.length > 0) {
    content = (
      <>
        {nativeSubmissions.length > 0
          ? <NativeEditorialInbox initialSubmissions={nativeSubmissions} />
          : null}
        {editorReviews.length > 0
          ? <EditorReviewMode initialReviews={editorReviews} />
          : null}
      </>
    );
  } else {
    content = externalAssignmentId
      ? <ReviewMode assignmentId={externalAssignmentId} />
      : <ReviewMode />;
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
