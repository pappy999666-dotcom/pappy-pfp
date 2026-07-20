import { Link } from "wouter";
import { Zap, Volume2, VolumeX } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Button } from "../ui/button";

// Global sound context so any step can check if sound is enabled
const SoundContext = createContext({ soundOn: true, setSoundOn: (_: boolean) => {} });
export const useSoundContext = () => useContext(SoundContext);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundOn, setSoundOn] = useState(true);
  return <SoundContext.Provider value={{ soundOn, setSoundOn }}>{children}</SoundContext.Provider>;
}

export function Navbar() {
  const { soundOn, setSoundOn } = useSoundContext();

  return (
    <header className="fixed top-0 w-full z-50 glass-card border-b border-white/5 bg-[#0A0E1A]/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover:glow-cyan transition-all">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white group-hover:text-glow-cyan transition-all">
            Pappy<span className="text-primary">PFP</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-10 h-10 border-0 bg-white/5 hover:bg-white/10"
            onClick={() => setSoundOn(!soundOn)}
            title={soundOn ? "Mute sounds" : "Enable sounds"}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-white/70" /> : <VolumeX className="w-4 h-4 text-white/40" />}
          </Button>
          <Link href="/app" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium font-display bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan h-10 px-4 py-2">
            Open App
          </Link>
        </div>
      </div>
    </header>
  );
}
