"use client";

import { useEffect, useRef, useState } from "react";
import { placeApi } from "../lib/api/endpoints";
import { Place } from "../lib/types";

const DEBOUNCE_MS = 300;

export default function PlaceAutocomplete({
  value,
  onChange,
  placeholder,
  allowNew = false,
  bare = false,
}: {
  value: Place | { id: null; name: string } | null;
  onChange: (place: Place | { id: null; name: string }) => void;
  placeholder: string;
  allowNew?: boolean;
  /** Omits the input's own border/background — use inside a parent that already provides them. */
  bare?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
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
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        const results = await placeApi.search(text.trim());
        if (requestId === requestIdRef.current) setSuggestions(results);
      } catch {
        if (requestId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function selectPlace(place: Place) {
    setQuery(place.name);
    setSuggestions([]);
    setFocused(false);
    onChange(place);
  }

  function selectNew() {
    setSuggestions([]);
    setFocused(false);
    onChange({ id: null, name: query.trim() });
  }

  const trimmedQuery = query.trim();
  const exactMatchExists = suggestions.some((s) => s.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showDropdown = focused && trimmedQuery.length > 0;

  return (
    <div className="relative z-10">
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
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[220px] overflow-y-auto rounded-[10px] bg-white shadow-xl">
          {suggestions.length === 0 && !loading && (
            <div className="px-3.5 py-3 text-[13px] text-slate-400">No matches yet</div>
          )}
          {suggestions.map((item) => (
            <button
              key={item.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectPlace(item)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-3.5 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-800">{item.name}</span>
              <span className="text-[11px] font-bold text-slate-400">{item.code}</span>
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
