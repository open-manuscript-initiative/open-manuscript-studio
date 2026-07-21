---
id: architecture-map
title: OMI Architecture Map
sidebar_position: 2
description: A high-level architectural map of the Open Manuscript Initiative and the relationships between its core specifications, workflows, platform components, and publication outputs.
keywords:
  - Open Manuscript Initiative
  - OMI architecture
  - scholarly publishing
  - manuscript model
  - annotation model
  - peer review
  - open standards
---

# OMI Architecture Map

**Status:** Draft  
**Version:** 0.1  
**Stability:** Experimental  

---

## Abstract

The Open Manuscript Initiative provides an open semantic architecture for the complete scholarly manuscript lifecycle.

OMI separates scholarly content from software, presentation, workflow, and institutional infrastructure. Its specifications define interoperable models for manuscripts, scholarly objects, anchors, annotations, metadata, peer review, publishing, and machine-assisted scholarly work.

This document presents the high-level architecture of OMI and describes how its principal specifications and implementation layers relate to one another.

---

## 1. Architectural overview

The OMI architecture is divided into five principal layers:

```text
┌─────────────────────────────────────────────────────────┐
│                 Application Layer                       │
│                                                         │
│       OMI Studio · Publisher Systems · OJS · Tools       │
├─────────────────────────────────────────────────────────┤
│                  Workflow Layer                         │
│                                                         │
│   Review · Collaboration · Versioning · Publishing      │
├─────────────────────────────────────────────────────────┤
│              Semantic Relationship Layer                │
│                                                         │
│       Anchors · Annotations · Citations · Provenance     │
├─────────────────────────────────────────────────────────┤
│                Scholarly Object Layer                   │
│                                                         │
│  Manuscript · Section · Paragraph · Figure · Table      │
│  Equation · Reference · Dataset · Supplementary Object  │
├─────────────────────────────────────────────────────────┤
│                  Foundation Layer                       │
│                                                         │
│        Core Principles · Identity · Portability         │
│        Extensibility · Preservation · Interoperability  │
└─────────────────────────────────────────────────────────┘
```

Each layer depends on the layers beneath it.

Application implementations may vary, but the semantic models remain stable.

---

## 2. Core architectural principle

OMI treats a manuscript not merely as a formatted document, but as a structured graph of scholarly objects and semantic relationships.

```text
Scholarly Object
      │
      ├── has identity
      ├── has type
      ├── may contain other objects
      ├── may be targeted by anchors
      └── may participate in semantic relationships
```

The manuscript is therefore represented as:

```text
Objects + Relationships + Metadata + Provenance
```

Presentation is generated from this canonical representation.

---

## 3. The canonical manuscript

The canonical manuscript contains the authoritative scholarly content and structure.

```text
Canonical Manuscript
│
├── Metadata
├── Contributors
├── Sections
│   ├── Headings
│   ├── Paragraphs
│   ├── Figures
│   ├── Tables
│   ├── Equations
│   └── Other scholarly objects
├── References
├── Notes
├── Annotations
├── Provenance
└── Workflow references
```

The canonical manuscript is independent of:

- page size;
- typography;
- publisher templates;
- word-processing software;
- output format;
- rendering engine;
- editorial management platform.

PDF, HTML, DOCX, EPUB, JATS XML, and other publication formats are derived representations.

---

## 4. Specification dependency map

The principal OMI specifications form the following dependency structure:

```text
OMI-SPEC-000
Core Principles
      │
      ▼
OMI-SPEC-120
Scholarly Object Model
      │
      ├──────────────────────────────┐
      ▼                              ▼
OMI-SPEC-100                   OMI-SPEC-140
Document Model                 Metadata Model
      │
      ▼
OMI-SPEC-110
Anchor Model
      │
      ▼
OMI-SPEC-130
Annotation Model
      │
      ├───────────────┬────────────────┬────────────────┐
      ▼               ▼                ▼                ▼
Review Model     Citation Model   AI Assistance    Publishing Model
```

The Core Principles define the architectural constraints.

The Scholarly Object Model defines what may exist in the OMI ecosystem.

The Document Model organizes scholarly objects into manuscripts.

The Anchor Model identifies stable targets.

The Annotation Model defines semantic relationships attached to those targets.

Workflow and interoperability specifications build upon these foundations.

---

# 5. Foundation layer

## 5.1 Core Principles

**OMI-SPEC-000 — Core Principles** defines the architectural constitution of OMI.

Its principal rules include:

