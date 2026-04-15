export function judgmentStyle(j: string) {
  if (j === "hold")    return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "유지" };
  if (j === "monitor") return { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   label: "모니터링" };
  if (j === "sell")    return { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     label: "매도검토" };
  return                      { bg: "bg-gray-50",     text: "text-gray-700",    border: "border-gray-200",    label: j };
}

export function issueTagStyle(tag: string) {
  if (tag === "risk")    return { bg: "bg-red-50",   text: "text-red-700",   label: "위험" };
  if (tag === "caution") return { bg: "bg-amber-50", text: "text-amber-700", label: "주의" };
  if (tag === "watch")   return { bg: "bg-blue-50",  text: "text-blue-700",  label: "주시" };
  return                        { bg: "bg-gray-50",  text: "text-gray-700",  label: tag };
}

export function stockTypeLabel(type: string) {
  if (type === "growth")   return "성장";
  if (type === "value")    return "가치";
  if (type === "rebound")  return "반등";
  if (type === "dividend") return "배당";
  return type;
}

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

      // 1차 압축 (0.85 품질)
      let result = canvas.toDataURL("image/jpeg", 0.85);

      // base64 크기가 3MB 초과 시 추가 압축
      const MAX_B64_BYTES = 3 * 1024 * 1024;
      if (result.length > MAX_B64_BYTES) {
        result = canvas.toDataURL("image/jpeg", 0.6);
      }
      // 여전히 크면 해상도도 줄임
      if (result.length > MAX_B64_BYTES) {
        const canvas2 = document.createElement("canvas");
        canvas2.width = Math.round(width * 0.6);
        canvas2.height = Math.round(height * 0.6);
        canvas2.getContext("2d")!.drawImage(img, 0, 0, canvas2.width, canvas2.height);
        result = canvas2.toDataURL("image/jpeg", 0.6);
      }

      URL.revokeObjectURL(img.src);
      resolve(result);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
