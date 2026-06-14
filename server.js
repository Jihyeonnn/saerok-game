const express = require("express");
const http = require("http");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT) || 3000;
const BAUD_RATE = 9600;
const SERIAL_RETRY_DELAY = 3000;

let arduinoPort = null;
let arduinoPath = null;
let reconnectTimer = null;

app.use(express.static("public"));

function getArduinoStatus() {
  return {
    connected: Boolean(arduinoPort && arduinoPort.isOpen),
    path: arduinoPath
  };
}

function broadcastArduinoStatus() {
  io.emit("arduino:status", getArduinoStatus());
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(function () {
    reconnectTimer = null;
    connectArduino();
  }, SERIAL_RETRY_DELAY);
}

async function findArduinoPath() {
  if (process.env.ARDUINO_PORT) {
    return process.env.ARDUINO_PORT;
  }

  const ports = await SerialPort.list();
  const likelyArduino = ports.find(function (port) {
    const description = [
      port.manufacturer,
      port.friendlyName,
      port.pnpId
    ].filter(Boolean).join(" ").toLowerCase();

    return /arduino|wch|ch340|usb serial|usb-serial/.test(description);
  });

  return likelyArduino ? likelyArduino.path : null;
}

async function connectArduino() {
  if (arduinoPort && (arduinoPort.isOpen || arduinoPort.opening)) return;

  try {
    const path = await findArduinoPath();

    if (!path) {
      arduinoPath = null;
      broadcastArduinoStatus();
      scheduleReconnect();
      return;
    }

    arduinoPath = path;
    arduinoPort = new SerialPort({
      path: path,
      baudRate: BAUD_RATE,
      autoOpen: false
    });

    const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: "\n" }));

    parser.on("data", function (line) {
      const message = parseArduinoMessage(line);

      if (message) {
        logArduinoInput(message);
        io.emit("arduino:input", message);
      }
    });

    arduinoPort.on("open", function () {
      console.log(`아두이노 연결됨: ${path}`);
      broadcastArduinoStatus();
    });

    arduinoPort.on("close", function () {
      console.log(`아두이노 연결 종료: ${path}`);
      arduinoPort = null;
      broadcastArduinoStatus();
      scheduleReconnect();
    });

    arduinoPort.on("error", function (error) {
      console.warn(`아두이노 연결 오류 (${path}): ${error.message}`);
      broadcastArduinoStatus();
    });

    arduinoPort.open(function (error) {
      if (!error) return;

      console.warn(`아두이노 포트를 열지 못했습니다 (${path}): ${error.message}`);
      arduinoPort = null;
      broadcastArduinoStatus();
      scheduleReconnect();
    });
  } catch (error) {
    console.warn(`아두이노 검색 오류: ${error.message}`);
    arduinoPort = null;
    arduinoPath = null;
    broadcastArduinoStatus();
    scheduleReconnect();
  }
}

function parseArduinoMessage(line) {
  const value = String(line).trim();

  if (!value) return null;
  if (value === "READY") return { type: "ready" };

  if (value.startsWith("BTN:")) {
    const button = value.slice(4).toUpperCase();
    return ["RED", "GREEN", "BLUE"].includes(button)
      ? { type: "button", value: button }
      : null;
  }

  if (value.startsWith("DIAL:")) {
    const dialValue = Number(value.slice(5));
    return Number.isInteger(dialValue) && dialValue >= 0 && dialValue <= 1023
      ? { type: "dial", value: dialValue }
      : null;
  }

  if (value.startsWith("IR:")) {
    const command = value.slice(3).toUpperCase();
    return { type: "ir", value: command };
  }

  return { type: "message", value: value };
}

function logArduinoInput(message) {
  const timestamp = new Date().toLocaleTimeString("ko-KR");

  if (message.type === "dial") {
    console.log(`[가변저항 입력 ${timestamp}] ${message.value} / 1023`);
    return;
  }

  if (message.type !== "button") return;

  const buttonLabels = {
    RED: "빨강",
    GREEN: "초록",
    BLUE: "파랑"
  };
  const label = buttonLabels[message.value] || message.value;

  console.log(`[버튼 입력 ${timestamp}] ${label} (${message.value})`);
}

function writeArduinoCommand(command) {
  if (!arduinoPort || !arduinoPort.isOpen) return false;

  const allowedCommand = /^(OK|FAIL|OFF|RGB:\d{1,3},\d{1,3},\d{1,3}|MOTOR:\d{1,3}|BUZZ:\d{2,4},\d{2,4})$/;

  if (!allowedCommand.test(command)) return false;

  arduinoPort.write(command + "\n", function (error) {
    if (error) {
      console.warn(`아두이노 명령 전송 실패: ${error.message}`);
    }
  });

  return true;
}

io.on("connection", function (socket) {
  socket.emit("arduino:status", getArduinoStatus());

  socket.on("arduino:feedback", function (command) {
    if (typeof command === "string") {
      writeArduinoCommand(command);
    }
  });
});

function startServer() {
  server.listen(PORT, () => {
    console.log(`새록새록 화면 실행 중: http://localhost:${PORT}`);
    connectArduino();
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  logArduinoInput,
  parseArduinoMessage,
  startServer
};
