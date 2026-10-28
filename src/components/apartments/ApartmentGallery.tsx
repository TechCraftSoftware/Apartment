'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';

interface ApartmentGalleryProps {
  images: string[];
  apartmentName: string;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80';

export function ApartmentGallery({
  images,
  apartmentName,
}: ApartmentGalleryProps) {
  const safeImages = images.length > 0 ? images : [FALLBACK_IMAGE];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? safeImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === safeImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-3">
      {/* Main Bento / Featured Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[340px] sm:h-[440px]">
        {/* Primary Selected Image */}
        <div
          onClick={() => setLightboxOpen(true)}
          className="lg:col-span-8 relative rounded-2xl overflow-hidden bg-stone-200 cursor-pointer group h-full"
        >
          <Image
            src={safeImages[activeIndex] || FALLBACK_IMAGE}
            alt={`${apartmentName} — Photo ${activeIndex + 1}`}
            fill
            priority
            className="object-cover group-hover:scale-102 transition-transform duration-500"
            sizes="(max-width: 1024px) 100vw, 66vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(true);
            }}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 hover:bg-white text-stone-900 text-xs font-semibold shadow-md transition-colors"
          >
            <Expand className="w-3.5 h-3.5" />
            View All {safeImages.length} Photos
          </button>
        </div>

        {/* Side Thumbnails on Desktop */}
        <div className="hidden lg:grid lg:col-span-4 grid-rows-2 gap-3 h-full">
          {safeImages.slice(1, 3).map((imgUrl, idx) => {
            const actualIndex = idx + 1;
            return (
              <div
                key={`${imgUrl}-${idx}`}
                onClick={() => setActiveIndex(actualIndex)}
                className={`relative rounded-2xl overflow-hidden bg-stone-200 cursor-pointer group border-2 transition-all ${
                  activeIndex === actualIndex
                    ? 'border-brand-700'
                    : 'border-transparent'
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={`${apartmentName} — View ${actualIndex + 1}`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="33vw"
                />
              </div>
            );
          })}
          {safeImages.length === 1 && (
            <div className="row-span-2 rounded-2xl bg-sand-100 border border-stone-200 flex items-center justify-center p-6 text-center text-xs text-stone-500">
              Click main photo to enlarge residence view.
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail Strip */}
      {safeImages.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          {safeImages.map((imgUrl, idx) => (
            <button
              key={`${imgUrl}-thumb-${idx}`}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative h-16 w-24 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                activeIndex === idx
                  ? 'border-brand-800 ring-2 ring-brand-800/20'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Image
                src={imgUrl}
                alt={`Thumbnail ${idx + 1}`}
                fill
                className="object-cover"
                sizes="96px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-5xl flex items-center justify-between text-white mb-4">
            <span className="text-sm font-medium">
              {apartmentName} ({activeIndex + 1} / {safeImages.length})
            </span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close gallery"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full max-w-5xl h-[65vh] rounded-2xl overflow-hidden bg-stone-900">
            <Image
              src={safeImages[activeIndex] || FALLBACK_IMAGE}
              alt={`${apartmentName} full view`}
              fill
              className="object-contain"
              sizes="100vw"
            />
            {safeImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous image"
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-stone-950/70 hover:bg-stone-950 text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next image"
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-stone-950/70 hover:bg-stone-950 text-white transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
