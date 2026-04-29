import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrowserQRCodeReader } from "@zxing/browser";

type QrCameraScannerProps = {
  onDetected: (value: string) => void;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const zxingReader = new BrowserQRCodeReader();

export const QrCameraScanner = ({ onDetected }: QrCameraScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorConstructor> | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [engine, setEngine] = useState<"native" | "zxing" | null>(null);

  const stopScanner = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    zxingReader.reset();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsRunning(false);
    setEngine(null);
  };

  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    if (videoRef.current.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      const found = barcodes.find((b) => b.rawValue && b.rawValue.trim().length > 0);
      if (found?.rawValue) {
        onDetected(found.rawValue);
        stopScanner();
        return;
      }
    }

    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const startNativeScanner = async () => {
    detectorRef.current = new window.BarcodeDetector!({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    setEngine("native");
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const startZxingScanner = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    streamRef.current = stream;

    setEngine("zxing");
    setIsRunning(true);

    zxingReader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
      const text = result?.getText();
      if (text && text.trim().length > 0) {
        onDetected(text);
        stopScanner();
      }
    });
  };

  const startScanner = async () => {
    setErrorText("");
    setIsStarting(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorText("Camera is not available on this device/browser.");
      setIsStarting(false);
      return;
    }

    if (window.BarcodeDetector) {
      await startNativeScanner();
    } else {
      await startZxingScanner();
    }

    setIsStarting(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="rounded-3xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Camera Scanner</p>
        {!isRunning ? (
          <Button
            onClick={startScanner}
            disabled={isStarting}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-600"
          >
            {isStarting ? "Starting..." : "Start Camera"}
          </Button>
        ) : (
          <Button onClick={stopScanner} variant="secondary" className="rounded-xl">
            Stop Camera
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-slate-100">
        <video ref={videoRef} className="h-64 w-full object-cover sm:h-80" muted playsInline />
      </div>

      {errorText ? (
        <p className="mt-3 text-sm text-rose-600">{errorText}</p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          {isRunning
            ? `Scanning with ${engine === "native" ? "native camera engine" : "fallback camera engine"}...`
            : "Point camera at a QR label. Scan stops automatically when a code is found."}
        </p>
      )}
    </div>
  );
};