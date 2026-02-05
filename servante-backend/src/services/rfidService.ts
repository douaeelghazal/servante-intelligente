import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

class RFIDService {
    private port: SerialPort | null = null;
    private parser: ReadlineParser | null = null;
    private lastScannedBadge: { uid: string; timestamp: number } | null = null;

    async initialize() {
        try {
            const portPath = await this.findArduinoPort();

            if (!portPath) {
                console.warn('⚠️  Arduino RFID reader not detected');
                return false;
            }

            this.port = new SerialPort({
                path: portPath,
                baudRate: 9600
            });

            this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

            this.parser.on('data', (data: string) => {
                const trimmed = data.trim();

                // Format attendu: UID:0A1B2C3D
                if (trimmed.startsWith('UID:')) {
                    const uid = trimmed.replace('UID:', '').toUpperCase();

                    // Toujours mettre à jour le timestamp même si c'est le même badge
                    // Cela permet de rescanner le même badge plusieurs fois
                    this.lastScannedBadge = {
                        uid,
                        timestamp: Date.now()
                    };

                    console.log('📇 Badge RFID scanné:', uid);
                }
            });

            this.port.on('error', (err) => {
                console.error('❌ Erreur port série RFID:', err.message);
            });

            console.log('✅ Lecteur RFID connecté sur', portPath);
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation RFID:', error);
            return false;
        }
    }

    private async findArduinoPort(): Promise<string | null> {
        try {
            const ports = await SerialPort.list();

            // Chercher un port Arduino (Mega utilise souvent CH340 ou FTDI)
            const arduinoPort = ports.find(port =>
                port.manufacturer?.toLowerCase().includes('arduino') ||
                port.manufacturer?.toLowerCase().includes('ch340') ||
                port.manufacturer?.toLowerCase().includes('ftdi') ||
                port.vendorId === '2341' || // Arduino officiel
                port.vendorId === '1a86'    // CH340 (clone Arduino)
            );

            return arduinoPort?.path || null;
        } catch (error) {
            console.error('Erreur lors de la recherche du port Arduino:', error);
            return null;
        }
    }

    getLastScan(): { uid: string; timestamp: number } | null {
        if (!this.lastScannedBadge) {
            return null;
        }

        // Expiration après 10 secondes
        const age = Date.now() - this.lastScannedBadge.timestamp;
        if (age > 10000) {
            this.lastScannedBadge = null;
            return null;
        }

        return this.lastScannedBadge;
    }

    consumeLastScan(): string | null {
        const scan = this.getLastScan();
        if (scan) {
            this.lastScannedBadge = null;
            return scan.uid;
        }
        return null;
    }

    getStatus(): { connected: boolean; port?: string } {
        return {
            connected: this.port !== null && this.port.isOpen,
            port: this.port?.path
        };
    }

    close() {
        if (this.port?.isOpen) {
            this.port.close();
            console.log('🔌 Lecteur RFID déconnecté');
        }
    }
}

export const rfidService = new RFIDService();