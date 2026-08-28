# Dynamic document indexes

OMI stores index entries as semantic targets, not page numbers.

During DOCX import, Word `XE` fields become OMI index entries tied to stable block ids. The visible result of a Word `INDEX` field is treated as pagination cache and is removed from canonical manuscript content.

In the Studio document view, a generated index displays each unique entry once and renders one navigation link for every semantic occurrence. No imported page number is retained.

During DOCX export, OMI writes real Word `XE` fields back to their target paragraphs and emits a dirty `INDEX` field with automatic field updating enabled. Word therefore computes page numbers from the final layout and naturally collapses repeated occurrences that fall on the same page.

This keeps pagination out of the manuscript model while preserving round-trip index semantics.
