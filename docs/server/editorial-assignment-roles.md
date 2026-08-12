# Editorial assignment roles

Open Manuscript Studio models editorial work as typed assignments rather than as a single generic reviewer role. The same authenticated user may receive different assignment types for the same manuscript and round when editorial policy requires it.

## Assignment types

| Assignment type | Purpose | Default anonymity | Scientific recommendation |
| --- | --- | --- | --- |
| `SCIENTIFIC_REVIEW` | Scholarly peer review | `DOUBLE_BLIND` | Required |
| `LANGUAGE_REVIEW` | Language, grammar, style and terminology revision | `DOUBLE_BLIND` | Not used |
| `TRANSLATION` | Translation into a target language | `DOUBLE_BLIND` | Not used |
| `EDITORIAL_REVISION` | Internal editorial revision | `OPEN` | Not used |

The editor may explicitly choose another supported anonymity mode when creating an assignment. Privacy-safe defaults are intentionally stricter for external participants.

## Identity boundary

The editor-facing API may expose author and assigned-participant identities when the authenticated user has `EDITOR` workspace access. Participant-facing assignment APIs do not expose author account records. Author-facing APIs do not expose the assigned participant's user ID, name, email, ORCID or affiliation; they expose only the assignment alias and author-visible feedback.

These rules apply independently of the assignment type. In particular, a language reviewer or translator is not implicitly granted editor privileges.

## Revision model

All assignment types use a separate working revision snapshot. The original assignment snapshot remains unchanged. Scientific reviewers submit a recommendation together with their revision and feedback. Language reviewers, translators and editorial revisers submit the completed assignment without an accept/revise/reject recommendation.

A translation assignment additionally requires `sourceLanguage` and `targetLanguage`, and the two values must differ. This release records the translation language pair and the translated working revision. A dedicated multi-variant manuscript representation can build on this assignment metadata without changing the authorization model.

## OJS integration

OJS 3.5 exposes broad platform roles such as author, reviewer, assistant and editor but does not provide native role constants that precisely mean OMI language reviewer or OMI translator. OMI therefore does not infer these roles from an OJS role name. The authoritative role is the Studio assignment created by an editor.

This avoids granting contributor metadata or editorial authority to an external participant merely because an OJS installation uses the broad `Assistant` role for several different production tasks.
