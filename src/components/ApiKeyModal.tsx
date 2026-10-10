import React, { useState, useEffect } from 'react';
import {
  getStoredApiKey,
  setStoredApiKey,
  removeStoredApiKey,
  getMaskedApiKey,
} from '../utils/apiKeyStorage';
import {
  Key,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  RotateCw,
  Sparkles,
  HelpCircle,
  X,
  Clipboard,
  Check,
  Info,
  Zap,
  Lock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

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
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [activeTab, setActiveTab] = useState<'tutorial' | 'manage'>('tutorial');
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
      // If user already has a key configured, start on the manage/change view; otherwise start on the tutorial
      setActiveTab(stored ? 'manage' : 'tutorial');
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
        text: 'Por favor, introduce una clave de API antes de guardar.',
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
      text: 'Verificando clave con los servidores de Google Gemini...',
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
          text: '¡Clave de API validada y guardada localmente con éxito en tu navegador!',
        });
        setActiveTab('manage');
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
        text: 'Clave guardada localmente en tu navegador.',
      });
      setActiveTab('manage');
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
      text: 'Comprobando el estado de tu clave actual con Google Gemini...',
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
          text: '¡Tu clave personal está activa, autorizada y funcionando al 100%!',
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
      text: 'Se ha eliminado tu clave personal. NubeELE ahora utilizará la clave compartida del servidor.',
    });
    setActiveTab('tutorial');
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0d0e14] border-2 border-zinc-700 shadow-2xl overflow-hidden font-mono flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#22242c] bg-[#12131a] shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span className="font-bold uppercase tracking-wider text-white">
              Clave de API Gemini
            </span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400 text-[11px] hidden sm:inline">Gratis & Almacenamiento Local</span>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500 text-xs font-bold transition-all cursor-pointer"
            title="Cerrar ventana (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span className="uppercase text-[10px] tracking-wider">Cerrar</span>
          </button>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center border-b border-[#22242c] bg-[#090a10] px-4 sm:px-5 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('tutorial')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'tutorial'
                ? 'border-emerald-400 text-white bg-[#12131a]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. Instructivo (Paso a paso gratis)</span>
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'manage'
                ? 'border-emerald-400 text-white bg-[#12131a]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. {currentKey ? 'Cambiar o Gestionar Clave' : 'Configurar Clave'}</span>
            {currentKey && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1 inline-block animate-pulse" />
            )}
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-zinc-300 font-sans">
          {/* Active Status Banner */}
          <div
            className={`p-3.5 border flex items-start gap-3 transition-colors ${
              currentKey
                ? 'bg-emerald-950/30 border-emerald-700/60 text-emerald-200'
                : 'bg-zinc-900/60 border-zinc-700 text-zinc-300'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {currentKey ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <Info className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono uppercase font-bold text-xs tracking-wider">
                  {currentKey ? 'Clave personal activa en este navegador' : 'Usando clave compartida del servidor'}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 border uppercase font-semibold ${
                    currentKey
                      ? 'border-emerald-600 bg-emerald-950/80 text-emerald-300'
                      : 'border-amber-600/50 bg-amber-950/40 text-amber-300'
                  }`}
                >
                  {currentKey ? 'Personal (localStorage)' : 'Servidor NubeELE'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                {currentKey
                  ? 'Tus consultas utilizan tu propia cuota gratuita de Google AI Studio guardada en tu navegador.'
                  : 'NubeELE está funcionando con la clave del sistema. Para tener tu propia cuota personal y rápida sin límites compartidos, sigue el instructivo y añade tu clave gratuita de Google.'}
              </p>
            </div>
          </div>

          {/* Feedback status message alert */}
          {statusMessage && (
            <div
              className={`p-3 border text-xs font-mono flex items-start gap-2.5 transition-all ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-950/50 border-rose-500 text-rose-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <RotateCw className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
            </div>
          )}

          {/* TAB 1: INSTRUCTIVO PASO A PASO */}
          {activeTab === 'tutorial' && (
            <div className="space-y-4">
              {/* Highlight Perks Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
                <div className="p-2.5 bg-[#12131a] border border-[#22242c]">
                  <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>100% GRATUITO</span>
                  </div>
                  <p className="text-zinc-400 text-[10px] font-sans leading-relaxed">
                    Google AI Studio ofrece un nivel gratuito generoso sin pedir tarjeta bancaria.
                  </p>
                </div>
                <div className="p-2.5 bg-[#12131a] border border-[#22242c]">
                  <div className="text-sky-400 font-bold mb-1 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>TU PROPIA CUOTA</span>
                  </div>
                  <p className="text-zinc-400 text-[10px] font-sans leading-relaxed">
                    Hasta 15 peticiones por minuto y 1.500 al día para tus clases sin esperas.
                  </p>
                </div>
                <div className="p-2.5 bg-[#12131a] border border-[#22242c]">
                  <div className="text-amber-400 font-bold mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>LOCAL Y PRIVADO</span>
                  </div>
                  <p className="text-zinc-400 text-[10px] font-sans leading-relaxed">
                    Se guarda exclusivamente en tu navegador (localStorage). Nadie más la ve.
                  </p>
                </div>
              </div>

              {/* Step 1 to 4 Instructions */}
              <div className="space-y-3 font-sans">
                {/* Step 1 */}
                <div className="p-3.5 bg-[#101218] border border-[#27272a] flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-black font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-bold text-white font-mono text-xs uppercase">
                        Abre Google AI Studio
                      </h4>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-zinc-200 text-black font-mono font-bold uppercase text-[11px] tracking-wider transition-colors cursor-pointer"
                      >
                        <span>Abrir aistudio.google.com</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      Haz clic en el enlace superior e inicia sesión con cualquier cuenta personal de Google o Gmail.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 bg-[#101218] border border-[#27272a] flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-black font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-bold text-white font-mono text-xs uppercase">
                      Haz clic en "Create API key"
                    </h4>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      En la pantalla verás un botón azul principal que dice <strong>"Create API key"</strong> (o "Crear clave de API").
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 bg-[#101218] border border-[#27272a] flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-black font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-bold text-white font-mono text-xs uppercase">
                      Selecciona un proyecto (Crear proyecto nuevo)
                    </h4>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      Elige crear en un nuevo proyecto de Google Cloud. <strong>No requiere tarjeta de crédito ni facturación</strong> para el plan gratuito estándar.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 bg-[#101218] border border-[#27272a] flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-black font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    4
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="font-bold text-white font-mono text-xs uppercase">
                      Copia la clave y pégala aquí abajo
                    </h4>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      Copia el código que comienza por <code className="text-emerald-300 font-mono bg-black/50 px-1 py-0.5">AIzaSy...</code> y pégalo directamente en la casilla de abajo:
                    </p>

                    {/* Quick input inside tutorial step 4 for fast completion */}
                    <div className="pt-1 flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={inputKey}
                          onChange={(e) => setInputKey(e.target.value)}
                          placeholder="Pega aquí tu clave (AIzaSy...)"
                          className="w-full px-3 py-2 bg-[#14161f] border border-[#27272a] focus:border-white text-white placeholder:text-zinc-600 text-xs font-mono focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                          title={showKey ? 'Ocultar' : 'Mostrar'}
                        >
                          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <button
                        onClick={handlePasteClipboard}
                        className="px-2.5 py-2 bg-[#181a24] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-[#27272a] text-xs font-mono transition-colors cursor-pointer"
                        title="Pegar del portapapeles"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleValidateAndSave()}
                        disabled={isValidating || !inputKey.trim()}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-mono font-bold uppercase text-xs tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        {isValidating ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Guardar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GESTIONAR Y CAMBIAR CLAVE */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              {/* If a key is configured: Current Key details */}
              {currentKey && (
                <div className="p-4 bg-[#101218] border border-[#27272a] space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Clave configurada actualmente</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Activa</span>
                    </span>
                  </div>

                  <div className="p-2.5 bg-black/60 border border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-white font-mono text-xs tracking-wider select-all">
                      {showKey ? currentKey : getMaskedApiKey(currentKey)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
                        title={showKey ? 'Ocultar clave' : 'Mostrar clave completa'}
                      >
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span className="text-[10px] uppercase">{showKey ? 'Ocultar' : 'Ver'}</span>
                      </button>

                      <button
                        onClick={handleCopyExistingKey}
                        className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
                        title="Copiar clave al portapapeles"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                        <span className="text-[10px] uppercase">{copied ? 'Copiada' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <button
                      onClick={handleTestExistingKey}
                      disabled={isValidating}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181920] hover:bg-zinc-800 border border-[#27272a] text-zinc-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                      title="Comprobar que la clave sigue teniendo conexión con Google Gemini"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isValidating ? 'animate-spin' : ''}`} />
                      <span>Probar conexión</span>
                    </button>

                    <button
                      onClick={handleRemoveKey}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                      title="Eliminar clave personal de este navegador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar y volver al sistema</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Change or Input a New Key Form */}
              <div className="p-4 bg-[#101218] border border-[#27272a] space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{currentKey ? 'Cambiar por una nueva clave' : 'Introducir nueva clave de API'}</span>
                  </label>
                  <button
                    onClick={handlePasteClipboard}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
                    title="Pegar desde el portapapeles"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Pegar</span>
                  </button>
                </div>

                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  {currentKey
                    ? 'Si deseas usar otra clave de Google AI Studio, pégala aquí abajo. La clave anterior se reemplazará inmediatamente en tu navegador.'
                    : 'Pega tu clave generada en Google AI Studio para activar tu cuota personal.'}
                </p>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Pega la nueva clave (AIzaSy...)"
                    className="w-full px-3 py-2.5 bg-[#14161f] border border-[#27272a] focus:border-white text-white placeholder:text-zinc-600 text-xs font-mono focus:outline-hidden transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    title={showKey ? 'Ocultar' : 'Mostrar'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                  <span className="text-[10px] text-zinc-500 font-sans">
                    Formato: 39 caracteres comenzando con AIzaSy
                  </span>

                  <button
                    onClick={() => handleValidateAndSave()}
                    disabled={isValidating || !inputKey.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
                  >
                    {isValidating ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{currentKey ? 'Guardar cambio' : 'Guardar y verificar'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Local Storage Guarantee Badge */}
              <div className="p-3 bg-[#121620] border border-[#232b38] flex items-start gap-2.5 text-zinc-300 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-white font-mono uppercase text-[11px] block">
                    Almacenamiento 100% local en tu navegador
                  </span>
                  <p className="text-zinc-400 text-[11px] font-sans leading-relaxed">
                    Tu clave se guarda exclusivamente en el almacenamiento local de este dispositivo (<code>localStorage</code>). Nunca se comparte, no se almacena en ninguna base de datos externa y puedes cambiarla o borrarla cuando desees.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3 bg-[#12131a] border-t border-[#22242c] flex items-center justify-between text-xs font-mono shrink-0">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            <span>Google Gemini</span>
            <span className="text-zinc-600">·</span>
            <span>Didáctica ELE</span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'manage' && (
              <button
                onClick={() => setActiveTab('tutorial')}
                className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                Ver instructivo
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
