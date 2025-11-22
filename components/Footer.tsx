"use client";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <span className="footer-logo">IB Fresh Fish</span>
          <span className="footer-location">Nellore</span>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} All rights reserved
        </div>
      </div>

      <style jsx>{`
        .footer {
          margin-top: auto;
          padding: 1rem 1.5rem;
          background: var(--card-bg);
          border-top: 1px solid var(--card-border);
        }

        .footer-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1600px;
          margin: 0 auto;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .footer-logo {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground);
        }

        .footer-location {
          font-size: 0.75rem;
          color: var(--muted);
          padding: 0.125rem 0.5rem;
          background: var(--primary-light);
          border-radius: var(--radius-sm);
        }

        .footer-copyright {
          font-size: 0.75rem;
          color: var(--muted);
        }

        @media (max-width: 640px) {
          .footer-content {
            flex-direction: column;
            gap: 0.5rem;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}
