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
import { Place } from "../types";

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
    <View style={styles.container}>
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
            data={suggestions}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionRow} onPress={() => selectPlace(item)}>
                <Text style={styles.suggestionName}>{item.name}</Text>
                <Text style={styles.suggestionCode}>{item.code}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No matches yet</Text>
                </View>
              ) : undefined
            }
            ListFooterComponent={
              allowNew && !exactMatchExists && !loading ? (
                <TouchableOpacity style={styles.newRow} onPress={selectNew}>
                  <Text style={styles.newRowText}>+ Use "{trimmedQuery}" as a new place</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", zIndex: 10 },
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
    maxHeight: 220,
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
  suggestionCode: { fontSize: 11, color: "#94a3b8", fontWeight: "700" },
  emptyRow: { paddingHorizontal: 14, paddingVertical: 12 },
  emptyText: { fontSize: 13, color: "#94a3b8" },
  newRow: { paddingHorizontal: 14, paddingVertical: 12 },
  newRowText: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
});
