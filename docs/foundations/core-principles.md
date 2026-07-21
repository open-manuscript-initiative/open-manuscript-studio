---
id: core-principles
title: OMI-SPEC-000 — Core Principles
sidebar_label: Core Principles
sidebar_position: 1
description: Foundational architectural principles of the Open Manuscript Initiative.
keywords:
  - Open Manuscript Initiative
  - OMI
  - scholarly publishing
  - architecture
  - open standards
  - semantic publishing
---

# OMI-SPEC-000 — Core Principles

**Status:** Draft  
**Version:** 1.0.0  
**Category:** Foundation Specification

---

# Abstract

The Open Manuscript Initiative (OMI) defines an open, semantic, and interoperable architecture for scholarly communication.

Unlike traditional document formats, OMI does not describe how a document should look. Instead, it describes what scholarly content is, how it is structured, how it relates to other scholarly objects, and how it can be preserved independently of software, publishers, or rendering technologies.

This document establishes the architectural principles upon which every OMI specification is based.

These principles are normative for the design of the OMI ecosystem.

---

# 1. Mission

The mission of the Open Manuscript Initiative is to create an open scholarly manuscript standard that is:

- publisher independent;
- software independent;
- machine readable;
- human readable;
- semantically rich;
- interoperable;
- extensible;
- preservable over the long term.

OMI aims to ensure that scholarly knowledge remains portable across disciplines, institutions, publishers, and generations.

---

# 2. Core Philosophy

OMI is based on one fundamental idea:

> **Knowledge is independent of its presentation.**

Scientific knowledge should not become tied to a specific application, vendor, file format, or publication workflow.

Formatting is temporary.

Knowledge is permanent.

---

# 3. Separation of Concerns

OMI separates concerns that conventional document editors usually combine.

```
Knowledge
        ↓
Semantics
        ↓
Structure
        ↓
Relationships
        ↓
Presentation
```

Only the presentation layer depends on the output format.

All upper layers remain stable.

---

# 4. Content is Canonical

The canonical manuscript represents the authoritative scholarly content.

Everything else is derived from it.

Examples include:

- PDF
- HTML
- DOCX
- EPUB
- JATS XML
- LaTeX
- future publication formats

None of these representations is considered authoritative.

The canonical manuscript remains the single source of truth.

---

# 5. Semantics Before Formatting

OMI stores meaning instead of appearance.

Instead of recording:

- bold
- italic
- page breaks
- indentation

OMI records:

- heading
- quotation
- scientific name
- annotation
- citation
- emphasis
- equation
- glossary term

Presentation is determined only during rendering.

---

# 6. Everything is a Scholarly Object

Every meaningful component of a manuscript is represented as a scholarly object.

Examples include:

- manuscript
- section
- paragraph
- heading
- figure
- table
- equation
- citation
- bibliography entry
- annotation
- review
- dataset
- supplementary material
- contributor

Each scholarly object possesses:

- identity;
- type;
- metadata;
- relationships;
- provenance.

---

# 7. Stable Identity

Every scholarly object should have a stable identifier.

Stable identifiers enable:

- annotations;
- citations;
- peer review;
- collaboration;
- version control;
- interoperability.

Identity must remain stable even when the document is reorganized.

---

# 8. Relationships are First-Class Citizens

Relationships are explicit semantic objects.

Examples include:

- citation
- annotation
- review
- reference
- dependency
- provenance
- semantic classification

Relationships are stored independently from visual presentation.

---

# 9. Separation of Identity and Content

The identity of contributors is conceptually separate from scholarly content.

Authors, reviewers, editors, translators, AI systems, and publishers participate through defined semantic roles.

Anonymous peer review is supported by separating portable scholarly data from protected identity information.

---

# 10. Rendering is Independent

Rendering is an implementation step.

The canonical manuscript may be rendered into:

- HTML
- PDF
- DOCX
- EPUB
- JATS XML
- LaTeX
- Braille
- speech synthesis
- future publication technologies

Rendering must not alter scholarly meaning.

---

# 11. Interoperability

OMI is designed to cooperate with existing scholarly infrastructure.

Examples include:

- Crossref
- DataCite
- ORCID
- ROR
- CSL
- JATS
- Dublin Core
- Schema.org
- IIIF
- OAI-PMH

OMI complements existing standards rather than replacing them.

---

# 12. Preservation First

Long-term preservation is a primary architectural goal.

The canonical manuscript should remain understandable decades into the future.

Therefore OMI avoids dependence upon:

- proprietary software;
- proprietary file formats;
- proprietary databases;
- proprietary cloud platforms.

Semantic information is always preferred over implementation-specific information.

---

# 13. Extensibility

OMI is intentionally extensible.

Future specifications may introduce:

- new scholarly object types;
- annotation types;
- metadata schemas;
- rendering profiles;
- publication workflows;
- discipline-specific extensions.

Extensions should preserve compatibility whenever practical.

---

# 14. Artificial Intelligence

Artificial intelligence is considered a scholarly participant rather than an author.

AI contributions are represented as identifiable scholarly objects with provenance.

AI may:

- suggest;
- analyse;
- validate;
- review;
- classify.

Human editorial authority remains essential.

No AI-generated modification should replace canonical content automatically.

---

# 15. Open Governance

The Open Manuscript Initiative is governed through an open specification process.

Its evolution should be guided by:

- transparency;
- public discussion;
- scholarly consensus;
- technical quality;
- long-term sustainability.

The standard should remain vendor-neutral and community driven.

---

# 16. Guiding Principles

Every OMI specification should satisfy the following principles.

| Principle | Description |
|------------|-------------|
| Semantic | Meaning precedes presentation. |
| Portable | Manuscripts move freely between systems. |
| Open | No proprietary dependencies. |
| Stable | Object identities survive editing. |
| Extensible | New capabilities should not break old manuscripts. |
| Interoperable | Existing scholarly standards are respected. |
| Transparent | Provenance remains traceable. |
| Accessible | Content can be rendered in multiple accessible forms. |
| Durable | Manuscripts remain usable over decades. |

---

# 17. Relationship to Other Specifications

This document provides the conceptual foundation for the entire OMI specification family.

Subsequent specifications define concrete models for:

- scholarly objects;
- manuscripts;
- metadata;
- anchors;
- annotations;
- peer review;
- publishing;
- interoperability;
- artificial intelligence.

Those specifications should remain consistent with the principles established here.

---

# 18. Conclusion

The Open Manuscript Initiative is not merely another document format.

It is an open semantic architecture for scholarly communication.

By separating scholarly meaning from presentation, software, and institutional workflows, OMI enables manuscripts to remain portable, interoperable, and intelligible across technologies and generations.

Its purpose is to ensure that scholarly knowledge outlives the tools used to create it.

---

> **Write naturally. Structure once. Publish everywhere.**
