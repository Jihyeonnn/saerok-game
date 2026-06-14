const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`새록새록 화면 실행 중: http://localhost:${PORT}`);
});