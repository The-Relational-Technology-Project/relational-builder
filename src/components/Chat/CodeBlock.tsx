import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang: language,
      theme: 'github-dark-default',
    })
      .then(result => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        // Fallback for unsupported languages
        if (!cancelled) setHtml('');
      });

    return () => { cancelled = true; };
  }, [code, language]);

  if (!html) {
    return (
      <div className="relative group">
        <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 text-sm overflow-x-auto">
          <code>{code}</code>
        </pre>
        <CopyButton code={code} />
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        className="rounded-lg text-sm overflow-x-auto [&_pre]:p-4 [&_pre]:m-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <CopyButton code={code} />
    </div>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs px-2 py-1 rounded"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
