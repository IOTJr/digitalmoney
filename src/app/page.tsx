import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Trixie - Secure Online Gigs, Tools & Dark Web Education",
  description: "Master online gigs, access premium tools, learn about dark markets, and unlock your earning potential",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <style>{`
        @keyframes neon-glow {
          0%, 100% { text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00; }
          50% { text-shadow: 0 0 20px #00ff00, 0 0 30px #00ff00, 0 0 40px #00ff00, 0 0 50px #00ff00; }
        }
        @keyframes border-glow {
          0%, 100% { border-color: #00ff00; box-shadow: 0 0 5px #00ff00, inset 0 0 5px #00ff00; }
          50% { border-color: #00ffff; box-shadow: 0 0 10px #00ffff, inset 0 0 10px #00ffff, 0 0 20px #00ff00; }
        }
        @keyframes float-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.5); }
          50% { box-shadow: 0 0 40px rgba(0, 255, 255, 0.8); }
        }
        .neon-title { animation: neon-glow 3s ease-in-out infinite; }
        .neon-border { animation: border-glow 2s ease-in-out infinite; }
        .float-in { animation: float-up 0.8s ease-out; }
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <header className="border-b border-green-500/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold neon-title tracking-widest">TRIXIE</h1>
          <nav className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-green-300 hover:text-green-100 transition-all duration-300 hover:glow"
            >
              Pricing
            </Link>
            <Link
              href="/register"
              className="text-sm text-green-300 hover:text-green-100 transition-all duration-300"
            >
              Register
            </Link>
            <Button asChild className="bg-green-500 hover:bg-green-400 text-black font-bold transition-all duration-300 transform hover:scale-110 shadow-lg neon-border">
              <Link href="/pricing">Enter</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-32 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-cyan-500/5 pointer-events-none"></div>
        <div className="max-w-5xl mx-auto relative z-10">
          <h2 className="text-6xl md:text-7xl font-black mb-8 tracking-tighter float-in">
            <span className="neon-title">MASTER</span>
            <br />
            <span className="text-cyan-300">ONLINE GIGS</span>
            <br />
            <span className="text-green-300">& SECURE EARNINGS</span>
          </h2>
          <p className="text-xl md:text-2xl text-green-200 mb-10 max-w-3xl mx-auto leading-relaxed float-in" style={{animationDelay: "0.2s"}}>
            Access exclusive tools, proven strategies, and expert knowledge to secure high-paying online gigs, 
            navigate dark markets safely, and build your empire in the digital economy.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center float-in" style={{animationDelay: "0.4s"}}>
            <Button asChild size="lg" className="bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-8 py-6 transition-all duration-300 transform hover:scale-105 shadow-lg neon-border">
              <Link href="/pricing">View Plans</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-400/10 font-bold text-lg px-8 py-6 transition-all duration-300 transform hover:scale-105 neon-border">
              <Link href="/register">Register Now</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 border-t border-b border-green-500/30">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-4xl font-black text-center mb-16 neon-title">
            WHAT YOU UNLOCK
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              title="Gig Opportunities"
              description="Discover proven techniques to land high-paying freelance projects on top platforms and maintain consistent income."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              }
              title="Advanced Tools"
              description="Access exclusive software, templates, and automation frameworks used by top earners in the industry."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Earn Real Money"
              description="Learn monetization strategies, income optimization, and financial management for sustainable digital earnings."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747 0-6.002-4.5-10.747-10-10.747z" />
                </svg>
              }
              title="Dark Market Education"
              description="Comprehensive guides on safely navigating darknet markets, understanding anonymity, and legal gray areas."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Expert Community"
              description="Connect with successful operators, share strategies, and collaborate on high-yield opportunities."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="24/7 Resources"
              description="Updated guides, video tutorials, case studies, and exclusive leaked content available round the clock."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 via-transparent to-cyan-500/10 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h3 className="text-5xl font-black mb-6 neon-title">
            READY TO LEVEL UP?
          </h3>
          <p className="text-xl text-green-200 mb-10">
            Stop leaving money on the table. Join thousands of operators already generating serious income 
            through proven gigs and market knowledge.
          </p>
          <Button asChild size="lg" className="bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-10 py-6 transition-all duration-300 transform hover:scale-110 shadow-2xl neon-border pulse-glow">
            <Link href="/pricing">UNLOCK YOUR ACCESS NOW</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-green-500/30 py-8 px-4 text-center text-sm text-green-400/60">
        <p>&copy; {new Date().getFullYear()} TRIXIE. Powered by professionals. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="group bg-black p-8 rounded-lg border-2 border-green-500/50 hover:border-cyan-400 transition-all duration-500 shadow-lg hover:shadow-2xl transform hover:scale-105 neon-border relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-lg"></div>
      <div className="relative z-10">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mb-5 text-green-400 group-hover:text-cyan-300 group-hover:bg-cyan-500/20 transition-all duration-300">
          {icon}
        </div>
        <h4 className="text-2xl font-bold mb-3 text-green-300 group-hover:text-cyan-300 transition-colors duration-300">{title}</h4>
        <p className="text-green-200/80 group-hover:text-green-100 transition-colors duration-300 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}