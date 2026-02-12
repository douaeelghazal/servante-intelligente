import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

interface MotorStatus {
    connected: boolean;
    port: string | null;
    lastResponse: string | null;
}

class MotorService {
    private port: SerialPort | null = null;
    private parser: ReadlineParser | null = null;
    private motorStatus: MotorStatus = {
        connected: false,
        port: null,
        lastResponse: null,
    };

    // RFID callback for shared serial port
    private rfidCallback: ((uid: string) => void) | null = null;

    // Motor to drawer mapping
    // Motor X = Drawer 1
    // Motor Y = Drawer 2
    // Motor Z = Drawer 3
    // Motor A = Drawer 4
    private drawerToMotor: { [key: string]: string } = {
        '1': 'x',
        '2': 'y',
        '3': 'z',
        '4': 'a',
    };

    async initialize(): Promise<void> {
        try {
            console.log('🔌 Recherche du contrôleur de moteurs...');

            const ports = await SerialPort.list();
            const arduinoPort = ports.find(
                (p) => p.vendorId === '2341' || p.vendorId === '1a86' // Arduino Mega vendor IDs
            );

            if (!arduinoPort) {
                console.warn('⚠️ Aucun Arduino détecté pour les moteurs');
                return;
            }

            this.port = new SerialPort({
                path: arduinoPort.path,
                baudRate: 9600,
            });

            this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

            this.parser.on('data', (line: string) => {
                const cleaned = line.trim();
                if (cleaned) {
                    // Check if it's a RFID UID message
                    if (cleaned.startsWith('UID:')) {
                        const uid = cleaned.replace('UID:', '').toUpperCase();
                        console.log('📇 Badge RFID scanné:', uid);

                        // Call RFID callback if registered
                        if (this.rfidCallback) {
                            this.rfidCallback(uid);
                        }
                    } else {
                        // Motor message
                        console.log(`[MOTOR] ${cleaned}`);
                        this.motorStatus.lastResponse = cleaned;
                    }
                }
            });

            this.port.on('error', (err) => {
                console.error('❌ Erreur moteur:', err.message);
                this.motorStatus.connected = false;
            });

            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for Arduino reset

            this.motorStatus.connected = true;
            this.motorStatus.port = arduinoPort.path;
            console.log(`✅ Contrôleur de moteurs connecté sur ${arduinoPort.path}`);
        } catch (error) {
            console.error('❌ Erreur initialisation moteurs:', error);
            this.motorStatus.connected = false;
        }
    }

    /**
     * Open drawer by number (1-4)
     */
    async openDrawer(drawerNumber: string): Promise<boolean> {
        if (!this.motorStatus.connected || !this.port) {
            console.warn('⚠️ Moteurs non connectés');
            return false;
        }

        const motor = this.drawerToMotor[drawerNumber];
        if (!motor) {
            console.error(`❌ Tiroir invalide: ${drawerNumber}. Utiliser 1, 2, 3 ou 4`);
            return false;
        }

        try {
            const command = `${motor}o\n`; // e.g., "xo" for drawer 1 open
            console.log(`🔓 Ouverture du tiroir ${drawerNumber} (moteur ${motor.toUpperCase()})...`);

            this.port.write(command);
            return true;
        } catch (error) {
            console.error('❌ Erreur envoi commande moteur:', error);
            return false;
        }
    }

    /**
     * Close drawer by number (1-4)
     */
    async closeDrawer(drawerNumber: string): Promise<boolean> {
        if (!this.motorStatus.connected || !this.port) {
            console.warn('⚠️ Moteurs non connectés');
            return false;
        }

        const motor = this.drawerToMotor[drawerNumber];
        if (!motor) {
            console.error(`❌ Tiroir invalide: ${drawerNumber}`);
            return false;
        }

        try {
            const command = `${motor}f\n`; // e.g., "xf" for drawer 1 close
            console.log(`🔒 Fermeture du tiroir ${drawerNumber} (moteur ${motor.toUpperCase()})...`);

            this.port.write(command);
            return true;
        } catch (error) {
            console.error('❌ Erreur envoi commande moteur:', error);
            return false;
        }
    }

    /**
     * Emergency stop all motors
     */
    async stopAll(): Promise<boolean> {
        if (!this.motorStatus.connected || !this.port) {
            return false;
        }

        try {
            this.port.write('s\n');
            console.log('🛑 ARRÊT D\'URGENCE - Tous les moteurs');
            return true;
        } catch (error) {
            console.error('❌ Erreur arrêt moteurs:', error);
            return false;
        }
    }

    getStatus(): MotorStatus {
        return { ...this.motorStatus };
    }

    /**
     * Register RFID callback for shared serial port
     */
    setRfidCallback(callback: (uid: string) => void): void {
        this.rfidCallback = callback;
    }

    /**
     * Get the serial port path (for RFID service to know which port is being used)
     */
    getPortPath(): string | null {
        return this.motorStatus.port;
    }

    async close(): Promise<void> {
        if (this.port && this.port.isOpen) {
            await new Promise<void>((resolve) => {
                this.port!.close((err) => {
                    if (err) console.error('Erreur fermeture port moteur:', err);
                    resolve();
                });
            });
            this.motorStatus.connected = false;
            this.motorStatus.port = null;
            console.log('🔌 Connexion moteurs fermée');
        }
    }
}

export const motorService = new MotorService();
