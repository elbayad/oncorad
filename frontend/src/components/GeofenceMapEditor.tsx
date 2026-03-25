import React, { useState, useEffect } from 'react';
import { MapContainer, GeoJSON, Marker, Polyline, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L, { DivIcon } from 'leaflet';
import { X, Save, Undo, Map as MapIcon, Trash2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface Floor {
    id: number;
    name: string;
    description?: string;
    plan?: string;
}

interface GeofenceMapEditorProps {
    initialGeofence?: any; // GeoJSON object or string (legacy)
    initialFloorId?: number;
    floors: Floor[];
    onSave: (geofence: any) => void;
    onCancel: () => void;
    mode?: 'polygon' | 'linestring';
}

const GEOJSON_SCALE = 1;

// Helper to scale GeoJSON
function scaleGeoJSON(geojson: any, scale: number) {
    const g = JSON.parse(JSON.stringify(geojson));
    function rec(coords: any) {
        if (typeof coords[0] === 'number') {
            coords[0] *= scale;
            coords[1] *= scale;
        } else {
            for (const k of coords) rec(k);
        }
    }
    if (g.type === 'FeatureCollection') {
        g.features.forEach((f: any) => rec(f.geometry.coordinates));
    } else if (g.type === 'Feature') {
        rec(g.geometry.coordinates);
    } else {
        rec(g.coordinates);
    }
    return g;
}

// Helper: Convert {lat, lng} to {x, y} (cm)
const toCm = (lat: number, lng: number) => {
    return {
        x: Math.round(lng * GEOJSON_SCALE),
        y: Math.round(lat * GEOJSON_SCALE)
    };
};

interface MapContentProps {
    geojsonData: any;
    points: { lat: number; lng: number }[];
    completedShapes: { lat: number; lng: number }[][];
    markerIcon: L.DivIcon;
    completedIcon: L.DivIcon;
    onMapClick: (lat: number, lng: number) => void;
    onPointMove: (shapeIdx: number | 'current', pointIdx: number, lat: number, lng: number) => void;
    onPointDelete: (shapeIdx: number | 'current', pointIdx: number) => void;
    onPointInsert: (shapeIdx: number | 'current', segmentIdx: number, lat: number, lng: number) => void;
    mode: 'polygon' | 'linestring';
}

function MapContent({
    geojsonData,
    points,
    completedShapes,
    markerIcon,
    completedIcon,
    onMapClick,
    onPointMove,
    onPointDelete,
    onPointInsert,
    mode
}: MapContentProps) {
    useMapEvents({
        click: (e: any) => onMapClick(e.latlng.lat, e.latlng.lng)
    });

    const renderPoints = (pts: { lat: number; lng: number }[], shapeIdx: number | 'current', isCompleted: boolean) => {
        return (
            <>
                {pts.map((p, i) => (
                    /* @ts-ignore */
                    <Marker
                        key={`${shapeIdx}-${i}`}
                        position={p}
                        icon={isCompleted ? completedIcon : markerIcon}
                        draggable={true}
                        eventHandlers={{
                            dragend: (e: any) => {
                                const marker = e.target;
                                const position = marker.getLatLng();
                                onPointMove(shapeIdx, i, position.lat, position.lng);
                            },
                            contextmenu: (e: any) => {
                                L.DomEvent.stopPropagation(e);
                                onPointDelete(shapeIdx, i);
                            }
                        }}
                    >
                        {/* Tooltip for help */}
                        <div className="hidden hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-1 rounded whitespace-nowrap z-[1000]">
                            Drag to move, Right-click to delete
                        </div>
                    </Marker>
                ))}

                {/* Mid-point markers for insertion */}
                {pts.length > 1 && pts.map((p, i) => {
                    if (i === pts.length - 1 && mode !== 'polygon') return null;
                    const nextIdx = (i + 1) % pts.length;
                    const nextP = pts[nextIdx];
                    if (!nextP) return null;

                    const midLat = (p.lat + nextP.lat) / 2;
                    const midLng = (p.lng + nextP.lng) / 2;

                    return (
                        /* @ts-ignore */
                        <Marker
                            key={`${shapeIdx}-mid-${i}`}
                            position={[midLat, midLng]}
                            icon={new DivIcon({
                                className: '',
                                html: `<div style="width: 6px; height: 6px; background: rgba(239, 68, 68, 0.5); border: 1px solid white; border-radius: 50%;"></div>`,
                                iconSize: [6, 6],
                                iconAnchor: [3, 3]
                            })}
                            eventHandlers={{
                                click: (e: any) => {
                                    L.DomEvent.stopPropagation(e);
                                    onPointInsert(shapeIdx, i, midLat, midLng);
                                }
                            }}
                        />
                    );
                })}
            </>
        );
    };

    return (
        <>
            {geojsonData && (
                /* @ts-ignore */
                <GeoJSON
                    data={geojsonData}
                    style={{ color: '#3b82f6', weight: 1, opacity: 0.3, fillOpacity: 0.1 }}
                />
            )}

            {/* Current Shape */}
            {points.length > 0 && renderPoints(points, 'current', false)}
            {points.length > 1 && (
                /* @ts-ignore */
                <Polyline positions={points} color="#ef4444" weight={2} />
            )}
            {mode === 'polygon' && points.length > 2 && (
                /* @ts-ignore */
                <Polygon positions={points} color="#ef4444" weight={1} fillOpacity={0.2} stroke={false} />
            )}

            {/* Completed Shapes */}
            {completedShapes.map((shape, idx) => (
                <React.Fragment key={`shape-${idx}`}>
                    {renderPoints(shape, idx, true)}
                    {mode === 'polygon' ? (
                        /* @ts-ignore */
                        <Polygon positions={shape} color="#3b82f6" weight={1} fillOpacity={0.3} stroke={true} />
                    ) : (
                        /* @ts-ignore */
                        <Polyline positions={shape} color="#3b82f6" weight={2} />
                    )}
                </React.Fragment>
            ))}
        </>
    );
}

// Map Bounds Component (Copied from FloorTrace)
function MapBounds({ geojsonData }: { geojsonData: any }) {
    const map = useMap();

    useEffect(() => {
        if (!geojsonData || !map) return;

        try {
            const timeoutId = setTimeout(() => {
                try {
                    const geoJsonLayer = L.geoJSON(geojsonData);
                    const bounds = geoJsonLayer.getBounds();

                    if (bounds && bounds.isValid()) {
                        // Disable animation to prevent "el is undefined" error on fast unmount/remount
                        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 2, animate: false });
                    } else {
                        map.setView([2100, 3300], -1, { animate: false });
                    }
                } catch (error) {
                    console.error("Error setting bounds", error);
                }
            }, 100);
            return () => clearTimeout(timeoutId);
        } catch (e) { }
    }, [geojsonData, map]);

    return null;
}

