import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../i18n';
import LegalFooter from '../components/LegalFooter';

const OPERATOR = {
  name: 'Omar Fourati',
  street: 'Am Sandberg 28',
  city: '51643 Gummersbach',
  email: 'info@omarfourati.de',
  web: 'omarfourati.de',
};

const UPDATED = { de: 'Stand: 25. September 2026', en: 'Last updated: 25 September 2026' };

/**
 * Setzt für die Dauer der Seite `noindex` und einen eigenen Titel.
 * Zusätzlich liefert nginx für diese Pfade `X-Robots-Tag: noindex` aus.
 */
function useLegalHead(title: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    document.title = `${title} – SecureVault`;
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, [title]);
}

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  const { t, locale } = useT();
  useLegalHead(title);

  return (
    <div className="min-h-screen bg-base px-4 py-10">
      <article className="legal-article max-w-2xl mx-auto glass rounded-2xl p-6 sm:p-8 text-sm text-text-muted leading-relaxed">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-text mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('legal.back')}
        </Link>
        <h1 className="text-2xl font-semibold text-text mb-1">{title}</h1>
        <p className="text-xs text-text-dim mb-6">{UPDATED[locale]}</p>
        {locale === 'en' && (
          <p className="text-xs text-text-dim mb-6 italic">
            This English version is provided for convenience. The German version is legally binding.
          </p>
        )}
        <div className="space-y-6">{children}</div>
      </article>
      <LegalFooter className="mt-6" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function Address(): React.ReactElement {
  return (
    <address className="not-italic">
      {OPERATOR.name}
      <br />
      {OPERATOR.street}
      <br />
      {OPERATOR.city}
      <br />
      Deutschland
    </address>
  );
}

const Mail = (): React.ReactElement => <a className="text-secondary hover:underline" href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;

// ---------------------------------------------------------------------------
// Impressum
// ---------------------------------------------------------------------------

export function ImpressumPage(): React.ReactElement {
  const { t, locale } = useT();

  if (locale === 'en') {
    return (
      <LegalLayout title={t('legal.imprint')}>
        <Section title="Information pursuant to § 5 DDG">
          <Address />
        </Section>
        <Section title="Contact">
          <p>Email: <Mail /><br />Web: {OPERATOR.web}</p>
        </Section>
        <Section title="Responsible for content pursuant to § 18 (2) MStV">
          <p>{OPERATOR.name}, address as above.</p>
        </Section>
        <Section title="Liability for content">
          <p>
            The content of these pages has been created with the utmost care. However, I cannot guarantee that it is
            correct, complete or up to date. As a service provider I am responsible for my own content on these pages
            under general law (§ 7 (1) DDG). Under §§ 8 to 10 DDG I am not obliged to monitor third-party information
            that is transmitted or stored. Unlawful content will be removed as soon as I become aware of it.
          </p>
        </Section>
        <Section title="Liability for links">
          <p>
            This site contains links to external third-party websites whose content I have no influence over. The
            respective provider is always responsible for the content of linked pages. Links will be removed promptly
            if any infringement becomes known.
          </p>
        </Section>
      </LegalLayout>
    );
  }

  return (
    <LegalLayout title={t('legal.imprint')}>
      <Section title="Angaben gemäß § 5 DDG">
        <Address />
      </Section>
      <Section title="Kontakt">
        <p>E-Mail: <Mail /><br />Web: {OPERATOR.web}</p>
      </Section>
      <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>{OPERATOR.name}, Anschrift wie oben.</p>
      </Section>
      <Section title="Haftung für Inhalte">
        <p>
          Die Inhalte dieser Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität der Inhalte kann ich jedoch keine Gewähr übernehmen. Als Diensteanbieter bin ich gemäß § 7 Abs. 1
          DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG
          bin ich jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
          Rechtswidrige Inhalte entferne ich umgehend, sobald ich davon Kenntnis erlange.
        </p>
      </Section>
      <Section title="Haftung für Links">
        <p>
          Diese Seite enthält Links zu externen Websites Dritter, auf deren Inhalte ich keinen Einfluss habe. Für die
          Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich. Bei Bekanntwerden von
          Rechtsverletzungen werde ich derartige Links umgehend entfernen.
        </p>
      </Section>
    </LegalLayout>
  );
}

