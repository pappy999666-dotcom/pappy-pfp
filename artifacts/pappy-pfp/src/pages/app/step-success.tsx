import { useEffect, useRef } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw, ExternalLink, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useGetSession } from "@workspace/api-client-react";
import { useSoundContext } from "@/components/layout/navbar";

export default function StepSuccess() {
  const { uploadedImage, sessionId, resetWizard } = useWizard();
  const soundPlayed = useRef(false);
  const { soundOn } = useSoundContext();

  const { data: session } = useGetSession(sessionId || "", {
    query: { enabled: !!sessionId },
  });

  // Play success sound once
  useEffect(() => {
    if (soundPlayed.current) return;
    soundPlayed.current = true;
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, ctx.currentTime);       // C5
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, []);

  if (!uploadedImage) return null;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
    >
      <Card className="border-green-500/30 bg-[#0A0E1A]/90 backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/10 blur-[100px] rounded-full" />
        </div>

        <CardContent className="flex flex-col items-center pt-14 pb-8 text-center relative z-10 space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
          >
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </motion.div>

          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Profile Updated! 🎉</h2>
            <p className="text-white/50 text-base max-w-xs mx-auto">
              Your new WhatsApp profile picture is live. Check your phone to confirm.
            </p>
          </div>

          <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.25)]">
            <img src={uploadedImage.dataUrl} alt="New profile picture" className="w-full h-full object-cover" />
          </div>

          {session?.sessionType === "temporary" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <ShieldCheck className="w-4 h-4" />
              Session securely removed — no data retained.
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center border-t border-white/5 pt-6 pb-8 relative z-10">
          <Button variant="ghost" onClick={resetWizard} className="text-white/60 hover:text-white h-11 px-6">
            <RotateCcw className="w-4 h-4 mr-2" /> Change Another
          </Button>
          <Button
            className="h-11 px-6 bg-[#229ED9] hover:bg-[#1a8bbf] text-white border-none gap-2"
            onClick={() => window.open("https://t.me/pappymythic", "_blank")}
          >
            <ExternalLink className="w-4 h-4" /> Join Our Channel
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
