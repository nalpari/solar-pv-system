"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";

interface AddressSearchProps {
  onPlaceSelect: (location: { lat: number; lng: number; address: string }) => void;
}

export default function AddressSearch({ onPlaceSelect }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof google !== "undefined" && google.maps) {
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
    // Lazy init if not yet initialized
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
    setIsLoading(true);
    autocompleteService.current.getPlacePredictions(
      { input },
      (results, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
          setIsOpen(true);
        } else {
          setPredictions([]);
        }
      }
    );
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  }

  function handleSelect(prediction: google.maps.places.AutocompletePrediction) {
    if (!placesService.current) return;
    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ["geometry", "formatted_address"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          setQuery(place.formatted_address || prediction.description);
          setPredictions([]);
          setIsOpen(false);
          onPlaceSelect({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address || prediction.description,
          });
        }
      }
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
        }}
      >
        Search Address
      </label>
      <div style={{ position: "relative" }}>
        <Search
          size={15}
          color="var(--text-tertiary)"
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder="Enter building address..."
          style={{
            width: "100%",
            paddingLeft: 34,
            paddingRight: isLoading ? 34 : 12,
            height: 40,
          }}
        />
        {isLoading && (
          <Loader2
            size={14}
            color="var(--text-tertiary)"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 50,
            listStyle: "none",
            padding: 4,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {predictions.map((p) => (
            <li key={p.place_id}>
              <button
                onClick={() => handleSelect(p)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  textAlign: "left",
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <MapPin
                  size={14}
                  color="var(--text-tertiary)"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>{p.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
