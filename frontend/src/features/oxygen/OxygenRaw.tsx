
import React, { useState, useEffect, useRef } from 'react';
import { Activity, Clock, Database, Signal, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OxygenRawData {
    mac: string;
    point_type: string;
    raw_data: string;
    last_updated: Date;
    rssi?: number;
}

export default function OxygenRaw() {
    const { t } = useTranslation();
    const [points, setPoints] = useState<Map<string, OxygenRawData>>(new Map());
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const connectWebSocket = () => {
        setConnectionStatus('connecting');
        // Connect to the same host as the API, but with ws protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use fixed port 8789 if likely running on dev server communicating with backend port
        // In production (same origin), use window.location.host
        const host = window.location.hostname;
        const port = '8789'; // Backend port from .env
        const url = `${protocol}//${host}:${port}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnectionStatus('connected');
        };

        ws.onclose = () => {
            setConnectionStatus('disconnected');
            // Auto-reconnect after 5s
            setTimeout(connectWebSocket, 5000);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Check if it's an MQTT message
                if (message.type === 'mqtt_message' && message.topic === 'rtls/topic') {
                    handleRtlsMessage(message.data);
                }
            } catch (err) {
            }
        };
    };

    const handleRtlsMessage = (payload: any) => {
        // Logic from mqttService.js to extract data
        // Structure: payload.device_info.mac, payload.data (array)
        if (!payload.device_info || !payload.data) return;

        const gatewayMac = payload.device_info.mac;

        // Process "other" packets which contain the raw data we want
        const otPackets = payload.data.filter((d: any) => d.type === 'other');

        otPackets.forEach((packet: any) => {
            if (!packet.raw_data) return;

            const mac = packet.mac || gatewayMac; // Use tag MAC if available

            const newData: OxygenRawData = {
                mac: mac,
                point_type: 'unknown', // We can try to deduce this or just show 'Oxygen Sensor'
                raw_data: packet.raw_data,
                last_updated: new Date(),
                rssi: packet.rssi
            };

            setPoints(prev => {
                const newMap = new Map(prev);
                newMap.set(mac, newData);
                return newMap;
            });
        });
    };

    // Convert Map to Array and sort by date desc
    const sortedPoints = Array.from(points.values()).sort((a, b) => b.last_updated.getTime() - a.last_updated.getTime());

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="text-blue-500" />
                        {t('oxygen.rawTitle')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('oxygen.rawSnippet')}
                    </p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${connectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    <Wifi className="w-4 h-4" />
                    {connectionStatus === 'connected' ? t('oxygen.wsConnected') : t('oxygen.wsDisconnected')}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedPoints.map((point) => (
                    <div key={point.mac} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50 dark:bg-gray-750">
                            <div>
                                <h3 className="font-mono text-lg font-bold text-gray-800 dark:text-blue-300">{point.mac}</h3>
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                    {t('oxygen.sensor')}
                                </span>
                            </div>
                            {point.rssi && (
                                <div className="flex items-center gap-1 text-xs text-gray-500" title="RSSI">
                                    <Signal className="w-3 h-3" />
                                    {point.rssi} dBm
                                </div>
                            )}
                        </div>

                        <div className="p-4 space-y-3">
                            <div>
                                <div className="text-xs uppercase text-gray-400 font-semibold mb-1">{t('oxygen.rawDataLabel')}</div>
                                <code className="block bg-gray-900 text-green-400 p-2 rounded text-xs break-all font-mono">
                                    {point.raw_data}
                                </code>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {(() => {
                                        // Parser les données brutes
                                        const raw = point.raw_data;
                                        const header = '071601ea';
                                        const index = raw.indexOf(header);

                                        if (index !== -1) {
                                            const dataHex = raw.substring(index + header.length, index + header.length + 8);
                                            const valves = [
                                                { name: 'Green/White', color: 'bg-green-100 text-green-800 border-green-200' }, // Using green-100 for White variants? Or uniform green? Let's make active = Green-500 for main, Green-100 for White? 
                                                // User said "boule verte". Let's use consistent Green for all ON states.
                                                // To distinguish, maybe active is always strong green?
                                                // Or if "Blue" is the name, the status "ON" is Green.
                                                // My previous code used `v.color` for ON.
                                                // I will change definitions to all use Green for ON.
                                            ];

                                            // Redefining to be safe
                                            const valveDefs = [
                                                { name: 'Green/White', activeColor: 'bg-green-500 text-white border-green-600' },
                                                { name: 'Green', activeColor: 'bg-green-500 text-white border-green-600' },
                                                { name: 'Blue/White', activeColor: 'bg-green-500 text-white border-green-600' },
                                                { name: 'Blue', activeColor: 'bg-green-500 text-white border-green-600' }
                                            ];

                                            return valveDefs.map((v, i) => {
                                                // 1 byte (2 chars) per valve
                                                const byteHex = dataHex.substring(i * 2, i * 2 + 2);
                                                const val = parseInt(byteHex, 16);
                                                const isOn = val === 1;

                                                return (
                                                    <div key={i} className={`text-xs px-2 py-1 rounded border flex items-center justify-between ${isOn ? v.activeColor : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                                        <span>{v.name}</span>
                                                        <div className="flex items-center gap-1">
                                                            {isOn && <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>}
                                                            <span className={`font-bold ${isOn ? '' : 'text-gray-400'}`}>
                                                                {isOn ? t('common.open') : t('common.closed')} <span className="opacity-50 text-[10px]">({byteHex})</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        }
                                        return <div className="col-span-2 text-xs text-gray-400 italic">{t('oxygen.unrecognizedFormat')}</div>;
                                    })()}
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Last update
                                </div>
                                <span className="font-mono">
                                    {point.last_updated.toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                        {/* Visual Indicator of freshness */}
                        <div className="h-1 w-full bg-[#0096D6] animate-pulse bg-opacity-20">
                            <div className="h-full bg-[#0096D6]" style={{ width: '100%' }}></div>
                        </div>
                    </div>
                ))}

                {sortedPoints.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p>{t('oxygen.waitingForMqtt')}</p>
                        <p className="text-xs mt-1">{t('oxygen.ensureSimulator')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
