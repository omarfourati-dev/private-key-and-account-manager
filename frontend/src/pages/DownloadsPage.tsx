import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Monitor,
  Download,
  ExternalLink,
  Apple,
  CheckCircle2,
  Zap,
  Shield,
  Share2,
  Plus,
  Chrome,
} from 'lucide-react';

interface GithubRelease {
  tag_name: string;
  published_at: string;
  assets: { name: string; browser_download_url: string; size: number }[];
}

const GITHUB_REPO = 'omarfourati55/private-key-and-account-manager';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DownloadsPage(): React.ReactElement {
  const [release, setRelease] = useState<GithubRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then(r => r.ok ? r.json() as Promise<GithubRelease> : Promise.reject())
      .then(data => setRelease(data))
      .catch(() => setRelease(null))
      .finally(() => setLoading(false));
  }, []);

  const apkAsset = release?.assets.find(a => a.name.endsWith('.apk'));

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">Download Apps</h1>
        <p className="text-text-muted text-sm">
          KeyVault is available natively on Android and iOS, and as a PWA on any device.
        </p>
      </div>

      {/* Release badge */}
      {release && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          Latest release: <span className="text-text font-medium">{release.tag_name}</span>
          · {new Date(release.published_at).toLocaleDateString()}
        </div>
      )}

      {/* Platform cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Android */}
        <PlatformCard
          icon={<Smartphone className="w-8 h-8" />}
          title="Android"
          subtitle="APK download"
          color="success"
          badge="Native App"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-success/30 border-t-success rounded-full animate-spin mx-auto" />
          ) : apkAsset ? (
            <a
              href={apkAsset.browser_download_url}
              className="btn-primary w-full justify-center text-sm py-2"
              download
            >
              <Download className="w-4 h-4" />
              Download APK
              <span className="text-white/60 text-xs">({formatBytes(apkAsset.size)})</span>
            </a>
          ) : (
            <a
              href={`https://github.com/${GITHUB_REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full justify-center text-sm py-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Releases
            </a>
          )}
          <StepList steps={[
            'Download the APK file',
            'Allow installation from unknown sources in Android Settings',
            'Open the APK and install',
            'Launch KeyVault from your app drawer',
          ]} />
        </PlatformCard>

        {/* iOS */}
        <PlatformCard
          icon={<Apple className="w-8 h-8" />}
          title="iOS / iPadOS"
          subtitle="Add to Home Screen"
          color="primary"
          badge="PWA"
        >
          <div className="space-y-1.5">
            <p className="text-xs text-text-muted text-center mb-3">
              Install as a home screen app via Safari
            </p>
          </div>
          <StepList steps={[
            'Open this site in Safari on your iPhone/iPad',
            'Tap the Share button (↑) at the bottom',
            'Tap "Add to Home Screen"',
            'Tap "Add" — app is now installed!',
          ]} />
          <div className="flex items-center gap-1.5 text-xs text-text-dim mt-2">
            <Share2 className="w-3 h-3 flex-shrink-0" />
            <span>Works offline after first load</span>
          </div>
        </PlatformCard>

        {/* Desktop */}
        <PlatformCard
          icon={<Monitor className="w-8 h-8" />}
          title="Desktop"
          subtitle="Windows / Mac / Linux"
          color="secondary"
          badge="PWA"
        >
          <p className="text-xs text-text-muted text-center mb-3">
            Install as a desktop app via Chrome or Edge
          </p>
          <StepList steps={[
            'Open this site in Chrome or Edge',
            'Click the install icon (⊕) in the address bar',
            'Click "Install" in the popup',
            'KeyVault opens as a standalone window',
          ]} />
          <div className="flex items-center gap-1.5 text-xs text-text-dim mt-2">
            <Chrome className="w-3 h-3 flex-shrink-0" />
            <span>Chrome 90+ / Edge 90+ required</span>
          </div>
        </PlatformCard>
      </div>

      {/* Features */}
      <div
        className="rounded-2xl border border-surface p-5"
        style={{ background: 'rgba(14,14,30,0.6)' }}
      >
        <h2 className="text-sm font-semibold text-text mb-4">Why use the native app?</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: 'Faster', text: 'Instant launch, no browser overhead' },
            { icon: Shield, title: 'More Secure', text: 'Runs in isolated native container' },
            { icon: Plus, title: 'Always Available', text: 'Works offline with cached data' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text">{title}</p>
                <p className="text-xs text-text-muted mt-0.5">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Build your own */}
      <div
        className="rounded-2xl border border-surface/60 p-5"
        style={{ background: 'rgba(14,14,30,0.4)' }}
      >
        <h2 className="text-sm font-semibold text-text mb-2">Build your own APK</h2>
        <p className="text-xs text-text-muted mb-3">
          KeyVault is open source. You can build the Android APK yourself:
        </p>
        <pre className="text-xs text-text-muted bg-base rounded-xl p-3 overflow-x-auto border border-surface font-mono leading-relaxed">
{`# Clone the repo
git clone https://github.com/${GITHUB_REPO}
cd private-key-and-account-manager/frontend

# Install dependencies & build web
npm install && npm run build

# Sync with Capacitor & build Android
npx cap sync android
cd android && ./gradlew assembleRelease`}
        </pre>
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mt-3 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View source on GitHub
        </a>
      </div>
    </div>
  );
}

function PlatformCard({
  icon, title, subtitle, color, badge, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: 'primary' | 'success' | 'secondary';
  badge: string;
  children: React.ReactNode;
}) {
  const colorMap = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    success: 'text-success bg-success/10 border-success/20',
    secondary: 'text-secondary bg-secondary/10 border-secondary/20',
  };
  const iconColor = {
    primary: 'text-primary',
    success: 'text-success',
    secondary: 'text-secondary',
  };

  return (
    <div className="card flex flex-col gap-4">
      {/* Header */}
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${iconColor[color]} bg-current/10`}
          style={{ backgroundColor: color === 'primary' ? 'rgba(124,106,247,0.1)' : color === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(56,189,248,0.1)' }}
        >
          <span className={iconColor[color]}>{icon}</span>
        </div>
        <h3 className="font-semibold text-text text-sm">{title}</h3>
        <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${colorMap[color]}`}>
          {badge}
        </span>
      </div>

      {children}
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
          <span className="w-4 h-4 rounded-full bg-surface-100 flex items-center justify-center text-[10px] font-bold text-text-dim flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