- content is canonical;
- semantics precede formatting;
- scholarly objects possess stable identity;
- relationships are first-class data;
- presentation is renderer-dependent;
- identity and content are separate concerns;
- implementations remain vendor-neutral;
- preservation is a primary design objective.

Every OMI specification SHOULD remain consistent with these principles.

---

## 5.2 Scholarly Object Model

**OMI-SPEC-120 — Scholarly Object Model** defines the common abstraction shared by all meaningful entities.

Examples include:

- manuscripts;
- sections;
- paragraphs;
- headings;
- figures;
- tables;
- equations;
- citations;
- bibliographic records;
- annotations;
- reviews;
- datasets;
- supplementary materials;
- authors and contributors.

A scholarly object has at minimum:

```json
{
  "id": "object-123",
  "type": "paragraph"
}
```

Additional properties depend on the object type.

---

# 6. Core model layer

## 6.1 Document Model

**OMI-SPEC-100 — Document Model** defines the structural organization of a manuscript.

It describes:

- manuscript-level properties;
- sections and hierarchical structure;
- content blocks;
- inline content;
- references to external scholarly objects;
- relationships between document components.

The Document Model does not define visual appearance.

---

## 6.2 Anchor Model

**OMI-SPEC-110 — Anchor Model** defines stable references to scholarly objects or selected regions within them.

An anchor may target:

- an entire manuscript;
- a section;
- a paragraph;
- an inline text range;
- a figure;
- a figure region;
- a table;
- a table cell;
- an equation;
- a citation;
- a bibliographic record;
- metadata;
- an external resource.

```text
Anchor
  │
  ▼
Stable target within a scholarly object
```

Anchors allow annotations and relationships to survive editing, restructuring, and re-rendering.

---

## 6.3 Annotation Model

**OMI-SPEC-130 — Annotation Model** defines annotations as first-class scholarly objects.

```text
Annotation
    │
    ├── type
    ├── body
    ├── creator or actor reference
    ├── visibility
    ├── provenance
    └── target
            │
            ▼
          Anchor
```

Annotations may represent:

- notes;
- comments;
- peer-review remarks;
- editorial instructions;
- citation relationships;
- AI suggestions;
- publishing instructions;
- semantic classifications.

An annotation is stored independently from the text it targets.

---

## 6.4 Metadata Model

**OMI-SPEC-140 — Metadata Model** defines descriptive, administrative, technical, and preservation metadata.

Metadata may describe:

- title;
- language;
- authorship;
- affiliations;
- identifiers;
- subjects;
- keywords;
- funding;
- rights;
- publication status;
- provenance;
- discipline-specific information.

The Metadata Model is designed to interoperate with established standards and identifier systems.

---

# 7. Workflow layer

## 7.1 Review Model

**OMI-SPEC-200 — Review Model** defines structured peer-review workflows.

It builds upon the Annotation Model.

```text
Review Annotation
      │
      ├── reviewer pseudonym
      ├── review round
      ├── recommendation
      ├── visibility policy
      ├── confidential or author-facing body
      └── target anchor
```

The Review Model supports:

- open review;
- single-anonymous review;
- double-anonymous review;
- triple-anonymous review;
- confidential editor comments;
- author-facing comments;
- multiple review rounds;
- structured recommendations;
- review audit trails.

Reviewer identity is separated from portable review content.

---

## 7.2 Collaboration Model

**OMI-SPEC-210 — Collaboration Model** defines multi-user manuscript interaction.

It may support:

- authors;
- co-authors;
- editors;
- translators;
- reviewers;
- copyeditors;
- proofreaders;
- technical contributors;
- AI assistants.

Collaboration permissions are role-based and object-aware.

---

## 7.3 Versioning Model

**OMI-SPEC-220 — Versioning Model** defines manuscript evolution.

```text
Version 1
    │
    ▼
Change Set
    │
    ▼
Version 2
```

The model should support:

- immutable version identifiers;
- object-level changes;
- revision history;
- branching;
- merging;
- provenance;
- comparison between versions;
- review-round snapshots.

---

## 7.4 Publishing Model

**OMI-SPEC-230 — Publishing Model** describes the transformation of the canonical manuscript into publication outputs.

```text
Canonical OMI Manuscript
          │
          ▼
 Publisher Profile
          │
          ▼
 Rendering Pipeline
          │
          ├── HTML
          ├── PDF
          ├── DOCX
          ├── EPUB
          ├── JATS XML
          ├── LaTeX
          └── Future formats
```

Publisher profiles may define:

- typography;
- citation style;
- note placement;
- heading hierarchy;
- page geometry;
- figure treatment;
- metadata requirements;
- output-specific transformations.

