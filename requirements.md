# Requirements – Private Key & Account Manager App

## Projektübersicht

Eine **private, passwortgeschützte Web-App** mit Backend, die gleichzeitig als **Progressive Web App (PWA)** auf mobilen und Desktop-Geräten installierbar ist (Native-App-Erfahrung). Die App dient ausschließlich dem persönlichen Verwalten von API-Keys und Kontodaten – geräteübergreifend synchronisiert über einen eigenen Server/Domain.

---

## 1. Technologie-Stack

| Bereich | Technologie |
|---|---|
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Build / PWA | Vite + vite-plugin-pwa |
| Backend | Node.js + Express + TypeScript |
| Datenbank | PostgreSQL (via Prisma ORM) |
| Authentifizierung | JWT (Access Token) + Refresh Token (HttpOnly Cookie) |
| Verschlüsselung | AES-256 (client-seitig, vor dem Senden an den Server) |
| Deployment | Eigener Server / Domain (z. B. VPS, Hetzner, DigitalOcean) |
| Native App | PWA (installierbar auf iOS, Android, Desktop) |

> **Sicherheitsprinzip:** Alle sensiblen Daten (API Keys, Passwörter) werden **client-seitig verschlüsselt**, bevor sie an den Server gesendet werden. Der Server speichert **niemals Klartext**. Selbst ein kompromittierter Server gibt keine Geheimnisse preis.

---

## 2. Authentifizierung & Benutzerverwaltung

- Die App ist **Single-User** (nur ein Account – der Besitzer).
- **Registrierung:** Einmalige Einrichtung beim ersten Start (E-Mail + Master-Passwort).
- **Login:** E-Mail + Master-Passwort → JWT wird ausgestellt.
- **JWT Access Token:** Kurzlebig (15 Minuten), im Memory des Frontends gespeichert.
- **Refresh Token:** Langlebig (30 Tage), in einem `HttpOnly`-Cookie gespeichert.
- **Auto-Lock:** Nach X Minuten Inaktivität (konfigurierbar) wird das Frontend gesperrt und erfordert erneute Passwort-Eingabe.
- **Passwort ändern:** Re-verschlüsselt alle gespeicherten Daten client-seitig und überträgt sie neu.
- Nach **5 Fehlversuchen** beim Login: 60 Sekunden Sperre (serverseitig via Rate Limiting).
- **Logout:** Invalidiert den Refresh Token auf dem Server.

---

## 3. Hauptfunktionen

### 3.1 API-Keys verwalten

