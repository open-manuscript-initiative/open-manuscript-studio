import { CheckCircle2, CircleHelp, Lightbulb, MapPin, Route } from 'lucide-react';

import { useTranslation } from '../i18n';
import { getDetailedHelpLabels, getDetailedHelpTopic } from '../i18n/helpDetailedAll';
import { getLocalizedHelpCopy } from '../i18n/helpResolver';

const HELP_TOPIC_NUMBER_PREFIX = /^\s*(?:\d+(?:\.\d+)*[.):-]?|[IVXLCDM]+[.)])\s+/i;

export function HelpPanel() {
  const { locale } = useTranslation();
  const copy = getLocalizedHelpCopy(locale);
  const detailedLabels = getDetailedHelpLabels(locale);
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const topics = copy.topics
    .map((topic) => ({
      ...topic,
      sourceTitle: topic.title,
      title: topic.title.replace(HELP_TOPIC_NUMBER_PREFIX, '').trim(),
    }))
    .sort((left, right) => collator.compare(left.title, right.title));

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="studio-help-intro">
        <CircleHelp size={20} aria-hidden="true" />
        <p>{copy.gettingStarted}</p>
      </div>

      <div className="studio-help-topics">
        {topics.map((topic, index) => {
          const detailed = getDetailedHelpTopic(locale, topic.sourceTitle);
          return (
            <details className="studio-help-topic" key={topic.sourceTitle} open={index === 0}>
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
        })}
      </div>
    </section>
  );
}
