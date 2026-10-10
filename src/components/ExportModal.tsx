import React, { useState } from 'react';
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
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  if (!isOpen) return null;

  const getMarkdownList = () => {
    let out = `# ${title} - Vocabulario de Clase\n\n`;
    words.forEach((w) => {
      const cleanW = cleanDisplayWord(w.word);
      out += `- **${cleanW}** (${w.category}, ${w.level}): ${w.meaning}\n`;
      if (w.example) out += `  *Ejemplo:* "${w.example}"\n`;
      if (w.collocation) out += `  *Colocación:* ${w.collocation}\n`;
      if (w.translationEn) out += `  *EN:* ${w.translationEn}\n`;
    });
    return out;
  };

  const getSimpleList = () => {
    return words.map((w) => `${cleanDisplayWord(w.word)} - ${w.meaning}`).join('\n');
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
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0d0e14] border border-[#27272a] shadow-2xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#22242c] bg-[#12131a]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Exportar léxico de clase
            </h3>
            <span className="text-[10px] text-zinc-400">
              {words.length} palabras recopiladas
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-zinc-300 font-sans leading-relaxed">
            Comparte la lista de vocabulario con tus estudiantes por chat, documento o campus virtual.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-[#14161f] border border-[#27272a]">
              <div>
                <span className="font-bold text-white uppercase text-[11px] block">
                  Formato Markdown / Ficha completa
                </span>
                <span className="text-[10px] text-zinc-400">
                  Incluye palabra, categoría, nivel, definición y frase
                </span>
              </div>
              <button
                onClick={() => handleCopy(getMarkdownList(), 'md')}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {copiedFormat === 'md' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFormat === 'md' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#14161f] border border-[#27272a]">
              <div>
                <span className="font-bold text-white uppercase text-[11px] block">
                  Lista simple de palabras
                </span>
                <span className="text-[10px] text-zinc-400">
                  Ideal para pegar directo en Zoom o Teams
                </span>
              </div>
              <button
                onClick={() => handleCopy(getSimpleList(), 'simple')}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#181920] hover:bg-zinc-800 border border-[#27272a] text-zinc-200 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {copiedFormat === 'simple' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFormat === 'simple' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[#22242c] flex items-center justify-between">
            <button
              onClick={handleDownloadText}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white uppercase text-[11px] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .md</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white uppercase text-[11px] font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
