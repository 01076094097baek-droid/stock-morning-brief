"use client";

import { useState } from "react";
import {
  hasPin,
  setPin as savePin,
  verifyPin,
  startSession,
  setHint,
  hasHint,
  getHintQuestion,
  verifyHintAnswer,
  resetPinWithHint,
} from "@/lib/storage";
import { ChevronLeft } from "lucide-react";

type Mode =
  | "verify"
  | "setup-pin" | "setup-confirm" | "setup-hint-q" | "setup-hint-a"
  | "recover-answer" | "recover-pin" | "recover-confirm";

const PRESET_QUESTIONS = [
  "내가 가장 좋아하는 종목은?",
  "처음으로 산 주식은?",
  "나의 투자 목표 금액은?",
  "첫 번째 주식 앱 이름은?",
  "직접 입력",
];

interface Props { onSuccess: () => void; }

export default function LoginScreen({ onSuccess }: Props) {
  const [mode,       setMode]       = useState<Mode>(hasPin() ? "verify" : "setup-pin");
  const [pin,        setPin]        = useState("");
  const [pinFirst,   setPinFirst]   = useState("");
  const [hintQ,      setHintQ]      = useState(PRESET_QUESTIONS[0]);
  const [customQ,    setCustomQ]    = useState("");
  const [hintA,      setHintA]      = useState("");
  const [hintInput,  setHintInput]  = useState("");
  const [error,      setError]      = useState("");

  const question = hintQ === "직접 입력" ? customQ : hintQ;

  function pressDigit(d: string) {
    setError("");
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) handleComplete(next);
  }

  function handleComplete(val: string) {
    if (mode === "verify") {
      verifyPin(val).then((ok) => {
        if (ok) { startSession(); onSuccess(); }
        else   { setError("PIN이 틀렸습니다"); setPin(""); }
      });
    } else if (mode === "setup-pin") {
      setPinFirst(val);
      setPin("");
      setMode("setup-confirm");
    } else if (mode === "setup-confirm") {
      if (val !== pinFirst) { setError("PIN이 일치하지 않습니다"); setPin(""); return; }
      savePin(val).then(() => { setPin(""); setMode("setup-hint-q"); });
    } else if (mode === "recover-pin") {
      setPinFirst(val);
      setPin("");
      setMode("recover-confirm");
    } else if (mode === "recover-confirm") {
      if (val !== pinFirst) { setError("PIN이 일치하지 않습니다"); setPin(""); return; }
      resetPinWithHint(hintInput, val).then((ok) => {
        if (ok) { startSession(); onSuccess(); }
        else   { setError("오류가 발생했습니다"); setPin(""); }
      });
    }
  }

  function submitHintAnswer() {
    if (!hintInput.trim()) { setError("답변을 입력해주세요"); return; }
    if (!verifyHintAnswer(hintInput)) { setError("답변이 틀렸습니다"); return; }
    setError("");
    setPin("");
    setMode("recover-pin");
  }

  function finishHintSetup() {
    if (!question.trim()) { setError("질문을 입력해주세요"); return; }
    if (!hintA.trim())    { setError("답변을 입력해주세요"); return; }
    setHint(question, hintA);
    startSession();
    onSuccess();
  }

  const isPinMode = ["verify", "setup-pin", "setup-confirm", "recover-pin", "recover-confirm"].includes(mode);

  const titles: Record<Mode, string> = {
    "verify":          "PIN 입력",
    "setup-pin":       "새 PIN 설정",
    "setup-confirm":   "PIN 확인",
    "setup-hint-q":    "힌트 질문 설정",
    "setup-hint-a":    "힌트 답변 입력",
    "recover-answer":  "힌트 답변 입력",
    "recover-pin":     "새 PIN 설정",
    "recover-confirm": "새 PIN 확인",
  };

  const subtitles: Record<Mode, string> = {
    "verify":          "4자리 PIN을 입력하세요",
    "setup-pin":       "사용할 PIN 4자리를 입력하세요",
    "setup-confirm":   "PIN을 한 번 더 입력하세요",
    "setup-hint-q":    "PIN 분실 시 복구에 사용할 질문을 선택하세요",
    "setup-hint-a":    "질문에 대한 답변을 입력하세요",
    "recover-answer":  getHintQuestion() || "힌트 질문에 답변하세요",
    "recover-pin":     "새 PIN 4자리를 입력하세요",
    "recover-confirm": "새 PIN을 한 번 더 입력하세요",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-white">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-3">
          <span className="text-white text-3xl font-black">주</span>
        </div>
        <p className="text-xs text-gray-400">주식 모닝 브리핑</p>
      </div>

      {/* Back button */}
      {(mode !== "verify" && mode !== "setup-pin") && (
        <button
          onClick={() => { setPin(""); setError(""); setMode(mode === "recover-answer" || mode === "recover-pin" || mode === "recover-confirm" ? "verify" : "verify"); }}
          className="absolute top-4 left-4 p-2 text-gray-400"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      <h2 className="text-xl font-bold text-gray-900 mb-1">{titles[mode]}</h2>
      <p className="text-sm text-gray-400 mb-8 text-center leading-relaxed">{subtitles[mode]}</p>

      {/* PIN dots */}
      {isPinMode && (
        <>
          <div className="flex gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all ${
                  i < pin.length ? "bg-violet-600 scale-110" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 w-64">
            {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
              <button
                key={i}
                disabled={!k}
                onClick={() => k === "⌫" ? (setPin((p) => p.slice(0, -1)), setError("")) : pressDigit(k)}
                className={`h-14 rounded-2xl text-xl font-semibold transition-colors ${
                  !k ? "invisible" :
                  k === "⌫" ? "bg-gray-100 text-gray-500 active:bg-gray-200" :
                  "bg-gray-50 text-gray-900 active:bg-violet-100"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* PIN recovery / forget */}
          {mode === "verify" && hasHint() && (
            <button
              onClick={() => { setPin(""); setError(""); setMode("recover-answer"); }}
              className="mt-6 text-sm text-violet-500 underline"
            >
              PIN을 잊었나요?
            </button>
          )}
        </>
      )}

      {/* Hint Q selection */}
      {mode === "setup-hint-q" && (
        <div className="w-full space-y-2">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => { setHintQ(q); if (q !== "직접 입력") setMode("setup-hint-a"); }}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                hintQ === q ? "border-violet-400 bg-violet-50 text-violet-700 font-semibold" : "border-gray-200 text-gray-700"
              }`}
            >
              {q}
            </button>
          ))}
          {hintQ === "직접 입력" && (
            <>
              <input
                placeholder="질문을 직접 입력하세요"
                value={customQ}
                onChange={(e) => setCustomQ(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-400"
              />
              <button
                onClick={() => customQ.trim() && setMode("setup-hint-a")}
                className="w-full bg-violet-600 text-white py-3 rounded-xl text-sm font-semibold"
              >
                다음
              </button>
            </>
          )}
        </div>
      )}

      {/* Hint A setup */}
      {mode === "setup-hint-a" && (
        <div className="w-full space-y-3">
          <p className="text-sm text-gray-600 text-center font-medium">&ldquo;{question}&rdquo;</p>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <input
            placeholder="답변 입력"
            value={hintA}
            onChange={(e) => setHintA(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-400"
          />
          <button
            onClick={finishHintSetup}
            className="w-full bg-violet-600 text-white py-3 rounded-xl text-sm font-semibold"
          >
            완료
          </button>
          <button
            onClick={() => { startSession(); onSuccess(); }}
            className="w-full text-gray-400 text-sm"
          >
            건너뛰기
          </button>
        </div>
      )}

      {/* Recover answer */}
      {mode === "recover-answer" && (
        <div className="w-full space-y-3">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <input
            placeholder="힌트 답변 입력"
            value={hintInput}
            onChange={(e) => setHintInput(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-400"
          />
          <button
            onClick={submitHintAnswer}
            className="w-full bg-violet-600 text-white py-3 rounded-xl text-sm font-semibold"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
