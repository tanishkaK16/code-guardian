'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, SearchCode, Bug, Ruler, BarChart3, FileText, FolderOpen } from 'lucide-react';

interface UploadedFile {
  name: string;
  content: string;
  size: number;
  language: string | null;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript (React)', js: 'JavaScript', jsx: 'JavaScript (React)',
  py: 'Python', java: 'Java', go: 'Go', rs: 'Rust', rb: 'Ruby', php: 'PHP',
  cs: 'C#', cpp: 'C++', c: 'C', swift: 'Swift', kt: 'Kotlin',
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', 'TypeScript (React)': '#3178c6', JavaScript: '#f7df1e',
  'JavaScript (React)': '#f7df1e', Python: '#3776ab', Java: '#b07219', Go: '#00add8',
  Rust: '#dea584', Ruby: '#cc342d', PHP: '#4f5d95', 'C#': '#178600',
  'C++': '#f34b7d', C: '#555555', Swift: '#f05138', Kotlin: '#a97bff',
};

function detectLang(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_MAP[ext] ?? null;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [projectName, setProjectName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    setError(null);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      // Skip non-code files, node_modules, hidden files, etc.
      if (file.name.startsWith('.') || file.name === 'package-lock.json' ||
          file.name === 'yarn.lock' || file.webkitRelativePath?.includes('node_modules') ||
          file.webkitRelativePath?.includes('.git/') || file.size > 500000) {
        continue;
      }

      const lang = detectLang(file.name);
      if (!lang) continue;

      try {
        const content = await file.text();
        const relativePath = file.webkitRelativePath || file.name;
        newFiles.push({
          name: relativePath,
          content,
          size: file.size,
          language: lang,
        });
      } catch {
        // Skip unreadable files
      }
    }

    if (newFiles.length === 0) {
      setError('No supported code files found. Supported: .ts, .tsx, .js, .jsx, .py, .java, .go, .rs');
      return;
    }

    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...newFiles.filter((f) => !existing.has(f.name))];
    });

    // Auto-detect project name from folder
    if (!projectName && newFiles[0]?.name.includes('/')) {
      setProjectName(newFiles[0].name.split('/')[0] ?? '');
    }
  }, [projectName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    setProgress('Preparing files for analysis...');

    try {
      setProgress(`Sending ${files.length} files to review engine...`);

      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map((f) => ({ name: f.name, content: f.content })),
          projectName: projectName || 'Uploaded Project',
        }),
      });

      setProgress('Running static analysis...');

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Review failed');
      }

      setProgress('Analysis complete! Loading results...');

      // Save to localStorage for the results page
      const reviews = JSON.parse(localStorage.getItem('guardian-reviews') || '[]');
      reviews.unshift(json.data);
      localStorage.setItem('guardian-reviews', JSON.stringify(reviews.slice(0, 50)));

      // Navigate to results
      router.push(`/review/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setIsAnalyzing(false);
      setProgress('');
    }
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const clearAll = () => {
    setFiles([]);
    setProjectName('');
    setError(null);
  };

  // Group files by language
  const filesByLang = files.reduce<Record<string, UploadedFile[]>>((acc, f) => {
    const lang = f.language || 'Other';
    (acc[lang] ??= []).push(f);
    return acc;
  }, {});

  const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold gradient-text">Upload Your Project</h1>
        <p className="text-[var(--color-guardian-text-secondary)] mt-2 text-lg">
          Drop your code files and get instant automated security analysis & feedback
        </p>
      </div>

      {/* Analyzing Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-8 text-center max-w-md glow-accent">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[var(--color-guardian-gradient-start)] to-[var(--color-guardian-gradient-end)] flex items-center justify-center animate-pulse">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">Analyzing Your Code</h2>
            <p className="text-sm text-[var(--color-guardian-text-secondary)] mb-4">{progress}</p>
            <div className="relative h-2 rounded-full overflow-hidden bg-[var(--color-guardian-surface)]">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-guardian-gradient-start)] to-[var(--color-guardian-gradient-end)] animate-[shimmer_1.5s_infinite]" />
            </div>
            <p className="text-xs text-[var(--color-guardian-text-muted)] mt-3">
              Scanning {files.length} files • {totalLines.toLocaleString()} lines
            </p>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
          dragging
            ? 'border-[var(--color-guardian-accent)] bg-[var(--color-guardian-accent-glow)] scale-[1.02]'
            : 'border-[var(--color-guardian-border)] hover:border-[var(--color-guardian-accent)] hover:bg-[var(--color-guardian-surface-hover)]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--color-guardian-gradient-start)] to-[var(--color-guardian-gradient-end)] flex items-center justify-center opacity-80">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-1">
          {dragging ? 'Drop your files here' : 'Drag & drop your code files'}
        </h3>
        <p className="text-sm text-[var(--color-guardian-text-muted)] mb-4">
          or click to browse • Supports .ts, .tsx, .js, .jsx, .py, .java, .go, .rs and more
        </p>
        <div className="flex justify-center gap-3 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
          >
            <FileText size={16} />
            Select Files
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          >
            <FolderOpen size={16} />
            Upload Folder
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.rb,.php,.cs,.cpp,.c,.swift,.kt"
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is valid but not in React types
          webkitdirectory=""
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
      </div>

      {/*  Error */}
      {error && (
        <div className="glass-card p-4 border-l-4 border-[var(--color-guardian-danger)]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-guardian-danger)]">⚠️</span>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Files Uploaded */}
      {files.length > 0 && (
        <>
          {/* Project Name & Stats */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 mr-4">
                <label className="text-xs font-medium text-[var(--color-guardian-text-muted)] uppercase tracking-wider mb-1 block">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-guardian-surface)] border border-[var(--color-guardian-border)] text-sm text-[var(--color-guardian-text)] placeholder-[var(--color-guardian-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-guardian-accent)] transition-all"
                />
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold">{files.length}</div>
                  <div className="text-xs text-[var(--color-guardian-text-muted)]">Files</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalLines.toLocaleString()}</div>
                  <div className="text-xs text-[var(--color-guardian-text-muted)]">Lines</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{Object.keys(filesByLang).length}</div>
                  <div className="text-xs text-[var(--color-guardian-text-muted)]">Languages</div>
                </div>
              </div>
            </div>

            {/* Language breakdown */}
            <div className="flex gap-2 flex-wrap">
              {Object.entries(filesByLang).map(([lang, langFiles]) => (
                <span
                  key={lang}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--color-guardian-surface)] border border-[var(--color-guardian-border)]"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: LANGUAGE_COLORS[lang] || '#888' }}
                  />
                  {lang}
                  <span className="text-[var(--color-guardian-text-muted)]">({langFiles.length})</span>
                </span>
              ))}
            </div>
          </div>

          {/* File list */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-guardian-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold">Files ({files.length})</h3>
              <button
                onClick={clearAll}
                className="text-xs text-[var(--color-guardian-text-muted)] hover:text-[var(--color-guardian-danger)] transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--color-guardian-border)]">
              {files.map((file) => (
                <div key={file.name} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[var(--color-guardian-surface-hover)] transition-colors">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: LANGUAGE_COLORS[file.language || ''] || '#888' }}
                  />
                  <span className="text-sm truncate flex-1 font-mono text-[var(--color-guardian-text-secondary)]">
                    {file.name}
                  </span>
                  <span className="text-xs text-[var(--color-guardian-text-muted)] flex-shrink-0">
                    {file.content.split('\n').length} lines
                  </span>
                  <button
                    onClick={() => removeFile(file.name)}
                    className="flex-shrink-0 text-[var(--color-guardian-text-muted)] hover:text-[var(--color-guardian-danger)] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Analyze Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={isAnalyzing}
              className="btn-primary text-base px-8 py-3.5 rounded-xl font-semibold flex items-center gap-3 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Analyze {files.length} File{files.length > 1 ? 's' : ''}
            </button>
          </div>

          {/* What we check */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <ShieldCheck size={28} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Security', desc: 'SQL injection, XSS, secrets' },
              { icon: <SearchCode size={28} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Robustness', desc: 'Non-existent APIs, phantom libs' },
              { icon: <Bug size={28} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Bug Risks', desc: 'Empty catches, unhandled errors' },
              { icon: <Ruler size={28} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Code Quality', desc: 'Type safety, code smells' },
            ].map((item) => (
              <div key={item.title} className="glass-card p-4 text-center">
                <div className="mb-3">{item.icon}</div>
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <p className="text-xs text-[var(--color-guardian-text-muted)] mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state - what we check */}
      {files.length === 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { icon: <ShieldCheck size={32} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Security Scan', desc: 'SQL injection, XSS, hardcoded secrets, path traversal' },
            { icon: <SearchCode size={32} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Robustness Check', desc: 'Catches non-existent APIs like Promise.sleep' },
            { icon: <Bug size={32} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Bug Detection', desc: 'Empty catch blocks, unhandled promises, type issues' },
            { icon: <BarChart3 size={32} className="mx-auto text-[var(--color-guardian-accent)]" />, title: 'Confidence Score', desc: 'Multi-dimensional quality scoring 0-100' },
          ].map((item) => (
            <div key={item.title} className="glass-card p-5 text-center hover:border-[var(--color-guardian-border-hover)] transition-all">
              <div className="mb-4">{item.icon}</div>
              <h4 className="text-sm font-semibold mb-1">{item.title}</h4>
              <p className="text-xs text-[var(--color-guardian-text-muted)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
