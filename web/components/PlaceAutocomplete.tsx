"use client";

import { useEffect, useRef, useState } from "react";
import { placeApi } from "../lib/api/endpoints";
import { ExternalPlace, Place, PlaceSelection } from "../lib/types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH_FOR_SUGGESTIONS = 3;

export default function PlaceAutocomplete({
  value,
  onChange,
  placeholder,
  allowNew = false,
  bare = false,
}: {
  value: PlaceSelection | null;
  onChange: (place: PlaceSelection) => void;
  placeholder: string;
  allowNew?: boolean;
  /** Omits the input's own border/background — use inside a parent that already provides them. */
  bare?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [knownPlaces, setKnownPlaces] = useState<Place[]>([]);
  const [suggestedPlaces, setSuggestedPlaces] = useState<ExternalPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  function handleQueryChange(text: string) {
    setQuery(text);
    // Typing again means the previously selected place no longer applies —
    // clear the selection so the parent can't act on a stale value while the
    // user is mid-edit of the text.
    if (value) onChange({ id: null, name: text });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setKnownPlaces([]);
      setSuggestedPlaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        const results = await placeApi.search(text.trim());
        if (requestId === requestIdRef.current) {
          setKnownPlaces(results.knownPlaces);
          setSuggestedPlaces(results.suggestedPlaces);
        }
      } catch {
        if (requestId === requestIdRef.current) {
          setKnownPlaces([]);
          setSuggestedPlaces([]);
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function selectKnownPlace(place: Place) {
    setQuery(place.name);
    setKnownPlaces([]);
    setSuggestedPlaces([]);
    setFocused(false);
    onChange(place);
  }

  function selectSuggestedPlace(place: ExternalPlace) {
    setQuery(place.name);
    setKnownPlaces([]);
    setSuggestedPlaces([]);
    setFocused(false);
    onChange({ id: null, name: place.name, latitude: place.latitude, longitude: place.longitude });
  }

  function selectNew() {
    setKnownPlaces([]);
    setSuggestedPlaces([]);
    setFocused(false);
    onChange({ id: null, name: query.trim() });
  }

  const trimmedQuery = query.trim();
  const exactMatchExists =
    knownPlaces.some((p) => p.name.toLowerCase() === trimmedQuery.toLowerCase()) ||
    suggestedPlaces.some((p) => p.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showDropdown = focused && trimmedQuery.length > 0;
  const tooShortForSuggestions = trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH_FOR_SUGGESTIONS;

  return (
    <div className={`relative ${showDropdown ? "z-30" : "z-10"}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        className={
          bare
            ? "w-full bg-transparent py-3 text-[15px] font-semibold text-slate-800 outline-none placeholder:text-slate-400"
            : "w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-accent"
        }
      />
      {loading && (
        <div className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[280px] overflow-y-auto rounded-[10px] bg-white shadow-xl">
          {knownPlaces.length === 0 && suggestedPlaces.length === 0 && !loading && (
            <div className="px-3.5 py-3 text-[13px] text-slate-400">
              {tooShortForSuggestions ? "Keep typing to search…" : "No matches yet"}
            </div>
          )}

          {knownPlaces.map((item) => (
            <button
              key={item.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectKnownPlace(item)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-3.5 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-800">{item.name}</span>
              <span className="text-[11px] font-bold text-slate-400">{item.code}</span>
            </button>
          ))}

          {suggestedPlaces.length > 0 && (
            <div className="bg-slate-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Other places
            </div>
          )}
          {suggestedPlaces.map((item, i) => (
            <button
              key={`${item.name}-${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestedPlace(item)}
              className="flex w-full items-center gap-2 border-b border-slate-100 px-3.5 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-slate-300">📍</span>
              <span className="text-sm font-medium text-slate-700">{item.name}</span>
            </button>
          ))}

          {allowNew && !exactMatchExists && !loading && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectNew}
              className="w-full px-3.5 py-3 text-left text-[13px] font-semibold text-accent hover:bg-slate-50"
            >
              + Use &quot;{trimmedQuery}&quot; as a new place
            </button>
          )}
        </div>
      )}
    </div>
  );
}
