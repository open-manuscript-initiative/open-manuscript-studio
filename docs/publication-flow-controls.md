# Text continuation, breakpoints and page management

The publication editor's **Page styles and section headers** panel provides:

- Study order controls that move a study with its descendants while retaining
  stable IDs, notes and contributor relationships.
- Section page starts and keep-together rules. A section longer than a complete
  page continues instead of being clipped.
- Empty print pages inserted before a selected paragraph, using a chosen page
  style. Insertions follow the stable block anchor when studies move.
- Deletion of inserted pages with subsequent text reflow. Automatic text pages
  follow the amount of content.

Section fit is marked with an **icon only**, beside the section heading.
The optional **Layout checker** lists continued, moved or oversized sections,
oversized blocks, overset frame stories, missing graphics and inactive page
insertions. Selecting an issue navigates to its section, frame or insertion
control. Editor warnings do not appear in publication exports.

In **Frames and page styles**, any text story can enable automatic continuation
and select a continuation page style. Generated frames on different page
styles fit the target text area. Manual frame geometry and linked chains remain
editable. The cursor in the story text field can insert frame/page breakpoints;
a page breakpoint skips remaining frames on the current page. Breakpoints can
be removed, follow surviving text through edits, and persist in OMI files.

Deleting a frame page retains its story and reconnects surviving links. Text
reflows or remains available as an unplaced story. Automatic pagination is
bounded to 100 pages and reports remaining overset text. Empty, untouched
automatic continuation pages are pruned, including between independent flows.

Page insertions and keep rules affect print preview and PDF. Semantic HTML stays
continuous. Auxiliary frame stories remain independent plain text; the main
publication view and export preserve rich manuscript formatting and notes.
