"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  LÓGICA CRIPTOGRÁFICA (TypeScript puro, sin dependencias)           */
/* ------------------------------------------------------------------ */

const DIGIT_MAP: Record<string, string> = {
  "0": "sa",
  "1": "iv",
  "2": "al",
  "3": "ju",
  "4": "ig",
  "5": "ar",
  "6": "co",
  "7": "la",
  "8": "ja",
  "9": "wa",
};

const REVERSE_DIGIT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(DIGIT_MAP).map(([digit, code]) => [code, digit])
);

const MAX_PLAIN = 10; // largo máximo del texto original
const MAX_CIPHER = 40; // peor caso: 10 caracteres x 4 símbolos ("bmoa" / "Afar")
const ALNUM = /^[a-zA-Z0-9]+$/;

const reverseString = (s: string) => Array.from(s).reverse().join("");

/** Capa 1: sustitución personalizada. */
function layer1Encrypt(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") out += DIGIT_MAP[ch];
    else if (ch >= "a" && ch <= "z") out += "bmo" + ch;
    else if (ch >= "A" && ch <= "Z") out += ch + "far";
  }
  return out;
}

/**
 * Deshace la Capa 1 leyendo de izquierda a derecha (tokenizador).
 * Un simple replace encadenado NO sirve: el sufijo "far" contiene "ar"
 * (código del 5) y los códigos numéricos pueden solaparse entre sí
 * ("al"+"la" -> "alla"). El tokenizador es inequívoco porque:
 *   - mayúscula  -> siempre va seguida de "far"
 *   - "bmo" + minúscula -> letra minúscula
 *   - cualquier otro caso -> código de 2 letras de un dígito
 */
function layer1Decrypt(s: string): string | null {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch >= "A" && ch <= "Z" && s.startsWith("far", i + 1)) {
      out += ch;
      i += 4;
    } else if (
      s.startsWith("bmo", i) &&
      i + 3 < s.length &&
      s[i + 3] >= "a" &&
      s[i + 3] <= "z"
    ) {
      out += s[i + 3];
      i += 4;
    } else {
      const digit = REVERSE_DIGIT_MAP[s.slice(i, i + 2)];
      if (digit === undefined) return null; // formato inválido
      out += digit;
      i += 2;
    }
  }
  return out;
}

/** Capa 1 (sustitución) + Capa 2 (espejo). */
function encrypt(text: string) {
  const layer1 = layer1Encrypt(text);
  return { layer1, result: reverseString(layer1) };
}

/** Deshace Capa 2 (invertir) y luego Capa 1. */
function decrypt(cipher: string) {
  const unmirrored = reverseString(cipher);
  const result = layer1Decrypt(unmirrored);
  return { unmirrored, result };
}

/* ------------------------------------------------------------------ */
/*  INTERFAZ                                                           */
/* ------------------------------------------------------------------ */

type Mode = "encrypt" | "decrypt" | null;