// ---------------------------------------------------------------------------
// Datenschutz
// ---------------------------------------------------------------------------

export function DatenschutzPage(): React.ReactElement {
  const { t, locale } = useT();
  return (
    <LegalLayout title={t('legal.privacy')}>
      {locale === 'en' ? <PrivacyEn /> : <PrivacyDe />}
    </LegalLayout>
  );
}

function PrivacyDe(): React.ReactElement {
  return (
    <>
      <Section title="1. Verantwortlicher">
        <p>
          {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.city}, Deutschland
          <br />
          E-Mail: <Mail />
        </p>
      </Section>

      <Section title="2. Das Wichtigste in Kürze">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Passwörter, API-Keys und 2FA-Schlüssel werden <strong>in deinem Browser verschlüsselt</strong>, bevor sie
            den Server erreichen. Auf dem Server liegt davon nur Chiffretext.
          </li>
          <li>
            Es werden nur <strong>technisch notwendige Cookies</strong> für die Anmeldung gesetzt (Abschnitt 9) –
            keine Werbe- oder Tracking-Cookies.
          </li>
          <li>
            Es werden keine Inhalte von Drittanbietern nachgeladen: Schriftarten und alle Dateien liegen auf meinem
            eigenen Server. Die Reichweitenmessung (Umami) betreibe ich selbst, cookie-frei und nur mit neutralen
            Seitenkategorien (Abschnitt 10).
          </li>
        </ul>
      </Section>

      <Section title="3. Hosting">
        <p>
          SecureVault läuft auf einem eigenen, bei der IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, angemieteten
          Server (VPS) in Deutschland. IONOS verarbeitet dabei ggf. anfallende Daten als Auftragsverarbeiter im Sinne
          von Art. 28 DSGVO. Die Verbindung ist per TLS verschlüsselt; die Zertifikate stellt Let&apos;s Encrypt
          (Internet Security Research Group, USA) aus. Dabei übermittelt der Server nur den Domainnamen an
          Let&apos;s Encrypt, keine Daten der Nutzer.
        </p>
      </Section>

      <Section title="4. Server-Logdateien (Zugriffsprotokolle)">
        <p>
          Beim Aufruf von SecureVault verarbeitet der eingesetzte Webserver (Caddy) technisch notwendig deine
          IP-Adresse, den Zeitpunkt und die angefragte Adresse, um die Seite auszuliefern. Die IP-Adresse wird dabei
          sofort gekürzt gespeichert (IPv4 auf /24, IPv6 auf /48) und ist damit nicht mehr einer einzelnen Person
          zuordenbar; Cookies und Zugangs-Token werden nicht protokolliert. Diese gekürzten Zugriffsprotokolle werden
          für maximal 90 Tage gespeichert und danach automatisch gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
          DSGVO – mein berechtigtes Interesse an einem sicheren und funktionsfähigen Betrieb.
        </p>
      </Section>

      <Section title="5. Benutzerkonto">
        <p>
          Für ein Konto speichere ich deine E-Mail-Adresse und einen Hash deines Passworts (bcrypt) – nie das Passwort
          selbst – sowie deine Einstellungen (z. B. Sprache, Design, Sperrzeit). Rechtsgrundlage ist Art. 6 Abs. 1
          lit. b DSGVO (Bereitstellung des Dienstes). Die Daten werden gespeichert, solange das Konto besteht, und mit
          dem Löschen des Kontos entfernt.
        </p>
      </Section>

      <Section title="6. Tresorinhalte und Verschlüsselung">
        <p>
          Passwörter, API-Keys und 2FA-Schlüssel werden in deinem Browser mit AES-256-GCM verschlüsselt. Der Schlüssel
          dafür wird aus deinem Tresorpasswort abgeleitet und verlässt dein Gerät nicht im Klartext; der Server
          speichert nur den verschlüsselten Datenblock.
        </p>
        <p>
          <strong>Unverschlüsselt</strong> gespeichert werden die beschreibenden Angaben eines Eintrags, damit Suche
          und Sortierung funktionieren: Bezeichnung, Symbol, Dienst, Benutzername, URL, Notiz, Ablaufdatum,
          Kategorien, Favoriten-Markierung sowie Zeitpunkte der Erstellung, Änderung und letzten Nutzung.
        </p>
        <p>
          <strong>Kontowiederherstellung:</strong> Damit ein vergessenes Tresorpasswort nicht zum Verlust aller Daten
          führt, wird dein Tresorschlüssel zusätzlich mit dem öffentlichen Schlüssel des Administrators verschlüsselt
          hinterlegt. Der Administrator (der Betreiber) kann damit – nur mit seinem eigenen, ebenfalls verschlüsselt
          gespeicherten privaten Schlüssel – den Zugang zu deinem Tresor wiederherstellen und hätte dabei technisch
          Zugriff auf die Tresorinhalte. Ich nutze diese Möglichkeit ausschließlich auf deine Anfrage hin.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </Section>

      <Section title="7. Anmeldung mit Google oder Apple (optional)">
        <p>
          Wenn du dich mit Google (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) oder Apple
          (Apple Distribution International Ltd., Hollyhill Industrial Estate, Cork, Irland) anmeldest, wirst du auf
          deren Seite weitergeleitet. Ich erhalte dabei deine E-Mail-Adresse und eine Konto-ID des Anbieters, um dich
          wiederzuerkennen. Für die Verarbeitung beim Anbieter gilt dessen Datenschutzerklärung. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. b DSGVO. Die Anmeldung per E-Mail und Passwort ist ohne diese Anbieter möglich.
        </p>
      </Section>

      <Section title="8. Sitzungen">
        <p>
          Zu jeder Anmeldung speichere ich den User-Agent deines Browsers (daraus abgeleitet: Gerätetyp, Browser,
          Betriebssystem), die auf /24 (IPv4) bzw. /48 (IPv6) gekürzte IP-Adresse sowie Beginn und letzte Aktivität.
          Das dient dazu, dass du in den Einstellungen deine aktiven Sitzungen erkennen und fremde Sitzungen beenden
          kannst. Eine Anmeldung ist höchstens 30 Tage gültig. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO – das
          berechtigte Interesse an der Sicherheit deines Kontos.
        </p>
      </Section>

      <Section title="9. Cookies und lokale Speicherung">
        <p>SecureVault setzt ausschließlich diese technisch notwendigen Cookies:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <code>refresh_token</code> – hält dich angemeldet (HttpOnly, nur über HTTPS, höchstens 30 Tage).
          </li>
          <li>
            <code>oauth_state</code> – nur bei der Anmeldung mit Google oder Apple, schützt diesen Vorgang vor
            Fälschung (10 Minuten).
          </li>
        </ul>
        <p>
          Außerdem legt der Browser die Programmdateien der App (Service Worker) ab, damit sie schneller lädt. Darin
          stehen keine Tresorinhalte. Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich) in
          Verbindung mit Art. 6 Abs. 1 lit. b DSGVO; eine Einwilligung ist dafür nicht nötig.
        </p>
      </Section>

      <Section title="10. Reichweitenmessung mit Umami">
        <p>
          Um zu sehen, wie SecureVault genutzt wird, setze ich <strong>Umami</strong> ein – eine
          Open-Source-Analyse-Software, die ich <strong>selbst auf meinem eigenen Server in Deutschland</strong>{' '}
          betreibe. Es fließen keine Daten an Dritte. Übermittelt wird nur eine <strong>neutrale Seitenkategorie</strong>{' '}
          (z. B. „Anmeldung“, „Tresor“, „Einstellungen“) – nie echte Adressen, Einladungs-Token, Tresorinhalte,
          E-Mail-Adressen oder IDs.
        </p>
        <p>
          Umami arbeitet <strong>cookie-frei</strong> und speichert nichts auf deinem Gerät. Deine IP-Adresse wird
          nicht gespeichert; sie wird nur kurz herangezogen, um zusammen mit einem täglich wechselnden Zufallswert
          einen Hash zu bilden, aus dem sich die IP-Adresse nicht zurückrechnen lässt. Rechtsgrundlage ist Art. 6
          Abs. 1 lit. f DSGVO – mein berechtigtes Interesse an einer datensparsamen Reichweitenmessung.
        </p>
        <p>
          Du kannst der Messung jederzeit widersprechen (Art. 21 DSGVO), indem du einen Tracking-Blocker nutzt oder
          „Nicht verfolgen“ (Do Not Track) in deinem Browser aktivierst – das Skript beachtet diese Einstellung.
        </p>
      </Section>

      <Section title="11. Kontaktaufnahme">
        <p>
          Bei einer Kontaktaufnahme per E-Mail an <Mail /> verarbeite ich die mitgeteilten Daten ausschließlich zur
          Bearbeitung deiner Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO.
        </p>
      </Section>

      <Section title="12. Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung
          der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Wende dich dazu
          einfach per E-Mail an <Mail />. Deine Einträge kannst du außerdem jederzeit selbst in den Einstellungen
          exportieren und löschen.
        </p>
        <p>
          Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel bei der
          Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestr. 2–4, 40213
          Düsseldorf.
        </p>
      </Section>

      <Section title="13. Keine automatisierte Entscheidungsfindung">
        <p>Es findet keine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO statt.</p>
      </Section>
    </>
  );
}

