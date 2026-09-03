import {
  AlignJustify,
  CornerDownLeft,
  FileText,
  Link,
  MessageSquare,
  Minus,
  MoveDown,
  Pencil,
  Plus,
  Scissors,
  type LucideIcon,
} from 'lucide-react';

type ProofingLegendMode = 'editor' | 'publication';

interface ProofingLegendItem {
  kind: string;
  label: string;
  icon: LucideIcon;
}

export function ProofingColorLegend({
  locale,
  mode,
}: {
  locale: string;
  mode: ProofingLegendMode;
}) {
  const copy = legendCopy(locale);
  const items: ProofingLegendItem[] = mode === 'publication'
    ? [
        { kind: 'discretionary-hyphen', label: copy.optionalHyphen, icon: Scissors },
        { kind: 'nonbreaking', label: copy.nonbreaking, icon: Link },
        { kind: 'forced-line-break', label: copy.forcedLineBreak, icon: CornerDownLeft },
        { kind: 'page-break-before', label: copy.pageBreak, icon: FileText },
        { kind: 'keep-together', label: copy.keepTogether, icon: AlignJustify },
        { kind: 'keep-with-next', label: copy.keepWithNext, icon: MoveDown },
      ]
    : [
        { kind: 'insertion', label: copy.insertion, icon: Plus },
        { kind: 'deletion', label: copy.deletion, icon: Minus },
        { kind: 'replacement', label: copy.replacement, icon: Pencil },
        { kind: 'comment', label: copy.comment, icon: MessageSquare },
      ];

  return (
    <aside className={`proofing-color-legend proofing-color-legend--${mode}`} aria-label={copy.title}>
      <strong>{copy.title}</strong>
      <ul>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.kind} data-proofing-kind={item.kind}>
              <span className="proofing-color-legend__swatch" aria-hidden="true">
                <Icon size={13} strokeWidth={2.2} />
              </span>
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function legendCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Színjelölések',
    insertion: 'Beszúrás',
    deletion: 'Törlés',
    replacement: 'Módosítás',
    comment: 'Megjegyzés',
    optionalHyphen: 'Feltételes elválasztás',
    nonbreaking: 'Egyben tartás',
    forcedLineBreak: 'Kényszerített sortörés',
    pageBreak: 'Oldaltörés',
    keepTogether: 'Bekezdés együtt',
    keepWithNext: 'Következővel együtt',
  };
  if (locale === 'de') return {
    title: 'Farbmarkierungen',
    insertion: 'Einfügung',
    deletion: 'Löschung',
    replacement: 'Änderung',
    comment: 'Kommentar',
    optionalHyphen: 'Bedingte Trennung',
    nonbreaking: 'Zusammenhalten',
    forcedLineBreak: 'Erzwungener Umbruch',
    pageBreak: 'Seitenumbruch',
    keepTogether: 'Absatz zusammen',
    keepWithNext: 'Mit nächstem zusammen',
  };
  return {
    title: 'Color highlights',
    insertion: 'Insertion',
    deletion: 'Deletion',
    replacement: 'Change',
    comment: 'Comment',
    optionalHyphen: 'Optional hyphen',
    nonbreaking: 'Keep together',
    forcedLineBreak: 'Forced line break',
    pageBreak: 'Page break',
    keepTogether: 'Keep paragraph',
    keepWithNext: 'Keep with next',
  };
}
