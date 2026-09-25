# Feature-Spezifikationen v2 — KeyVault

Technische Detailspezifikation aller 25 Roadmap-Features: Datenmodell, Crypto-Design,
API, UI und Migrationspfad.

**Aufwand:** S = < 1 Tag · M = 1–3 Tage · L = 1–2 Wochen · XL = > 2 Wochen
**Status:** ⬜ offen · 🟨 in Arbeit · ✅ fertig

---

## Wellenplanung

| Welle | Features | Ziel |
|---|---|---|
| 1 — Quick Wins 🟨 | 1, 2, 3, 4, 5, 6 | Sofort spürbarer Alltagsnutzen, keine Crypto-Änderung |
| 2 — Datensicherheit | 9, 23, 24, 10 | Kein irreversibler Datenverlust, Nachvollziehbarkeit |
| 3 — Vault-Härtung | 21, 22 | Metadaten verschlüsseln, KDF auf Stand der Technik |
| 4 — Inhalte | 11, 12, 7, 8, 13 | Mehr Typen, Anhänge, Health-Analyse, Importe |
| 5 — Zugang | 15, 14 | Biometrie, Offline-Schreiben |
| 6 — Teilen | 16, 17, 20 | Sharing, One-Time-Links, Notfallzugriff |
| 7 — Integration | 18, 19 | CLI, Browser-Extension / Android Autofill |
| 8 — Extras | 25 | Duress-Modus |

---

# Welle 1 — Quick Wins

## 1. TOTP-Codes anzeigen ✅ (M)

**Ausgangslage:** `otpAuth` wird in `frontend/src/utils/csvImport.ts` geparst und im
verschlüsselten Blob gespeichert, aber nirgends gerendert.

**Datenmodell:** Keine Änderung. `otpAuth` bleibt im verschlüsselten JSON-Blob
(`DecryptedEntry.otpAuth` ist in `frontend/src/types/index.ts` bereits deklariert).

**Algorithmus:** RFC 6238 (TOTP) auf Basis RFC 4226 (HOTP).
- Parsing von `otpauth://totp/LABEL?secret=BASE32&issuer=X&algorithm=SHA1&digits=6&period=30`
- Base32-Decode (RFC 4648, Padding optional, Grossbuchstaben-normalisiert)
- HMAC über `crypto.subtle.sign('HMAC', key, counterBytes)` — kein externes Paket nötig
- Algorithmen: SHA-1 (Default), SHA-256, SHA-512 · `digits`: 6 oder 8 · `period`: Default 30 s

