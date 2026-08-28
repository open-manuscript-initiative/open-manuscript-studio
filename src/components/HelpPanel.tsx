import { CheckCircle2, CircleHelp, Lightbulb, MapPin, Route, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTranslation } from '../i18n';
import { getDetailedHelpLabels, getDetailedHelpTopic } from '../i18n/helpDetailedAll';
import { getLocalizedHelpCopy } from '../i18n/helpResolver';
import './HelpPanelSearch.css';

const HELP_TOPIC_NUMBER_PREFIX = /^\s*(?:\d+(?:\.\d+)*[.):-]?|[IVXLCDM]+[.)])\s+/i;

export function HelpPanel() {
  const { locale } = useTranslation();
  const copy = getLocalizedHelpCopy(locale);
  const detailedLabels = getDetailedHelpLabels(locale);
  const searchCopy = getHelpSearchCopy(locale);
  const [query, setQuery] = useState('');
  const collator = useMemo(() => new Intl.Collator(locale, { sensitivity: 'base', numeric: true }), [locale]);
  const topics = useMemo(() => copy.topics
    .map((topic) => ({
      ...topic,
      sourceTitle: topic.title,
      title: topic.title.replace(HELP_TOPIC_NUMBER_PREFIX, '').trim(),
      detailed: getDetailedHelpTopic(locale, topic.title),
    }))
    .sort((left, right) => collator.compare(left.title, right.title)), [collator, copy.topics, locale]);

  const normalizedQuery = normalizeHelpSearch(query);
  const filteredTopics = useMemo(() => {
    if (!normalizedQuery) return topics;
    return topics.filter((topic) => {
      const detailed = topic.detailed;
      const searchable = [
        topic.title,
        topic.body,
        ...(topic.tips ?? []),
        detailed?.location,
        ...(detailed?.steps ?? []),
        ...(detailed?.checks ?? []),
      ].filter((value): value is string => Boolean(value)).join('\n');
      return normalizeHelpSearch(searchable).includes(normalizedQuery);
    });
  }, [normalizedQuery, topics]);

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
      </div>

      <label className="studio-help-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchCopy.placeholder}
          aria-label={searchCopy.label}
          autoComplete="off"
          enterKeyHint="search"
        />
        {normalizedQuery ? <span aria-live="polite">{searchCopy.results(filteredTopics.length)}</span> : null}
      </label>

      <div className="studio-help-intro">
        <CircleHelp size={20} aria-hidden="true" />
        <p>{copy.gettingStarted}</p>
      </div>

      <div className="studio-help-topics">
        {filteredTopics.length ? filteredTopics.map((topic, index) => {
          const detailed = topic.detailed;
          return (
            <details className="studio-help-topic" key={topic.sourceTitle} open={Boolean(normalizedQuery) || index === 0}>
              <summary>{topic.title}</summary>
              <div className="studio-help-topic-body">
                <p>{topic.body}</p>

                {detailed ? (
                  <div className="studio-help-detailed" aria-label={topic.title}>
                    <section className="studio-help-detail-section">
                      <h4><MapPin size={16} aria-hidden="true" />{detailedLabels.location}</h4>
                      <p>{detailed.location}</p>
                    </section>

                    <section className="studio-help-detail-section">
                      <h4><Route size={16} aria-hidden="true" />{detailedLabels.steps}</h4>
                      <ol>
                        {detailed.steps.map((step) => <li key={step}>{step}</li>)}
                      </ol>
                    </section>

                    <section className="studio-help-detail-section studio-help-detail-section--checks">
                      <h4><CheckCircle2 size={16} aria-hidden="true" />{detailedLabels.checks}</h4>
                      <ul>
                        {detailed.checks.map((check) => <li key={check}>{check}</li>)}
                      </ul>
                    </section>
                  </div>
                ) : null}

                {topic.tips?.length ? (
                  <div className="studio-help-tips">
                    <Lightbulb size={16} aria-hidden="true" />
                    <ul>
                      {topic.tips.map((tip) => <li key={tip}>{tip}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          );
        }) : (
          <p className="studio-help-search-empty" role="status">{searchCopy.empty}</p>
        )}
      </div>
    </section>
  );
}

function normalizeHelpSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getHelpSearchCopy(locale: string) {
  if (locale === 'hu') return {
    label: 'Keresés a Súgóban',
    placeholder: 'Keresés a Súgóban…',
    empty: 'Nincs a keresésnek megfelelő súgótéma.',
    results: (count: number) => `${count} találat`,
  };
  if (locale === 'de') return {
    label: 'Hilfe durchsuchen',
    placeholder: 'Hilfe durchsuchen…',
    empty: 'Kein passendes Hilfethema gefunden.',
    results: (count: number) => `${count} Treffer`,
  };
  return {
    label: 'Search Help',
    placeholder: 'Search Help…',
    empty: 'No matching help topic found.',
    results: (count: number) => `${count} result${count === 1 ? '' : 's'}`,
  };
}
