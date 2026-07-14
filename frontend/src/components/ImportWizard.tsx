import React, { useRef, useState } from 'react';
import { X, Upload, ChevronDown, AlertTriangle, CheckCircle2, Plus, RefreshCw, KeyRound } from 'lucide-react';
import { useCsvImport, ImportAbortedError, ImportUploadError, type AnalyzeSummary, type ImportProgress, type ImportResult } from '../hooks/useCsvImport';
import { CsvImportError, MAX_CSV_FILE_BYTES, MAX_CSV_ROWS } from '../utils/csvImport';

interface ImportWizardProps {
  onClose: () => void;
  onDone: () => void;
}

type Step = 'pick' | 'analyzing' | 'preview' | 'running' | 'done';

const ERROR_MESSAGES: Record<string, string> = {
  'json-file': 'This looks like a JSON backup. Use the regular Import button for JSON exports.',
  'unknown-format': 'Unrecognized CSV format. Expected an Apple Passwords or Google/Chrome password export.',
  'empty-file': 'The selected file is empty.',
  'too-many-rows': `Too many rows — the import supports up to ${MAX_CSV_ROWS} passwords per file.`,
  'vault-locked': 'The vault locked itself — import cancelled. Unlock and try again.',
  'file-too-large': 'File is larger than 5 MB. Password exports are normally much smaller — is this the right file?',
};

const GENERIC_ERROR = 'Import failed. Nothing was changed in your vault — please try again.';

function errorMessage(err: unknown): string {
  if (err instanceof CsvImportError) return ERROR_MESSAGES[err.code] ?? GENERIC_ERROR;
  if (err instanceof ImportAbortedError) return ERROR_MESSAGES[err.reason] ?? 'Import cancelled.';
  if (err instanceof ImportUploadError) {
    return err.partial
      ? `Upload failed after ${err.created + err.updated} entries were already imported. `
        + 'Select the CSV file again to continue — entries that already made it will be skipped automatically.'
      : GENERIC_ERROR;
  }
  return GENERIC_ERROR;
}

const EXPORT_GUIDES: { source: string; steps: string }[] = [
  { source: 'iPhone / iPad', steps: 'Settings → General → Transfer or Reset → (or directly: Settings → Passwords) → Export Passwords → save the CSV file.' },
  { source: 'Mac', steps: 'Passwords app (or Safari → Settings → Passwords) → File → Export All Passwords to File → save the CSV.' },
  { source: 'Android / Chrome', steps: 'Chrome → Settings → Google Password Manager → Settings → Export passwords, or visit passwords.google.com → Settings → Export.' },
];

const PHASE_LABELS: Record<ImportProgress['phase'], string> = {
  comparing: 'Comparing with your vault…',
  encrypting: 'Encrypting…',
  uploading: 'Uploading…',
};

const ENCRYPT_BAR_SHARE = 0.7;

function unifiedFraction(progress: ImportProgress): number {
  const phaseFraction = progress.done / Math.max(progress.total, 1);
  if (progress.phase === 'encrypting') return ENCRYPT_BAR_SHARE * phaseFraction;
  if (progress.phase === 'uploading') return ENCRYPT_BAR_SHARE + (1 - ENCRYPT_BAR_SHARE) * phaseFraction;
  return phaseFraction;
}

