# Page thumbnails

Open **Publication editor** in print view. Expand **Page thumbnails** above the page canvas and click a miniature to navigate to its sheet. The strip scrolls horizontally and can be collapsed to leave more editing space. The same navigator is available in **Frames and page styles**, including on narrow screens.

Each miniature shows the measured text-line and graphic positions, its printed page number, and an uppercase page-style letter. The legend maps letters to style names: A, B, … Z, AA, AB, … . Letters follow the style list, so moving a page does not change its style letter. Renaming a style updates its legend and accessible page labels.

Select a thumbnail, choose **New page style in thumbnails**, and add a page before or after it. Use the arrow buttons, or drag one thumbnail onto another, to change order. **Delete page** removes the selected inserted sheet or frame page.

- Frame pages move individually with their frames, graphic transforms, and style assignments. Linked text flows retain their links and source text. Deleting a frame page preserves its stories for reflow or placement into another frame.
- In the continuous manuscript, text pages move with their complete study and descendants. This preserves semantic order, references and note anchors. Pages sharing the same study do not reorder its paragraphs. Inserted empty sheets move and delete individually; automatic text pages are not deleted through the thumbnail controls.
- Continuous-text insertions attach to the nearest paragraph boundary, before or after the selected page's source paragraph. A paragraph continued across multiple sheets remains one paragraph. Insertions can follow the final paragraph, so a final blank or plate can be added without creating dummy content.

Inserted sheets follow their anchor when studies move. Print/PDF export applies the same before/after-block insertions; semantic HTML remains continuous. Page operations and style assignments persist in the OMI document. The miniature is an overview of layout geometry rather than a raster proof; review the full page or exported PDF for typography.
