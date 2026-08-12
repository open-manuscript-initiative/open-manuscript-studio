import { useEffect, useState } from 'react';

import { EditorReviewMode, loadEditorReviewOverview } from './EditorReviewMode';
import { ReviewMode } from './ReviewMode';

export function ReviewPortal() {
  const [editorReviews, setEditorReviews] = useState<Awaited<ReturnType<typeof loadEditorReviewOverview>> | null>(null);

  useEffect(() => {
    void loadEditorReviewOverview()
      .then(setEditorReviews)
      .catch(() => setEditorReviews([]));
  }, []);

  if (editorReviews === null) {
    return <main className="review-mode"><div className="review-mode__card"><p>Loading peer review workspace…</p></div></main>;
  }

  if (editorReviews.length > 0) {
    return <EditorReviewMode initialReviews={editorReviews} />;
  }

  return <ReviewMode />;
}