The canonical manuscript remains unchanged.

---

# 8. Interoperability layer

## 8.1 Citation Model

**OMI-SPEC-300 — Citation Model** defines citations as semantic relationships.

```text
Citing Object
      │
      ▼
Citation Relationship
      │
      ▼
Cited Resource
```

Citation rendering may vary by publisher or discipline, while the underlying relationship remains stable.

---

## 8.2 API

**OMI-SPEC-310 — API** defines programmatic interaction with OMI manuscripts and scholarly objects.

The API may expose:

- manuscript retrieval;
- object creation and modification;
- annotation operations;
- anchor resolution;
- validation;
- rendering;
- workflow integration;
- import and export;
- plugin interfaces.

---

## 8.3 File Format

**OMI-SPEC-320 — File Format** defines the portable representation of an OMI manuscript package.

A package may contain:

```text
manuscript.omi
│
├── manuscript.json
├── objects/
├── assets/
├── annotations/
├── references/
├── schemas/
├── provenance/
└── manifest.json
```

The format should prioritize:

- transparency;
- validation;
- recoverability;
- long-term preservation;
- implementation independence.

---

## 8.4 Plugin Architecture

**OMI-SPEC-330 — Plugin Architecture** defines extensibility mechanisms.

Plugins may provide:

- new scholarly object types;
- discipline-specific metadata;
- renderers;
- exporters;
- importers;
- validators;
- editorial workflows;
- repository integrations;
- AI services.

Plugins MUST NOT compromise the portability of the canonical manuscript.

---

# 9. Artificial intelligence layer

## 9.1 AI Assistance

**OMI-SPEC-400 — AI Assistance** defines how machine-generated suggestions interact with scholarly manuscripts.

AI output is represented as annotation or provenance-bearing content.

```text
AI Service
    │
    ▼
AI Annotation
    │
    ├── model or service identifier
    ├── creation time
    ├── operation type
    ├── confidence or rationale
    ├── target anchor
    └── human review status
```

AI suggestions do not automatically replace canonical content.

---

## 9.2 AI Review

**OMI-SPEC-410 — AI Review** defines machine-assisted quality assessment.

Possible operations include:

- structural validation;
- citation checking;
- terminology consistency;
- language analysis;
- accessibility checking;
- metadata validation;
- statistical warnings;
- publication-profile compliance.

AI review remains distinguishable from human peer review.

---

## 9.3 Provenance

**OMI-SPEC-420 — Provenance** records how scholarly objects were created or changed.

Provenance may identify:

- human contributors;
- software tools;
- import operations;
- AI systems;
- transformation processes;
- publication systems;
- validation services.

Provenance supports transparency without requiring all identity information to be publicly disclosed.

---

# 10. Application layer

## 10.1 OMI Studio

OMI Studio is a reference authoring environment built upon the OMI specifications.

```text
OMI Studio
│
├── Manuscript editor
├── Scholarly object inspector
├── Annotation panel
├── Notes editor
├── Review interface
├── Metadata editor
├── Publisher preview
├── Validation
├── Import
└── Export
```

OMI Studio is an implementation of the specifications, not the specification itself.

Other applications may implement OMI differently.

---

## 10.2 Publisher systems

Publisher and journal-management platforms may use OMI for:

- submission intake;
- technical validation;
- peer review;
- copyediting;
- production;
- publication;
- repository deposit;
- long-term preservation.

A publisher may implement OMI directly or integrate it through an API or plugin.

---

## 10.3 External systems

OMI is designed to cooperate with external scholarly infrastructure.

Examples include:

```text
OMI
 │
 ├── OJS and journal management platforms
 ├── Institutional repositories
 ├── DOI registration services
 ├── ORCID
 ├── ROR
 ├── Crossref
 ├── DataCite
 ├── CSL
 ├── JATS
 ├── IIIF
 ├── Preservation systems
 └── Research data repositories
```

OMI does not seek to replace these infrastructures.

It provides a portable semantic manuscript layer between them.

---

# 11. Identity and privacy architecture

Identity is handled separately from canonical scholarly content.

```text
Portable OMI Content
│
├── actor role
├── pseudonym
├── contribution type
└── public provenance
        │
        │ protected mapping
        ▼
Institutional Identity System
├── account
├── verified identity
├── permissions
└── confidential audit data
```

This separation supports:

- anonymous peer review;
- privacy-preserving collaboration;
- controlled identity disclosure;
- institutional accountability;
- portable review records.

Private identity bindings SHOULD NOT be included in portable anonymous review packages.