export default function ImportWizard({ onClose, onDone }: ImportWizardProps): React.ReactElement {
  const { analyze, execute, reset } = useCsvImport();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [assignCategory, setAssignCategory] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [vaultTouched, setVaultTouched] = useState(false);

  const handleClose = () => {
    if (step === 'running') return;
    reset();
    // refresh the entries list whenever the server may have changed,
    // including after a partial upload failure
    if (vaultTouched) onDone();
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      if (file.size > MAX_CSV_FILE_BYTES) {
        setError(ERROR_MESSAGES['file-too-large']);
        return;
      }
      setStep('analyzing');
      const text = await file.text();
      const analyzed = await analyze(text, setProgress);
      setSummary(analyzed);
      setStep('preview');
    } catch (err) {
      setError(errorMessage(err));
      setStep('pick');
    } finally {
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    setError(null);
    setStep('running');
    try {
      const importResult = await execute({ assignCategory }, setProgress);
      setResult(importResult);
      setVaultTouched(true);
      setStep('done');
    } catch (err) {
      if (err instanceof ImportUploadError && err.partial) setVaultTouched(true);
      setError(errorMessage(err));
      // the plan is dropped on abort and upload failure — retrying requires a fresh analyze
      const planIsGone = err instanceof ImportAbortedError || err instanceof ImportUploadError;
      setStep(planIsGone ? 'pick' : 'preview');
      if (planIsGone) setSummary(null);
    } finally {
      setProgress(null);
    }
  };

  const nothingToImport = summary !== null && summary.newCount === 0 && summary.updateCount === 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal-content max-w-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-surface bg-base-100/95 backdrop-blur-sm rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="text-base font-semibold text-text">Import from Apple / Google</h2>
          {step !== 'running' && (
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface hover:bg-surface-100 transition-colors text-text-muted hover:text-text"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 72px)' }}>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-text">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-error" />
              <span>{error}</span>
            </div>
          )}

          {step === 'pick' && (
            <>
              <p className="text-sm text-text-muted">
                Import a CSV password export from the Apple Passwords app or Google Password Manager.
                Re-importing later works like a sync: unchanged entries are skipped, changed passwords
                are updated and nothing is duplicated.
              </p>

              <button
                onClick={() => setShowGuides(!showGuides)}
                aria-expanded={showGuides}
                className="flex items-center gap-1 text-sm text-primary"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showGuides ? 'rotate-180' : ''}`} />
                How do I export my passwords?
              </button>
              {showGuides && (
                <div className="space-y-2">
                  {EXPORT_GUIDES.map(guide => (
                    <div key={guide.source} className="p-3 bg-surface rounded-lg">
                      <p className="text-sm font-medium text-text">{guide.source}</p>
                      <p className="text-xs text-text-muted mt-1">{guide.steps}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-text">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                <span>
                  The exported CSV contains all your passwords in plain text.
                  <strong> Delete the file after importing</strong> and empty the trash.
                </span>
              </div>

              <button onClick={() => fileInputRef.current?.click()} className="btn-primary w-full">
                <Upload className="w-4 h-4" />
                Choose CSV file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
            </>
          )}

          {(step === 'analyzing' || step === 'running') && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-muted">
                {progress ? `${PHASE_LABELS[progress.phase]} (${progress.done}/${progress.total})` : 'Reading file…'}
              </p>
              {step === 'running' && progress && (
                <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                  {/* encrypting counts credentials, uploading counts chunks — map both
                      onto one monotonic 0-100% scale so the bar never jumps backwards */}
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.round(unifiedFraction(progress) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {step === 'preview' && summary && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-surface rounded-lg">
                  <p className="text-lg font-semibold text-text">{summary.newCount}</p>
                  <p className="text-xs text-text-muted">new</p>
                </div>
                <div className="p-3 bg-surface rounded-lg">
                  <p className="text-lg font-semibold text-text">{summary.updateCount}</p>
                  <p className="text-xs text-text-muted">will update</p>
                </div>
                <div className="p-3 bg-surface rounded-lg">
                  <p className="text-lg font-semibold text-text">{summary.unchangedCount}</p>
                  <p className="text-xs text-text-muted">unchanged</p>
                </div>
              </div>

              {(summary.skippedEmptyPassword > 0 || summary.malformedRows.length > 0
                || summary.droppedCsvRows.length > 0 || summary.vaultDuplicates > 0
                || summary.undecryptable > 0) && (
                <ul className="text-xs text-text-muted space-y-1">
                  {summary.skippedEmptyPassword > 0 && (
                    <li>{summary.skippedEmptyPassword} rows without a password (e.g. passkeys) were skipped.</li>
                  )}
                  {summary.malformedRows.length > 0 && (
                    <li>Malformed rows skipped: {summary.malformedRows.join(', ')}</li>
                  )}
                  {summary.droppedCsvRows.length > 0 && (
                    <li>Duplicate rows in the file — the last one wins: rows {summary.droppedCsvRows.join(', ')}</li>
                  )}
                  {summary.vaultDuplicates > 0 && (
                    <li>{summary.vaultDuplicates} credentials exist multiple times in your vault; only the newest copy is updated.</li>
                  )}
                  {summary.undecryptable > 0 && (
                    <li>{summary.undecryptable} matching vault entries could not be decrypted and are left untouched.</li>
                  )}
                </ul>
              )}

              {summary.otpCount > 0 && (
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <KeyRound className="w-3.5 h-3.5" />
                  {summary.otpCount} one-time-code secrets will be stored encrypted alongside the passwords.
                </p>
              )}

              {summary.previewItems.length > 0 && (
                <div className="max-h-56 overflow-y-auto border border-surface rounded-lg divide-y divide-surface">
                  {summary.previewItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      {item.action === 'create'
                        ? <Plus className="w-3.5 h-3.5 shrink-0 text-success" />
                        : <RefreshCw className="w-3.5 h-3.5 shrink-0 text-warning" />}
                      <span className="text-text truncate">{item.name}</span>
                      {item.username && <span className="text-text-muted text-xs truncate">{item.username}</span>}
                    </div>
                  ))}
                </div>
              )}

              {summary.newCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignCategory}
                    onChange={e => setAssignCategory(e.target.checked)}
                    className="rounded"
                  />
                  Assign category "{summary.format === 'apple' ? 'Apple Import' : 'Google Import'}" to new entries
                </label>
              )}

              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-text">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                <span>Remember: <strong>delete the CSV file</strong> after importing — it contains all your passwords in plain text.</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={nothingToImport}
                  className="btn-primary flex-1"
                >
                  {nothingToImport ? 'Everything up to date' : `Import ${summary.newCount + summary.updateCount} entries`}
                </button>
                <button onClick={handleClose} className="btn-secondary">Cancel</button>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <>
              <div className="flex flex-col items-center gap-2 py-4">
                <CheckCircle2 className="w-10 h-10 text-success" />
                <p className="text-sm text-text">
                  {result.created} created, {result.updated} updated, {result.unchanged} already up to date.
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-text">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                <span>Now <strong>delete the CSV export file</strong> from your device and empty the trash.</span>
              </div>

              <button onClick={handleClose} className="btn-primary w-full">Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
