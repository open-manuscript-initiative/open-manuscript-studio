# Name-index spacing normalization before DOCX semantic import

Word-generated `INDEX` results are pagination caches. Some DOCX body import paths flatten the separator between an index term and the first Arabic page number, for example:

- `Acsády Ignác376, 391`
- `Ákosfalvi Szilágyi László376`

Before semantic index attachment, Studio normalizes only sections recognized as name indexes (`Névmutató`, `Névjegyzék`, `Name index`, `Personenregister`, etc.). A space is inserted only when an Arabic digit immediately follows a Unicode letter/mark:

- `Acsády Ignác376, 391` → `Acsády Ignác 376, 391`

The manuscript body is not modified by this pass. After normalization, the static Word page-number cache is removed and the semantic `XE` markers remain the canonical index data.
