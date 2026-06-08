const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// 본인 포트로 바꿔야 함
const arduino = new SerialPort({
  path: "COM3",
  baudRate: 9600,
});

const parser = arduino.pipe(new ReadlineParser({ delimiter: "\n" }));

parser.on("data", (line) => {
  console.log("아두이노에서 받은 값:", line);

  try {
    const data = JSON.parse(line.trim());
    console.log("다이얼 값:", data.pot);
    console.log("버튼 값:", data.button);
  } catch (e) {
    console.log("JSON 변환 실패");
  }
});