---

# 12. Rendering architecture

Rendering transforms semantic content into presentation.

```text
Canonical Manuscript
        │
        ▼
Semantic Validation
        │
        ▼
Target Profile
        │
        ▼
Renderer
        │
        ├── HTML
        ├── PDF
        ├── DOCX
        ├── EPUB
        ├── JATS XML
        ├── LaTeX
        └── Accessible formats
```

The renderer determines:

- typography;
- pagination;
- note placement;
- citation formatting;
- figure layout;
- table rendering;
- heading appearance;
- accessibility representation.

Rendering MUST NOT redefine the semantic meaning of the manuscript.

---

# 13. Example: peer-review annotation lifecycle

The following example illustrates how multiple OMI layers interact.

```text
1. A paragraph exists as a scholarly object.
                    │
                    ▼
2. An anchor identifies a sentence in the paragraph.
                    │
                    ▼
3. A reviewer creates a review annotation.
                    │
                    ▼
4. The Review Model applies anonymity and visibility rules.
                    │
                    ▼
5. The author receives an anonymized review projection.
                    │
                    ▼
6. The author revises the canonical manuscript.
                    │
                    ▼
7. The Versioning Model records the change.
                    │
                    ▼
8. The annotation is resolved or retained as provenance.
```

The review comment is not embedded permanently into the paragraph.

It remains an independent, traceable scholarly object.

---

# 14. Example: publication lifecycle

```text
Authoring
    │
    ▼
Canonical OMI Manuscript
    │
    ▼
Validation
    │
    ▼
Peer Review
    │
    ▼
Revision and Versioning
    │
    ▼
Editorial Acceptance
    │
    ▼
Publisher Profile
    │
    ▼
Rendering
    │
    ├── Journal HTML
    ├── Archival PDF
    ├── JATS XML
    ├── EPUB
    └── Repository package
```

The same canonical manuscript may produce every output.

No output format becomes the authoritative source.

---

# 15. Architecture invariants

All conforming OMI implementations SHOULD preserve the following invariants.

## 15.1 Canonical-content invariant

Presentation-specific changes MUST NOT alter canonical scholarly meaning.

## 15.2 Stable-identity invariant

A scholarly object SHOULD retain its identity across ordinary editing operations.

## 15.3 Relationship invariant

Semantic relationships SHOULD remain explicit and machine-readable.

## 15.4 Portability invariant

A manuscript MUST remain interpretable outside the software that created it.

## 15.5 Privacy invariant

Confidential identity information MUST remain separable from portable scholarly content.

## 15.6 Provenance invariant

Meaningful automated and human transformations SHOULD be attributable.

## 15.7 Extensibility invariant

Extensions SHOULD preserve the validity and readability of the underlying manuscript.

---

# 16. Architectural boundaries

OMI defines:

- semantic manuscript structures;
- scholarly object identities;
- anchors;
- annotations;
- workflow representations;
- interoperable metadata;
- portable package structures;
- rendering inputs;
- extension mechanisms.

OMI does not prescribe:

- a single editor;
- a single publishing platform;
- a single database;
- a single programming language;
- a single peer-review method;
- a single citation style;
- a single visual design;
- a single institutional workflow.

Implementations remain free to choose their internal technologies.

---

# 17. Summary map

```text
                         OMI-SPEC-000
                        Core Principles
                               │
                               ▼
                    Scholarly Object Model
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
          Document Model              Metadata Model
                  │
                  ▼
             Anchor Model
                  │
                  ▼
           Annotation Model
                  │
      ┌───────────┼───────────┬───────────────┐
      ▼           ▼           ▼               ▼
 Review Model  Citation    AI Assistance   Publishing
      │           │           │               │
      └───────────┴───────────┴───────────────┘
                              │
                              ▼
                    Portable OMI Manuscript
                              │
                              ▼
                       OMI Implementations
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
       Studio          Publisher Systems     Repositories
                              │
                              ▼
                     Publication Renderers
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
           HTML              PDF              JATS
```

---

# 18. Conclusion

The Open Manuscript Initiative provides a layered semantic architecture rather than a monolithic file format.

Its central abstraction is the scholarly object graph:

```text
Stable scholarly objects
        +
Explicit semantic relationships
        +
Portable metadata
        +
Traceable provenance
```

Applications, workflows, and publication formats are built upon this graph.

By separating scholarly meaning from presentation and infrastructure, OMI allows manuscripts to move between authors, disciplines, publishers, repositories, and future technologies without losing their intellectual structure.

> **Write naturally. Structure once. Publish everywhere.**
