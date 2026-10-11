import { useDialogFocus } from '../hooks/useDialogFocus';
import React, { useState, useEffect } from 'react';
import {
  getStoredApiKey,
  setStoredApiKey,
  removeStoredApiKey,
  getMaskedApiKey,
} from '../utils/apiKeyStorage';
import { ShieldCheck, Eye, EyeOff, Trash2, RotateCw, X, Clipboard, Check, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChange?: (hasCustomKey: boolean) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyChange,
}) => {
  const dialogRef = useDialogFocus(isOpen);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredApiKey();
      setCurrentKey(stored);
      setInputKey('');
      setShowKey(false);
      setStatusMessage(null);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleValidateAndSave = async (keyToSave?: string) => {
    const key = (keyToSave !== undefined ? keyToSave : inputKey).trim();
    if (!key) {
      setStatusMessage({
        type: 'error',
        text: 'Pegá tu API key antes de guardar.',
      });
      return;
    }

    if (!key.startsWith('AIzaSy')) {
      setStatusMessage({
        type: 'error',
        text: 'El formato no parece coincidir. Las claves de Google AI Studio suelen comenzar por "AIzaSy...".',
      });
      return;
    }

    setIsValidating(true);
    setStatusMessage({
      type: 'info',
      text: 'Verificando API key...',
    });

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': key,
        },
        body: JSON.stringify({ apiKey: key }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStoredApiKey(key);
        setCurrentKey(key);
        setInputKey('');
        setStatusMessage({
          type: 'success',
          text: 'API key verificada y guardada en este navegador.',
        });
        onKeyChange?.(true);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'La clave no pudo ser validada. Comprueba que esté activa en Google AI Studio.',
        });
      }
    } catch (err: any) {
      // In case of network timeout, still save locally
      setStoredApiKey(key);
      setCurrentKey(key);
      setInputKey('');
      setStatusMessage({
        type: 'success',
        text: 'API key guardada en este navegador.',
      });
      onKeyChange?.(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestExistingKey = async () => {
    if (!currentKey) return;
    setIsValidating(true);
    setStatusMessage({
      type: 'info',
      text: 'Comprobando tu API key...',
    });

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': currentKey,
        },
        body: JSON.stringify({ apiKey: currentKey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: 'Google verificó tu API key.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Hubo un inconveniente al comprobar la clave actual.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'info',
        text: 'No se pudo conectar en este momento con los servidores de Google.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveKey = () => {
    removeStoredApiKey();
    setCurrentKey(null);
    setInputKey('');
    setStatusMessage({
      type: 'info',
      text: 'API key eliminada de este navegador.',
    });
    onKeyChange?.(false);
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setInputKey(text.trim());
        }
      }
    } catch {
      // Clipboard access might be blocked by browser permissions
    }
  };

  const handleCopyExistingKey = () => {
    if (!currentKey) return;
    navigator.clipboard?.writeText(currentKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="api-key-title"
      className="utility-overlay"
      onClick={onClose}>
      <div className="utility-sheet"
        onClick={(e) => e.stopPropagation()}>
        <header className="utility-header">
          <div>
            <p className="eyebrow"><span>Ajustes</span><span>{currentKey ? 'Conectada' : 'Sin conectar'}</span></p>
            <h2 id="api-key-title">API key de Gemini</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar API key" className="icon-button">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="utility-body space-y-6">
          <p className="text-sm text-zinc-400 leading-relaxed">Conectá Gemini para generar vocabulario sobre cualquier tema.</p>

          {statusMessage && (
            <div role="status" aria-live="polite" className={`status-note ${
              statusMessage.type === 'error' ? 'is-error' : ''
            }`}>{statusMessage.text}</div>
          )}

          {currentKey && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <ShieldCheck className="w-4 h-4" /><span>API key guardada</span>
              </div>
              <div className="flex items-center gap-2 border border-zinc-800 p-3">
                <code className="text-xs text-zinc-400 flex-1 break-all">{showKey ? currentKey : getMaskedApiKey(currentKey)}</code>
                <button onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Ocultar API key' : 'Mostrar API key'}
                  className="p-1.5 text-zinc-400 hover:text-white cursor-pointer">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={handleCopyExistingKey} aria-label="Copiar API key" className="p-1.5 text-zinc-400 hover:text-white cursor-pointer">
                  {copied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <button onClick={handleTestExistingKey} disabled={isValidating}
                  className="text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer py-2">Probar conexión</button>
                <button onClick={handleRemoveKey} className="flex items-center gap-1.5 text-zinc-500 hover:text-white cursor-pointer py-2">
                  <Trash2 className="w-3 h-3" />Eliminar API key
                </button>
              </div>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleValidateAndSave(); }} className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="api-key-input" className="text-xs font-mono text-zinc-300">{currentKey ? 'Reemplazar API key' : 'API key de Gemini'}</label>
              <button type="button" onClick={handlePasteClipboard} className="text-xs text-zinc-500 hover:text-white cursor-pointer">Pegar</button>
            </div>
            <div className="relative">
              <input id="api-key-input" type={showKey ? 'text' : 'password'} value={inputKey}
                onChange={(e) => setInputKey(e.target.value)} placeholder="AIzaSy…" autoComplete="off" spellCheck={false}
                className="w-full bg-[#09090b] border border-zinc-700 p-3 pr-11 text-sm font-mono focus:outline-none focus:border-zinc-200" />
              <button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Ocultar entrada' : 'Mostrar entrada'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white cursor-pointer">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button type="submit" disabled={isValidating || !inputKey.trim()}
              className="button-primary w-full">
              {isValidating && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              {isValidating ? 'Verificando…' : currentKey ? 'Guardar cambio' : 'Guardar y verificar'}
            </button>
          </form>

          <details className="border-t border-zinc-800 pt-4 text-xs text-zinc-400">
            <summary className="cursor-pointer hover:text-white">Cómo obtener una API key</summary>
            <ol className="list-decimal pl-4 space-y-2 mt-4 leading-relaxed">
              <li>Abrí <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                className="text-zinc-200 underline underline-offset-4">Google AI Studio <ExternalLink className="w-3 h-3 inline" /></a> con tu cuenta de Google.</li>
              <li>Elegí <strong className="text-zinc-200">Create API key</strong> y seleccioná un proyecto.</li>
              <li>Copiá la API key, pegala arriba y presioná <strong className="text-zinc-200">Guardar y verificar</strong>.</li>
            </ol>
            <p className="mt-3 leading-relaxed">La cuota y el costo dependen del modelo y de tu proyecto de Google.</p>
          </details>
          <p className="text-[11px] leading-relaxed text-zinc-500">Tu API key se guarda en este navegador y se envía al servidor para consultar Gemini. Podés eliminarla cuando quieras.</p>
        </div>
      </div>
    </div>
  );
};
