#define DECODE_NEC
#include <IRremote.hpp>

/*
  새록새록 재활 게임 - Arduino UNO + MB-102

  [버튼]
  D2 = 빨강 버튼
  D3 = 초록 버튼
  D4 = 파랑 버튼

  [출력]
  D5 = 진동 모터
  D6 = 부저
  D7 = IR 수신기
  D9 = RGB LED R
  D10 = RGB LED G
  D11 = RGB LED B
  A0 = 가변저항

  [주의]
  버튼 위 색상 표시 LED 3개는 아두이노 핀을 쓰지 않음.
  5V → 220Ω → LED 긴 다리
  LED 짧은 다리 → GND
  이렇게 연결해서 항상 켜 둠.
*/

// ===================== 핀 설정 =====================
const int BTN_RED   = 2;
const int BTN_GREEN = 3;
const int BTN_BLUE  = 4;

const int MOTOR_PIN = 5;
const int BUZZER_PIN = 6;
const int IR_PIN = 7;

const int RGB_R = 9;
const int RGB_G = 10;
const int RGB_B = 11;

const int DIAL_PIN = A0;

// ===================== 버튼 디바운스 =====================
const unsigned long DEBOUNCE_TIME = 40;

struct Button {
  int pin;
  const char* colorName;
  bool lastReading;
  bool stableState;
  unsigned long lastChangeTime;
};

Button buttons[] = {
  { BTN_RED,   "RED",   HIGH, HIGH, 0 },
  { BTN_GREEN, "GREEN", HIGH, HIGH, 0 },
  { BTN_BLUE,  "BLUE",  HIGH, HIGH, 0 }
};

const int BUTTON_COUNT = sizeof(buttons) / sizeof(buttons[0]);

// ===================== 가변저항 전송 간격 =====================
unsigned long lastDialSendTime = 0;
const unsigned long DIAL_SEND_INTERVAL = 150;

int lastDialValue = -1;

// ===================== 기본 설정 =====================
void setup() {
  Serial.begin(9600);
  Serial.setTimeout(20);

  // 버튼은 INPUT_PULLUP 사용
  pinMode(BTN_RED, INPUT_PULLUP);
  pinMode(BTN_GREEN, INPUT_PULLUP);
  pinMode(BTN_BLUE, INPUT_PULLUP);

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(RGB_R, OUTPUT);
  pinMode(RGB_G, OUTPUT);
  pinMode(RGB_B, OUTPUT);

  analogWrite(MOTOR_PIN, 0);
  setRGB(0, 0, 0);

  // IR 수신기 시작
  IrReceiver.begin(IR_PIN, ENABLE_LED_FEEDBACK);

  Serial.println("READY");
}

// ===================== 반복 실행 =====================
void loop() {
  readButtons();
  readDial();
  readIR();
  readSerialCommand();
}

// ===================== 버튼 읽기 =====================
void readButtons() {
  for (int i = 0; i < BUTTON_COUNT; i++) {
    bool reading = digitalRead(buttons[i].pin);

    if (reading != buttons[i].lastReading) {
      buttons[i].lastChangeTime = millis();
      buttons[i].lastReading = reading;
    }

    if ((millis() - buttons[i].lastChangeTime) > DEBOUNCE_TIME) {
      if (reading != buttons[i].stableState) {
        buttons[i].stableState = reading;

        // INPUT_PULLUP은 누르면 LOW
        if (buttons[i].stableState == LOW) {
          Serial.print("BTN:");
          Serial.println(buttons[i].colorName);

          shortBeep();
        }
      }
    }
  }
}

// ===================== 가변저항 읽기 =====================
void readDial() {
  if (millis() - lastDialSendTime < DIAL_SEND_INTERVAL) {
    return;
  }

  lastDialSendTime = millis();

  int value = analogRead(DIAL_PIN);

  // 값이 너무 조금 변할 때는 전송하지 않음
  if (lastDialValue == -1 || abs(value - lastDialValue) >= 8) {
    lastDialValue = value;

    Serial.print("DIAL:");
    Serial.println(value);
  }
}

