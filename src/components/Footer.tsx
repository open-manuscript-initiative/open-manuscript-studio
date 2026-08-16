import { BUILD_INFO } from '../version';

export function Footer() {
  return (
    <footer className="omi-footer" aria-label="Open Manuscript Studio">
      <div className="omi-footer-container">
        <div className="omi-footer-brand">
          <strong>Open Manuscript Studio</strong>
          <span className="omi-footer-version">
            v{BUILD_INFO.version} · Build #{BUILD_INFO.build} · {BUILD_INFO.commit}
          </span>
        </div>

        <nav className="omi-footer-links" aria-label="Studio links">
          <a
            href="https://openmanuscript.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            © 2026 Open Manuscript Initiative
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
          <a
            href="https://openmanuscript.org/docs/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </nav>
      </div>
    </footer>
  );
}
