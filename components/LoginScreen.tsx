"use client";

import { useState, useEffect, useRef } from "react";
import {
  hasPinSet,
  setPin as savePin,
  verifyPin,
  setHint,
  getHintQuestion,
  hasHintSet,
  verifyHintAnswer,
  resetPinWithHint,
} from "@/lib/storage";
import { Delete, TrendingUp, HelpCircle, ChevronLeft } from "lucide-react";

interface LoginScreenProps {
  onSuccess: () => void;
}

type Mode =
  | "verify"           // PIN 입력 (로그인)
  | "setup-pin"        // PIN 설정 (첫 등록)
  | "setup-confirm"    // PIN 확인
  | "setup-hint-q"     // 힌트 질문 입력
  | "setup-hint-a"     // 힌트 답변 입력
  | "recover-answer"   // 분실 복구: 힌트 답변 입력
  | "recover-pin"      // 분실 복구: 새 PIN 입력
  | "recover-confirm"; // 분실 복구: 새 PIN 확인

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

const PRESET_QUESTIONS = [
  "내가 가장 좋아하는 종목은?",
  "처음으로 산 주식은?",
  "나의 투자 목표 수익률은?",
  "내 투자 멘토 이름은?",
  "직접 입력",
];

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("verify");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [hintQuestion, setHintQuestion] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [hintAnswer, setHintAnswer] = useState("");
  const [recoverAnswer, setRecoverAnswer] = useState("");
  const [recoverPin, setRecoverPin] = useState("");
  const [recoverConfirmPin, setRecoverConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hintQ, setHintQ] = useState<string | null>(null);
  const answerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(hasPinSet() ? "verify" : "setup-pin");
    setHintQ(getHintQuestion());
  }, []);

  useEffect(() => {
    if (mode === "recover-answer" || mode === "setup-hint-a") {
      setTimeout(() => answerRef.current?.focus(), 100);
    }
  }, [mode]);

  function triggerShake(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  // ── 숫자 패드 핸들러 ──
  async function handleDigit(d: string) {
    if (loading) return;

    const isPinConfirmMode = mode === "setup-confirm" || mode === "recover-confirm";
    const current = isPinConfirmMode
      ? mode === "setup-confirm" ? confirmPin : recoverConfirmPin
      : mode === "recover-pin" ? recoverPin : pin;

    if (d === "del") {
      setError("");
      if (mode === "setup-confirm") setConfirmPin((p) => p.slice(0, -1));
      else if (mode === "recover-confirm") setRecoverConfirmPin((p) => p.slice(0, -1));
      else if (mode === "recover-pin") setRecoverPin((p) => p.slice(0, -1));
      else setPin((p) => p.slice(0, -1));
      return;
    }

    if (current.length >= 4) return;
    const next = current + d;

    if (mode === "setup-pin") {
      setPin(next);
      if (next.length === 4) {
        setMode("setup-confirm");
        setConfirmPin("");
        setError("");
      }
    } else if (mode === "setup-confirm") {
      setConfirmPin(next);
      if (next.length === 4) await submitSetupConfirm(next);
    } else if (mode === "verify") {
      setPin(next);
      if (next.length === 4) await submitVerify(next);
    } else if (mode === "recover-pin") {
      setRecoverPin(next);
      if (next.length === 4) {
        setMode("recover-confirm");
        setRecoverConfirmPin("");
        setError("");
      }
    } else if (mode === "recover-confirm") {
      setRecoverConfirmPin(next);
      if (next.length === 4) await submitRecoverConfirm(next);
    }
  }

  async function submitVerify(value: string) {
    setLoading(true);
    const ok = await verifyPin(value);
    if (ok) {
      onSuccess();
    } else {
      setPin("");
      triggerShake("잘못된 PIN입니다");
    }
    setLoading(false);
  }

  async function submitSetupConfirm(value: string) {
    setLoading(true);
    if (value !== pin) {
      setConfirmPin("");
      triggerShake("PIN이 일치하지 않아요");
      setTimeout(() => {
        setMode("setup-pin");
        setPin("");
        setConfirmPin("");
      }, 800);
    } else {
      // PIN 저장 → 힌트 설정으로
      await savePin(pin);
      setMode("setup-hint-q");
      setError("");
    }
    setLoading(false);
  }

  async function submitRecoverConfirm(value: string) {
    setLoading(true);
    if (value !== recoverPin) {
      setRecoverConfirmPin("");
      triggerShake("PIN이 일치하지 않아요");
      setTimeout(() => {
        setMode("recover-pin");
        setRecoverPin("");
        setRecoverConfirmPin("");
      }, 800);
    } else {
      const ok = await resetPinWithHint(recoverAnswer, recoverPin);
      if (ok) {
        setHintQ(getHintQuestion());
        onSuccess();
      } else {
        triggerShake("오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
    setLoading(false);
  }

  async function submitHintSetup() {
    const q = hintQuestion === "직접 입력" ? customQuestion.trim() : hintQuestion.trim();
    if (!q) { setError("질문을 입력해주세요"); return; }
    if (!hintAnswer.trim()) { setError("답변을 입력해주세요"); return; }
    setLoading(true);
    await setHint(q, hintAnswer);
    setLoading(false);
    onSuccess();
  }

  function skipHint() {
    // 힌트 없이 바로 진입
    onSuccess();
  }

  async function submitRecoverAnswer() {
    if (!recoverAnswer.trim()) { setError("답변을 입력해주세요"); return; }
    setLoading(true);
    const ok = await verifyHintAnswer(recoverAnswer);
    if (ok) {
      setMode("recover-pin");
      setRecoverPin("");
      setError("");
    } else {
      setError("답변이 일치하지 않아요");
    }
    setLoading(false);
  }

  // ── 현재 모드별 PIN 도트에 표시할 값 ──
  const dotValue =
    mode === "setup-confirm" ? confirmPin
    : mode === "recover-pin" ? recoverPin
    : mode === "recover-confirm" ? recoverConfirmPin
    : pin;

  const isPinMode = ["verify", "setup-pin", "setup-confirm", "recover-pin", "recover-confirm"].includes(mode);

  // ── 진행 단계 표시 ──
  const setupSteps = ["setup-pin", "setup-confirm", "setup-hint-q", "setup-hint-a"];
  const recoverSteps = ["recover-answer", "recover-pin", "recover-confirm"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-8 select-none">
      {/* 로고 */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-violet-200">
          <TrendingUp size={26} className="text-white" />
        </div>
        <h1 className="font-bold text-lg text-gray-900">주식 모닝 브리핑</h1>
      </div>

      {/* ── PIN 입력/설정 화면 ── */}
      {isPinMode && (
        <>
          {/* 뒤로가기 (복구 모드) */}
          {(mode === "recover-pin" || mode === "recover-confirm") && (
            <button
              onClick={() => { setMode("recover-answer"); setRecoverPin(""); setRecoverConfirmPin(""); setError(""); }}
              className="absolute top-6 left-4 flex items-center gap-1 text-sm text-gray-400"
            >
              <ChevronLeft size={16} /> 이전
            </button>
          )}

          <div className="text-center mb-6">
            <h2 className="font-semibold text-gray-800">
              {mode === "verify" && "PIN 입력"}
              {mode === "setup-pin" && "PIN 설정"}
              {mode === "setup-confirm" && "PIN 확인"}
              {mode === "recover-pin" && "새 PIN 설정"}
              {mode === "recover-confirm" && "새 PIN 확인"}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {mode === "verify" && "4자리 PIN을 입력해주세요"}
              {mode === "setup-pin" && "사용할 4자리 PIN을 입력하세요"}
              {mode === "setup-confirm" && "PIN을 한 번 더 입력하세요"}
              {mode === "recover-pin" && "새로 사용할 4자리 PIN을 입력하세요"}
              {mode === "recover-confirm" && "새 PIN을 한 번 더 입력하세요"}
            </p>
          </div>

          {/* PIN 도트 */}
          <div className={`flex gap-4 mb-3 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < dotValue.length
                    ? "bg-violet-600 border-violet-600 scale-110"
                    : "bg-transparent border-gray-300"
                }`}
              />
            ))}
          </div>

          {/* 에러 */}
          <div className="h-5 mb-4">
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          </div>

          {/* 숫자 패드 */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
            {DIGITS.map((d, i) => {
              if (d === "") return <div key={i} />;
              if (d === "del") {
                return (
                  <button key={i} onClick={() => handleDigit("del")}
                    className="h-16 rounded-2xl flex items-center justify-center text-gray-500 active:bg-gray-100">
                    <Delete size={22} />
                  </button>
                );
              }
              return (
                <button key={i} onClick={() => handleDigit(d)}
                  className="h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl font-semibold text-gray-800 active:bg-violet-50 active:border-violet-200 active:text-violet-700 transition-colors">
                  {d}
                </button>
              );
            })}
          </div>

          {/* 진행 단계 (setup) */}
          {setupSteps.includes(mode) && (
            <div className="flex gap-2 mt-6">
              {setupSteps.map((s) => (
                <div key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${s === mode ? "bg-violet-600" : setupSteps.indexOf(s) < setupSteps.indexOf(mode) ? "bg-violet-300" : "bg-gray-200"}`} />
              ))}
            </div>
          )}

          {/* 복구 단계 (recover) */}
          {recoverSteps.includes(mode) && (
            <div className="flex gap-2 mt-6">
              {recoverSteps.map((s) => (
                <div key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${s === mode ? "bg-violet-600" : recoverSteps.indexOf(s) < recoverSteps.indexOf(mode) ? "bg-violet-300" : "bg-gray-200"}`} />
              ))}
            </div>
          )}

          {/* PIN 분실 버튼 (verify 모드에서만) */}
          {mode === "verify" && hasHintSet() && (
            <button
              onClick={() => { setMode("recover-answer"); setRecoverAnswer(""); setError(""); }}
              className="mt-8 flex items-center gap-1.5 text-sm text-violet-500 active:text-violet-700"
            >
              <HelpCircle size={15} />
              PIN을 잊었나요?
            </button>
          )}
        </>
      )}

      {/* ── 힌트 질문 선택 ── */}
      {mode === "setup-hint-q" && (
        <div className="w-full max-w-[320px]">
          <div className="text-center mb-6">
            <h2 className="font-semibold text-gray-800">힌트 질문 설정</h2>
            <p className="text-sm text-gray-400 mt-1">PIN 분실 시 사용할 질문을 선택하세요</p>
          </div>

          <div className="space-y-2">
            {PRESET_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => { setHintQuestion(q); if (q !== "직접 입력") { setMode("setup-hint-a"); setError(""); } }}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  hintQuestion === q
                    ? "border-violet-400 bg-violet-50 text-violet-700 font-medium"
                    : "border-gray-100 bg-gray-50 text-gray-700"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {hintQuestion === "직접 입력" && (
            <div className="mt-3">
              <input
                autoFocus
                placeholder="질문을 직접 입력하세요"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                onClick={() => {
                  if (!customQuestion.trim()) { setError("질문을 입력해주세요"); return; }
                  setMode("setup-hint-a"); setError("");
                }}
                className="mt-2 w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-medium"
              >
                다음
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-500 text-center mt-2">{error}</p>}

          <button onClick={skipHint} className="mt-4 w-full text-center text-sm text-gray-400 active:text-gray-600">
            나중에 설정할게요
          </button>

          {/* 진행 단계 */}
          <div className="flex gap-2 justify-center mt-6">
            {setupSteps.map((s) => (
              <div key={s}
                className={`w-2 h-2 rounded-full transition-colors ${s === mode ? "bg-violet-600" : setupSteps.indexOf(s) < setupSteps.indexOf(mode) ? "bg-violet-300" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
      )}

      {/* ── 힌트 답변 입력 (설정 시) ── */}
      {mode === "setup-hint-a" && (
        <div className="w-full max-w-[320px]">
          <button
            onClick={() => { setMode("setup-hint-q"); setHintAnswer(""); setError(""); }}
            className="flex items-center gap-1 text-sm text-gray-400 mb-6"
          >
            <ChevronLeft size={16} /> 이전
          </button>

          <div className="text-center mb-6">
            <h2 className="font-semibold text-gray-800">힌트 답변 입력</h2>
            <div className="mt-3 bg-violet-50 rounded-xl px-4 py-2.5 inline-block">
              <p className="text-sm text-violet-700 font-medium">
                &ldquo;{hintQuestion === "직접 입력" ? customQuestion : hintQuestion}&rdquo;
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-2">대소문자·공백은 무시됩니다</p>
          </div>

          <input
            ref={answerRef}
            placeholder="답변을 입력하세요"
            value={hintAnswer}
            onChange={(e) => { setHintAnswer(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && submitHintSetup()}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}

          <button
            onClick={submitHintSetup}
            disabled={loading}
            className="mt-3 w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-60"
          >
            {loading ? "저장 중..." : "완료"}
          </button>

          {/* 진행 단계 */}
          <div className="flex gap-2 justify-center mt-6">
            {setupSteps.map((s) => (
              <div key={s}
                className={`w-2 h-2 rounded-full transition-colors ${s === mode ? "bg-violet-600" : setupSteps.indexOf(s) < setupSteps.indexOf(mode) ? "bg-violet-300" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
      )}

      {/* ── PIN 분실 복구: 힌트 답변 입력 ── */}
      {mode === "recover-answer" && (
        <div className="w-full max-w-[320px]">
          <button
            onClick={() => { setMode("verify"); setPin(""); setError(""); }}
            className="flex items-center gap-1 text-sm text-gray-400 mb-6"
          >
            <ChevronLeft size={16} /> 로그인으로
          </button>

          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <HelpCircle size={22} className="text-amber-600" />
            </div>
            <h2 className="font-semibold text-gray-800">PIN 복구</h2>
            {hintQ ? (
              <>
                <p className="text-sm text-gray-500 mt-2">아래 질문에 답하면 PIN을 재설정할 수 있어요</p>
                <div className="mt-3 bg-amber-50 rounded-xl px-4 py-2.5">
                  <p className="text-sm text-amber-800 font-medium">&ldquo;{hintQ}&rdquo;</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">대소문자·공백은 무시됩니다</p>
              </>
            ) : (
              <p className="text-sm text-red-400 mt-2">등록된 힌트 질문이 없어요.<br/>PIN을 재설정하려면 앱 데이터를 초기화해야 합니다.</p>
            )}
          </div>

          {hintQ && (
            <>
              <input
                ref={answerRef}
                placeholder="힌트 답변 입력"
                value={recoverAnswer}
                onChange={(e) => { setRecoverAnswer(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submitRecoverAnswer()}
                className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-300 ${
                  error ? "border-red-300 bg-red-50" : "border-gray-200"
                }`}
              />
              {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
              <button
                onClick={submitRecoverAnswer}
                disabled={loading}
                className="mt-3 w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {loading ? "확인 중..." : "다음"}
              </button>
            </>
          )}

          {/* 진행 단계 */}
          <div className="flex gap-2 justify-center mt-6">
            {recoverSteps.map((s) => (
              <div key={s}
                className={`w-2 h-2 rounded-full transition-colors ${s === mode ? "bg-violet-600" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
