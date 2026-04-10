"use client";

import { useState, useEffect } from "react";
import { hasPinSet, setPin as savePin, verifyPin } from "@/lib/storage";
import { Delete, TrendingUp } from "lucide-react";

interface LoginScreenProps {
  onSuccess: () => void;
}

type Mode = "verify" | "setup-enter" | "setup-confirm";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("verify");
  const [pin, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(hasPinSet() ? "verify" : "setup-enter");
  }, []);

  function triggerShake(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function handleDigit(d: string) {
    if (loading) return;

    if (d === "del") {
      if (mode === "setup-confirm") {
        setConfirmPin((p) => p.slice(0, -1));
      } else {
        setPinValue((p) => p.slice(0, -1));
      }
      setError("");
      return;
    }

    const current = mode === "setup-confirm" ? confirmPin : pin;
    if (current.length >= 4) return;

    const next = current + d;

    if (mode === "setup-confirm") {
      setConfirmPin(next);
      if (next.length === 4) {
        await submitConfirm(next);
      }
    } else {
      setPinValue(next);
      if (next.length === 4) {
        await submit(next);
      }
    }
  }

  async function submit(value: string) {
    setLoading(true);
    if (mode === "verify") {
      const ok = await verifyPin(value);
      if (ok) {
        onSuccess();
      } else {
        setPinValue("");
        triggerShake("잘못된 PIN입니다");
      }
    } else {
      // setup-enter → setup-confirm
      setMode("setup-confirm");
      setConfirmPin("");
      setError("");
    }
    setLoading(false);
  }

  async function submitConfirm(value: string) {
    setLoading(true);
    if (value !== pin) {
      setConfirmPin("");
      triggerShake("PIN이 일치하지 않아요. 다시 시도해주세요");
      setTimeout(() => {
        setMode("setup-enter");
        setPinValue("");
        setConfirmPin("");
      }, 800);
    } else {
      await savePin(pin);
      onSuccess();
    }
    setLoading(false);
  }

  const currentValue = mode === "setup-confirm" ? confirmPin : pin;

  const titles: Record<Mode, string> = {
    verify: "PIN 입력",
    "setup-enter": "PIN 설정",
    "setup-confirm": "PIN 확인",
  };

  const subtitles: Record<Mode, string> = {
    verify: "4자리 PIN을 입력해주세요",
    "setup-enter": "사용할 4자리 PIN을 입력하세요",
    "setup-confirm": "PIN을 한 번 더 입력하세요",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-8 select-none">
      {/* 로고 */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200">
          <TrendingUp size={30} className="text-white" />
        </div>
        <h1 className="font-bold text-xl text-gray-900">주식 모닝 브리핑</h1>
        <p className="text-sm text-gray-400 mt-1">AI 기반 매일 아침 투자 브리핑</p>
      </div>

      {/* 타이틀 */}
      <div className="text-center mb-8">
        <h2 className="font-semibold text-gray-800">{titles[mode]}</h2>
        <p className="text-sm text-gray-400 mt-1">{subtitles[mode]}</p>
      </div>

      {/* PIN 도트 */}
      <div className={`flex gap-4 mb-3 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < currentValue.length
                ? "bg-violet-600 border-violet-600 scale-110"
                : "bg-transparent border-gray-300"
            }`}
          />
        ))}
      </div>

      {/* 에러 메시지 */}
      <div className="h-5 mb-6">
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>

      {/* 숫자 패드 */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {DIGITS.map((d, i) => {
          if (d === "") return <div key={i} />;

          if (d === "del") {
            return (
              <button
                key={i}
                onClick={() => handleDigit("del")}
                className="h-16 rounded-2xl flex items-center justify-center text-gray-500 active:bg-gray-100 transition-colors"
              >
                <Delete size={22} />
              </button>
            );
          }

          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl font-semibold text-gray-800 active:bg-violet-50 active:border-violet-200 active:text-violet-700 transition-colors"
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* 진행 표시 (설정 모드) */}
      {mode !== "verify" && (
        <div className="flex gap-2 mt-8">
          <div className={`w-2 h-2 rounded-full transition-colors ${mode === "setup-enter" ? "bg-violet-600" : "bg-gray-200"}`} />
          <div className={`w-2 h-2 rounded-full transition-colors ${mode === "setup-confirm" ? "bg-violet-600" : "bg-gray-200"}`} />
        </div>
      )}
    </div>
  );
}
