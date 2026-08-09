import { CircleHelp, Lightbulb } from 'lucide-react';

import { useTranslation } from '../i18n';
import { getHelpCopy } from '../i18n/help';

export function HelpPanel() {
  const { locale } = useTranslation();
  const copy = getHelpCopy(locale);

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
        {copy.topics.map((topic, index) => (
          <details className="studio-help-topic" key={topic.title} open={index === 0}>
            <summary>{topic.title}</summary>
            <div className="studio-help-topic-body">
              <p>{topic.body}</p>
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
        ))}
      </div>
    </section>
  );
}
