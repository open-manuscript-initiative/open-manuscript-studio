import { BUILD_INFO } from "../version";

export function Footer() {
  return (
    <footer className="omi-footer">
      <div className="omi-footer-title">
        Open Manuscript Studio
      </div>

      <div className="omi-footer-version">
        v{BUILD_INFO.version}
        {" • "}
        Build #{BUILD_INFO.build}
        {" • "}
        {BUILD_INFO.commit}
      </div>

      <div className="omi-footer-links">
        <span>© 2026 Open Manuscript Initiative</span>

        <span className="omi-footer-separator">•</span>

        <a
          href="https://github.com/open-manuscript-initiative/open-manuscript-studio"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>

        <span className="omi-footer-separator">•</span>

        <a
          href="https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
        >
          MIT License
        </a>

        <span className="omi-footer-separator">•</span>

        <a
          href="https://openmanuscript.org/docs/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Documentation
        </a>
      </div>
    </footer>
  );
}
