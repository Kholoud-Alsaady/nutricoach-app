"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

interface ChatMessageRendererProps {
  content: string;
  isUser?: boolean;
}

/**
 * Validate that a URL uses safe protocols (http/https only)
 * to prevent javascript: or data: injection exploits.
 */
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    // Relative URLs or malformed strings are not permitted as external research links
    return false;
  }
}

/**
 * Strips any redundant "Short answer:" heading from the start of assistant messages.
 */
function sanitizeShortAnswerHeading(text: string): string {
  if (!text) return "";
  return text
    .replace(/^[\s#*•_-]*(?:short answer|short-answer|quick answer|direct answer)[:*#\s]*/i, "")
    .trim();
}

/**
 * Parses inline Markdown tokens (bold, italic, links, inline code)
 * into safe React elements without dangerouslySetInnerHTML.
 */
function parseInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex to match:
  // 1. Links: [label](url)
  // 2. Bold: **text**
  // 3. Inline code: `code`
  // 4. Italic: *text* or _text_
  const inlineRegex = /(!?\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(_([^_]+)_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = inlineRegex.lastIndex;

    // Plain text preceding the matched token
    if (matchStart > lastIndex) {
      nodes.push(text.slice(lastIndex, matchStart));
    }

    const fullMatch = match[0];

    // Link: [label](url)
    if (match[1] && !fullMatch.startsWith("!")) {
      const label = match[2];
      const url = match[3];

      if (isSafeUrl(url)) {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${matchStart}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:text-brand-hover underline underline-offset-2 font-medium inline-flex items-center gap-0.5 break-all transition-colors"
          >
            <span>{label}</span>
            <ExternalLink className="w-2.5 h-2.5 inline shrink-0" aria-hidden="true" />
          </a>
        );
      } else {
        nodes.push(label);
      }
    }
    // Bold: **text**
    else if (match[4]) {
      const boldText = match[5];
      nodes.push(
        <strong key={`${keyPrefix}-bold-${matchStart}`} className="font-semibold text-ink-primary">
          {boldText}
        </strong>
      );
    }
    // Inline Code: `code`
    else if (match[6]) {
      const codeText = match[7];
      nodes.push(
        <code
          key={`${keyPrefix}-code-${matchStart}`}
          className="bg-surface-subtle text-ink-primary px-1 py-0.5 rounded text-[11px] font-mono border border-border"
        >
          {codeText}
        </code>
      );
    }
    // Italic: *text* or _text_
    else if (match[8] || match[10]) {
      const italicText = match[9] || match[11];
      nodes.push(
        <em key={`${keyPrefix}-italic-${matchStart}`} className="italic text-ink-secondary">
          {italicText}
        </em>
      );
    }

    lastIndex = matchEnd;
  }

  // Trailing plain text after the last token
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

interface BlockToken {
  type: "heading" | "bullet-list" | "numbered-list" | "paragraph";
  level?: number;
  text?: string;
  items?: string[];
}

/**
 * Tokenizes raw Markdown into structured blocks (headings, lists, paragraphs).
 */
function parseBlocks(rawText: string): BlockToken[] {
  const blocks: BlockToken[] = [];
  const lines = rawText.split(/\r?\n/);

  let currentList: { type: "bullet-list" | "numbered-list"; items: string[] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(" ").trim();
      if (pText) {
        blocks.push({ type: "paragraph", text: pText });
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line indicates block break
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Explicit markdown heading (e.g. ### Heading or ## Heading)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push({
        type: "heading",
        level,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    // Section headings formatted as standalone **Heading:** or **Key takeaways**
    const boldHeadingMatch = trimmed.match(/^\*\*([^*:]+):?\*\*:?$/);
    if (boldHeadingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: 3,
        text: boldHeadingMatch[1].trim(),
      });
      continue;
    }

    // Plain text section headers (e.g. "Key takeaways" or "Recommended reading")
    if (/^(Key takeaways|Recommended reading|Practical next steps|Summary|Overview):?$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: 3,
        text: trimmed.replace(/:$/, ""),
      });
      continue;
    }

    // Bullet list item (e.g. "• item", "- item", "* item")
    const bulletMatch = trimmed.match(/^([•\-\*])\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      const itemText = bulletMatch[2].trim();
      if (!currentList || currentList.type !== "bullet-list") {
        flushList();
        currentList = { type: "bullet-list", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Numbered list item (e.g. "1. item")
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      flushParagraph();
      const itemText = numMatch[2].trim();
      if (!currentList || currentList.type !== "numbered-list") {
        flushList();
        currentList = { type: "numbered-list", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Continuation of a list item or new paragraph line
    if (currentList && line.startsWith("   ")) {
      // Indented continuation of previous list item
      const lastIdx = currentList.items.length - 1;
      currentList.items[lastIdx] += " " + trimmed;
    } else {
      flushList();
      currentParagraphLines.push(trimmed);
    }
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function ChatMessageRenderer({ content, isUser = false }: ChatMessageRendererProps) {
  if (!content) return null;

  // For user messages, simple clean display with linebreaks preserved
  if (isUser) {
    return (
      <div
        dir="auto"
        className="text-xs text-ink-primary whitespace-pre-wrap leading-relaxed break-words"
        style={{ unicodeBidi: "plaintext" }}
      >
        {content}
      </div>
    );
  }

  // Sanitize assistant content
  const sanitized = sanitizeShortAnswerHeading(content);
  const blocks = parseBlocks(sanitized);

  if (blocks.length === 0) {
    return (
      <p dir="auto" className="text-xs text-ink-secondary leading-relaxed" style={{ unicodeBidi: "plaintext" }}>
        {sanitized}
      </p>
    );
  }

  return (
    <div
      dir="auto"
      className="text-xs text-ink-secondary leading-relaxed space-y-2.5 break-words"
      style={{ unicodeBidi: "plaintext" }}
    >
      {blocks.map((block, idx) => {
        const key = `block-${idx}`;

        switch (block.type) {
          case "heading": {
            return (
              <h4
                key={key}
                className="font-semibold text-ink-primary text-xs tracking-tight pt-1.5 first:pt-0 pb-0.5 border-b border-border/40"
              >
                {parseInlineMarkdown(block.text || "", key)}
              </h4>
            );
          }

          case "bullet-list": {
            return (
              <ul key={key} className="space-y-1.5 my-1.5 pl-0.5">
                {block.items?.map((item, itemIdx) => (
                  <li key={`${key}-item-${itemIdx}`} className="flex items-start gap-2 text-ink-secondary">
                    <span className="text-brand font-bold text-xs leading-tight select-none mt-0.5 shrink-0">
                      •
                    </span>
                    <span className="flex-1 min-w-0 leading-relaxed">
                      {parseInlineMarkdown(item, `${key}-${itemIdx}`)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }

          case "numbered-list": {
            return (
              <ol key={key} className="space-y-1.5 my-1.5 pl-0.5">
                {block.items?.map((item, itemIdx) => (
                  <li key={`${key}-num-${itemIdx}`} className="flex items-start gap-2 text-ink-secondary">
                    <span className="text-brand font-semibold text-[11px] leading-tight select-none mt-0.5 shrink-0 min-w-[14px]">
                      {itemIdx + 1}.
                    </span>
                    <span className="flex-1 min-w-0 leading-relaxed">
                      {parseInlineMarkdown(item, `${key}-${itemIdx}`)}
                    </span>
                  </li>
                ))}
              </ol>
            );
          }

          case "paragraph":
          default: {
            return (
              <p key={key} className="text-ink-secondary leading-relaxed">
                {parseInlineMarkdown(block.text || "", key)}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
