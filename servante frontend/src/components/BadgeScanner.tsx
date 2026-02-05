import React, { useState, useEffect } from 'react';
import { Scan, X, CheckCircle, Loader } from 'lucide-react';

interface BadgeScannerProps {
    onBadgeScanned: (uid: string) => void;
    onClose: () => void;
    currentBadgeId?: string;
}

const BadgeScanner: React.FC<BadgeScannerProps> = ({ onBadgeScanned, onClose, currentBadgeId }) => {
    const [scanId, setScanId] = useState<string | null>(null);
    const [status, setStatus] = useState<'init' | 'waiting' | 'success' | 'error'>('init');
    const [message, setMessage] = useState('Initialisation...');
    const [scannedUid, setScannedUid] = useState<string | null>(null);

    // Démarrer le scan au montage du composant
    useEffect(() => {
        startScan();

        return () => {
            // Annuler le scan si le composant est démonté
            if (scanId) {
                cancelScan(scanId);
            }
        };
    }, []);

    // Démarrer un nouveau scan
    const startScan = async () => {
        try {
            const response = await fetch('/api/hardware/badge-scan/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                setScanId(data.scanId);
                setStatus('waiting');
                setMessage('Approchez le badge du lecteur RFID...');

                // Commencer à poller pour le résultat
                pollForResult(data.scanId);
            } else {
                setStatus('error');
                setMessage(data.message || 'Erreur lors du démarrage du scan');
            }
        } catch (error) {
            console.error('Erreur startScan:', error);
            setStatus('error');
            setMessage('Erreur de connexion au serveur');
        }
    };

    // Poller le serveur pour vérifier si un badge a été scanné
    const pollForResult = async (id: string) => {
        const maxAttempts = 60; // 60 secondes max
        let attempts = 0;

        const poll = async () => {
            if (attempts >= maxAttempts) {
                setStatus('error');
                setMessage('Délai d\'attente dépassé. Réessayez.');
                return;
            }

            try {
                const response = await fetch(`/api/hardware/badge-scan/${id}`);
                const data = await response.json();

                if (data.success && data.uid) {
                    // Badge détecté !
                    setScannedUid(data.uid);
                    setStatus('success');
                    setMessage(`Badge détecté : ${data.uid}`);

                    // Notifier le parent après 1 seconde
                    setTimeout(() => {
                        onBadgeScanned(data.uid);
                    }, 1000);
                } else if (data.success && !data.uid) {
                    // Toujours en attente
                    attempts++;
                    setTimeout(poll, 1000);
                } else {
                    setStatus('error');
                    setMessage(data.message || 'Erreur lors du scan');
                }
            } catch (error) {
                console.error('Erreur poll:', error);
                setStatus('error');
                setMessage('Erreur de connexion');
            }
        };

        poll();
    };

    // Annuler un scan
    const cancelScan = async (id: string) => {
        try {
            await fetch(`/api/hardware/badge-scan/${id}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Erreur cancelScan:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Scan className="w-6 h-6" />
                        Scanner un badge
                    </h3>
                    <button
                        onClick={() => {
                            if (scanId) cancelScan(scanId);
                            onClose();
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Animation et statut */}
                    <div className="flex flex-col items-center justify-center py-8">
                        {status === 'waiting' && (
                            <div className="relative">
                                {/* Animation de scan */}
                                <div className="w-32 h-32 border-8 border-blue-200 rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Scan className="w-16 h-16 text-blue-600 animate-bounce" />
                                </div>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-16 h-16 text-green-600" />
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center">
                                <X className="w-16 h-16 text-red-600" />
                            </div>
                        )}

                        {status === 'init' && (
                            <Loader className="w-16 h-16 text-slate-400 animate-spin" />
                        )}
                    </div>

                    {/* Message */}
                    <div className="text-center">
                        <p className="text-lg font-semibold text-slate-900 mb-2">{message}</p>
                        {scannedUid && (
                            <p className="text-sm text-slate-600">
                                UID: <span className="font-mono font-bold text-blue-600">{scannedUid}</span>
                            </p>
                        )}
                        {currentBadgeId && status === 'waiting' && (
                            <p className="text-xs text-slate-500 mt-4">
                                Badge actuel: <span className="font-mono">{currentBadgeId}</span>
                            </p>
                        )}
                    </div>

                    {/* Instructions */}
                    {status === 'waiting' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                💡 <strong>Instructions:</strong>
                                <br />
                                1. Approchez le badge du lecteur RFID
                                <br />
                                2. Attendez la détection (bip sonore)
                                <br />
                                3. Le badge sera automatiquement enregistré
                            </p>
                        </div>
                    )}

                    {/* Boutons */}
                    <div className="flex gap-3">
                        {status === 'error' && (
                            <button
                                onClick={() => {
                                    setStatus('init');
                                    startScan();
                                }}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                            >
                                Réessayer
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (scanId) cancelScan(scanId);
                                onClose();
                            }}
                            className="flex-1 px-4 py-3 bg-slate-200 hover:bg-slate-300 rounded-lg font-semibold transition-all"
                        >
                            {status === 'success' ? 'Fermer' : 'Annuler'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BadgeScanner;
