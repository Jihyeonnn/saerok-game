const gameInfo = {
  color: {
    title: "색깔 맞추기",
    instruction: "글자의 뜻이 아니라, 글씨의 색과 같은 버튼을 눌러 주세요.",
    method: "빨강·초록·파랑 버튼"
  },
  direction: {
    title: "좌/우 분류",
    instruction: "캐릭터를 알맞은 표지판이 있는 쪽으로 보내 주세요.",
    method: "왼쪽·오른쪽 선택"
  },
  dial: {
    title: "다이얼 수치 맞추기",
    instruction: "목표 수치에 가깝게 다이얼을 조절한 뒤 확인 버튼을 눌러 주세요.",
    method: "다이얼 + 확인 버튼"
  }
};

const colorLabel = {
  RED: "빨강",
  GREEN: "초록",
  BLUE: "파랑"
};

const colorStyle = {
  RED: "#e63946",
  GREEN: "#2a9d8f",
  BLUE: "#457b9d"
};

const directionLabel = {
  LEFT: "왼쪽",
  RIGHT: "오른쪽"
};

const directionItems = [
  { id: "RABBIT", name: "토끼" },
  { id: "CAT", name: "고양이" }
];

let currentGame = "";
let target = null;

let colorWord = null;
let colorInk = null;

let directionCharacter = null;
let directionLeftSign = null;
let directionRightSign = null;

let currentDialValue = 512;
let roundStartedAt = Date.now();
let waitingNextRound = false;

