"use client";

import { useEffect, useRef, useState } from "react";

const REGION_ID = "barcode-scanner-region";

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const instance = new Html5Qrcode(REGION_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.ITF,
          ],
          verbose: false,
        });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 180 } },
          (decodedText) => {
            const now = Date.now();
            if (lastCodeRef.current.code === decodedText && now - lastCodeRef.current.at < 1500) {
              return;
            }
            lastCodeRef.current = { code: decodedText, at: now };
            if (navigator.vibrate) navigator.vibrate(80);
            onDetected(decodedText);
          },
          () => {
            // Игнорируем кадры без распознанного кода
          },
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? `Не удалось запустить камеру: ${err.message}`
            : "Не удалось запустить камеру",
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      if (instance) {
        instance
          .stop()
          .then(() => instance.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between bg-black/80 px-4 py-3 text-white">
        <span className="text-sm font-semibold">Наведите камеру на штрихкод</span>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20">
          Закрыть ✕
        </button>
      </div>
      <div className="relative flex-1">
        <div id={REGION_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      </div>
      {error && (
        <div className="bg-red-600 px-4 py-3 text-center text-sm text-white">{error}</div>
      )}
    </div>
  );
}
