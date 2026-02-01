import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { docMetaByModuleKey } from '@/help/docsRegistry';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'section';

type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

type DocsLayoutProps = {
  moduleKey: string;
  children: ReactNode;
};

const copyToClipboard = async (text: string) => {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

export function DocsLayout({ moduleKey, children }: DocsLayoutProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const meta = docMetaByModuleKey[moduleKey];

  const title = meta?.title ?? 'Documentation';
  const updatedAt = meta?.updatedAt ?? '—';

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    container.querySelectorAll('button[data-docs-copy="true"]').forEach((node) => node.remove());

    const headings = Array.from(container.querySelectorAll('h2, h3')) as HTMLHeadingElement[];
    const used = new Map<string, number>();
    const toc: TocItem[] = [];

    headings.forEach((heading) => {
      const text = heading.textContent?.trim() ?? '';
      if (!text) return;

      let id = heading.id?.trim();
      if (!id) {
        const base = slugify(text);
        const count = (used.get(base) ?? 0) + 1;
        used.set(base, count);
        id = count > 1 ? `${base}-${count}` : base;
        heading.id = id;
      } else {
        const count = (used.get(id) ?? 0) + 1;
        used.set(id, count);
        if (count > 1) {
          const nextId = `${id}-${count}`;
          heading.id = nextId;
          id = nextId;
        }
      }

      heading.classList.add('scroll-mt-24');

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = 'Copy link';
      copyButton.dataset.docsCopy = 'true';
      copyButton.className = 'ml-2 text-xs text-muted-foreground hover:text-foreground';
      copyButton.addEventListener('click', () => {
        const baseUrl = window.location.href.split('#')[0];
        void copyToClipboard(`${baseUrl}#${id}`);
      });
      heading.appendChild(copyButton);

      const level = heading.tagName === 'H2' ? 2 : 3;
      toc.push({ id, text, level });
    });

    setTocItems(toc);
  }, [children, moduleKey]);

  const toc = useMemo(() => tocItems, [tocItems]);

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">Last updated: {updatedAt}</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div ref={contentRef} className="space-y-6">
          {children}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">On this page</h2>
            {toc.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sections found.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {toc.map((item) => (
                  <li key={item.id} className={item.level === 3 ? 'ml-3' : undefined}>
                    <a href={`#${item.id}`} className="text-muted-foreground hover:text-foreground">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