function PrivacyEn(): React.ReactElement {
  return (
    <>
      <Section title="1. Controller">
        <p>
          {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.city}, Germany
          <br />
          Email: <Mail />
        </p>
      </Section>

      <Section title="2. Summary">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Passwords, API keys and 2FA secrets are <strong>encrypted in your browser</strong> before they reach the
            server. The server only stores ciphertext.
          </li>
          <li>
            Only <strong>strictly necessary cookies</strong> for signing in are set (section 9) – no advertising or
            tracking cookies.
          </li>
          <li>
            No third-party content is loaded: fonts and all files are served from my own server. Analytics (Umami)
            is self-hosted, cookie-free and only records neutral page categories (section 10).
          </li>
        </ul>
      </Section>

      <Section title="3. Hosting">
        <p>
          SecureVault runs on a virtual server rented from IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, located in
          Germany. IONOS acts as a processor under Art. 28 GDPR. Connections are TLS-encrypted; certificates are
          issued by Let&apos;s Encrypt (Internet Security Research Group, USA), which only receives the domain name.
        </p>
      </Section>

      <Section title="4. Server log files">
        <p>
          The web server (Caddy) processes your IP address, the time and the requested address in order to deliver
          the page. The IP address is truncated immediately (IPv4 to /24, IPv6 to /48); cookies and tokens are not
          logged. These truncated logs are kept for at most 90 days and then deleted automatically. Legal basis:
          Art. 6 (1) (f) GDPR – legitimate interest in secure and reliable operation.
        </p>
      </Section>

      <Section title="5. User account">
        <p>
          For an account I store your email address and a bcrypt hash of your password – never the password itself –
          as well as your settings (e.g. language, theme, lock timeout). Legal basis: Art. 6 (1) (b) GDPR. The data is
          kept while the account exists and removed when it is deleted.
        </p>
      </Section>

      <Section title="6. Vault contents and encryption">
        <p>
          Passwords, API keys and 2FA secrets are encrypted in your browser with AES-256-GCM using a key derived from
          your vault password. The key never leaves your device in plain text; the server only stores the encrypted
          blob.
        </p>
        <p>
          The descriptive fields of an entry are stored <strong>unencrypted</strong> so that search and sorting work:
          name, icon, service, username, URL, note, expiry date, categories, favorite flag and the times of creation,
          last change and last use.
        </p>
        <p>
          <strong>Account recovery:</strong> so that a forgotten vault password does not mean losing all data, your
          vault key is additionally stored encrypted with the administrator&apos;s public key. The administrator (the
          operator) can use it – only together with their own private key, which is also stored encrypted – to
          restore access to your vault and would technically have access to its contents in doing so. I only use this
          at your request. Legal basis: Art. 6 (1) (b) GDPR.
        </p>
      </Section>

      <Section title="7. Sign in with Google or Apple (optional)">
        <p>
          If you sign in with Google (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland) or Apple
          (Apple Distribution International Ltd., Hollyhill Industrial Estate, Cork, Ireland), you are redirected to
          their site. I receive your email address and an account ID from the provider to recognise you. The
          provider&apos;s privacy policy applies to its processing. Legal basis: Art. 6 (1) (b) GDPR. Signing in with
          email and password works without these providers.
        </p>
      </Section>

      <Section title="8. Sessions">
        <p>
          For each sign-in I store your browser&apos;s user agent (from which device type, browser and operating
          system are derived), your IP address truncated to /24 (IPv4) or /48 (IPv6), and the start and last activity
          time. This lets you recognise your active sessions in the settings and end unknown ones. A sign-in is valid
          for at most 30 days. Legal basis: Art. 6 (1) (f) GDPR – legitimate interest in the security of your account.
        </p>
      </Section>

      <Section title="9. Cookies and local storage">
        <p>SecureVault only sets these strictly necessary cookies:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>refresh_token</code> – keeps you signed in (HttpOnly, HTTPS only, at most 30 days).</li>
          <li><code>oauth_state</code> – only when signing in with Google or Apple, protects that flow against forgery (10 minutes).</li>
        </ul>
        <p>
          Your browser also caches the app&apos;s program files (service worker) so it loads faster; they contain no
          vault data. Legal basis: § 25 (2) no. 2 TDDDG (strictly necessary) in conjunction with Art. 6 (1) (b) GDPR;
          no consent is required.
        </p>
      </Section>

      <Section title="10. Analytics with Umami">
        <p>
          I use <strong>Umami</strong>, open-source analytics software that I <strong>host myself on my own server in
          Germany</strong>. No data is passed to third parties. Only a <strong>neutral page category</strong> (e.g.
          &quot;sign-in&quot;, &quot;vault&quot;, &quot;settings&quot;) is sent – never real addresses, invitation
          tokens, vault contents, email addresses or IDs.
        </p>
        <p>
          Umami is <strong>cookie-free</strong> and stores nothing on your device. Your IP address is not stored; it is
          only used briefly, together with a daily rotating salt, to form a hash from which the IP address cannot be
          recovered. Legal basis: Art. 6 (1) (f) GDPR. You can object at any time (Art. 21 GDPR) by using a tracking
          blocker or enabling &quot;Do Not Track&quot; in your browser, which the script respects.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          If you contact me by email at <Mail />, I process the data you provide solely to handle your request. Legal
          basis: Art. 6 (1) (b) or (f) GDPR.
        </p>
      </Section>

      <Section title="12. Your rights">
        <p>
          You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of
          processing (Art. 18), data portability (Art. 20) and objection (Art. 21). Simply email <Mail />. You can also
          export and delete your entries yourself at any time in the settings.
        </p>
        <p>
          You also have the right to lodge a complaint with a supervisory authority, for example the Landesbeauftragte
          für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestr. 2–4, 40213 Düsseldorf, Germany.
        </p>
      </Section>

      <Section title="13. No automated decision-making">
        <p>No automated decision-making within the meaning of Art. 22 GDPR takes place.</p>
      </Section>
    </>
  );
}
