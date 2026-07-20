import { useEffect, useState } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, SmartphoneNfc, Copy, Check, Users } from "lucide-react";
import { useGetSession, useGetSessionQR, useGetSessionStatus } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

// Fetch live pair count from /api/stats
function useLivePairCount() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) return { totalPairs: 0 };
      return res.json() as Promise<{ totalPairs: number }>;
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export default function StepPairing() {
  const { sessionId, setStep } = useWizard();
  const [localStatus, setLocalStatus] = useState<string>("connecting");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { data: stats } = useLivePairCount();

  if (!sessionId) { setStep(1); return null; }

  const { data: session } = useGetSession(sessionId, {
    query: { refetchInterval: 1500, enabled: !!sessionId },
  });

  const { data: qrData } = useGetSessionQR(sessionId, {
    query: {
      enabled: session?.pairingMethod === "qr" && session?.status === "awaiting_scan",
      refetchInterval: 20_000,
    },
  });

  const { data: statusInfo } = useGetSessionStatus(sessionId, {
    query: {
      refetchInterval: 1500,
      enabled: !!sessionId && !["paired","completed","failed","logged_out"].includes(localStatus),
    },
  });

  useEffect(() => {
    if (!statusInfo) return;
    setLocalStatus(statusInfo.status);
    if (["paired","uploading","applying","completed"].includes(statusInfo.status)) {
      setTimeout(() => setStep(6), 800);
    }
    if (statusInfo.status === "failed") {
      toast({
        title: "Connection Failed",
        description: statusInfo.message || "Please try again.",
        variant: "destructive",
      });
    }
  }, [statusInfo, setStep, toast]);

  const handleCopy = () => {
    if (!session?.pairingCode) return;
    navigator.clipboard.writeText(session.pairingCode).then(() => {
      setCopied(true);
      toast({ title: "Copied!", description: "Pairing code copied to clipboard." });
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast({ title: "Copy failed", description: "Please copy the code manually.", variant: "destructive" });
    });
  };

  const status = session?.status ?? localStatus;
  const isConnecting = status === "connecting";
  const isCodeMethod = session?.pairingMethod === "code";
  const isFailed = status === "failed";

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl relative overflow-hidden">

      {/* Live pair counter badge */}
      {stats && stats.totalPairs > 0 && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
          <Users className="w-3 h-3" />
          <span>{stats.totalPairs.toLocaleString()} paired</span>
        </div>
      )}

      {/* Connecting background pulse */}
      {isConnecting && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMjBMNDAgMjAiIHN0cm9rZT0iIzAwRDRGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')] animate-[slide-right_2s_linear_infinite]" />
        </div>
      )}

      <CardHeader className="text-center relative z-10 pt-8">
        <CardTitle className="text-2xl">
          {isFailed ? "Connection Failed" : isConnecting ? "Connecting..." : "Link Your WhatsApp"}
        </CardTitle>
        <CardDescription className="text-white/50">
          {isFailed
            ? "Something went wrong. Please go back and try again."
            : isConnecting
            ? "Establishing secure connection to WhatsApp servers."
            : "Follow the steps below on your phone."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 relative z-10 pt-2 pb-6">

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isFailed ? "bg-red-500" : "bg-primary"}`}
            initial={{ width: "5%" }}
            animate={{
              width: isFailed ? "100%" :
                     isConnecting ? "20%" :
                     status === "awaiting_code_entry" || status === "awaiting_scan" ? "40%" :
                     "60%"
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        <AnimatePresence mode="wait">

          {/* Connecting state */}
          {isConnecting && (
            <motion.div key="connecting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10"
            >
              <div className="relative w-20 h-20 flex items-center justify-center mb-4">
                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-primary/50" />
                <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
                  className="absolute inset-[-8px] rounded-full border border-purple-500/30" />
                <SmartphoneNfc className="w-9 h-9 text-primary relative z-10" />
              </div>
              <p className="font-mono text-primary text-xs tracking-widest uppercase">Negotiating Handshake</p>
              <p className="text-white/40 text-xs mt-2">This usually takes 5–15 seconds</p>
            </motion.div>
          )}

          {/* Failed state */}
          {isFailed && (
            <motion.div key="failed"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <span className="text-2xl">✕</span>
              </div>
              <p className="text-white/60 text-sm text-center max-w-xs">
                {statusInfo?.message || "Connection failed. Please go back and try again."}
              </p>
            </motion.div>
          )}

          {/* Pairing code */}
          {!isConnecting && !isFailed && isCodeMethod && (
            <motion.div key="code"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="bg-black/60 border border-white/10 rounded-2xl p-6 flex flex-col items-center w-full max-w-sm">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Your Pairing Code</p>
                {session?.pairingCode ? (
                  <>
                    <div className="font-mono text-5xl font-bold tracking-[0.18em] text-white mb-1">
                      {session.pairingCode}
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleCopy}
                      className="mt-2 text-white/50 hover:text-white gap-2 text-xs">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy Code"}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-white/40 text-xs">Generating code...</p>
                  </div>
                )}
              </div>
              <div className="w-full max-w-sm space-y-3">
                <Instruction n={1} text="Open WhatsApp on your phone" />
                <Instruction n={2} text="Tap ⋮ (3 dots) → Linked Devices" />
                <Instruction n={3} text="Tap 'Link a Device'" />
                <Instruction n={4} text="Tap 'Link with phone number instead'" />
                <Instruction n={5} text="Enter the code shown above" />
              </div>
            </motion.div>
          )}

          {/* QR code */}
          {!isConnecting && !isFailed && !isCodeMethod && (
            <motion.div key="qr"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="bg-white p-3 rounded-xl shadow-2xl relative overflow-hidden">
                {qrData?.qrDataUrl ? (
                  <img src={qrData.qrDataUrl} alt="WhatsApp QR Code" className="w-56 h-56 block" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-gray-50 rounded-lg">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}
                <motion.div
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_3px_rgba(0,212,255,0.7)] z-10"
                />
              </div>
              <div className="w-full max-w-sm space-y-3">
                <Instruction n={1} text="Open WhatsApp on your phone" />
                <Instruction n={2} text="Tap ⋮ (3 dots) → Linked Devices" />
                <Instruction n={3} text="Tap 'Link a Device'" />
                <Instruction n={4} text="Point your camera at the QR code" />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </CardContent>

      {!isConnecting && (
        <CardFooter className="border-t border-white/5 pt-4 pb-5 relative z-10">
          <Button variant="ghost" onClick={() => setStep(4)} className="text-white/50 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Change Method
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function Instruction({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold shrink-0 text-primary mt-0.5">
        {n}
      </div>
      <p className="text-white/70 text-sm leading-snug">{text}</p>
    </div>
  );
}
