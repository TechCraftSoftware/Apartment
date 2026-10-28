'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Save,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Check,
  ImagePlus,
} from 'lucide-react';
import { Apartment } from '@/types';
import { ApartmentInput } from '@/context/BookingContext';
import { AVAILABLE_AMENITIES } from '@/lib/seed-data';
import { formatNaira } from '@/lib/utils';

interface ApartmentFormProps {
  initialData?: Apartment;
  onSubmit: (data: ApartmentInput) => {
    success: boolean;
    apartment?: Apartment;
    error?: string;
  };
  submitLabel?: string;
}

const PRESET_GALLERY_URLS = [
  {
    label: 'Modern Living Room',
    url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Luxury Master Suite',
    url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Open Chef Kitchen',
    url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Penthouse Terrace View',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1400&q=80',
  },
];

export function ApartmentForm({
  initialData,
  onSubmit,
  submitLabel = 'Save Apartment Listing',
}: ApartmentFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || '');
  const [neighborhood, setNeighborhood] = useState(
    initialData?.neighborhood || 'Victoria Island'
  );
  const [location, setLocation] = useState(
    initialData?.location || 'Victoria Island, Lagos'
  );
  const [shortDescription, setShortDescription] = useState(
    initialData?.shortDescription || ''
  );
  const [description, setDescription] = useState(
    initialData?.description || ''
  );
  const [pricePerNight, setPricePerNight] = useState<number>(
    initialData?.pricePerNight || 140000
  );
  const [maxGuests, setMaxGuests] = useState<number>(
    initialData?.maxGuests || 2
  );
  const [bedrooms, setBedrooms] = useState<number>(initialData?.bedrooms || 1);
  const [bathrooms, setBathrooms] = useState<number>(
    initialData?.bathrooms || 1.5
  );
  const [sizeSqm, setSizeSqm] = useState<number>(initialData?.sizeSqm || 85);
  const [isActive, setIsActive] = useState<boolean>(
    initialData ? initialData.isActive : true
  );
  const [featured, setFeatured] = useState<boolean>(
    initialData ? Boolean(initialData.featured) : true
  );

  // Availability Rules
  const [minNights, setMinNights] = useState<number>(
    initialData?.availabilityRules?.minNights || 1
  );
  const [maxNights, setMaxNights] = useState<number>(
    initialData?.availabilityRules?.maxNights || 60
  );
  const [checkInTime, setCheckInTime] = useState<string>(
    initialData?.availabilityRules?.checkInTime || '14:00'
  );
  const [checkOutTime, setCheckOutTime] = useState<string>(
    initialData?.availabilityRules?.checkOutTime || '11:00'
  );

  // Amenities
  const [amenities, setAmenities] = useState<string[]>(
    initialData?.amenities || [
      '24/7 Power & Inverter Backup',
      'High-Speed Fiber Wi-Fi',
      'Smart TV with Netflix & Prime',
      'Fully Equipped Chef Kitchen',
      '24-Hour Uniformed Security',
      'Air Conditioning in All Rooms',
    ]
  );
  const [customAmenity, setCustomAmenity] = useState('');

  // Images
  const [images, setImages] = useState<string[]>(
    initialData?.images || [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80',
    ]
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleAddCustomAmenity = () => {
    const trimmed = customAmenity.trim();
    if (!trimmed) return;
    if (!amenities.includes(trimmed)) {
      setAmenities((prev) => [...prev, trimmed]);
    }
    setCustomAmenity('');
  };

  const handleAddImageUrl = (urlToAdd?: string) => {
    const target = (urlToAdd ?? newImageUrl).trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('/')) {
      setErrors((prev) => ({
        ...prev,
        images: 'Image URL must start with https://, http://, or /',
      }));
      return;
    }
    setImages((prev) => [...prev, target]);
    if (!urlToAdd) setNewImageUrl('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.images;
      return next;
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Apartment name is required.';
    if (!neighborhood.trim())
      nextErrors.neighborhood = 'Neighborhood / district is required.';
    if (!location.trim()) nextErrors.location = 'Full address/location is required.';
    if (!shortDescription.trim())
      nextErrors.shortDescription = 'Short summary description is required.';
    if (!description.trim())
      nextErrors.description = 'Detailed apartment description is required.';
    if (!pricePerNight || pricePerNight <= 0)
      nextErrors.pricePerNight = 'Nightly price must be greater than ₦0.';
    if (!maxGuests || maxGuests < 1)
      nextErrors.maxGuests = 'Maximum guests must be at least 1.';
    if (bedrooms < 1) nextErrors.bedrooms = 'Bedrooms must be at least 1.';
    if (bathrooms < 1) nextErrors.bathrooms = 'Bathrooms must be at least 1.';
    if (images.length === 0)
      nextErrors.images = 'Please include at least one apartment image URL.';
    if (amenities.length === 0)
      nextErrors.amenities = 'Select at least one amenity.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const result = onSubmit({
      name: name.trim(),
      neighborhood: neighborhood.trim(),
      location: location.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      pricePerNight: Number(pricePerNight),
      maxGuests: Number(maxGuests),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      sizeSqm: Number(sizeSqm) || 75,
      amenities,
      images,
      isActive,
      featured,
      availabilityRules: {
        minNights: Number(minNights) || 1,
        maxNights: Number(maxNights) || 60,
        checkInTime,
        checkOutTime,
        allowSameDayTurnover: true,
      },
    });

    if (result.success) {
      router.push('/admin/apartments');
    } else if (result.error) {
      setErrors({ form: result.error });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errors.form && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errors.form}</span>
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
        <div className="border-b border-stone-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              1. Residence Identity & Status
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Core listing details displayed across the public catalog.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-brand-800 focus:ring-brand-700"
              />
              <span className="text-xs font-semibold text-stone-800">
                Active Listing (Bookable)
              </span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-brand-800 focus:ring-brand-700"
              />
              <span className="text-xs font-medium text-stone-700">
                Featured on Homepage
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Apartment Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Executive Lagoon View Penthouse"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Neighborhood / District *
            </label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="e.g., Victoria Island, Ikoyi, Lekki Phase 1"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            {errors.neighborhood && (
              <p className="text-xs text-red-600 mt-1">{errors.neighborhood}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Full Street Address / Location *
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., 24 Bourdillon Road, Ikoyi, Lagos"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            {errors.location && (
              <p className="text-xs text-red-600 mt-1">{errors.location}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Short Summary (Card Teaser) *
            </label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="1–2 sentence overview shown on listing cards..."
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            {errors.shortDescription && (
              <p className="text-xs text-red-600 mt-1">
                {errors.shortDescription}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Full Description *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the interior design, ambiance, neighborhood highlights, and ideal guest experience..."
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Pricing, Capacity & Specifications */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-base font-bold text-stone-900">
            2. Pricing, Capacity & Stay Rules
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Nightly rates in Nigerian Naira (₦), guest limits, and room counts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Nightly Price (₦) *
            </label>
            <input
              type="number"
              min={10000}
              step={5000}
              value={pricePerNight}
              onChange={(e) => setPricePerNight(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            <span className="block text-[11px] text-brand-700 font-medium mt-1">
              Formatted: {formatNaira(Number(pricePerNight) || 0)} / night
            </span>
            {errors.pricePerNight && (
              <p className="text-xs text-red-600 mt-1">
                {errors.pricePerNight}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Max Guests *
            </label>
            <input
              type="number"
              min={1}
              max={16}
              value={maxGuests}
              onChange={(e) => setMaxGuests(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            {errors.maxGuests && (
              <p className="text-xs text-red-600 mt-1">{errors.maxGuests}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Bedrooms *
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Bathrooms *
            </label>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={bathrooms}
              onChange={(e) => setBathrooms(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Floor Size (m²)
            </label>
            <input
              type="number"
              min={20}
              max={1000}
              value={sizeSqm}
              onChange={(e) => setSizeSqm(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-stone-100">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Minimum Stay (Nights)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={minNights}
              onChange={(e) => setMinNights(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Maximum Stay (Nights)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={maxNights}
              onChange={(e) => setMaxNights(Number(e.target.value))}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Check-In Time
            </label>
            <input
              type="text"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Check-Out Time
            </label>
            <input
              type="text"
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Amenities */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-base font-bold text-stone-900">
            3. Residence Amenities
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Select included features or add custom hospitality amenities.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {Array.from(new Set([...AVAILABLE_AMENITIES, ...amenities])).map(
            (item) => {
              const selected = amenities.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleAmenity(item)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                    selected
                      ? 'border-brand-700 bg-brand-50/70 text-brand-950'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                >
                  <span className="truncate pr-2">{item}</span>
                  {selected && (
                    <Check className="w-4 h-4 text-brand-700 shrink-0" />
                  )}
                </button>
              );
            }
          )}
        </div>

        <div className="flex items-center gap-2 max-w-md pt-2">
          <input
            type="text"
            value={customAmenity}
            onChange={(e) => setCustomAmenity(e.target.value)}
            placeholder="Add custom amenity (e.g., Private Chef on Request)"
            className="flex-1 rounded-xl border border-stone-300 px-3.5 py-2 text-xs text-stone-900 focus:border-brand-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddCustomAmenity}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
        {errors.amenities && (
          <p className="text-xs text-red-600">{errors.amenities}</p>
        )}
      </div>

      {/* Section 4: Image URLs */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-5">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-base font-bold text-stone-900">
            4. Apartment Imagery ({images.length} Photos)
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Add high-resolution image URLs or click a preset architectural photo below.
          </p>
        </div>

        {/* Add Image Input */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="flex-1 rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-brand-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleAddImageUrl()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors shrink-0"
            >
              <ImagePlus className="w-4 h-4" />
              Add Image URL
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-brand-700" />
              Quick add verified photo:
            </span>
            {PRESET_GALLERY_URLS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleAddImageUrl(preset.url)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-brand-50 hover:border-brand-300 text-stone-700 transition-colors"
              >
                + {preset.label}
              </button>
            ))}
          </div>

          {errors.images && (
            <p className="text-xs text-red-600">{errors.images}</p>
          )}
        </div>

        {/* Image Preview Grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {images.map((imgUrl, idx) => (
              <div
                key={`${imgUrl}-${idx}`}
                className="group relative rounded-xl overflow-hidden border border-stone-200 bg-stone-100"
              >
                <div className="relative h-36 w-full">
                  <Image
                    src={imgUrl}
                    alt={`Apartment preview ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="280px"
                  />
                  {idx === 0 && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-brand-800 text-white text-[10px] font-bold uppercase">
                      Main Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    title="Remove image"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-stone-950/75 hover:bg-red-600 text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-2 bg-white text-[11px] text-stone-500 truncate">
                  {imgUrl}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Footer */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/apartments')}
          className="px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-medium text-stone-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
