"use client";

import { useEffect, useState, useMemo } from "react";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80",
  "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80",
];

export function SmartphoneSection({ images: propImages, title, description }) {
  const images = useMemo(() => {
    if (propImages && propImages.length > 0) return propImages;
    return FALLBACK_IMAGES;
  }, [propImages]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setPrevIndex(currentIndex);
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [images.length, currentIndex]);

  return (
    <section className="relative z-10 bg-[#0a0f1c] py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold text-[#00a5b0] sm:text-5xl">
              {title || "Mes Réalisations"}
            </h2>
            <p className="mt-6 text-lg text-[#94a3b8] leading-relaxed">
              {description || "Découvrez mes projets en situation réelle. Chaque application reflète mon engagement pour la qualité, le design et l'innovation."}
            </p>
            <div className="mt-8 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPrevIndex(currentIndex);
                    setCurrentIndex(i);
                  }}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i === currentIndex ? "w-8 bg-[#00a5b0]" : "w-2 bg-[#1e293b] hover:bg-[#334155]"
                  }`}
                  aria-label={`Voir le projet ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="relative animate-levitate">
              <div className="relative mx-auto w-[220px] rounded-[2.5rem] border-[3px] border-[#334155] bg-[#0f172a] p-2.5 shadow-2xl shadow-[#00a5b0]/5">
                <div className="mx-auto mb-1.5 h-5 w-16 rounded-full bg-[#1e293b]" />
                <div className="relative aspect-[9/19] overflow-hidden rounded-[1.25rem] bg-[#1e293b]">
                  {images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                      style={{ opacity: i === currentIndex ? 1 : 0 }}
                    />
                  ))}
                </div>
                <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-[#1e293b]" />
              </div>
            </div>

            <div className="absolute -right-4 top-4 animate-float-card-1">
              <div className="rounded-xl bg-[#1e293b] p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a5b0]/20">
                    <svg className="h-4 w-4 text-[#00a5b0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">React</p>
                    <p className="text-xs text-[#94a3b8]">Frontend</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-4 bottom-8 animate-float-card-2">
              <div className="rounded-xl bg-[#1e293b] p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d900a8]/20">
                    <svg className="h-4 w-4 text-[#d900a8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Next.js</p>
                    <p className="text-xs text-[#94a3b8]">Framework</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -right-2 bottom-20 animate-float-card-3">
              <div className="rounded-xl bg-[#1e293b] p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div className="text-yellow-400 text-sm font-bold">5.0</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes levitate {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        .animate-levitate {
          animation: levitate 4s ease-in-out infinite;
        }
        @keyframes float-card-1 {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-8px) translateX(4px); }
        }
        .animate-float-card-1 {
          animation: float-card-1 5s ease-in-out infinite;
        }
        @keyframes float-card-2 {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(8px) translateX(-4px); }
        }
        .animate-float-card-2 {
          animation: float-card-2 6s ease-in-out infinite;
        }
        @keyframes float-card-3 {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-6px) translateX(6px); }
        }
        .animate-float-card-3 {
          animation: float-card-3 4.5s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
