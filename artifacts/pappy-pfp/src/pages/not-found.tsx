import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      <BackgroundOrbs />
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6">
          <div className="font-display text-[150px] font-bold leading-none text-white/5 font-mono select-none">
            404
          </div>
          <h1 className="text-3xl font-display font-bold text-white">Lost in the void?</h1>
          <p className="text-white/60 max-w-md mx-auto">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <div className="pt-4">
            <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-display bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan h-11 px-8">
              <Home className="w-4 h-4 mr-2" /> Back Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