**UI:**
- `TotpCode`-Komponente in der `EntryCard`: Monospace, Gruppierung `123 456`
- Countdown-Ring (SVG `stroke-dasharray`), Farbwechsel auf `warning` bei < 5 s Restlaufzeit
- Copy-Button mit eigenem Toast
- Code nur im entsperrten Zustand sichtbar
- Im `EntryForm`: Feld „Authenticator-Schlüssel (otpauth:// oder Base32)" mit Live-Validierung

**QR-Scan (Teil dieses Features):** `BarcodeDetector` wo verfügbar, sonst manuelle Eingabe.
Kamera nur on demand, Stream sofort nach Erkennung stoppen.

**Tests:** RFC-6238-Testvektoren, URI-Parser-Edgecases (fehlendes Secret, Grossschreibung,
URL-encodete Labels, `steam`-Typ ablehnen).

---

## 2. Zwischenablage automatisch leeren ✅ (S)

**Ausgangslage:** `frontend/src/hooks/useClipboard.ts` schreibt und vergisst.

**Umsetzung:**
- Parameter `clearAfterMs` (Default 30 000; Settings: 10/20/30/60 s / aus)
- Nach Ablauf `navigator.clipboard.writeText('')` — **nur** wenn der aktuelle Inhalt noch
  dem geschriebenen Wert entspricht (via `readText()`, sofern Permission vorhanden).
  Sonst würde fremd kopierter Inhalt zerstört.
- Ohne `readText()` (Firefox/Safari): überschreiben nur, wenn seit dem Kopieren kein
  weiterer Copy-Vorgang der App erfolgte
- Ein **globaler** Timer, nicht einer pro Hook-Instanz; Reset bei erneutem Kopieren
- Toast mit Countdown: „Passwort kopiert · wird in 30 s geleert"

**Settings:** `Settings.clipboardClearSecs Int @default(30)` (0 = aus)

**Bekannte Grenze:** Auf iOS Safari ist programmatisches Leeren nicht zuverlässig —
wird in der UI als Hinweis vermerkt.

---

## 3. Favoriten & „Zuletzt verwendet" ✅ (S)

```prisma
model Entry {
  isFavorite  Boolean   @default(false)
  lastUsedAt  DateTime?
  @@index([userId, isFavorite])
}
```

**API:**
- `PATCH /api/entries/:id/favorite` → `{ isFavorite: boolean }`
- `POST /api/entries/:id/used` → `lastUsedAt = now()`, feuert bei Copy/Reveal
  (fire-and-forget; Fehler werden verschluckt, darf den Copy-Flow nie blockieren)

**UI:** Stern in der `EntryCard`-Kopfzeile · Dashboard-Abschnitt „Favoriten" über dem Grid ·
neue Sortieroption `lastUsedAt` (`SortField` in `types/index.ts` erweitern).

**Datenschutz:** `lastUsedAt` ist Klartext-Metadatum und bleibt es auch nach Feature 21
(Server-Sortierung) — im Threat Model als akzeptiert dokumentieren.

---

## 4. Command Palette (Cmd/Ctrl+K) ✅ (M)

- Komponente `CommandPalette.tsx`, global im `Layout` gemountet
- Trigger `Cmd+K` / `Ctrl+K`, `Esc` schliesst
- Fuzzy-Matching über `name`, `service`, `username`, `url`, Kategorien; eigene
  Scoring-Funktion (exakter Präfix > Wortanfang > Substring > verstreute Zeichen)
- Aktionen: `Enter` Secret kopieren · `Shift+Enter` Benutzername · `Cmd+Enter` URL öffnen ·
  `→` Bearbeiten öffnen
- Globale Befehle: Neuer Eintrag, Tresor sperren, Einstellungen, Exportieren, Health-Check
- Pfeiltasten-Navigation, `aria-activedescendant`

**Performance:** Suche läuft über den geladenen `entries`-Array im Speicher, kein
Netzwerk-Roundtrip; Ergebnisliste auf 50 begrenzt.

**Tests:** Scoring-Funktion ist rein und isoliert unit-testbar.

---

## 5. Session-Details ✅ (S)

```prisma
model RefreshToken {
  userAgent     String?
  ipAddress     String?   // gekürzt: IPv4 /24, IPv6 /48
  lastActiveAt  DateTime  @default(now())
}
```

**Backend:** Beim Ausstellen (`/setup`, `/login`, OAuth-Callback) User-Agent und
**gekürzte** IP speichern (DSGVO-Datensparsamkeit). `/api/auth/refresh` aktualisiert
`lastActiveAt`. `GET /api/auth/sessions` liefert die Felder und markiert `isCurrent`
anhand des Cookie-Tokens.

**UI:** Geräte-Icon (Desktop/Mobile/Tablet), Browser + OS, gekürzte IP, „zuletzt aktiv
vor X", Badge „Dieses Gerät". Die aktuelle Session ist nicht widerrufbar (stattdessen
„Abmelden").

**Parsing:** Minimaler eigener UA-Parser (~40 Zeilen Regex) statt Fremdlibrary — der
UA-String ist ohnehin nur ein Anhaltspunkt.

---

## 6. Deutsche Lokalisierung (i18n) 🟨 (M)

**Architektur:** Kein `i18next` — für zwei Sprachen genügt ein kleiner Provider.
- `frontend/src/i18n/{de,en}.ts` — flache Key-Value-Objekte
- `frontend/src/i18n/index.tsx` — `I18nProvider` + `useT()`
- Typisierung: `en.ts` definiert den Schlüsseltyp, `de.ts` wird dagegen geprüft
  (`Record<keyof typeof en, string>`) → fehlende Übersetzungen sind Compile-Fehler
- Interpolation `t('entries.deleteConfirm', { name })`
- Plural über `_one`/`_other`-Suffix

**Sprachwahl:** `Settings.locale String @default("de")`, Erstwert aus `navigator.language`.
Fallback: gewählte Sprache → Englisch → Schlüsselname.

**Umfang:** Alle Strings in `pages/`, `components/`, alle Toasts. Backend-Fehler bleiben
technische Codes; das Frontend mappt sie auf lokalisierte Texte.

**Zusatz:** Datums-/Zahlformatierung über `Intl.DateTimeFormat` und
`Intl.RelativeTimeFormat` mit aktiver Locale statt `toLocaleDateString()` ohne Argument.

**Stand:** Infrastruktur fertig und getestet; umgestellt sind `Layout`, `Dashboard`,
`SearchBar`, `CategoryFilter`, `EntryCard`, `EntryForm`, `TotpCode`, `CommandPalette`,
`useClipboard` und `SettingsPage`. **Noch offen:** `LoginPage`, `LockScreen`, `SetupPage`,
`InvitePage`, `AdminPage`, `DownloadsPage`, `ImportWizard`, `PasswordGenerator`,
`OAuthCallbackPage` — diese Seiten sind weiterhin englisch. Die Schlüssel dafür fehlen
noch in `en.ts`/`de.ts`.

---

# Welle 2 — Datensicherheit

## 9. Papierkorb & Versionshistorie ⬜ (M)

```prisma
model Entry {
  deletedAt DateTime?
  @@index([userId, deletedAt])
}

model EntryVersion {
  id            String    @id @default(uuid())
  entryId       String
  encryptedData String    // Snapshot VOR der Änderung
  name          String
  service       String?
  username      String?
  url           String?
  note          String?
  expiresAt     DateTime?
  createdAt     DateTime  @default(now())
  entry         Entry     @relation(fields: [entryId], references: [id], onDelete: Cascade)
  @@index([entryId, createdAt])
}
```

**Regeln:**
- `PUT /api/entries/:id` sichert den bisherigen Zustand — nur wenn sich `encryptedData`
  oder ein Metadatenfeld tatsächlich geändert hat
- Max. 10 Versionen pro Eintrag, älteste in derselben Transaktion löschen
- `DELETE` setzt `deletedAt` (Soft Delete); alle Lese-Endpunkte filtern `deletedAt: null`
- Hartes Löschen nach 30 Tagen über einen Lazy-Job beim ersten `GET /api/entries` pro
  Tag und Nutzer (kein Cron nötig, hält das Deployment einfach)

**API:** `GET /api/entries/trash` · `POST /api/entries/:id/restore` ·
`DELETE /api/entries/:id/permanent` · `GET /api/entries/:id/versions` ·
`POST /api/entries/:id/versions/:versionId/restore`

**Achtung Re-Verschlüsselung:** Beim Passwortwechsel und bei der Vault-Migration müssen
`EntryVersion.encryptedData` **mit** re-verschlüsselt werden — sonst sind alte Versionen
danach unlesbar. Betrifft `PUT /api/auth/password` und `POST /api/auth/migrate-vault`.

**UI:** Papierkorb als Dashboard-Filter-Tab; Versionshistorie aufklappbar im `EntryForm`
mit Diff pro Feld (Secrets nur maskiert vergleichen).

---

## 23. Audit-Log ⬜ (M)

```prisma
model AuditEvent {
  id        String   @id @default(uuid())
  userId    String   // betroffener Nutzer
  actorId   String   // handelnder Nutzer (bei Admin-Aktionen abweichend)
  action    String
  entryId   String?
  entryName String?  // Snapshot, überlebt das Löschen des Eintrags
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
  @@index([actorId, createdAt])
}
```

**Aktionskatalog:** `auth.login`, `auth.login_failed`, `auth.logout`,
`auth.password_changed`, `auth.session_revoked`, `entry.created`, `entry.updated`,
`entry.deleted`, `entry.restored`, `entry.revealed`, `entry.copied`, `entry.shared`,
`export.created`, `import.executed`, `admin.user_deleted`, `admin.password_reset`,
`admin.invite_created`, `vault.unlocked`, `vault.locked`

**Wichtig:** `entry.revealed` / `entry.copied` werden client-seitig ausgelöst,
gebündelt alle 5 s, fire-and-forget. Sie dürfen den Copy-Vorgang nie verzögern oder
bei Fehler blockieren.

**Retention:** 180 Tage, konfigurierbar; Aufräumen im selben Lazy-Job wie der Papierkorb.

**UI:** Seite `/activity` mit Filter nach Aktion/Zeitraum/Eintrag. Admins sehen zusätzlich
alle Nutzer. Admin-Aktionen an fremden Vaults erscheinen **immer auch im Log des
betroffenen Nutzers** — das ist der Kern von Feature 24.

---

## 24. Transparenz beim Admin-Escrow ⬜ (S)

**Ausgangslage:** `frontend/src/hooks/useAuth.ts` hinterlegt den Vault-Key still mit dem
Admin-Public-Key (`adminEncryptedVaultKey`). Nutzer erfahren davon nichts.

**Umsetzung:**
- Settings-Abschnitt „Notfall-Wiederherstellung" mit Klartext-Erklärung: *„Ein
  Administrator kann dein Master-Passwort zurücksetzen, ohne dass deine Daten verloren
  gehen. Dafür ist eine mit dem Administrator-Schlüssel verschlüsselte Kopie deines
  Tresor-Schlüssels hinterlegt. Jede Verwendung erscheint in deinem Aktivitätsprotokoll."*
- Status: aktiv / nicht hinterlegt, mit Zeitpunkt
- **Opt-out** mit doppelter Bestätigung und klarer Warnung („Bei Verlust des
  Master-Passworts sind alle Daten unwiederbringlich verloren") → `adminEncryptedVaultKey = null`
- `POST /api/auth/escrow/opt-out` und `/opt-in`
- Jeder Admin-Reset schreibt `admin.password_reset` ins Log **des betroffenen Nutzers**
  und löst (falls Push aktiv, Feature 10) eine Benachrichtigung aus

**Setup-Flow:** Beim ersten Login einmalig als Dialog „Verstanden" / „Nicht hinterlegen".

---

## 10. Ablauf-Benachrichtigungen ⬜ (M)

```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
}

model NotificationLog {
  id      String   @id @default(uuid())
  entryId String
  kind    String   // "expiry_30" | "expiry_7" | "expiry_0"
  sentAt  DateTime @default(now())
  @@unique([entryId, kind])
}
```

**Technik:** Web Push (VAPID) via `web-push`. Der Service Worker kommt aus
`vite-plugin-pwa` und braucht eigene `push`/`notificationclick`-Behandlung →
Umstellung von `generateSW` auf `injectManifest`.

**Versand:** Täglicher Check. Ohne Scheduler: Lazy-Trigger beim ersten API-Zugriff des
Tages, plus optionaler `docker-compose`-Sidecar mit `cron` für Nutzer, die sich tagelang
nicht einloggen. `NotificationLog` verhindert Doppelversand.

**Inhalt:** Nur der Eintragsname, **niemals** das Secret. Nach Feature 21 steht auch der
Name nicht mehr im Klartext zur Verfügung → dann generisch „1 Zugang läuft in 7 Tagen ab",
Details erst nach dem Entsperren. Diese Abhängigkeit bestimmt die Reihenfolge.

**Fallback E-Mail:** Optional per SMTP, gleiche Inhaltsregel.

---

# Welle 3 — Vault-Härtung

## 21. Verschlüsselte Metadaten + Blind Index ⬜ (L)

**Problem:** `name`, `service`, `username`, `url`, `note` liegen im Klartext in `entries`
(`backend/prisma/schema.prisma`). Ein DB-Dump offenbart das komplette Kontenverzeichnis.
Das widerspricht der Zusage in README und `requirements.md`.

**Zielzustand:** Alle inhaltlichen Felder wandern in den Blob. In der Tabelle verbleiben:
`id`, `userId`, `type`, `createdAt`, `updatedAt`, `expiresAt`, `isFavorite`,
`lastUsedAt`, `encryptedData`, `searchTokens`. `type` und `expiresAt` bleiben bewusst
Klartext (Sortierung, Ablauf-Jobs) — als akzeptiertes Restrisiko dokumentiert.

**Blind Index:**
```
indexKey  = HKDF-SHA256(vaultKey, info = "keyvault-blind-index-v1")
token(w)  = base64url( HMAC-SHA256(indexKey, normalize(w)) )[0..15]   // 12 Byte gekürzt
normalize = NFKC → lowercase → Diakritika entfernen → Nicht-Alphanumerik trimmen
```
- Tokens aus: allen Wörtern (≥ 2 Zeichen) von `name`, `service`, `username`, Host der
  `url`, Kategorienamen — **plus alle Präfixe ab Länge 2**, damit Präfixsuche funktioniert
- Speicherung `searchTokens String[]` mit GIN-Index
- Suche: Client tokenisiert den Suchbegriff mit demselben Schlüssel, Server filtert
  `searchTokens hasEvery [...]` und sieht nur HMACs
- `note` wird **nicht** indiziert (zu viel Leakage über Worthäufigkeiten); Notizsuche
  läuft rein client-seitig über die geladenen Einträge

**Bewusste Restrisiken:** Angreifer mit DB-Zugriff sieht die Token-Anzahl (≈ Länge der
Metadaten) und kann gleiche Werte über Einträge korrelieren (deterministischer Index).
Ein Wörterbuchangriff scheitert ohne `vaultKey`.

**Migration** (`20xx_encrypt_metadata`):
1. Spalte `searchTokens` hinzufügen, alte Spalten **nicht** löschen
2. Client-seitige Migration analog `runVaultMigration` in `useAuth.ts`: beim nächsten
   Unlock alle Einträge laden, Metadaten in den Blob schreiben, Tokens berechnen,
   per Bulk-Endpunkt zurückschreiben
3. Erst wenn `User.metadataEncryptedAt` gesetzt ist, liefert der Server die alten
   Klartextspalten nicht mehr aus
4. Folge-Migration löscht die Spalten, sobald alle Nutzer migriert sind
   (Fortschritt in der Admin-Oberfläche sichtbar)

**Betroffen:** `entries.ts` (Suche), `transfer.ts` (Export/Import), `csvImport.ts`
(Merge-Keys), Dashboard-Filter, Admin-Statistiken.

---

## 22. Argon2id statt PBKDF2 ⬜ (M)

**Ausgangslage:** PBKDF2-SHA256 mit 100 000 Iterationen (`frontend/src/utils/crypto.ts`)
— unter der OWASP-Empfehlung von 600 000.

**Ziel:** Argon2id via WASM (`hash-wasm` — kleiner als `argon2-browser`, keine
Emscripten-Laufzeit).

**Parameter:** Desktop `m = 64 MiB, t = 3, p = 1`, 32 Byte Output. Mobil `m = 32 MiB`,
damit iOS-Safari nicht abstürzt. Die Parameter werden **im Blob mitgespeichert**, nicht geraten.

**Versioniertes Blob-Format** (heute: `salt(32) || iv(12) || ciphertext`, ohne Kennung):
```
magic "KV"(2) | version(1) | kdfId(1) | params(variabel) | salt(32) | iv(12) | ciphertext
kdfId: 1 = PBKDF2-SHA256-100k (Legacy), 2 = Argon2id
```
`decryptData` erkennt Legacy-Blobs am fehlenden Magic; da Legacy mit zufälligem Salt
beginnt, zusätzlich Längen-/Plausibilitätsprüfung — im Zweifel erst v2, dann Legacy versuchen.

**Migration:** Transparent beim nächsten Unlock. Da der Vault-Key bereits eine
Indirektionsebene ist (`wrapVaultKey`), muss **nur der Wrapper** neu berechnet werden,
nicht alle Einträge → ein einziger `PUT /api/auth/vault-key`. Das macht die Migration billig.

**UX:** Argon2id mit 64 MiB braucht ~0,5–1 s. Ableitung läuft in einem Web Worker,
Unlock-Screen bekommt Spinner mit Fortschrittstext.

---

# Welle 4 — Inhalte

## 11. Weitere Eintragstypen ⬜ (L)

```prisma
enum EntryType {
  API_KEY
  ACCOUNT
  SSH_KEY
  CERTIFICATE
  SECURE_NOTE
  CREDIT_CARD
  WIFI
  SEED_PHRASE
  IDENTITY
}
```

| Typ | Felder (sensible Felder im Blob) |
|---|---|
| `SSH_KEY` | Privater Schlüssel, öffentlicher Schlüssel, Passphrase, Fingerprint, Host, Kommentar |
| `CERTIFICATE` | Zertifikat (PEM), privater Schlüssel, Kette, Aussteller, Gültig-bis (→ `expiresAt`) |
| `SECURE_NOTE` | Freitext (Markdown) |
| `CREDIT_CARD` | Karteninhaber, Nummer, Ablauf, CVC, PIN, Bank, Kartentyp |
| `WIFI` | SSID, Passwort, Verschlüsselungsart, versteckt ja/nein |
| `SEED_PHRASE` | Wortliste (12/18/24), Wallet-Typ, Derivation Path, Passphrase |
| `IDENTITY` | Name, Geburtsdatum, Ausweisnummer, Gültig-bis, ausstellende Behörde |

**Architektur:** Statt `EntryForm` weiter aufzublähen, ein deklaratives Feldschema:
```ts
// frontend/src/entryTypes/index.ts
interface FieldDef {
  key: string;
  labelKey: string;                 // i18n-Schlüssel
  kind: 'text' | 'password' | 'textarea' | 'date' | 'select' | 'wordlist';
  sensitive: boolean;               // → wandert in den Blob
  required?: boolean;
  options?: string[];
  validate?: (v: string) => string | null;
}
type EntryTypeDef = { type: EntryType; icon: string; fields: FieldDef[] };
```
`EntryForm` und `EntryCard` rendern generisch. Damit wird Typ 10–15 später eine reine
Datenänderung.

**Spezialfunktionen:** `SEED_PHRASE` Wortgrid mit BIP-39-Validierung · `WIFI`
QR-Generierung (`WIFI:T:WPA;S:ssid;P:pass;;`) · `CREDIT_CARD` Luhn-Prüfung und
BIN-Kartentyperkennung · `SSH_KEY` Fingerprint (SHA-256/Base64) aus dem Public Key.

---

## 12. Verschlüsselte Datei-Anhänge ⬜ (L)

```prisma
model Attachment {
  id         String   @id @default(uuid())
  entryId    String
  userId     String
  filename   String   // verschlüsselt
  mimeType   String   // verschlüsselt
  sizeBytes  Int      // Klartext (Quota)
  storageKey String   @unique
  createdAt  DateTime @default(now())
  @@index([entryId])
}
```

**Crypto:** Datei client-seitig mit einem **eigenen** zufälligen 256-Bit-Schlüssel
AES-GCM-verschlüsselt; dieser Datei-Schlüssel wird mit dem Vault-Key gewrappt und im
Blob des Eintrags abgelegt. Vorteil: Beim Teilen (Feature 16) muss nur der Datei-Schlüssel
neu gewrappt werden, nicht die Datei.

**Speicherung:** Volume `./data/attachments/<storageKey>`, nicht in Postgres (BLOBs
erschweren Backups). `storageKey` ist eine zufällige UUID ohne Bezug zum Dateinamen.

**Limits:** 10 MB/Datei, 100 MB/Nutzer, max. 20 Anhänge/Eintrag. Upload per
`multipart/form-data` mit `busboy`-Streaming (kein Buffern im Speicher).

**Chunking:** Dateien > 2 MB werden client-seitig in 1-MB-Chunks mit eigenem IV
verschlüsselt: `chunkCount(4) || [iv(12) || len(4) || ciphertext]*`

**UI:** Drag & Drop im `EntryForm`, Vorschau für Bilder/PDF nach dem Entschlüsseln
(Blob-URL, sofort nach dem Schliessen widerrufen).

---

## 7. Password-Health-Dashboard ⬜ (M)

**Vollständig client-seitig** — kein Secret verlässt das Gerät.

| Prüfung | Kriterium | Schwere |
|---|---|---|
| Schwach | zxcvbn-Score ≤ 1 | hoch |
| Mittelmässig | zxcvbn-Score = 2 | mittel |
| Wiederverwendet | identisches Passwort in ≥ 2 Einträgen | hoch |
| Ähnlich | Levenshtein-Distanz ≤ 2 zu einem anderen Passwort | niedrig |
| Alt | `updatedAt` älter als 365 Tage | mittel |
| Ohne 2FA | `ACCOUNT` ohne `otpAuth`, obwohl der Dienst 2FA anbietet\* | niedrig |
| Abgelaufen | `expiresAt` in der Vergangenheit | hoch |
| Kompromittiert | HIBP-Treffer (Feature 8) | kritisch |

\* Statische Liste `frontend/src/data/2fa-directory.json` (abgeleitet aus 2fa.directory) —
kein Netzwerkzugriff.

**Score:** 0–100, gewichtet nach Schwere, Trendanzeige über den letzten Wert in `localStorage`.

**Performance:** zxcvbn braucht ~10–30 ms pro Passwort. Ab 100 Einträgen Web Worker mit
Fortschrittsbalken; Ergebnisse für die Session cachen, Invalidierung bei Eintragsänderung.

**UI:** Seite `/health` mit Score-Ring, gruppierten Befunden, Direktsprung zum Bearbeiten.
Kritische Befunde zusätzlich als Dashboard-Badge.

---

## 8. Breach-Check via HIBP ⬜ (S)

**Protokoll (k-Anonymity):** `SHA-1(passwort)` → Hex/Uppercase → die ersten **5** Zeichen
an `https://api.pwnedpasswords.com/range/{prefix}` → Abgleich der Suffixliste lokal.
Weder Passwort noch vollständiger Hash verlassen das Gerät.

**Zwingend opt-in** (`Settings.breachCheckEnabled Boolean @default(false)`) mit
Erklärungstext. Solange aus, erfolgt **kein** Drittanbieter-Request — das ist die Zusage
aus `requirements.md` §10 („keine Telemetrie").

**Details:** Header `Add-Padding: true` (HIBP füllt die Antwort auf, damit die
Antwortgrösse nichts verrät) · Ergebnisse 7 Tage in `localStorage` cachen (Key =
Hash-Präfix) · max. 10 parallele Abfragen · Fehler still verschlucken · läuft als Teil
von Feature 7.

**CSP:** `connectSrc` in `backend/src/index.ts` muss `https://api.pwnedpasswords.com`
erlauben — dokumentiert als bewusste Ausnahme.

---

## 13. Weitere Import-/Export-Formate ⬜ (M)

**Basis:** `frontend/src/utils/csvImport.ts` ist bereits sauber getrennt (reine
Funktionen, crypto-frei). Erweiterung um ein Adapter-Register:

```ts
interface ImportAdapter {
  id: 'apple' | 'chrome' | 'bitwarden' | 'onepassword' | 'keepass' | 'lastpass' | 'dashlane';
  detect: (raw: string) => boolean;
  parse: (raw: string) => CsvCredential[];
}
```

| Format | Quelle | Besonderheit |
|---|---|---|
| Bitwarden | JSON (unverschlüsselt) | Ordner → Kategorien, `login.totp` → `otpAuth`, Custom Fields → Notiz |
| 1Password | 1PUX (ZIP+JSON) oder CSV | 1PUX enthält Anhänge → mit Feature 12 verknüpfen |
| KeePass | XML (KDBX-Export) | Gruppenbaum → Kategorien, Binaries → Anhänge |
| LastPass | CSV | `grouping` → Kategorie, `extra` → Notiz |
| Dashlane | CSV (mehrere Dateien) | getrennte Dateien für Logins/Notes/Cards |

**Export:** Umgekehrt für Bitwarden-JSON und generisches CSV, jeweils mit derselben
doppelten Bestätigung wie der bestehende Klartext-Export.

**Sicherheit:** Regel aus `csvImport.ts` beibehalten — Rohdaten nie in persistenten State,
Referenzen nach dem Import verwerfen, kein Logging der Zeileninhalte.

---

# Welle 5 — Zugang

## 15. Biometrisches Entsperren ⬜ (L)

**Web (WebAuthn + PRF-Extension):**
```
1. Registrierung: navigator.credentials.create({ publicKey: {
     ..., extensions: { prf: { eval: { first: <32-Byte-Salt> } } } } })
2. Unlock:        navigator.credentials.get({ ..., extensions: { prf: ... } })
                  → results.first = 32 Byte, gerätegebunden, reproduzierbar
3. biometricKey = HKDF-SHA256(prfOutput, info = "keyvault-biometric-v1")
4. wrappedVaultKey = AES-GCM(biometricKey, vaultKey)
```

```prisma
model BiometricCredential {
  id              String    @id @default(uuid())
  userId          String
  credentialId    String    @unique
  publicKey       String
  prfSalt         String
  wrappedVaultKey String
  deviceName      String
  createdAt       DateTime  @default(now())
  lastUsedAt      DateTime?
}
```

**Wichtig:** Das Master-Passwort bleibt der alleinige Wiederherstellungsweg. Biometrie ist
ein **zusätzlicher** Wrapper, kein Ersatz. Beim Passwortwechsel müssen die
`wrappedVaultKey` **nicht** angefasst werden, da der Vault-Key unverändert bleibt —
ein Vorteil der bestehenden Architektur.

**Fallback ohne PRF** (ältere Browser, iOS < 18): WebAuthn nur zur Authentisierung,
Vault-Key im `localStorage` mit einem in der Credential hinterlegten Zufallsschlüssel
gewrappt. Schwächer → als solches gekennzeichnet und opt-in.

**Capacitor:** `@capacitor-community/biometric-auth` + Keystore/Keychain-gebundener
Schlüssel, gleiche Wrapper-Logik. Plattformweiche in `frontend/src/utils/biometric.ts`.

**UI:** Nach dem Unlock einmalig „Face ID / Fingerabdruck einrichten?"; im Lock-Screen
grosser Biometrie-Button, Passwort als „Anderes Verfahren". Settings: Geräteliste mit
Einzel-Widerruf.

---

## 14. Offline-Schreiben ⬜ (L)

**Ausgangslage:** Laut `requirements.md` §5 bewusst read-only.

**Architektur:**
- IndexedDB-Store `pendingOps` (via `idb`):
  `{ id, op: 'create'|'update'|'delete', entryId, payload, createdAt, baseUpdatedAt }`
- Alle Schreibzugriffe laufen über eine `syncQueue`-Schicht statt direkt über `api`
- Optimistisches Update im lokalen State, Badge „ausstehend"
- Sync bei `online`-Event und App-Start, sequenziell in Erstellungsreihenfolge

**Konfliktstrategie:** Server-`updatedAt` dient als Version.
- `baseUpdatedAt` stimmt → anwenden
- Abweichung → Konflikt. Der Server kann verschlüsselte Inhalte nicht mergen; der Client
  entschlüsselt beide Fassungen und zeigt einen Dialog („Lokale behalten / Server behalten
  / beide als zwei Einträge"). **Kein** automatisches Überschreiben — bei Passwörtern ist
  stiller Datenverlust inakzeptabel.
- `DELETE` auf zwischenzeitlich geänderte Einträge → ebenfalls Rückfrage

**Offline-Lesen:** Entschlüsselte Einträge werden **nicht** persistiert; persistiert wird
der verschlüsselte Blob in IndexedDB, entschlüsselt wird bei jedem Start neu.

**Service Worker:** `runtimeCaching` in `frontend/vite.config.ts` um `NetworkFirst` für
`GET /api/entries` erweitern.

---

# Welle 6 — Teilen

## 16. Eintrags-Sharing zwischen Nutzern ⬜ (L)

**Basis:** Die RSA-OAEP-Infrastruktur existiert bereits für den Admin-Escrow
(`encryptVaultKeyForAdmin` / `decryptVaultKeyWithAdminKey` in `crypto.ts`) und wird zu
einem allgemeinen Nutzer-Keypair verallgemeinert.

```prisma
model User {
  publicKey           String?   // RSA-OAEP 2048 JWK
  privateKeyEncrypted String?   // mit dem Vault-Key verschlüsselt
}

model EntryShare {
  id                String    @id @default(uuid())
  entryId           String
  ownerId           String
  recipientId       String
  encryptedEntryKey String    // Eintrags-Key, mit Empfänger-Public-Key verschlüsselt
  permission        String    // "read" | "write"
  createdAt         DateTime  @default(now())
  acceptedAt        DateTime?
  revokedAt         DateTime?
  @@unique([entryId, recipientId])
}
```

**Schlüsselhierarchie (Änderung gegenüber heute):** Heute wird jeder Eintrag direkt mit
dem Vault-Key verschlüsselt. Für Sharing braucht jeder Eintrag einen **eigenen** Schlüssel:
```
entryKey        = 32 zufällige Byte
encryptedData   = AES-GCM(entryKey, plaintext)
wrappedEntryKey = AES-GCM(vaultKey, entryKey)        // im Blob-Header des Eigentümers
shareKey        = RSA-OAEP(recipientPublicKey, entryKey)
```
Das ist eine **Blob-Formatänderung** und wird deshalb mit Feature 22 zusammen geplant.

**Widerruf:** `revokedAt` entzieht den Zugriff, aber der Empfänger kann den `entryKey`
bereits kennen. Ehrliche Formulierung in der UI: *„Der Zugriff wird entzogen. Bereits
eingesehene Passwörter sollten dennoch geändert werden."* Optional: bei Widerruf
automatisch eine Passwortrotation vorschlagen.

**UI:** „Teilen"-Dialog mit Nutzersuche (nur Nutzer derselben Instanz),
Berechtigungswahl; geteilte Einträge mit Besitzer-Badge und eigenem Filter.

---

## 17. One-Time-Secret-Links ⬜ (M)

```prisma
model SecretLink {
  id            String    @id @default(uuid())
  token         String    @unique   // 32 Byte base64url
  userId        String
  encryptedData String              // mit dem Fragment-Key verschlüsselt
  maxViews      Int       @default(1)
  viewCount     Int       @default(0)
  expiresAt     DateTime
  createdAt     DateTime  @default(now())
  burnedAt      DateTime?
}
```

**Ablauf:**
1. Client erzeugt zufälligen 256-Bit `linkKey` und verschlüsselt den Inhalt damit
2. Nur das Chiffrat geht an den Server, Rückgabe: `token`
3. Link `https://host/s/{token}#{base64url(linkKey)}` — der Key steht im **Fragment**
   und wird vom Browser nie mitgesendet
4. `GET /api/secret-links/:token` liefert das Chiffrat und erhöht `viewCount` in derselben
   Transaktion; bei `viewCount >= maxViews` wird `encryptedData` sofort überschrieben
   und `burnedAt` gesetzt
5. Entschlüsselung client-seitig aus dem Fragment

**Schutzmassnahmen:** strenges Rate Limit auf dem Abruf · Ablauf max. 7 Tage, Default 24 h ·
öffentliche Seite `/s/:token` ohne Auth und ohne App-Shell, mit **explizitem
„Jetzt anzeigen"-Klick** (verhindert, dass Link-Vorschauen von Slack/WhatsApp das Secret
verbrennen) · `X-Robots-Tag: noindex`, kein Referrer.

---

## 20. Notfallzugriff (Emergency Access) ⬜ (L)

```prisma
model EmergencyContact {
  id                String    @id @default(uuid())
  grantorId         String
  granteeId         String
  encryptedVaultKey String    // mit Grantee-Public-Key verschlüsselt
  waitingDays       Int       @default(7)
  status            String    // "invited"|"accepted"|"requested"|"granted"|"rejected"
  requestedAt       DateTime?
  grantedAt         DateTime?
  createdAt         DateTime  @default(now())
  @@unique([grantorId, granteeId])
}
```

**Ablauf:** Einladung → Annahme → im Ernstfall Antrag des Kontakts → Benachrichtigung an
den Eigentümer (Push + E-Mail) → Wartefrist läuft → Eigentümer kann jederzeit ablehnen →
nach Ablauf gibt der Server den `encryptedVaultKey` frei.

**Voraussetzung:** Nutzer-Keypair aus Feature 16.

**Kritisch und offen zu kommunizieren:** Die Wartefrist wird serverseitig durchgesetzt.
Ein kompromittierter Server könnte sie überspringen — das ist die Grenze des Modells und
gehört in die UI. Wer das nicht akzeptiert, lässt das Feature aus.

---

# Welle 7 — Integration

## 18. CLI + Scoped Access Tokens ⬜ (L)

**Motivation:** Secrets in Skripten verwenden, **ohne** sie auf stdout zu schreiben.

```prisma
model AccessToken {
  id              String    @id @default(uuid())
  userId          String
  name            String
  tokenHash       String    @unique   // SHA-256 des Tokens
  scopes          String[]            // ["entries:read"] etc.
  categoryIds     String[]            // leer = alle
  wrappedVaultKey String?             // mit CLI-Passphrase gewrappt
  expiresAt       DateTime?
  lastUsedAt      DateTime?
  createdAt       DateTime  @default(now())
  revokedAt       DateTime?
}
```

**Schlüsselproblem:** Headless-Zugriff braucht den Vault-Key. Zwei wählbare Wege:
- **a) CLI-Passphrase** (empfohlen): eigene Passphrase beim Anlegen des Tokens, damit wird
  eine weitere Kopie des Vault-Keys gewrappt. Die CLI fragt sie einmal ab und hält sie im
  OS-Keychain.
- **b) Agent-Modus:** `keyvault agent` hält den Vault-Key im Speicher, CLI-Aufrufe
  sprechen über Unix-Socket / Named Pipe mit ihm; begrenzte Lebensdauer.

**Kommandos:**
```
keyvault login
keyvault list [--type api_key]
keyvault get <name> [--field password]      # nur mit --print auf stdout
keyvault exec <name...> -- <cmd>            # injiziert als Env-Var, NIE auf stdout
keyvault env <name...>                      # export-Zeilen, explizit gewollt
keyvault set <name> --stdin
keyvault rotate <name>
```

**Verbindliche Sicherheitsregeln der CLI:**
- `get` ohne `--print` kopiert in die Zwischenablage statt zu drucken
- `exec` schreibt Secrets ausschliesslich in die Umgebung des Kindprozesses
- Kein Secret in Logs, Fehlermeldungen oder Stacktraces — auch nicht maskiert
- Keine Secrets als Kommandozeilenargument (sichtbar in `ps`)
- Interaktive Eingaben über TTY, nicht als Argument (Shell-History)

**Paket:** `cli/` als eigenes npm-Workspace, Node ≥ 20, publiziert als `@keyvault/cli`.
Die Crypto-Funktionen aus `frontend/src/utils/crypto.ts` wandern in ein gemeinsames
`shared/crypto`-Paket (Web Crypto ist in Node 20 verfügbar).

---

## 19. Browser-Extension & Android Autofill ⬜ (XL)

**19a — Browser-Extension (Manifest V3)**
- Eigenes Paket `extension/`, Vite-Build mit `@crxjs/vite-plugin`
- Vault-Key lebt im Service Worker der Extension (Speicher, nie `chrome.storage`)
- Content Script erkennt Login-Formulare heuristisch (`type=password` + vorangehendes
  Text-/E-Mail-Feld), bietet Overlay mit passenden Einträgen
- Matching über Registrable Domain (Public Suffix List), nicht über den vollen Host
- Speichern-Dialog nach erfolgreichem Login mit neuem Passwort
- Kommunikation über dieselbe REST-API mit eigenem Access Token
- **Keine** `<all_urls>`-Permission ohne Not: `activeTab` + optionale Host-Permissions

**19b — Android Autofill Service (realistische Zwischenstufe)**
- Der Android-Build existiert bereits (`.github/workflows/android-build.yml`)
- Eigenes Capacitor-Plugin mit `AutofillService` (Android 8+)
- `Dataset`-Antworten aus dem entsperrten Vault im Speicher
- Biometrie-Gate vor jedem Ausfüllen (baut auf Feature 15 auf)
- Deutlich weniger Aufwand als die Extension, hoher Nutzen genau dort, wo Tippen am
  meisten stört

**19c — iOS Credential Provider**
- `ASCredentialProviderExtension`, native Extension im Xcode-Projekt
- Apple Developer Account nötig (laut Commit-Historie noch nicht vorhanden) → zuletzt

---

# Welle 8 — Extras

## 25. Duress-Passwort / Panikmodus ⬜ (M)

```prisma
model User {
  duressPasswordHash String?
  duressVaultKey     String?   // eigener Vault-Key, mit dem Duress-Passwort gewrappt
}
model Entry {
  vaultScope String @default("primary")   // "primary" | "duress"
}
```

- Login prüft erst `passwordHash`, dann `duressPasswordHash`
- Bei Duress-Treffer normaler Token mit `scope: "duress"` im JWT; alle Entry-Endpunkte
  filtern entsprechend
- Der Server verhält sich **identisch**: keine abweichenden Fehlercodes, keine
  abweichenden Antwortzeiten (Timing!), kein Logeintrag, der den Modus verrät
- Optional: stiller Alarm (unauffällig benanntes Audit-Event, Push an ein Zweitgerät)

**Ehrliche Einordnung:** Gegen einen Angreifer mit Server- oder DB-Zugriff ist der
Köder-Tresor erkennbar (zwei Hash-Spalten, zwei Scopes). Das Feature schützt gegen
Nötigung am Gerät, nicht gegen forensische Analyse — daher am Ende der Liste.

---

# Querschnitt: Auswirkungen auf Bestehendes

| Bestehende Funktion | Betroffen durch | Was zu tun ist |
|---|---|---|
| `PUT /api/auth/password` | 9, 12, 16 | Versionen, Datei-Keys und Share-Keys mit re-verschlüsseln |
| `runVaultMigration` | 21, 22 | Migrationsketten dürfen sich nicht überschneiden — Versionsfeld am User |
| CSV-Import-Merge | 21 | Merge-Keys aus verschlüsselten Metadaten bilden |
| Export/Import JSON | 9, 11, 12, 21 | Exportformat-Version anheben, Anhänge einbeziehen |
| Admin-Statistiken | 21 | Zählungen ohne Klartextzugriff |
| Service Worker | 10, 14 | `injectManifest` statt `generateSW` |
| Blob-Format | 16, 22 | **Gemeinsam** planen — beide ändern das Format |

---

# Reihenfolge-Abhängigkeiten

```
1  TOTP ─────────────────► eigenständig
2  Clipboard ────────────► eigenständig
3  Favoriten ────────────► eigenständig
5  Sessions ─────────────► eigenständig
6  i18n ─────────────────► VOR 4, 7, 11 (neue Strings)
4  Command Palette ──────► nach 6
9  Papierkorb ───────────► eigenständig
23 Audit-Log ────────────► vor 24
24 Escrow-Transparenz ───► nach 23
22 Argon2 ──┬────────────► Blob-Format v2:
16 Sharing ─┘              gemeinsam planen
21 Metadaten ────────────► vor 10 (Benachrichtigungsinhalte)
10 Push ─────────────────► nach 21
7  Health ───────────────► vor 8
8  HIBP ─────────────────► nach 7
11 Typen ────────────────► vor 13 (Importe brauchen Zieltypen)
12 Anhänge ──────────────► vor 13 (1PUX/KeePass-Binaries)
15 Biometrie ────────────► vor 19b (Autofill-Gate)
16 Sharing ──────────────► vor 20 (Keypair)
18 CLI ──────────────────► braucht shared/crypto-Paket
```
