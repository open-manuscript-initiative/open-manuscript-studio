import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export function newWorkspaceId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useLocalWorkspace<T>(key: string, createDefault: () => T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return createDefault();
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) as T : createDefault();
    } catch {
      return createDefault();
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Export remains available if browser storage is full or disabled. */ }
  }, [key, value]);
  return [value, setValue];
}

export function downloadWorkspaceFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadWorkspaceJson(name: string, value: unknown): void {
  downloadWorkspaceFile(name, JSON.stringify(value, null, 2), 'application/json;charset=utf-8');
}

export function safeWorkspaceFileName(value: string, fallback: string): string {
  return (value || fallback).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || fallback;
}

export function readTiptapText(content: string): string {
  try {
    const visit = (node: unknown): string => {
      if (!node || typeof node !== 'object') return '';
      const value = node as { type?: unknown; text?: unknown; content?: unknown };
      if (value.type === 'text' && typeof value.text === 'string') return value.text;
      if (value.type === 'hardBreak') return '\n';
      const children = Array.isArray(value.content) ? value.content.map(visit).join('') : '';
      return ['paragraph', 'heading', 'blockquote', 'listItem'].includes(String(value.type)) ? children + '\n' : children;
    };
    return visit(JSON.parse(content)).trim();
  } catch {
    return content.trim();
  }
}
