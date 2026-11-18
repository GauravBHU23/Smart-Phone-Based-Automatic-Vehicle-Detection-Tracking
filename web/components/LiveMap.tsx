"use client";

import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useMemo } from "react";
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "../lib/mapStyles";

export type MapTheme = "light" | "dark" | "standard" | "satellite" | "hybrid";

const containerStyle = { width: "100%", height: "100%" };

export interface MapMarkerSpec {
  id: string;
  lat: number;
  lng: number;
  label: string;
  pinColor?: string;
  onClick?: () => void;
}

export default function LiveMap({
  apiKey,
  center,
  zoom = 13,
  theme = "light",
  markers = [],
  path,
}: {
  apiKey: string;
  center: { lat: number; lng: number };
  zoom?: number;
  theme?: MapTheme;
  markers?: MapMarkerSpec[];
  path?: { lat: number; lng: number }[];
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "vehicletrack-google-maps",
  });

  const mapTypeId = theme === "satellite" ? "satellite" : theme === "hybrid" ? "hybrid" : "roadmap";
  const styles = theme === "dark" ? DARK_MAP_STYLE : theme === "light" ? LIGHT_MAP_STYLE : [];

  const options = useMemo(
    () => ({
      styles,
      mapTypeId,
      disableDefaultUI: false,
      clickableIcons: false,
    }),
    [styles, mapTypeId]
  );

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading map…
      </div>
    );
  }

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={zoom} options={options}>
      {path && path.length > 1 && (
        <Polyline path={path} options={{ strokeColor: "#2563eb", strokeWeight: 4 }} />
      )}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={{ lat: m.lat, lng: m.lng }}
          title={m.label}
          onClick={m.onClick}
          {...(m.pinColor ? { icon: { url: `https://maps.google.com/mapfiles/ms/icons/${m.pinColor}-dot.png` } } : {})}
        />
      ))}
    </GoogleMap>
  );
}