let totalCount = 0;
let correctCount = 0;
let records = [];

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(function (page) {
    page.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");
}

function showMainPage() {
  showPage("mainPage");
}

function showResultPage() {
  showPage("resultPage");
  renderStats();
  renderRecords();
  renderGraph();
}

function selectGame(game) {
  currentGame = game;
  showPage("playPage");
  makeRound();
}

function makeRound() {
  waitingNextRound = false;
  roundStartedAt = Date.now();
  clearResult();

  if (currentGame === "color") {
    makeColorRound();
  }

  if (currentGame === "direction") {
    makeDirectionRound();
  }

  if (currentGame === "dial") {
    target = Math.floor(Math.random() * 801) + 100;
  }

  renderGamePage();
}

function makeColorRound() {
  const colors = ["RED", "GREEN", "BLUE"];

  colorWord = colors[Math.floor(Math.random() * colors.length)];
  colorInk = colors[Math.floor(Math.random() * colors.length)];

  target = colorInk;
}

function makeDirectionRound() {
  directionCharacter = directionItems[Math.floor(Math.random() * directionItems.length)];

  const shuffledSigns = [...directionItems].sort(function () {
    return Math.random() - 0.5;
  });

  directionLeftSign = shuffledSigns[0];
  directionRightSign = shuffledSigns[1];

  target = directionLeftSign.id === directionCharacter.id ? "LEFT" : "RIGHT";
}

function renderGamePage() {
  document.getElementById("gameTitle").textContent = gameInfo[currentGame].title;
  document.getElementById("instruction").textContent = gameInfo[currentGame].instruction;
  document.getElementById("methodText").textContent = gameInfo[currentGame].method;

  if (currentGame === "color") {
    renderColorPage();
  }

  if (currentGame === "direction") {
    renderDirectionPage();
  }

  if (currentGame === "dial") {
    renderDialPage();
  }

  renderStats();
}

function renderColorPage() {
  document.getElementById("targetText").innerHTML = `
    <span class="stroop-word" style="color:${colorStyle[colorInk]}">
      ${colorLabel[colorWord]}
    </span>
  `;

  document.getElementById("inputText").textContent = "선택 전";

  document.getElementById("inputArea").innerHTML = `
    <div class="answer-buttons">
      <button class="color-btn red-btn" onclick="submitColorAnswer('RED')">빨강</button>
      <button class="color-btn green-btn" onclick="submitColorAnswer('GREEN')">초록</button>
      <button class="color-btn blue-btn" onclick="submitColorAnswer('BLUE')">파랑</button>
    </div>
  `;
}

function renderDirectionPage() {
  document.getElementById("targetText").textContent = directionCharacter.name;
  document.getElementById("inputText").textContent = "선택 전";

  document.getElementById("inputArea").innerHTML = `
    <div class="direction-stage">
      <div class="sign-board">
        <div class="sign-title">왼쪽 표지판</div>
        <div class="sign-name">${directionLeftSign.name} 집</div>
      </div>

      <div class="character-box">
        <div class="character-label">보낼 캐릭터</div>
        <div class="character-name">${directionCharacter.name}</div>
      </div>

      <div class="sign-board">
        <div class="sign-title">오른쪽 표지판</div>
        <div class="sign-name">${directionRightSign.name} 집</div>
      </div>
    </div>

    <div class="answer-buttons">
      <button class="direction-btn" onclick="submitDirectionAnswer('LEFT')">왼쪽으로 보내기</button>
      <button class="direction-btn" onclick="submitDirectionAnswer('RIGHT')">오른쪽으로 보내기</button>
    </div>
  `;
}

function renderDialPage() {
  document.getElementById("targetText").textContent = target;
  document.getElementById("inputText").textContent = currentDialValue;

  document.getElementById("inputArea").innerHTML = `
    <input
      type="range"
      min="0"
      max="1023"
      value="${currentDialValue}"
      oninput="changeDialValue(this.value)"
    />
    <br />
    <button class="confirm-btn" onclick="submitDialAnswer()">확인</button>
  `;
}

function changeDialValue(value) {
  currentDialValue = Number(value);
  document.getElementById("inputText").textContent = currentDialValue;
}

function submitColorAnswer(input) {
  if (waitingNextRound) return;

  const isCorrect = input === target;

  document.getElementById("inputText").innerHTML = `
    <span style="color:${colorStyle[input]}; font-weight:bold;">
      ${colorLabel[input]}
    </span>
  `;

  saveResult({
    input: colorLabel[input],
    gap: "-",
    isCorrect: isCorrect
  });
}

function submitDirectionAnswer(input) {
  if (waitingNextRound) return;

  const isCorrect = input === target;

  document.getElementById("inputText").textContent =
    directionLabel[input] + "으로 이동";

  saveResult({
    input: directionLabel[input] + "으로 이동",
    gap: "-",
    isCorrect: isCorrect
  });
}

function submitDialAnswer() {
  if (waitingNextRound) return;

  const gap = Math.abs(currentDialValue - target);
  const isCorrect = gap <= 80;

  saveResult({
    input: currentDialValue,
    gap: gap,
    isCorrect: isCorrect
  });
}

function saveResult(answer) {
  waitingNextRound = true;

  const reactionTime = Date.now() - roundStartedAt;

  totalCount++;

  if (answer.isCorrect === true) {
    correctCount++;
  }

  records.push({
    no: totalCount,
    game: gameInfo[currentGame].title,
    target: getTargetText(),
    input: answer.input,
    gap: answer.gap,
    correct: answer.isCorrect,
    reactionTime: reactionTime
  });

  renderResult(answer.isCorrect, reactionTime, answer.gap);
  renderStats();
  renderRecords();
  renderGraph();

  setTimeout(function () {
    makeRound();
  }, 1200);
}

function getTargetText() {
  if (currentGame === "color") {
    return `${colorLabel[colorWord]} 글자 / 글씨 색: ${colorLabel[colorInk]}`;
  }

  if (currentGame === "direction") {
    const targetSign = target === "LEFT" ? directionLeftSign : directionRightSign;
    return `${directionCharacter.name} → ${directionLabel[target]} ${targetSign.name} 집`;
  }

  if (currentGame === "dial") {
    return target;
  }

  return "-";
}

function renderResult(isCorrect, reactionTime, gap) {
  const resultBox = document.getElementById("result");

  if (isCorrect) {
    resultBox.textContent = `정답! 반응시간: ${reactionTime}ms`;
    resultBox.className = "result correct";
  } else {
    resultBox.textContent = `오답! 정답은 ${getAnswerText()} / 반응시간: ${reactionTime}ms`;
    resultBox.className = "result wrong";
  }

  if (currentGame === "dial") {
    resultBox.textContent += ` / 차이: ${gap}`;
  }
}

function getAnswerText() {
  if (currentGame === "color") {
    return colorLabel[target];
  }

  if (currentGame === "direction") {
    return directionLabel[target];
  }

  if (currentGame === "dial") {
    return target;
  }

  return "-";
}

function clearResult() {
  const resultBox = document.getElementById("result");

  if (!resultBox) return;

  resultBox.textContent = "";
  resultBox.className = "result";
}

function resetGame() {
  totalCount = 0;
  correctCount = 0;
  records = [];
  waitingNextRound = false;

  clearResult();
  renderStats();
  renderRecords();
  renderGraph();

  if (!document.getElementById("playPage").classList.contains("hidden")) {
    makeRound();
  }
}

function renderStats() {
  const accuracy = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
  const averageReactionTime = getAverageReactionTime();

  document.querySelectorAll(".js-accuracy").forEach(function (el) {
    el.textContent = accuracy + "%";
  });

  document.querySelectorAll(".js-accuracy-meter").forEach(function (el) {
    el.style.width = accuracy + "%";
  });

  document.querySelectorAll(".js-correct-count").forEach(function (el) {
    el.textContent = correctCount;
  });

  document.querySelectorAll(".js-total-count").forEach(function (el) {
    el.textContent = totalCount;
  });

  document.querySelectorAll(".js-average-reaction").forEach(function (el) {
    el.textContent = averageReactionTime;
  });
}

function getAverageReactionTime() {
  if (records.length === 0) {
    return 0;
  }

  const sum = records.reduce(function (total, item) {
    return total + item.reactionTime;
  }, 0);

  return Math.round(sum / records.length);
}

function renderRecords() {
  const recordBody = document.getElementById("recordBody");

  if (!recordBody) return;

  if (records.length === 0) {
    recordBody.innerHTML = `<tr><td colspan="7">아직 기록이 없습니다.</td></tr>`;
    return;
  }

  const recentRecords = records.slice(-10).reverse();

  recordBody.innerHTML = recentRecords.map(function (record) {
    return `
      <tr>
        <td>${record.no}</td>
        <td>${record.game}</td>
        <td>${record.target}</td>
        <td>${record.input}</td>
        <td>${record.gap}</td>
        <td>${record.correct ? "정답" : "오답"}</td>
        <td>${record.reactionTime}ms</td>
      </tr>
    `;
  }).join("");
}

function renderGraph() {
  const graph = document.getElementById("reactionGraph");

  if (!graph) return;

  if (records.length === 0) {
    graph.innerHTML = `<div class="empty-text">아직 기록이 없습니다.</div>`;
    return;
  }

  const recentRecords = records.slice(-10);
  const maxTime = Math.max(...recentRecords.map(function (item) {
    return item.reactionTime;
  }), 1);

  graph.innerHTML = recentRecords.map(function (record) {
    const height = Math.max((record.reactionTime / maxTime) * 120, 8);

    return `
      <div class="bar-item">
        <div class="bar" style="height:${height}px;"></div>
        <div class="bar-label">${record.reactionTime}ms</div>
      </div>
    `;
  }).join("");
}

window.addEventListener("DOMContentLoaded", function () {
  showMainPage();
  renderStats();
  renderRecords();
  renderGraph();
});