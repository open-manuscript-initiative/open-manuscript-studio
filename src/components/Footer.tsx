import { BUILD_INFO } from "../version";

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid #ddd",
        padding: "0.6rem 1rem",
        fontSize: "0.85rem",
        color: "#666",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>
        <strong>Open Manuscript Studio</strong>
      </span>

      <span>
        v{BUILD_INFO.version}
        {" · "}
        Build #{BUILD_INFO.build}
        {" · "}
        {BUILD_INFO.commit}
      </span>
    </footer>
  );
}
