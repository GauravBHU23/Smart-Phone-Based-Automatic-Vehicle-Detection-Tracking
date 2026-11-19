import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { placeApi } from "../api/endpoints";
import { ExternalPlace, Place, PlaceSelection } from "../types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH_FOR_SUGGESTIONS = 3;

type Row =
  | { kind: "known"; place: Place }
  | { kind: "suggested"; place: ExternalPlace }
  | { kind: "new" }
  | { kind: "empty"; message: string };

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

  const rows: Row[] = [
    ...knownPlaces.map((place): Row => ({ kind: "known", place })),
    ...suggestedPlaces.map((place): Row => ({ kind: "suggested", place })),
  ];
  if (rows.length === 0 && !loading) {
    rows.push({ kind: "empty", message: tooShortForSuggestions ? "Keep typing to search…" : "No matches yet" });
  }
  if (allowNew && !exactMatchExists && !loading) {
    rows.push({ kind: "new" });
  }

  return (
    <View style={[styles.container, showDropdown && styles.containerFocused]}>
      <TextInput
        style={[styles.input, bare && styles.inputBare]}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={query}
        onChangeText={handleQueryChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {loading && (
        <ActivityIndicator style={styles.loadingIcon} size="small" color="#2563eb" />
      )}

      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={rows}
            keyExtractor={(row, i) =>
              row.kind === "known" ? row.place.id : row.kind === "suggested" ? `s-${i}` : row.kind
            }
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              if (item.kind === "known") {
                return (
                  <TouchableOpacity style={styles.suggestionRow} onPress={() => selectKnownPlace(item.place)}>
                    <Text style={styles.suggestionName}>{item.place.name}</Text>
                    <Text style={styles.suggestionCode}>{item.place.code}</Text>
                  </TouchableOpacity>
                );
              }
              if (item.kind === "suggested") {
                return (
                  <TouchableOpacity style={styles.suggestionRow} onPress={() => selectSuggestedPlace(item.place)}>
                    <Text style={styles.suggestionNameMuted}>📍 {item.place.name}</Text>
                  </TouchableOpacity>
                );
              }
              if (item.kind === "new") {
                return (
                  <TouchableOpacity style={styles.newRow} onPress={selectNew}>
                    <Text style={styles.newRowText}>+ Use &quot;{trimmedQuery}&quot; as a new place</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>{item.message}</Text>
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", zIndex: 10 },
  containerFocused: { zIndex: 30 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: "#1e293b",
  },
  inputBare: {
    borderWidth: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  loadingIcon: { position: "absolute", right: 14, top: 14 },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    maxHeight: 280,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 20,
  },
  suggestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  suggestionName: { fontSize: 14, color: "#1e293b", fontWeight: "500" },
  suggestionNameMuted: { fontSize: 14, color: "#334155", fontWeight: "500" },
  suggestionCode: { fontSize: 11, color: "#94a3b8", fontWeight: "700" },
  emptyRow: { paddingHorizontal: 14, paddingVertical: 12 },
  emptyText: { fontSize: 13, color: "#94a3b8" },
  newRow: { paddingHorizontal: 14, paddingVertical: 12 },
  newRowText: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
});
