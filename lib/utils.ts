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
      const MAX = 900;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
