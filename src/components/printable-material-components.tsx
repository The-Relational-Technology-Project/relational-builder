import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';
import { PrintableMaterialPreview } from '@/components/PrintableMaterialPreview';

/** The plain text inside a hast node */
function hastText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === 'text') return n.value ?? '';
  return (n.children ?? []).map(hastText).join('');
}

/**
 * Markdown renderers that show a complete HTML document in a code block as
 * a rendered page. Anything else (a snippet, a material cut off by the body
 * limit) stays an ordinary code block.
 */
export const printableMaterialComponents: Components = {
  pre({ node, children, ...rest }) {
    const code = node?.children?.[0];
    if (code && code.type === 'element' && code.tagName === 'code') {
      const cls = code.properties?.className;
      const isHtml = Array.isArray(cls) && cls.includes('language-html');
      if (isHtml) {
        const text = hastText(code);
        if (/<html[\s>]/i.test(text) && /<\/html>\s*$/i.test(text.trim())) {
          return <PrintableMaterialPreview html={text} />;
        }
      }
    }
    return <pre {...rest}>{children as ReactNode}</pre>;
  },
};
