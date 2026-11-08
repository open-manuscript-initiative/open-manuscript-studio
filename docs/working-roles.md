# Working roles

In **Profile → Preferences → Preferred working role**, choose Author, Editor,
Scientific reviewer, Translator, Language reviewer, Layout editor, or Full
workspace. The preference is saved with the account on the selected Studio
server. Existing accounts default to Full workspace.

The manuscript menu shows the tools relevant to that role. **Show all tools**
restores the full menu for the current document without changing the profile.
Document opening, Settings and Tools remain available in every role.

| Working role | Main tasks |
| --- | --- |
| Author | Manuscript metadata, contributors, notes, references, signatures, submission and assignment follow-up |
| Editor | Manuscript data, editorial workflow, assignments, validation, publication |
| Scientific reviewer | Notes, references, editorial tasks, history |
| Translator | Translation workspaces, notes, references, history |
| Language reviewer | Manuscript data, notes, references, validation, editorial tasks |
| Layout editor | Live publication editor, publication profile, validation |

## Opening from OJS or OMP

Server-verified handoffs supply the author/editor role automatically. This role
takes precedence over the profile only while that imported manuscript is active.
The menu identifies whether its role comes from OJS, OMP or the personal profile.
Switching to another document restores its applicable role or the profile
preference. The override is session-only and is never exported inside an OMI file
or written back to the account preference. Unknown/missing actor modes retain the
profile preference. Legacy OJS local-storage payloads do not override it.

OJS/OMP reviewer launches continue through the existing verified review portal.
Scientific review, language review and translation assignments use their
server-supplied assignment type and existing task-specific editor capabilities.
The profile selector does not change those assignment restrictions.

Working roles control menu presentation only. Choosing Editor, or showing all
tools, does not grant editorial/institutional privileges or access to additional
manuscripts. The existing server-side assignments, grants, anonymity rules and
external capabilities remain authoritative.

## Server update

Deploy the Identity database migration before starting the updated API:

```sh
cd server
npm run prisma:migrate:identity:deploy
npm run prisma:generate:all
```

The migration adds `users.workflow_role` with the default `general`, preserving
the existing interface for accounts that have not chosen a working role.
