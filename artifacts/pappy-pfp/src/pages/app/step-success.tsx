import { useWizard } from "./wizard-context";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, MessageCircle, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useGetSession } from "@workspace/api-client-react";

export default function StepSuccess() {
  const { uploadedImage, sessionId, resetWizard } = useWizard();
  
  const { data: session } = useGetSession(sessionId || "", {
    query: { enabled: !!sessionId }
  });

  if (!uploadedImage) return null;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
    >
      <Card className="border-green-500/30 bg-[#0A0E1A]/90 backdrop-blur-2xl relative overflow-hidden">
        {/* Success burst background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/20 blur-[100px] rounded-full" />
        </div>

        <CardContent className="flex flex-col items-center pt-16 pb-10 text-center relative z-10 space-y-8">
          
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
          >
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </motion.div>

          <div>
            <h2 className="text-4xl font-display font-bold text-white mb-3">Picture Updated!</h2>
            <p className="text-white/60 text-lg max-w-sm mx-auto">
              Your new WhatsApp profile picture is live. You can check your phone to confirm.
            </p>
          </div>

          <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
            <img src={uploadedImage.dataUrl} alt="Final profile picture" className="w-full h-full object-cover" />
          </div>

          {session?.sessionType === 'temporary' && (
            <Badge variant="outline" className="bg-black/40 border-green-500/30 text-green-400 px-4 py-2 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Session securely removed. No data retained.
            </Badge>
          )}

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4 justify-center border-t border-white/5 pt-8 pb-10 relative z-10 bg-black/20">
          <Button variant="ghost" onClick={resetWizard} className="text-white/70 hover:text-white h-12 px-6">
            <RotateCcw className="w-4 h-4 mr-2" /> Upload Another
          </Button>
          <Button 
            className="h-12 px-8 bg-blue-500 hover:bg-blue-600 text-white border-none shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            onClick={() => window.open("https://t.me/pappy_pfp_bot", "_blank")}
          >
            <MessageCircle className="w-5 h-5 mr-2" /> Visit Telegram Bot
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