- **Erstellen:** Neuen API-Key-Eintrag anlegen mit:
  - Name / Label (z. B. „OpenAI Production")
  - Service / Anbieter (z. B. „OpenAI", „GitHub", „Stripe")
  - API Key (client-seitig verschlüsselt)
  - Kategorie / Tag (frei wählbar, z. B. „AI", „Hosting", „Payment")
  - Optionale Notiz
  - Ablaufdatum (optional, mit Hinweis wenn abgelaufen oder bald ablaufend)
  - Erstellungsdatum (automatisch)
- **Lesen:** Einträge werden standardmäßig maskiert (`••••••••`) angezeigt.
  - „Anzeigen"-Button zum temporären Einblenden.
- **Bearbeiten:** Alle Felder aktualisierbar.
- **Löschen:** Mit Bestätigungsdialog.
- **Kopieren:** Key mit einem Klick in die Zwischenablage (mit Toast-Feedback).

### 3.2 Kontodaten verwalten

- **Erstellen:** Neuen Konto-Eintrag anlegen mit:
  - Name / Label (z. B. „AWS Root Account")
  - Benutzername / E-Mail
  - Passwort (client-seitig verschlüsselt)
  - URL / Website (optional, mit „Öffnen"-Button)
  - Kategorie / Tag (frei wählbar)
  - Optionale Notiz / 2FA-Hinweis
  - Erstellungsdatum (automatisch)
- **Lesen:** Passwörter standardmäßig maskiert.
- **Bearbeiten:** Alle Felder aktualisierbar.
- **Löschen:** Mit Bestätigungsdialog.
- **Kopieren:** Benutzername & Passwort separat kopierbar.

### 3.3 Passwort-Generator

- Integrierter Generator direkt im Erstellungs-/Bearbeitungsformular.
- Konfigurierbare Optionen:
  - Länge (8–128 Zeichen, Slider)
  - Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (je an/aus)
  - Sonderzeichen-Set anpassbar
- Passwortstärke-Anzeige (Weak / Fair / Strong / Very Strong).
- „Generieren"-Button + direktes Übernehmen in das Passwortfeld.
- „Kopieren"-Button.

### 3.4 Kategorien / Tags

- Freie, benutzerdefinierte Kategorien (z. B. „AI", „Cloud", „Social", „Banking").
- Kategorien können erstellt, umbenannt und gelöscht werden.
- Einträge können mehreren Kategorien zugeordnet werden.
- Filter-Sidebar oder Filter-Chips zum Filtern nach Kategorie.

### 3.5 Suche & Filter

- Globale Suchleiste (sucht über Name, Service, URL, Notiz, Kategorie).
- Filter: Kategorie, Typ (API Key / Konto / Alle), Ablaufstatus.
- Sortierung: Alphabetisch, nach Erstellungsdatum, nach zuletzt bearbeitet.

---

## 4. UI / UX

- **Dashboard:** Übersicht aller Einträge mit Statistiken (Anzahl Keys, Konten, bald ablaufende Keys).
- **Dark Mode** als Standard (Light Mode umschaltbar, Präferenz wird gespeichert).
- **Responsive Design:** Mobile-first, funktioniert auf Smartphone, Tablet und Desktop.
- Jeder Eintrag hat ein farbiges Icon oder Emoji als visuellen Identifier (wählbar).
- Toast-Benachrichtigungen für alle Aktionen (Kopiert, Gespeichert, Fehler, etc.).
- Klares, minimalistisches Design – privat, kein Branding-Overhead.

---

## 5. PWA / Native App Anforderungen

- Die App muss als **PWA installierbar** sein (Web App Manifest + Service Worker).
- **Offline-Modus:** Bereits geladene Daten sind offline lesbar (gecacht via Service Worker). Schreiboperationen erfordern eine Verbindung.
- App-Icon und Splash Screen für iOS, Android und Desktop.
- Auf iOS: Über „Zum Home-Bildschirm hinzufügen" installierbar.
- Auf Android: Install-Banner / „Zum Startbildschirm" hinzufügen.
- Auf Desktop (Chrome/Edge): Als Desktop-App installierbar.
- HTTPS ist Pflicht (Voraussetzung für PWA und sichere Cookies).

---

## 6. Datensicherheit

- **Client-seitige Verschlüsselung:** Alle sensiblen Felder werden mit AES-256 verschlüsselt, bevor sie das Gerät verlassen. Der Schlüssel wird vom Master-Passwort via PBKDF2 (100.000 Iterationen, zufälliges Salt) abgeleitet.
- **Server speichert niemals Klartext.**
- **Passwort-Hashing:** Das Master-Passwort wird serverseitig mit `bcrypt` (Kostenfaktor 12) gehasht.
- **HTTPS:** Pflicht für alle Kommunikation (Let's Encrypt / eigenes Zertifikat).
- **HttpOnly Cookies** für Refresh Tokens (kein JS-Zugriff).
- **Rate Limiting** auf allen Auth-Endpoints (via `express-rate-limit`).
- **CORS:** Nur die eigene Domain ist als Origin erlaubt.
- **Helmet.js:** Sicherheits-HTTP-Header automatisch gesetzt.
- **Input-Validierung:** Alle Server-Eingaben via `zod` validiert.

---

## 7. Import / Export

- **Export:** Alle Daten als verschlüsselte `.json`-Datei exportieren (mit Master-Passwort geschützt, client-seitig entschlüsselt).
- **Import:** Verschlüsselte `.json`-Datei importieren (Master-Passwort erforderlich).
- **Klartext-Export:** Optional, nur nach expliziter doppelter Bestätigung, für Backup-Zwecke.

---

## 8. Einstellungen

- Master-Passwort ändern (re-verschlüsselt alle Daten).
- Auto-Lock-Timer einstellen (5 / 15 / 30 Minuten / deaktiviert).
- Dark/Light Mode.
- Kategorien verwalten (erstellen, umbenennen, löschen).
- Aktive Sessions einsehen und einzeln abmelden (z. B. „Alle anderen Sessions abmelden").
- Alle Daten löschen (Reset mit Bestätigungsdialog).
- App-Version anzeigen.

---

## 9. Backend API Endpunkte (REST)

### Auth
| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/api/auth/setup` | Ersteinrichtung (einmalig) |
| POST | `/api/auth/login` | Login, gibt JWT zurück |
| POST | `/api/auth/refresh` | Access Token via Refresh Token erneuern |
| POST | `/api/auth/logout` | Refresh Token invalidieren |
| PUT | `/api/auth/password` | Master-Passwort ändern |

### Einträge
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/entries` | Alle Einträge abrufen |
| POST | `/api/entries` | Neuen Eintrag erstellen |
| PUT | `/api/entries/:id` | Eintrag aktualisieren |
| DELETE | `/api/entries/:id` | Eintrag löschen |

### Kategorien
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/categories` | Alle Kategorien abrufen |
| POST | `/api/categories` | Kategorie erstellen |
| PUT | `/api/categories/:id` | Kategorie umbenennen |
| DELETE | `/api/categories/:id` | Kategorie löschen |

### Import / Export
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/export` | Alle verschlüsselten Daten exportieren |
| POST | `/api/import` | Verschlüsselte Daten importieren |

---

## 10. Nicht-funktionale Anforderungen

- **Single-User-App** – kein Mehrbenutzer-System.
- **Keine Telemetrie**, kein Tracking, keine Werbung.
- Erster Ladevorgang unter 2 Sekunden (gecachte PWA-Shell).
- Kompatibilität: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+.
- HTTPS ist Pflicht.

---

## 11. Projektstruktur (Vorschlag)

```
/
├── frontend/
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   └── src/
│       ├── components/
│       │   ├── LockScreen.tsx
│       │   ├── Dashboard.tsx
│       │   ├── EntryCard.tsx
│       │   ├── EntryForm.tsx
│       │   ├── PasswordGenerator.tsx
│       │   ├── CategoryManager.tsx
│       │   ├── SearchBar.tsx
│       │   ├── Settings.tsx
│       │   └── Toast.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useEntries.ts
│       │   ├── useCrypto.ts
│       │   └── useClipboard.ts
│       ├── types/
│       │   └── index.ts
│       ├── utils/
│       │   ├── crypto.ts
│       │   └── api.ts
│       ├── App.tsx
│       └── main.tsx
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── entries.ts
│       │   ├── categories.ts
│       │   └── transfer.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   └── rateLimiter.ts
│       ├── utils/
│       │   └── jwt.ts
│       └── index.ts
│
├── docker-compose.yml
└── README.md
```

---

## 12. Deployment

- **Docker + Docker Compose** für einfaches Deployment auf dem eigenen Server.
- Services in `docker-compose.yml`:
  - `frontend` – Nginx serviert den React-Build.
  - `backend` – Node.js/Express API.
  - `db` – PostgreSQL.
- **Reverse Proxy:** Nginx oder Traefik vor den Diensten (HTTPS-Terminierung).
- **SSL:** Let's Encrypt (via Certbot oder Traefik automatisch).
- **Umgebungsvariablen** via `.env`-Datei (niemals ins Git-Repo).

---

## 13. Lieferobjekte

- [ ] Vollständige React-App (TypeScript) mit PWA-Konfiguration
- [ ] Node.js/Express Backend (TypeScript)
- [ ] Prisma Schema + Migrations
- [ ] Docker Compose Setup (Frontend, Backend, PostgreSQL)
- [ ] Nginx Konfiguration (Reverse Proxy + HTTPS-Hinweise)
- [ ] Client-seitige AES-256 Verschlüsselung implementiert
- [ ] Alle CRUD-Operationen funktionsfähig
- [ ] Passwort-Generator implementiert
- [ ] Kategorien-System implementiert
- [ ] Responsive UI (Mobile + Desktop)
- [ ] `README.md` mit Schritt-für-Schritt Deployment-Anleitung
---

## 14. Feature-Roadmap v2

Erweiterung des Funktionsumfangs. Die technische Detailspezifikation zu jedem Punkt
(Datenmodell, Crypto-Design, API, Migration) steht in `docs/feature-specs.md`.

### Welle 1 — Quick Wins
- [x] **1. TOTP-Codes** – 2FA-Codes im Eintrag anzeigen (RFC 6238), QR-Scan zum Hinzufügen
- [x] **2. Zwischenablage automatisch leeren** – konfigurierbar 10–60 s
- [x] **3. Favoriten & „Zuletzt verwendet"** – Stern-Markierung, neue Sortierung
- [x] **4. Command Palette** – Cmd/Ctrl+K, Suchen → Enter → kopiert
- [x] **5. Session-Details** – Gerät, Browser, gekürzte IP, letzte Aktivität
- [~] **6. Deutsche Lokalisierung** – DE/EN umschaltbar, typsichere Schlüssel

### Welle 2 — Datensicherheit
- [ ] **9. Papierkorb & Versionshistorie** – Soft Delete 30 Tage, 10 Versionen je Eintrag
- [ ] **23. Audit-Log** – nachvollziehbare Aktivitätshistorie je Nutzer
- [ ] **24. Escrow-Transparenz** – Admin-Wiederherstellung sichtbar machen, Opt-out
- [ ] **10. Ablauf-Benachrichtigungen** – Web Push bei T-30/T-7/T-0

### Welle 3 — Vault-Härtung
- [ ] **21. Verschlüsselte Metadaten** – Blind Index statt Klartextspalten
- [ ] **22. Argon2id** – KDF-Ablösung von PBKDF2, versioniertes Blob-Format

### Welle 4 — Inhalte
- [ ] **11. Weitere Eintragstypen** – SSH, Zertifikat, Notiz, Karte, WLAN, Seed, Ausweis
- [ ] **12. Verschlüsselte Datei-Anhänge** – 10 MB/Datei, eigener Datei-Schlüssel
- [ ] **7. Password-Health-Dashboard** – schwach, wiederverwendet, alt, ohne 2FA
- [ ] **8. Breach-Check (HIBP)** – k-Anonymity, zwingend opt-in
- [ ] **13. Weitere Importformate** – Bitwarden, 1Password, KeePass, LastPass, Dashlane

### Welle 5 — Zugang
- [ ] **15. Biometrisches Entsperren** – WebAuthn PRF, Capacitor Keystore/Keychain
- [ ] **14. Offline-Schreiben** – IndexedDB-Queue mit Konfliktdialog

### Welle 6 — Teilen
- [ ] **16. Eintrags-Sharing** – Nutzer-Keypair, Eintrags-Schlüssel je Eintrag
- [ ] **17. One-Time-Secret-Links** – Schlüssel im URL-Fragment, selbstzerstörend
- [ ] **20. Notfallzugriff** – Vertrauensperson mit Wartefrist

### Welle 7 — Integration
- [ ] **18. CLI + Access Tokens** – `keyvault exec` injiziert Secrets ohne stdout-Ausgabe
- [ ] **19. Browser-Extension & Android Autofill** – MV3-Extension, AutofillService

### Welle 8 — Extras
- [ ] **25. Duress-Passwort** – Köder-Tresor bei Nötigung

### Sicherheitsgrundsätze für alle neuen Features

1. Kein Secret verlässt das Gerät im Klartext – auch nicht in Benachrichtigungen, Logs
   oder Fehlermeldungen.
2. Kein Request an Dritte ohne ausdrückliche Zustimmung (§10 „keine Telemetrie").
3. Kein stiller Datenverlust: Konflikte und Überschreibungen werden erfragt, nicht geraten.
4. Jede Änderung am Blob-Format ist versioniert und abwärtskompatibel lesbar.
5. Grenzen des Schutzmodells werden in der UI benannt, nicht beschönigt.