// ===================== IR 리모컨 읽기 =====================
void readIR() {
  if (IrReceiver.decode()) {
    bool isRepeat = IrReceiver.decodedIRData.flags & IRDATA_FLAGS_IS_REPEAT;
    uint8_t command = IrReceiver.decodedIRData.command;
    IRRawDataType rawData = IrReceiver.decodedIRData.decodedRawData;

    // NEC raw 데이터는 명령 바이트가 16~23번째 비트에 들어 있음
    if (command == 0x00 && rawData != 0) {
      command = (rawData >> 16) & 0xFF;
    }

    // 버튼을 길게 누를 때 오는 반복 프레임은 중복 입력 방지를 위해 무시
    if (isRepeat) {
      IrReceiver.resume();
      return;
    }

    // 일반 미니 리모컨 기준으로 자주 쓰이는 값
    // 리모컨마다 다를 수 있어서 Serial Monitor로 먼저 확인하면 됨
    if (command == 0x08) {
      Serial.println("IR:LEFT");
    } 
    else if (command == 0x5A) {
      Serial.println("IR:RIGHT");
    } 
    else if (command == 0x1C) {
      Serial.println("IR:OK");
    } 
    else {
      Serial.print("IR:0x");
      Serial.println(command, HEX);

      Serial.print("IRRAW:0x");
      Serial.println(rawData, HEX);
    }

    IrReceiver.resume();
  }
}

// ===================== PC/Node에서 오는 명령 처리 =====================
// 예)
// OK
// FAIL
// RGB:255,0,0
// RGB:0,255,0
// RGB:0,0,255
// MOTOR:180
// MOTOR:0
// BUZZ:1000,100
// OFF
void readSerialCommand() {
  if (!Serial.available()) {
    return;
  }

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd == "OK") {
    successFeedback();
  } 
  else if (cmd == "FAIL") {
    failFeedback();
  } 
  else if (cmd == "OFF") {
    setRGB(0, 0, 0);
    analogWrite(MOTOR_PIN, 0);
    noTone(BUZZER_PIN);
    IrReceiver.restartTimer();
  } 
  else if (cmd.startsWith("RGB:")) {
    handleRGBCommand(cmd);
  } 
  else if (cmd.startsWith("MOTOR:")) {
    int power = cmd.substring(6).toInt();
    power = constrain(power, 0, 255);
    analogWrite(MOTOR_PIN, power);
  } 
  else if (cmd.startsWith("BUZZ:")) {
    handleBuzzCommand(cmd);
  }
}

// ===================== RGB 명령 처리 =====================
void handleRGBCommand(String cmd) {
  cmd.replace("RGB:", "");

  int firstComma = cmd.indexOf(',');
  int secondComma = cmd.indexOf(',', firstComma + 1);

  if (firstComma == -1 || secondComma == -1) {
    return;
  }

  int r = cmd.substring(0, firstComma).toInt();
  int g = cmd.substring(firstComma + 1, secondComma).toInt();
  int b = cmd.substring(secondComma + 1).toInt();

  r = constrain(r, 0, 255);
  g = constrain(g, 0, 255);
  b = constrain(b, 0, 255);

  setRGB(r, g, b);
}

// ===================== 부저 명령 처리 =====================
void handleBuzzCommand(String cmd) {
  cmd.replace("BUZZ:", "");

  int comma = cmd.indexOf(',');

  if (comma == -1) {
    return;
  }

  int freq = cmd.substring(0, comma).toInt();
  int duration = cmd.substring(comma + 1).toInt();

  freq = constrain(freq, 100, 5000);
  duration = constrain(duration, 20, 2000);

  playToneSafely(freq, duration);
}

// ===================== RGB LED 제어 =====================
void setRGB(int r, int g, int b) {
  // Uno의 D11 PWM은 IR 수신 타이머와 충돌하므로 디지털 출력 사용
  digitalWrite(RGB_R, r > 0 ? HIGH : LOW);
  digitalWrite(RGB_G, g > 0 ? HIGH : LOW);
  digitalWrite(RGB_B, b > 0 ? HIGH : LOW);
}

// ===================== 부저 사용 후 IR 수신 복구 =====================
void playToneSafely(int frequency, int duration) {
  tone(BUZZER_PIN, frequency, duration);
  delay(duration);
  noTone(BUZZER_PIN);
  IrReceiver.restartTimer();
}

// ===================== 버튼 입력음 =====================
void shortBeep() {
  playToneSafely(1200, 50);
}

// ===================== 정답 피드백 =====================
void successFeedback() {
  setRGB(0, 255, 0);
  analogWrite(MOTOR_PIN, 150);
  playToneSafely(1500, 120);
  analogWrite(MOTOR_PIN, 0);
}

// ===================== 오답 피드백 =====================
void failFeedback() {
  setRGB(255, 0, 0);
  analogWrite(MOTOR_PIN, 220);
  playToneSafely(300, 200);
  analogWrite(MOTOR_PIN, 0);
}
