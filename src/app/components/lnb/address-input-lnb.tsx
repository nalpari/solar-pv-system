"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin } from "lucide-react";
import { InputBox } from "@/components/common";
import { t, type Lang } from "../../utils/i18n";

interface AddressInputLnbProps {
  lang: Lang;
  /** true면 입력/검색 비활성화 — 크롭모드 진입 시 주소 재검색을 막기 위해 사용 */
  disabled?: boolean;
  onPlaceSelect: (location: {
    lat: number;
    lng: number;
    address: string;
    viewport?: google.maps.LatLngBounds;
  }) => void;
}

export function AddressInputLnb({ lang, disabled = false, onPlaceSelect }: AddressInputLnbProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof google !== "undefined" && google.maps && google.maps.places) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      const div = document.createElement("div");
      placesService.current = new google.maps.places.PlacesService(div);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPlaces = useCallback((input: string) => {
    if (!input.trim()) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }
    if (!autocompleteService.current && typeof google !== "undefined" && google.maps) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      const div = document.createElement("div");
      placesService.current = new google.maps.places.PlacesService(div);
    }
    if (!autocompleteService.current) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }
    autocompleteService.current.getPlacePredictions({ input, componentRestrictions: { country: "jp" } }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        setPredictions(results);
        setIsOpen(true);
      } else {
        setPredictions([]);
        if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.error("Places autocomplete failed:", status);
        }
      }
    });
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  }

  function handleSearchClick() {
    if (query.trim()) searchPlaces(query);
  }

  function handleSelect(prediction: google.maps.places.AutocompletePrediction) {
    if (!placesService.current) return;
    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ["geometry", "formatted_address", "address_components"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          setQuery(place.formatted_address || prediction.description);
          setPredictions([]);
          setIsOpen(false);
          onPlaceSelect({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address || prediction.description,
            viewport: place.geometry.viewport,
          });
        } else {
          console.error("Places getDetails failed:", status);
        }
      },
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <InputBox
        value={query}
        disabled={disabled}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearchClick();
        }}
        placeholder={t("addressPlaceholder", lang)}
        withSearchIcon
        onSearchClick={disabled ? undefined : handleSearchClick}
      />
      {isOpen && predictions.length > 0 && (
        <ul className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-[#eff4f8] rounded-[4px] shadow-md list-none p-1 max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <li key={p.place_id}>
              <button
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-start gap-2 px-2 py-2 rounded-[3px] bg-transparent border-none text-[13px] leading-snug text-[#333] text-left hover:bg-[#f5f7fb] cursor-pointer"
              >
                <MapPin size={14} className="shrink-0 mt-0.5 text-[#999]" />
                <span>{p.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
