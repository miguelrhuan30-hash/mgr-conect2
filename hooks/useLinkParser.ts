/**
 * hooks/useLinkParser.ts — Intel Workspace v2 (Sprint IW-01)
 * Detecta e resolve [[links]] em texto raw.
 * Regex segura contra ReDoS (limite de 200 chars dentro dos colchetes).
 */
import { useMemo } from 'react';
import { IntelItem, ParsedLinkToken } from '../types';

// Regex segura: máx 200 chars dentro dos colchetes, sem colchetes aninhados
const LINK_REGEX = /\[\[([^\[\]]{1,200})\]\]/g;
const MAX_LINKS_PER_PARSE = 20;

export function useLinkParser(items: IntelItem[]) {

  const parseText = useMemo(() => (raw: string): ParsedLinkToken[] => {
    const tokens: ParsedLinkToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let linkCount = 0;

    // Reset lastIndex antes de usar (regex é stateful com flag 'g')
    LINK_REGEX.lastIndex = 0;

    while ((match = LINK_REGEX.exec(raw)) !== null && linkCount < MAX_LINKS_PER_PARSE) {
      // Texto puro antes do link
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', content: raw.slice(lastIndex, match.index) });
      }

      const innerText = match[1];
      const resolvedItem = items.find(
        i => i.text.toLowerCase() === innerText.toLowerCase().trim() && !i.deleted
      );

      tokens.push({ type: 'link', content: innerText, resolvedItem });
      lastIndex = match.index + match[0].length;
      linkCount++;
    }

    // Texto restante após o último link
    if (lastIndex < raw.length) {
      tokens.push({ type: 'text', content: raw.slice(lastIndex) });
    }

    return tokens;
  }, [items]);

  /** Extrai apenas os innerTexts dos [[links]] presentes no texto */
  const extractLinkTexts = (raw: string): string[] => {
    const results: string[] = [];
    const regex = /\[\[([^\[\]]{1,200})\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(raw)) !== null) results.push(match[1]);
    return results;
  };

  /** Verifica se o texto inteiro é um link [[...]] */
  const isLinkSyntax = (text: string): boolean =>
    /^\[\[.{1,200}\]\]$/.test(text.trim());

  return { parseText, extractLinkTexts, isLinkSyntax };
}
