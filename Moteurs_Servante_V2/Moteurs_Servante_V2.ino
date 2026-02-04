// =====================================
// SERVANTE INTELLIGENTE - CODE ARDUINO MOTEURS V2
// Trapezoid acceleration profile
// =====================================

// -------------------- TB6560 PINS --------------------
#define EN_PIN   14

// Motor X
#define STEP_X   2 
#define DIR_X    3
#define END_X    26

// Motor Y
#define STEP_Y   4
#define DIR_Y    5
#define END_Y    28

// Motor Z
#define STEP_Z   6
#define DIR_Z    7
#define END_Z    30

// Motor A
#define STEP_A   22
#define DIR_A    24
#define END_A    32

// -------------------- VARIABLES & CALIBRATION --------------------
int stepsPerRev = 400;   // NEMA 17 (0.9°)
int microstep = 8;
float pulleyPitch_mm = 8.0;

// Pas par mm
float stepsPer_mm = (float)(stepsPerRev * microstep) / pulleyPitch_mm;

// Course tiroir
const long DRAWER_DISTANCE_MM = 380;
const long STEPS_TO_MOVE = (long)(DRAWER_DISTANCE_MM * stepsPer_mm);

bool stopAll = true;
char activeAxis = ' ';


// -------------------- LOI TRAPÈZE (AJOUT) --------------------
float Vmax = 2500.0;        // pas / seconde
float accel = 500.0;        // pas / seconde²
float currentSpeed = 0;     // vitesse instantanée
long accelSteps = 0;        // pas d'accélération
long totalPlannedSteps = 0;// pas totaux du mouvement

// -------------------- STRUCTURE MOTEUR --------------------
struct MotorState {
  long stepsRemaining;
  int stepPin;
  int dirPin;
  int endPin;
  char id;
  bool isClosing;
};

MotorState motors[] = {
  {0, STEP_X, DIR_X, END_X, 'x', false},
  {0, STEP_Y, DIR_Y, END_Y, 'y', false},
  {0, STEP_Z, DIR_Z, END_Z, 'z', false},
  {0, STEP_A, DIR_A, END_A, 'a', false}
};


// -------------------- FUNCTION : MOVEMENT --------------------
void handleMotorMovement(MotorState& motor) {

  if (motor.stepsRemaining > 0) {

    // --- Capteur de fin de course ---
    bool endstopReached = (digitalRead(motor.endPin) == LOW);

    if (motor.isClosing && endstopReached) {
      Serial.print("🛑 Moteur "); Serial.print(motor.id);
      Serial.println(" : Fermeture atteinte");
      motor.stepsRemaining = 0;
      return;
    }

    if (!motor.isClosing && endstopReached) {
      Serial.print("⚠️ Moteur "); Serial.print(motor.id);
      Serial.println(" : Capteur atteint en ouverture");
      motor.stepsRemaining = 0;
      return;
    }

    // --------- LOI TRAPÈZE (AJOUT) ---------
    long stepsDone = totalPlannedSteps - motor.stepsRemaining;

    if (stepsDone < accelSteps) {
      currentSpeed += accel * 0.001;       // accélération
    }
    else if (motor.stepsRemaining < accelSteps) {
      currentSpeed -= accel * 0.001;       // décélération
    }
    else {
      currentSpeed = Vmax;                 // vitesse constante
    }

    if (currentSpeed < 150) currentSpeed = 150; // sécurité

    float delayMicro = 1000000.0 / currentSpeed;

    // --------- STEP ---------
    digitalWrite(motor.stepPin, HIGH);
    delayMicroseconds(delayMicro / 2);
    digitalWrite(motor.stepPin, LOW);
    delayMicroseconds(delayMicro / 2);

    motor.stepsRemaining--;

  } else {
    Serial.print("✅ Moteur "); Serial.print(motor.id);
    Serial.println(" : Mouvement terminé");
    activeAxis = ' ';
    stopAll = true;
  }
}


// -------------------- SETUP --------------------
void setup() {
  Serial.begin(9600);

  pinMode(EN_PIN, OUTPUT);
  digitalWrite(EN_PIN, LOW);

  for (int i = 0; i < 4; i++) {
    pinMode(motors[i].stepPin, OUTPUT);
    pinMode(motors[i].dirPin, OUTPUT);
    pinMode(motors[i].endPin, INPUT_PULLUP);
    digitalWrite(motors[i].dirPin, HIGH);
  }
}


// -------------------- LOOP --------------------
void loop() {

  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.toLowerCase();

    char action = input.charAt(0);
    char axis = input.charAt(1);

    // ---- ARRÊT D'URGENCE ----
    if (action == 's') {
      stopAll = true;
      activeAxis = ' ';
      for (int i = 0; i < 4; i++) motors[i].stepsRemaining = 0;
      Serial.println("🛑 Arrêt d'urgence");
      return;
    }

    // ---- COMMANDE AXE ----
    if (activeAxis == ' ' && (action == 'o' || action == 'f')) {

      int motorIndex = -1;
      if (axis == 'x') motorIndex = 0;
      else if (axis == 'y') motorIndex = 1;
      else if (axis == 'z') motorIndex = 2;
      else if (axis == 'a') motorIndex = 3;

      if (motorIndex != -1) {
        MotorState& m = motors[motorIndex];

        for (int i = 0; i < 4; i++) motors[i].stepsRemaining = 0;

        activeAxis = m.id;
        stopAll = false;

        // --------- INITIALISATION TRAPÈZE (AJOUT) ---------
        totalPlannedSteps = (action == 'o') ? STEPS_TO_MOVE : (STEPS_TO_MOVE + 20000);
        accelSteps = (Vmax * Vmax) / (2 * accel);
        if (2 * accelSteps > totalPlannedSteps)
          accelSteps = totalPlannedSteps / 2;
        currentSpeed = 0;
        // -----------------------------------------------

        if (action == 'o') {
          digitalWrite(m.dirPin, HIGH);
          m.stepsRemaining = STEPS_TO_MOVE;
          m.isClosing = false;
        } else {
          digitalWrite(m.dirPin, LOW);
          m.stepsRemaining = STEPS_TO_MOVE + 20000;
          m.isClosing = true;
        }
      }
    }
  }

  if (stopAll || activeAxis == ' ') return;

  for (int i = 0; i < 4; i++) {
    if (motors[i].id == activeAxis) {
      handleMotorMovement(motors[i]);
      break;
    }
  }
}
