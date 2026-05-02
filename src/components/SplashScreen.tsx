import { useEffect, useState } from "react";
import shodelIcon from "@/assets/shodel-icon.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6 animate-scale-in">
        <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-sm p-4 shadow-2xl">
          <img
            src={shodelIcon}
            alt="Jayee Express"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Jayee Express
          </h1>
          <p className="text-white/80 text-sm mt-1">Your Community Marketplace</p>
        </div>
      </div>
      
      {/* Loading indicator */}
      <div className="absolute bottom-20">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