export default function Home() {
  const [mode, setMode] = useState<Mode>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [intermediate, setIntermediate] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const clearOutput = () => {
    setResult("");
    setIntermediate("");
    setError("");
    setCopied(false);
  };

  const selectMode = (m: Mode) => {
    setMode(m);
    setInput("");
    clearOutput();
  };

  const exit = () => selectMode(null);

  const handleProcess = () => {
    clearOutput();
    if (!mode) return;

    const limit = mode === "encrypt" ? MAX_PLAIN : MAX_CIPHER;

    if (input.length === 0) {
      setError("El campo está vacío. Ingresa al menos 1 carácter.");
      return;
    }
    if (/\s/.test(input)) {
      setError("No se permiten espacios.");
      return;
    }
    if (!ALNUM.test(input)) {
      setError(
        "Solo se permiten caracteres alfanuméricos (a-z, A-Z, 0-9). Sin símbolos ni tildes."
      );
      return;
    }
    if (input.length > limit) {
      setError(
        mode === "encrypt"
          ? `El texto debe tener entre 1 y ${MAX_PLAIN} caracteres (actual: ${input.length}).`
          : `El texto cifrado no puede superar ${MAX_CIPHER} caracteres (actual: ${input.length}).`
      );
      return;
    }

    if (mode === "encrypt") {
      const { layer1, result } = encrypt(input);
      setIntermediate(layer1);
      setResult(result);
    } else {
      const { unmirrored, result } = decrypt(input);
      if (result === null || result.length < 1 || result.length > MAX_PLAIN) {
        setError(
          result !== null && result.length > MAX_PLAIN
            ? `El texto original resultante supera ${MAX_PLAIN} caracteres.`
            : "Texto cifrado inválido: no corresponde al formato generado por este sistema."
        );
        return;
      }
      setIntermediate(unmirrored);
      setResult(result);
    }
  };

  const handleCopy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(result);
        ok = true;
      }
    } catch {
      ok = false;
    }

    // Respaldo para navegadores/contextos donde la API moderna falla
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = result;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
    }

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const menu: { key: Mode | "exit"; label: string; n: number }[] = [
    { key: "encrypt", label: "Encriptar", n: 1 },
    { key: "decrypt", label: "Desencriptar", n: 2 },
    { key: "exit", label: "Salir", n: 3 },
  ];

  const isEnc = mode === "encrypt";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-2xl rounded-xl border border-emerald-500/30 bg-slate-900 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        {/* Barra de título estilo terminal */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="ml-3 text-xs text-slate-400">
            crypto-panel — sistema criptográfico
          </span>
        </div>

        <div className="p-6 space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-emerald-400">
              &gt; Sistema Criptográfico<span className="animate-pulse">_</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Texto de 1 a 10 caracteres alfanuméricos
            </p>
          </header>

          {/* Menú */}
          <nav className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {menu.map((item) => {
              const active = item.key === mode;
              return (
                <button
                  key={item.n}
                  onClick={() =>
                    item.key === "exit" ? exit() : selectMode(item.key as Mode)
                  }
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    active
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                      : item.key === "exit"
                      ? "border-slate-700 hover:border-red-400 hover:text-red-300"
                      : "border-slate-700 hover:border-emerald-400 hover:text-emerald-300"
                  }`}
                >
                  <span className="text-slate-500">{item.n}.-</span>{" "}
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Panel de trabajo */}
          {mode ? (
            <section className="space-y-4">
              <label className="block text-sm text-slate-400">
                {isEnc
                  ? "Texto a encriptar (1–10 caracteres, a-z A-Z 0-9):"
                  : "Texto a desencriptar (resultado de la encriptación):"}
                <input
                  type="text"
                  value={input}
                  maxLength={isEnc ? MAX_PLAIN : MAX_CIPHER}
                  onChange={(e) => {
                    setInput(e.target.value);
                    clearOutput();
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleProcess()}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={isEnc ? "Ej: Hola123" : "Ej: 3ujrafAbmol..."}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-emerald-300 placeholder-slate-600 outline-none focus:border-emerald-400"
                />
              </label>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {input.length}/{isEnc ? MAX_PLAIN : MAX_CIPHER} caracteres
                </span>
                <button
                  onClick={handleProcess}
                  className="rounded-lg bg-emerald-500 px-5 py-2 font-bold text-slate-950 hover:bg-emerald-400 transition"
                >
                  {isEnc ? "Encriptar" : "Desencriptar"}
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  ⚠ {error}
                </div>
              )}

              {result && (
                <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-950 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      {isEnc
                        ? "Paso 1 · Capa 1 (sustitución)"
                        : "Paso 1 · Texto invertido (deshace Capa 2)"}
                    </p>
                    <p className="break-all text-slate-300">{intermediate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      {isEnc
                        ? "Paso 2 · Capa 2 (espejo) — resultado final"
                        : "Paso 2 · Texto original (deshace Capa 1)"}
                    </p>
                    <p className="break-all text-lg font-bold text-emerald-400">
                      {result}
                    </p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="text-xs rounded border border-slate-700 px-3 py-1 text-slate-400 hover:border-emerald-400 hover:text-emerald-300"
                  >
                    {copied ? "¡Copiado!" : "Copiar resultado"}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <p className="text-sm text-slate-500">
              Selecciona una opción del menú para comenzar.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
