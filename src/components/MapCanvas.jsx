import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSimStore } from '../store/simStore.js';

export function MapCanvas({ canvasRef, onSelectDrone, instances }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const wrapperRef = useRef(null);

  const satelliteMode = useSimStore((s) => s.modes.satellite);
  const dominantRegime = useSimStore((s) => s.dominantRegime);
  const customConfig = useSimStore((s) => s.customConfig);
  const scenario = useSimStore((s) => s.scenario);

  // Derive effective radius from custom config or scenario preset
  const radiusMap = {
    'simple': 80,
    'multi-survivor': 150,
    'disaster-zone': 200,
    'mass-casualty': 300,
    'catastrophe': 450,
  };
  const effectiveRadius = scenario === 'custom'
    ? (customConfig.areaRadiusMeters || 200)
    : (radiusMap[scenario] || 200);

  // Base zoom 16.6 corresponds to 200m radius (~4 city blocks).
  // Doubling radius drops zoom by 1; halving radius increases zoom by 1.
  const calcZoom = (r) => Math.max(14.5, Math.min(18.8, 16.6 - Math.log2(r / 200)));

  // ─── Initialize MapLibre GL JS Satellite Basemap ─────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'esri-satellite': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
              attribution: '© Esri, Maxar, Earthstar Geographics',
            },
          },
          layers: [
            {
              id: 'esri-satellite-layer',
              type: 'raster',
              source: 'esri-satellite',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [-122.3995, 37.7915], // Downtown San Francisco Financial District Urban Core
        zoom: calcZoom(effectiveRadius),
        pitch: 0,
        bearing: 0,
        interactive: false, // Locked to disaster sector to maintain 1:1 canvas coordinate sync
        attributionControl: false,
      });

      mapInstanceRef.current = map;
    } catch (err) {
      console.warn('MapLibre satellite initialization failed:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ─── Dynamic Map Zoom with Radius Changes ─────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const targetZoom = calcZoom(effectiveRadius);
    try {
      mapInstanceRef.current.easeTo({
        zoom: targetZoom,
        duration: 500,
      });
    } catch (e) {
      console.warn('Map zoom update failed:', e);
    }
  }, [effectiveRadius]);

  // ─── Toggle Satellite Map Visibility ─────────────────────────────────────
  useEffect(() => {
    if (mapContainerRef.current) {
      mapContainerRef.current.style.display = satelliteMode ? 'block' : 'none';
      if (satelliteMode && mapInstanceRef.current) {
        mapInstanceRef.current.resize();
      }
    }
    if (instances && instances.visualizer) {
      instances.visualizer.showSatelliteMode = satelliteMode;
      instances.visualizer.render(1);
    }
  }, [satelliteMode, instances]);

  // ─── ResizeObserver for Canvas and Map Viewports ─────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;

        const dpr = window.devicePixelRatio || 1;
        if (instances && instances.visualizer) {
          instances.visualizer.resize(width, height, dpr);
          instances.visualizer.render(1);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      }
    });

    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [instances]);

  // ─── Canvas Click Handler (Select drone near click, or deselect on empty) ─
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !instances || !instances.visualizer) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const hitDrone = instances.visualizer.getDroneAtCss(clickX, clickY, 22);
    if (hitDrone) {
      onSelectDrone(hitDrone.id);
    } else {
      onSelectDrone(null);
    }
  };

  return (
    <div ref={wrapperRef} className="map-canvas-viewport">
      {/* MapLibre Satellite Basemap Layer */}
      <div ref={mapContainerRef} className="map-container" />

      {/* Primary Simulation Canvas (Pheromones, Heatmap, Drones, Hazards) */}
      <canvas
        ref={canvasRef}
        className="sim-canvas"
        onClick={handleCanvasClick}
      />
    </div>
  );
}
