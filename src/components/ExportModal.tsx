import { useDialogFocus } from '../hooks/useDialogFocus';
import React, { useState, useEffect } from 'react';
import { WordItem } from '../types';
import { cleanDisplayWord } from '../utils/grammar';
import { X, Copy, Check, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  words: WordItem[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title,
  words,
}) => {
  const dialogRef = useDialogFocus(isOpen);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getMarkdownList = () => {
    let out = `# ${title} - Vocabulario de Clase\n\n`;
    words.forEach((w) => {
      const cleanW = cleanDisplayWord(w.word);
      out += `- **${cleanW}** (${w.category}, ${w.level})${w.meaning ? `: ${w.meaning}` : ''}\n`;
      if (w.example) out += `  *Ejemplo:* "${w.example}"\n`;
      if (w.collocation) out += `  *Colocación:* ${w.collocation}\n`;
      if (w.translationEn) out += `  *EN:* ${w.translationEn}\n`;
    });
    return out;
  };

  const getSimpleList = () => {
    return words.map((w) => `${cleanDisplayWord(w.word)}${w.meaning ? ` - ${w.meaning}` : ''}`).join('\n');
  };

  const handleCopy = (text: string, formatName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownloadText = () => {
    const blob = new Blob([getMarkdownList()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_vocabulario.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={dialogRef} tabIndex={-1} role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
      className="utility-overlay"
      onClick={onClose}
    >
      <div className="utility-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="utility-header">
          <div>
            <p className="eyebrow"><span>Exportar</span><span>{String(words.length).padStart(2, '0')} palabras</span></p>
            <h3 id="export-title">Léxico de clase</h3>
          </div>
          <button onClick={onClose} aria-label="Cerrar exportación" className="icon-button">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="utility-body">
          <p className="utility-lead">
            Compartí la lista con tus estudiantes por chat, documento o campus virtual.
            {words.some(word => word.detailsPending) && ' Se incluyen los detalles de las fichas que ya abriste.'}
          </p>

          <div className="export-list">
            <div className="export-option">
              <div>
                <span className="export-name">Ficha completa</span>
                <span className="export-desc">Markdown con categoría, nivel, definición y ejemplo.</span>
              </div>
              <button onClick={() => handleCopy(getMarkdownList(), 'md')} className="button-primary">
                {copiedFormat === 'md' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                <span>{copiedFormat === 'md' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="export-option">
              <div>
                <span className="export-name">Lista simple</span>
                <span className="export-desc">Para pegar directo en Zoom, Meet o Teams.</span>
              </div>
              <button onClick={() => handleCopy(getSimpleList(), 'simple')} className="button-secondary">
                {copiedFormat === 'simple' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                <span>{copiedFormat === 'simple' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <div className="utility-footer">
            <button onClick={handleDownloadText} className="text-button">
              <Download aria-hidden="true" />
              <span>Descargar .md</span>
            </button>
            <button onClick={onClose} className="text-button is-strong">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