export default function GeofenceMapEditor({
    initialGeofence,
    initialFloorId,
    floors,
    onSave,
    onCancel,
    mode = 'polygon'
}: GeofenceMapEditorProps) {
    const [selectedFloorId, setSelectedFloorId] = useState<number | null>(initialFloorId !== undefined && initialFloorId !== null ? initialFloorId : (floors.length > 0 ? floors[0].id : null));
    const [geojsonData, setGeojsonData] = useState<any>(null);

    // State for multiple shapes
    const [completedShapes, setCompletedShapes] = useState<{ lat: number; lng: number }[][]>([]);
    const [currentPoints, setCurrentPoints] = useState<{ lat: number; lng: number }[]>([]);

    const [mapKey, setMapKey] = useState(0);

    // Parse initial geofence
    useEffect(() => {
        if (initialGeofence) {
            try {
                let parsedShapes: { lat: number, lng: number }[][] = [];

                // Check if it's a string that might be JSON
                if (typeof initialGeofence === 'string') {
                    if (initialGeofence.trim().startsWith('{') || initialGeofence.trim().startsWith('[')) {
                        try {
                            const parsed = JSON.parse(initialGeofence);
                            initialGeofence = parsed;
                        } catch (e) {
                            // Not valid JSON, continue with legacy parsing below
                        }
                    }
                }

                // Check if it's a GeoJSON object (Feature or Geometry)
                if (typeof initialGeofence === 'object' && initialGeofence !== null) {
                    const geometry = initialGeofence.type === 'Feature' ? initialGeofence.geometry : initialGeofence;

                    if (geometry.type === 'Polygon') {
                        // Single Polygon -> One shape
                        const coords = geometry.coordinates[0];
                        parsedShapes.push(coords.map((c: number[]) => ({ lat: c[1] / GEOJSON_SCALE, lng: c[0] / GEOJSON_SCALE })));
                    } else if (geometry.type === 'MultiPolygon') {
                        // MultiPolygon -> Multiple shapes
                        parsedShapes = geometry.coordinates.map((poly: number[][][]) =>
                            poly[0].map((c: number[]) => ({ lat: c[1] / GEOJSON_SCALE, lng: c[0] / GEOJSON_SCALE }))
                        );
                    } else if (geometry.type === 'LineString') {
                        // Single LineString
                        const coords = geometry.coordinates;
                        parsedShapes.push(coords.map((c: number[]) => ({ lat: c[1] / GEOJSON_SCALE, lng: c[0] / GEOJSON_SCALE })));
                    } else if (geometry.type === 'MultiLineString') {
                        // MultiLineString
                        parsedShapes = geometry.coordinates.map((line: number[][]) =>
                            line.map((c: number[]) => ({ lat: c[1] / GEOJSON_SCALE, lng: c[0] / GEOJSON_SCALE }))
                        );
                    }

                } else if (typeof initialGeofence === 'string') {
                    // Legacy string format ((x,y),...) treated as single shape
                    const matches = initialGeofence.match(/(\d+(\.\d+)?)/g);
                    if (matches && matches.length >= 2) {
                        const pts = [];
                        for (let i = 0; i < matches.length; i += 2) {
                            const x = parseFloat(matches[i]);
                            const y = parseFloat(matches[i + 1]);
                            pts.push({ lat: y / GEOJSON_SCALE, lng: x / GEOJSON_SCALE });
                        }
                        parsedShapes.push(pts);
                    }
                }

                // Remove the last point if it's the same as the first (for closed polygons)
                const cleanedShapes = parsedShapes.map(shape => {
                    if (shape.length > 1 && shape[0].lat === shape[shape.length - 1].lat && shape[0].lng === shape[shape.length - 1].lng) {
                        return shape.slice(0, -1);
                    }
                    return shape;
                });

                setCompletedShapes(cleanedShapes);
                setCurrentPoints([]); // Start fresh
            } catch (e) {
                console.error("Failed to parse initial geofence", e);
            }
        }
    }, [initialGeofence]);

    // Update selected floor when initialFloorId changes
    useEffect(() => {
        if (initialFloorId !== undefined && initialFloorId !== null) {
            setSelectedFloorId(initialFloorId);
        }
    }, [initialFloorId]);

    // Load GeoJSON when floor changes
    useEffect(() => {
        if (selectedFloorId === null || selectedFloorId === undefined) {
            console.warn('[GeofenceEditor] No floor selected');
            return;
        }
        const floor = floors.find(f => f.id === selectedFloorId);

        if (!floor?.plan) {
            console.warn('[GeofenceEditor] Floor has no plan file:', floor);
            setGeojsonData(null);
            return;
        }

        const loadPlan = async () => {
            try {
                const res = await fetch(`/${floor.plan}`);
                if (res.ok) {
                    const data = await res.json();
                    const scaled = scaleGeoJSON(data, 1 / GEOJSON_SCALE);
                    setGeojsonData(scaled);
                    setMapKey(prev => prev + 1);
                } else {
                    console.error(`[GeofenceEditor] Failed to fetch plan: ${res.status} ${res.statusText}`);
                }
            } catch (e) {
                console.error("Failed to load floor plan", e);
            }
        };
        loadPlan();
    }, [selectedFloorId, floors]);

    const handleMapClick = (lat: number, lng: number) => {
        setCurrentPoints(prev => [...prev, { lat, lng }]);
    };

    const handleUndo = () => {
        if (currentPoints.length > 0) {
            setCurrentPoints(prev => prev.slice(0, -1));
        } else if (completedShapes.length > 0) {
            const newCompleted = [...completedShapes];
            const lastShape = newCompleted.pop();
            setCompletedShapes(newCompleted);
            if (lastShape) setCurrentPoints(lastShape);
        }
    };

    const handleFinishShape = () => {
        if (mode === 'polygon' && currentPoints.length < 3) return;
        if (mode === 'linestring' && currentPoints.length < 2) return;

        setCompletedShapes(prev => [...prev, currentPoints]);
        setCurrentPoints([]);
    };

    const handlePointMove = (shapeIdx: number | 'current', pointIdx: number, lat: number, lng: number) => {
        if (shapeIdx === 'current') {
            setCurrentPoints(prev => {
                const newPts = [...prev];
                newPts[pointIdx] = { lat, lng };
                return newPts;
            });
        } else {
            setCompletedShapes(prev => {
                const newShapes = [...prev];
                const newPts = [...newShapes[shapeIdx]];
                newPts[pointIdx] = { lat, lng };
                newShapes[shapeIdx] = newPts;
                return newShapes;
            });
        }
    };

    const handlePointDelete = (shapeIdx: number | 'current', pointIdx: number) => {
        if (shapeIdx === 'current') {
            setCurrentPoints(prev => prev.filter((_, i) => i !== pointIdx));
        } else {
            setCompletedShapes(prev => {
                const newShapes = [...prev];
                const newPts = newShapes[shapeIdx].filter((_, i) => i !== pointIdx);

                // If shape becomes invalid, delete it?
                if ((mode === 'polygon' && newPts.length < 3) || (mode === 'linestring' && newPts.length < 2)) {
                    return newShapes.filter((_, i) => i !== shapeIdx);
                }

                newShapes[shapeIdx] = newPts;
                return newShapes;
            });
        }
    };

    const handlePointInsert = (shapeIdx: number | 'current', segmentIdx: number, lat: number, lng: number) => {
        if (shapeIdx === 'current') {
            setCurrentPoints(prev => {
                const newPts = [...prev];
                newPts.splice(segmentIdx + 1, 0, { lat, lng });
                return newPts;
            });
        } else {
            setCompletedShapes(prev => {
                const newShapes = [...prev];
                const newPts = [...newShapes[shapeIdx]];
                newPts.splice(segmentIdx + 1, 0, { lat, lng });
                newShapes[shapeIdx] = newPts;
                return newShapes;
            });
        }
    };

    const handleDeleteShape = (idx: number) => {
        if (confirm("Supprimer cette forme ?")) {
            setCompletedShapes(prev => prev.filter((_, i) => i !== idx));
        }
    };

    const handleSave = () => {
        let allShapes = [...completedShapes];
        if ((mode === 'polygon' && currentPoints.length >= 3) || (mode === 'linestring' && currentPoints.length >= 2)) {
            allShapes.push(currentPoints);
        }

        if (allShapes.length === 0) {
            alert("Veuillez créer au moins une forme.");
            return;
        }

        const shapeCoords = allShapes.map(shape => {
            const coords = shape.map(p => {
                const { x, y } = toCm(p.lat, p.lng);
                return [x, y];
            });
            if (mode === 'polygon') {
                if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                    coords.push(coords[0]);
                }
            }
            return coords;
        });

        let result: any;
        if (mode === 'polygon') {
            const multiPolyCoords = shapeCoords.map(c => [c]);
            result = {
                type: 'MultiPolygon',
                coordinates: multiPolyCoords
            };
        } else {
            result = {
                type: 'MultiLineString',
                coordinates: shapeCoords
            };
        }

        onSave(result);
    };

    const markerIcon = new DivIcon({
        className: '',
        html: `<div style="width: 12px; height: 12px; background: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.5); cursor: move;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    const completedIcon = new DivIcon({
        className: '',
        html: `<div style="width: 10px; height: 10px; background: #3b82f6; border: 1px solid white; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.4); cursor: move;"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
    });

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex flex-col">
            {/* Header / Toolbar */}
            <div className="bg-white dark:bg-gray-800 p-4 flex flex-wrap justify-between items-center border-b border-gray-200 dark:border-gray-700 gap-4">
                <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <MapIcon className="w-5 h-5" />
                        {mode === 'linestring' ? 'Éditeur de Trajet' : 'Éditeur de Geofence'}
                    </h2>
                    <select
                        value={selectedFloorId ?? ''}
                        onChange={(e) => setSelectedFloorId(Number(e.target.value))}
                        className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={initialFloorId !== undefined && initialFloorId !== null}
                    >
                        {floors.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.id} - {f.description || f.name}
                            </option>
                        ))}
                    </select>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {completedShapes.length} formes | {currentPoints.length} pts en cours
                    </div>
                </div>

                <div className="flex items-center space-x-2 flex-wrap">
                    <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
                        <span>Faire glisser pour déplacer</span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>Clic droit pour supprimer</span>
                    </div>

                    <button
                        onClick={handleFinishShape}
                        disabled={
                            (mode === 'polygon' && currentPoints.length < 3) ||
                            (mode === 'linestring' && currentPoints.length < 2)
                        }
                        className="flex items-center gap-1 px-3 py-2 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 rounded disabled:opacity-50 font-medium"
                        title="Finaliser la forme en cours"
                    >
                        <Save className="w-4 h-4" /> Finir forme
                    </button>
                    <button
                        onClick={handleUndo}
                        disabled={currentPoints.length === 0 && completedShapes.length === 0}
                        className="flex items-center gap-1 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
                        title="Annuler le dernier point ou rouvrir la dernière forme"
                    >
                        <Undo className="w-4 h-4" /> Annuler
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                        <X className="w-4 h-4" /> Fermer
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1 px-4 py-2 bg-[#0096D6] hover:bg-[#007BB5] text-white rounded font-medium shadow-lg"
                    >
                        <Save className="w-4 h-4" /> Tout Valider
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Shapes Sidebar */}
                <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-4 hidden md:block">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Formes Validées</h3>
                    {completedShapes.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">Aucune forme encore validée.</p>
                    ) : (
                        <div className="space-y-2">
                            {completedShapes.map((shape, idx) => (
                                <div key={idx} className="group flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors">
                                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Forme #{idx + 1}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-500 mr-2">{shape.length} pts</span>
                                        <button
                                            onClick={() => handleDeleteShape(idx)}
                                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            title="Supprimer la forme"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-slate-900">
                    {/* @ts-ignore */}
                    <MapContainer
                        key={mapKey}
                        center={[2100, 3300]}
                        zoom={-1}
                        minZoom={-5}
                        maxZoom={4}
                        zoomSnap={0.1}
                        crs={L.CRS.Simple}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <MapContent
                            geojsonData={geojsonData}
                            points={currentPoints}
                            completedShapes={completedShapes}
                            markerIcon={markerIcon}
                            completedIcon={completedIcon}
                            onMapClick={handleMapClick}
                            onPointMove={handlePointMove}
                            onPointDelete={handlePointDelete}
                            onPointInsert={handlePointInsert}
                            mode={mode}
                        />

                        <MapBounds geojsonData={geojsonData} />
                    </MapContainer>
                </div>
            </div>
        </div>
    );
}
