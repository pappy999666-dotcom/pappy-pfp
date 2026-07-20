import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { motion } from "framer-motion";
import { ImagePlus, Smartphone, CheckCircle2, ArrowRight, ShieldCheck, Zap, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      <BackgroundOrbs />
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-4xl mx-auto flex flex-col items-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8 border-primary/30">
              <span className="flex w-2 h-2 rounded-full bg-primary glow-cyan"></span>
              <span className="text-sm font-medium text-primary">Live Now — No app download required</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold font-display text-white leading-tight mb-8">
              Change your WhatsApp<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
                Profile Picture
              </span>
              <br />in minutes.
            </h1>
            
            <p className="text-xl text-white/60 mb-12 max-w-2xl leading-relaxed">
              Upload your best photo, adjust the crop, pair securely, and watch your profile update instantly. No fuss.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Link href="/app" className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-display bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan-lg h-14 px-8 text-lg w-full sm:w-auto">
                Start Now <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Button variant="ghost" size="lg" className="h-14 px-8 text-lg w-full sm:w-auto text-white" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                How It Works
              </Button>
            </div>
          </motion.div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="container mx-auto px-4 py-24 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold font-display text-white mb-4">How it works</h2>
            <p className="text-white/60 text-lg">Three simple steps to a fresh look.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <StepCard 
              icon={<ImagePlus className="w-8 h-8 text-primary" />}
              title="1. Upload Photo"
              description="Drop in your favorite picture. We support high-res PNGs and JPEGs. Adjust and crop it perfectly."
              delay={0.1}
            />
            <StepCard 
              icon={<Smartphone className="w-8 h-8 text-purple-400" />}
              title="2. Pair WhatsApp"
              description="Connect your account securely using a QR code or an 8-digit pairing code. Takes 5 seconds."
              delay={0.2}
            />
            <StepCard 
              icon={<CheckCircle2 className="w-8 h-8 text-green-400" />}
              title="3. Done!"
              description="We automatically update your profile picture. Your session is securely removed immediately."
              delay={0.3}
            />
          </div>
        </section>

        {/* Security & Features */}
        <section className="container mx-auto px-4 py-24">
          <div className="glass-card p-10 rounded-3xl max-w-5xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            
            <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h2 className="text-3xl font-bold font-display text-white mb-6">Designed for privacy first.</h2>
                <ul className="space-y-6">
                  <FeatureItem 
                    icon={<ShieldCheck className="w-6 h-6 text-primary" />}
                    title="Temporary Sessions"
                    description="By default, we disconnect immediately after your picture updates. No background access."
                  />
                  <FeatureItem 
                    icon={<Lock className="w-6 h-6 text-primary" />}
                    title="No Data Kept"
                    description="Your photos and phone number are wiped from our servers the moment you are done."
                  />
                  <FeatureItem 
                    icon={<Zap className="w-6 h-6 text-primary" />}
                    title="Instant Delivery"
                    description="Updates happen live. See the change on your phone in real-time."
                  />
                </ul>
              </div>
              <div className="relative h-[400px] rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center p-8">
                {/* Abstract visualization of secure connection */}
                <div className="relative w-full max-w-sm aspect-square">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border border-primary/20 rounded-full border-dashed"
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-8 border border-purple-400/20 rounded-full border-dashed"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur-md border border-primary/30 glow-cyan">
                      <Lock className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="py-8 text-center text-white/40 text-sm border-t border-white/5">
        <p>Pappy PFP Web &copy; {new Date().getFullYear()}. Secure & Private.</p>
      </footer>
    </div>
  );
}

function StepCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay }}
      className="glass-card p-8 rounded-2xl text-left border-t border-white/10 hover:bg-white/[0.02] transition-colors group"
    >
      <div className="w-16 h-16 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold font-display text-white mb-3">{title}</h3>
      <p className="text-white/60 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <li className="flex gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mt-1">
        {icon}
      </div>
      <div>
        <h4 className="text-lg font-bold text-white mb-1">{title}</h4>
        <p className="text-white/60">{description}</p>
      </div>
    </li>
  );
}
