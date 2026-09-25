import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';

/** Links zu Impressum und Datenschutz — auf jeder Seite erreichbar, auch ohne Anmeldung. */
export default function LegalFooter({ className = '' }: { className?: string }): React.ReactElement {
  const { t } = useT();
  return (
    <nav
      aria-label={t('legal.footerLabel')}
      className={`flex items-center justify-center gap-4 text-xs text-text-dim ${className}`}
    >
      <Link to="/impressum" className="hover:text-text transition-colors">
        {t('legal.imprint')}
      </Link>
      <span aria-hidden="true">·</span>
      <Link to="/datenschutz" className="hover:text-text transition-colors">
        {t('legal.privacy')}
      </Link>
    </nav>
  );
}
