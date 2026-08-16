import { BUILD_INFO } from '../version';

export function Footer() {
  return (
    <footer className="omi-footer" aria-label="Open Manuscript Studio">
      <div className="omi-footer-accent" aria-hidden="true" />

      <div className="omi-footer-container">
        <div className="omi-footer-identity">
          <div className="omi-footer-mark" aria-hidden="true">OMI</div>

          <div className="omi-footer-brand">
            <strong>Open Manuscript Studio</strong>
            <span>Scholarly writing and publishing infrastructure</span>
          </div>
        </div>

        <div className="omi-footer-meta">
          <nav className="omi-footer-links" aria-label="Studio links">
            <a
              href="https://openmanuscript.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Manuscript Initiative
            </a>
            <a
              href="https://openmanuscript.org/docs/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>
            <a
              href="https://github.com/open-manuscript-initiative/open-manuscript-studio"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
          </nav>

          <div className="omi-footer-build">
            <span>v{BUILD_INFO.version}</span>
            <span aria-hidden="true">·</span>
            <span>Build #{BUILD_INFO.build}</span>
            <span aria-hidden="true">·</span>
            <span>{BUILD_INFO.commit}</span>
          </div>
        </div>
      </div>

      <div className="omi-footer-copyright">
        © 2026 Open Manuscript Initiative · Open infrastructure for scholarly communication
      </div>
    </footer>
  );
}
