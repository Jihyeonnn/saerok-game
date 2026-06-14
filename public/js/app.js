const gameInfo = {
  color: {
    title: "색깔 맞추기",
    instruction: "글자의 뜻이 아니라, 글씨의 색과 같은 버튼을 눌러 주세요.",
    method: "색상 버튼 / 화면 버튼"
  },
  direction: {
    title: "동물 얼굴 분류",
    instruction: "가운데 나타난 얼굴을 보고 토끼는 왼쪽, 고양이는 오른쪽으로 보내 주세요.",
    method: "IR 리모컨 / 방향 버튼"
  },
  dial: {
    title: "다이얼 수치 맞추기",
    instruction: "목표 수치에 가깝게 다이얼을 조절한 뒤 확인 버튼을 눌러 주세요.",
    method: "다이얼 + IR 확인"
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
  { id: "RABBIT", name: "토끼", image: "./img/rabbit.png" },
  { id: "CAT", name: "고양이", image: "./img/cat.png" }
];

const TOTAL_QUESTIONS = 15;
const TRAINING_HISTORY_KEY = "saerok-training-history-v1";
const MAX_SAVED_SESSIONS = 200;

const playTimeOptions = {
  relaxed: { label: "여유", seconds: 10, description: "문제당 10초" },
  normal: { label: "보통", seconds: 7, description: "문제당 7초" },
  quick: { label: "빠름", seconds: 4, description: "문제당 4초" }
};

const difficultyOptions = {
  easy: { label: "쉬움" },
  normal: { label: "보통" },
  hard: { label: "어려움" }
};

const difficultyDescriptions = {
  color: {
    easy: "두 가지 색으로 출제",
    normal: "세 가지 색으로 출제",
    hard: "세 가지 색, 글자와 글씨 색이 항상 다름"
  },
  direction: {
    easy: "토끼는 왼쪽, 고양이는 오른쪽으로 고정",
    normal: "게임 시작 시 분류함 위치가 결정됨",
    hard: "매 문제마다 분류함 위치가 바뀜"
  },
  dial: {
    easy: "목표값과 차이 120까지 정답",
    normal: "목표값과 차이 80까지 정답",
    hard: "목표값과 차이 40까지 정답"
  }
};

const settingsByGame = {
  color: { playTime: "normal", difficulty: "normal" },
  direction: { playTime: "normal", difficulty: "normal" },
  dial: { playTime: "normal", difficulty: "normal" }
};

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
let sessionActive = false;
let roundTimerId = null;
let nextRoundTimerId = null;
let roundDeadline = 0;
let sessionDirectionOrder = [...directionItems];
let currentSessionId = null;
let sessionStartedAt = null;
let progressGameFilter = "all";

let answeredCount = 0;
let correctCount = 0;
let records = [];
let trainingHistory = loadTrainingHistory();
let arduinoSocket = null;
let arduinoConnected = false;

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(function (page) {
    page.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");
}

function showMainPage() {
  stopSession();
  showPage("mainPage");
}

function showResultPage() {
  stopSession();
  showPage("resultPage");
  renderStats();
  renderProgressDashboard();
  renderRecords();
  renderGraph();
}

function selectGame(game) {
  stopSession();
  currentGame = game;
  showPage("playPage");
  document.getElementById("gameSetup").classList.remove("hidden");
  document.getElementById("sessionArea").classList.add("hidden");
  renderGameSetup();
  renderStats();
}

function renderGameSetup() {
  const settings = settingsByGame[currentGame];
  const setupOptions = document.getElementById("setupOptions");

  document.getElementById("setupGameTitle").textContent =
    gameInfo[currentGame].title + " 설정";

  setupOptions.innerHTML = `
    <div class="setting-group">
      <div class="setting-heading">
        <strong>플레이 시간</strong>
        <span>각 문제에 답할 수 있는 시간입니다.</span>
      </div>
      <div class="setting-options">
        ${Object.entries(playTimeOptions).map(function ([key, option]) {
          return `
            <button
              type="button"
              class="setting-option ${settings.playTime === key ? "selected" : ""}"
              onclick="setGameSetting('playTime', '${key}')"
            >
              <strong>${option.label}</strong>
              <span>${option.description}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-heading">
        <strong>난이도</strong>
        <span>게임마다 난이도 적용 방식이 다릅니다.</span>
      </div>
      <div class="setting-options">
        ${Object.entries(difficultyOptions).map(function ([key, option]) {
          return `
            <button
              type="button"
              class="setting-option ${settings.difficulty === key ? "selected" : ""}"
              onclick="setGameSetting('difficulty', '${key}')"
            >
              <strong>${option.label}</strong>
              <span>${difficultyDescriptions[currentGame][key]}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function setGameSetting(settingName, value) {
  if (!settingsByGame[currentGame]) return;

  settingsByGame[currentGame][settingName] = value;
  renderGameSetup();
}

function startGame() {
  clearGameTimers();
  answeredCount = 0;
  correctCount = 0;
  records = [];
  waitingNextRound = false;
  sessionActive = true;
  currentDialValue = 512;
  sessionDirectionOrder = getShuffledDirectionItems();
  currentSessionId = createSessionId();
  sessionStartedAt = new Date().toISOString();

  document.getElementById("gameSetup").classList.add("hidden");
  document.getElementById("sessionArea").classList.remove("hidden");

  renderActiveSettings();
  renderStats();
  renderRecords();
  renderGraph();
  makeRound();
}

function renderActiveSettings() {
  const settings = settingsByGame[currentGame];
  const timeOption = playTimeOptions[settings.playTime];
  const difficultyOption = difficultyOptions[settings.difficulty];

  document.getElementById("activeSettings").textContent =
    `${timeOption.description} · 난이도 ${difficultyOption.label}`;
}

function makeRound() {
  if (!sessionActive || answeredCount >= TOTAL_QUESTIONS) return;

  clearRoundTimer();
  sendArduinoCommand("OFF");
  waitingNextRound = false;
  roundStartedAt = Date.now();
  clearResult();
  document.getElementById("currentQuestion").textContent = answeredCount + 1;

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
  startRoundTimer();
}

function makeColorRound() {
  const difficulty = settingsByGame.color.difficulty;
  const colors = difficulty === "easy"
    ? ["RED", "BLUE"]
    : ["RED", "GREEN", "BLUE"];

  colorWord = colors[Math.floor(Math.random() * colors.length)];
  colorInk = colors[Math.floor(Math.random() * colors.length)];

  if (difficulty === "hard") {
    while (colorInk === colorWord) {
      colorInk = colors[Math.floor(Math.random() * colors.length)];
    }
  }

  target = colorInk;
}

function makeDirectionRound() {
  directionCharacter = directionItems[Math.floor(Math.random() * directionItems.length)];
  const difficulty = settingsByGame.direction.difficulty;
  let order = directionItems;

  if (difficulty === "normal") {
    order = sessionDirectionOrder;
  }

  if (difficulty === "hard") {
    order = getShuffledDirectionItems();
  }

  directionLeftSign = order[0];
  directionRightSign = order[1];

  target = directionLeftSign.id === directionCharacter.id ? "LEFT" : "RIGHT";
}

function getShuffledDirectionItems() {
  return Math.random() < 0.5
    ? [...directionItems]
    : [...directionItems].reverse();
}

function renderGamePage() {
  const gamePanel = document.querySelector(".game-panel");

  gamePanel.classList.toggle("direction-mode", currentGame === "direction");
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
  const colors = settingsByGame.color.difficulty === "easy"
    ? ["RED", "BLUE"]
    : ["RED", "GREEN", "BLUE"];

  document.getElementById("targetText").innerHTML = `
    <span class="stroop-word" style="color:${colorStyle[colorInk]}">
      ${colorLabel[colorWord]}
    </span>
  `;

  document.getElementById("inputText").textContent = "선택 전";

  document.getElementById("inputArea").innerHTML = `
    <div class="answer-buttons">
      ${colors.map(function (color) {
        return `
          <button
            class="color-btn ${color.toLowerCase()}-btn"
            onclick="submitColorAnswer('${color}')"
          >
            ${colorLabel[color]}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderDirectionPage() {
  document.getElementById("targetText").textContent = directionCharacter.name;
  document.getElementById("inputText").textContent = "분류 대기";

  document.getElementById("inputArea").innerHTML = `
    <div class="classification-board">
      <div class="classification-destinations">
        <button
          class="classification-bin rabbit-bin"
          type="button"
          onclick="submitDirectionAnswer('LEFT')"
          aria-label="토끼를 왼쪽으로 분류"
        >
          <span class="bin-side">왼쪽 분류함</span>
          <img src="${directionLeftSign.image}" alt="토끼 얼굴" />
          <strong>${directionLeftSign.name}</strong>
        </button>

        <button
          class="classification-bin cat-bin"
          type="button"
          onclick="submitDirectionAnswer('RIGHT')"
          aria-label="고양이를 오른쪽으로 분류"
        >
          <span class="bin-side">오른쪽 분류함</span>
          <img src="${directionRightSign.image}" alt="고양이 얼굴" />
          <strong>${directionRightSign.name}</strong>
        </button>
      </div>

      <div class="classification-lane">
        <span class="classification-question">이 얼굴은 어디로 보낼까요?</span>
        <div class="classification-target">
          <img
            src="${directionCharacter.image}"
            alt="${directionCharacter.name} 얼굴"
          />
        </div>
      </div>

      <div class="classification-controls">
        <button
          class="direction-btn direction-left-btn"
          type="button"
          onclick="submitDirectionAnswer('LEFT')"
          aria-label="왼쪽 토끼 분류함으로 보내기"
        >
          <span class="direction-arrow" aria-hidden="true">←</span>
          <span>토끼</span>
        </button>

        <button
          class="direction-btn direction-right-btn"
          type="button"
          onclick="submitDirectionAnswer('RIGHT')"
          aria-label="오른쪽 고양이 분류함으로 보내기"
        >
          <span>고양이</span>
          <span class="direction-arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <p class="classification-hint">키보드의 왼쪽·오른쪽 방향키로도 분류할 수 있어요.</p>
    </div>
  `;
}

function renderDialPage() {
  document.getElementById("targetText").textContent = target;
  document.getElementById("inputText").textContent = currentDialValue;
  const tolerance = getDialTolerance();

  document.getElementById("inputArea").innerHTML = `
    <p class="dial-tolerance">목표값과 차이 ${tolerance} 이내면 정답입니다.</p>
    <input
      id="dialControl"
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

  const dialControl = document.getElementById("dialControl");

  if (dialControl && Number(dialControl.value) !== currentDialValue) {
    dialControl.value = currentDialValue;
  }
}

function submitColorAnswer(input) {
  if (waitingNextRound || !sessionActive) return;

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
  if (waitingNextRound || !sessionActive) return;

  const isCorrect = input === target;
  const selectedSign = input === "LEFT" ? directionLeftSign : directionRightSign;

  document.getElementById("inputText").textContent =
    selectedSign.name + " 분류함";

  saveResult({
    input: `${directionLabel[input]} ${selectedSign.name} 분류함`,
    gap: "-",
    isCorrect: isCorrect
  });
}

function submitDialAnswer() {
  if (waitingNextRound || !sessionActive) return;

  const gap = Math.abs(currentDialValue - target);
  const isCorrect = gap <= getDialTolerance();

  saveResult({
    input: currentDialValue,
    gap: gap,
    isCorrect: isCorrect
  });
}

function getDialTolerance() {
  const difficulty = settingsByGame.dial.difficulty;

  if (difficulty === "easy") return 120;
  if (difficulty === "hard") return 40;
  return 80;
}

function startRoundTimer() {
  const seconds = playTimeOptions[settingsByGame[currentGame].playTime].seconds;
  const timeRemaining = document.getElementById("timeRemaining");

  roundDeadline = Date.now() + (seconds * 1000);
  timeRemaining.textContent = seconds;
  timeRemaining.parentElement.classList.remove("time-warning");

  roundTimerId = setInterval(function () {
    const remainingMilliseconds = Math.max(roundDeadline - Date.now(), 0);
    const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);

    timeRemaining.textContent = remainingSeconds;
    timeRemaining.parentElement.classList.toggle("time-warning", remainingSeconds <= 2);

    if (remainingMilliseconds <= 0) {
      clearRoundTimer();
      handleRoundTimeout();
    }
  }, 100);
}

function handleRoundTimeout() {
  if (waitingNextRound || !sessionActive) return;

  document.getElementById("inputText").textContent = "시간 초과";

  saveResult({
    input: "시간 초과",
    gap: "-",
    isCorrect: false,
    timedOut: true
  });
}

function clearRoundTimer() {
  if (roundTimerId !== null) {
    clearInterval(roundTimerId);
    roundTimerId = null;
  }
}

function clearGameTimers() {
  clearRoundTimer();

  if (nextRoundTimerId !== null) {
    clearTimeout(nextRoundTimerId);
    nextRoundTimerId = null;
  }
}

function stopSession() {
  if (sessionActive && records.length > 0) {
    persistCurrentSession(false);
  }

  sendArduinoCommand("OFF");
  sessionActive = false;
  waitingNextRound = false;
  clearGameTimers();
}

function createSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadTrainingHistory() {
  if (typeof localStorage === "undefined") return [];

  try {
    const savedHistory = JSON.parse(localStorage.getItem(TRAINING_HISTORY_KEY));
    return Array.isArray(savedHistory) ? savedHistory : [];
  } catch (error) {
    console.warn("저장된 훈련 기록을 불러오지 못했습니다.", error);
    return [];
  }
}

function saveTrainingHistory() {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(
      TRAINING_HISTORY_KEY,
      JSON.stringify(trainingHistory.slice(0, MAX_SAVED_SESSIONS))
    );
  } catch (error) {
    console.warn("훈련 기록을 저장하지 못했습니다.", error);
  }
}

function persistCurrentSession(completed) {
  if (!currentSessionId || records.length === 0) return;

  const settings = settingsByGame[currentGame];
  const averageReactionTime = getAverageReactionTime(records);
  const session = {
    id: currentSessionId,
    game: currentGame,
    gameTitle: gameInfo[currentGame].title,
    startedAt: sessionStartedAt,
    updatedAt: new Date().toISOString(),
    completedAt: completed ? new Date().toISOString() : null,
    completed: completed === true,
    totalQuestions: TOTAL_QUESTIONS,
    answeredCount: answeredCount,
    correctCount: correctCount,
    accuracy: answeredCount === 0
      ? 0
      : Math.round((correctCount / answeredCount) * 100),
    averageReactionTime: averageReactionTime,
    timeoutCount: records.filter(function (record) {
      return record.timedOut === true;
    }).length,
    settings: {
      playTime: settings.playTime,
      difficulty: settings.difficulty
    },
    records: records.map(function (record) {
      return { ...record };
    })
  };

  const existingIndex = trainingHistory.findIndex(function (item) {
    return item.id === currentSessionId;
  });

  if (existingIndex === -1) {
    trainingHistory.unshift(session);
  } else {
    trainingHistory[existingIndex] = session;
  }

  trainingHistory.sort(function (a, b) {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  trainingHistory = trainingHistory.slice(0, MAX_SAVED_SESSIONS);
  saveTrainingHistory();
}

function saveResult(answer) {
  if (waitingNextRound || !sessionActive) return;

  clearRoundTimer();
  waitingNextRound = true;

  const reactionTime = Date.now() - roundStartedAt;

  answeredCount++;

  if (answer.isCorrect === true) {
    correctCount++;
  }

  records.push({
    no: answeredCount,
    game: gameInfo[currentGame].title,
    target: getTargetText(),
    input: answer.input,
    gap: answer.gap,
    correct: answer.isCorrect,
    reactionTime: reactionTime,
    timedOut: answer.timedOut === true
  });

  sendArduinoCommand(answer.isCorrect ? "OK" : "FAIL");
  persistCurrentSession(false);
  renderResult(answer.isCorrect, reactionTime, answer.gap, answer.timedOut);
  renderStats();
  renderRecords();
  renderGraph();

  nextRoundTimerId = setTimeout(function () {
    nextRoundTimerId = null;

    if (answeredCount >= TOTAL_QUESTIONS) {
      finishGame();
      return;
    }

    makeRound();
  }, 1200);
}

function finishGame() {
  persistCurrentSession(true);
  sendArduinoCommand("OFF");
  sessionActive = false;
  waitingNextRound = false;
  clearGameTimers();
  showPage("resultPage");
  renderStats();
  renderProgressDashboard();
  renderRecords();
  renderGraph();
}

function getTargetText() {
  if (currentGame === "color") {
    return `${colorLabel[colorWord]} 글자 / 글씨 색: ${colorLabel[colorInk]}`;
  }

  if (currentGame === "direction") {
    return `${directionCharacter.name} → ${directionLabel[target]} 분류함`;
  }

  if (currentGame === "dial") {
    return target;
  }

  return "-";
}

function renderResult(isCorrect, reactionTime, gap, timedOut) {
  const resultBox = document.getElementById("result");

  if (timedOut) {
    resultBox.textContent = `시간 초과! 정답은 ${getAnswerText()}`;
    resultBox.className = "result wrong";
  } else if (isCorrect) {
    resultBox.textContent = `정답! 반응시간: ${reactionTime}ms`;
    resultBox.className = "result correct";
  } else {
    resultBox.textContent = `오답! 정답은 ${getAnswerText()} / 반응시간: ${reactionTime}ms`;
    resultBox.className = "result wrong";
  }

  if (currentGame === "dial" && !timedOut) {
    resultBox.textContent += ` / 차이: ${gap}`;
  }
}

function getAnswerText() {
  if (currentGame === "color") {
    return colorLabel[target];
  }

  if (currentGame === "direction") {
    const targetSign = target === "LEFT" ? directionLeftSign : directionRightSign;
    return `${directionLabel[target]} ${targetSign.name} 분류함`;
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
  clearGameTimers();
  sendArduinoCommand("OFF");
  answeredCount = 0;
  correctCount = 0;
  records = [];
  sessionActive = false;
  waitingNextRound = false;
  currentSessionId = null;
  sessionStartedAt = null;
  trainingHistory = [];
  saveTrainingHistory();

  clearResult();
  renderStats();
  renderProgressDashboard();
  renderRecords();
  renderGraph();

  if (!document.getElementById("playPage").classList.contains("hidden")) {
    document.getElementById("gameSetup").classList.remove("hidden");
    document.getElementById("sessionArea").classList.add("hidden");
    renderGameSetup();
  }
}

function renderStats() {
  const accuracy = answeredCount === 0
    ? 0
    : Math.round((correctCount / answeredCount) * 100);
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
    el.textContent = TOTAL_QUESTIONS;
  });

  document.querySelectorAll(".js-average-reaction").forEach(function (el) {
    el.textContent = averageReactionTime;
  });
}

function getAverageReactionTime(recordList = records) {
  if (recordList.length === 0) {
    return 0;
  }

  const sum = recordList.reduce(function (total, item) {
    return total + item.reactionTime;
  }, 0);

  return Math.round(sum / recordList.length);
}

function setProgressFilter(game) {
  const availableFilters = ["all", "color", "direction", "dial"];

  if (!availableFilters.includes(game)) return;

  progressGameFilter = game;
  renderProgressDashboard();
  renderRecords();
  renderGraph();
}

function getFilteredHistory() {
  return trainingHistory.filter(function (session) {
    const hasRecords = Array.isArray(session.records) && session.records.length > 0;
    const matchesGame = progressGameFilter === "all" || session.game === progressGameFilter;
    return hasRecords && matchesGame;
  });
}

function getCompletedSessions(sessionList = getFilteredHistory()) {
  return sessionList.filter(function (session) {
    return session.completed === true && session.answeredCount === TOTAL_QUESTIONS;
  });
}

function getDisplayRecords() {
  const resultPage = document.getElementById("resultPage");
  const isResultPageVisible = resultPage && !resultPage.classList.contains("hidden");

  if (!isResultPageVisible) {
    return records;
  }

  const latestSession = getFilteredHistory()[0];
  return latestSession && Array.isArray(latestSession.records)
    ? latestSession.records
    : [];
}

function renderProgressDashboard() {
  const dashboard = document.getElementById("progressDashboard");
  const emptyState = document.getElementById("progressEmpty");

  if (!dashboard || !emptyState) return;

  updateProgressFilterButtons();

  const filteredHistory = getFilteredHistory();
  const completedSessions = getCompletedSessions(filteredHistory);

  if (filteredHistory.length === 0) {
    dashboard.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  dashboard.classList.remove("hidden");
  emptyState.classList.add("hidden");

  renderProgressSummary(completedSessions);
  renderProgressInsight(completedSessions);
  renderProgressCharts(completedSessions);
  renderGameProgressCards(completedSessions);
  renderSessionHistory(filteredHistory);
}

function updateProgressFilterButtons() {
  document.querySelectorAll(".progress-filter").forEach(function (button) {
    button.classList.toggle(
      "selected",
      button.dataset.progressFilter === progressGameFilter
    );
  });
}

function renderProgressSummary(sessions) {
  const totals = sessions.reduce(function (summary, session) {
    summary.questions += session.answeredCount;
    summary.correct += session.correctCount;
    summary.reactionTotal += session.averageReactionTime * session.answeredCount;
    return summary;
  }, { questions: 0, correct: 0, reactionTotal: 0 });

  const accuracy = totals.questions === 0
    ? 0
    : Math.round((totals.correct / totals.questions) * 100);
  const averageReactionTime = totals.questions === 0
    ? 0
    : Math.round(totals.reactionTotal / totals.questions);
  const bestSession = sessions.reduce(function (best, session) {
    if (!best || session.accuracy > best.accuracy) return session;
    return best;
  }, null);

  document.getElementById("progressSessionCount").textContent = sessions.length + "회";
  document.getElementById("progressQuestionCount").textContent =
    `총 ${totals.questions}문제`;
  document.getElementById("progressAccuracy").textContent = accuracy + "%";
  document.getElementById("progressCorrectCount").textContent =
    `${totals.correct}문제 정답`;
  document.getElementById("progressReactionTime").textContent =
    averageReactionTime + "ms";
  document.getElementById("progressBestAccuracy").textContent =
    bestSession ? bestSession.accuracy + "%" : "0%";
  document.getElementById("progressBestGame").textContent =
    bestSession ? bestSession.gameTitle : "-";
}

function renderProgressInsight(sessions) {
  const insight = document.getElementById("progressInsight");

  if (sessions.length === 0) {
    insight.innerHTML = `
      <strong>첫 완료 기록을 기다리고 있어요.</strong>
      <span>현재 진행 중인 기록은 저장됐으며, 15문제를 완료하면 진척도 비교가 시작됩니다.</span>
    `;
    return;
  }

  if (sessions.length === 1) {
    insight.innerHTML = `
      <strong>첫 기준 기록이 저장됐어요.</strong>
      <span>한 번 더 완료하면 정답률과 반응시간 변화를 비교할 수 있습니다.</span>
    `;
    return;
  }

  const recentSessions = [...sessions].slice(0, 10).reverse();
  const first = recentSessions[0];
  const latest = recentSessions[recentSessions.length - 1];
  const accuracyChange = latest.accuracy - first.accuracy;
  const reactionChange = first.averageReactionTime - latest.averageReactionTime;
  const accuracyText = accuracyChange === 0
    ? "정답률은 동일하고"
    : `정답률이 ${Math.abs(accuracyChange)}%p ${accuracyChange > 0 ? "올랐고" : "낮아졌고"}`;
  const reactionText = reactionChange === 0
    ? "반응시간은 동일합니다."
    : `반응시간은 ${Math.abs(reactionChange)}ms ${reactionChange > 0 ? "빨라졌습니다." : "느려졌습니다."}`;

  insight.innerHTML = `
    <strong>최근 변화</strong>
    <span>${accuracyText}, ${reactionText}</span>
  `;
}

function renderProgressCharts(sessions) {
  const recentSessions = [...sessions].slice(0, 10).reverse();

  renderSessionChart(
    "accuracyProgressChart",
    recentSessions,
    function (session) { return session.accuracy; },
    function (value) { return value + "%"; },
    {
      type: "accuracy",
      minValue: 0,
      maxValue: 100,
      ariaLabel: "회차별 평균 정답률 변화"
    }
  );

  renderSessionChart(
    "reactionProgressChart",
    recentSessions,
    function (session) { return session.averageReactionTime; },
    function (value) { return value + "ms"; },
    {
      type: "reaction",
      ariaLabel: "회차별 평균 반응시간 변화"
    }
  );
}

function renderSessionChart(containerId, sessions, getValue, formatValue, options) {
  const container = document.getElementById(containerId);

  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = `<div class="empty-text">완료된 훈련 기록이 없습니다.</div>`;
    return;
  }

  const values = sessions.map(getValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const valueRange = Math.max(rawMax - rawMin, rawMax * 0.15, 100);
  const minValue = options.minValue !== undefined
    ? options.minValue
    : Math.max(0, Math.floor((rawMin - valueRange * 0.15) / 100) * 100);
  const maxValue = options.maxValue !== undefined
    ? options.maxValue
    : Math.ceil((rawMax + valueRange * 0.15) / 100) * 100;
  const safeRange = Math.max(maxValue - minValue, 1);
  const width = Math.max(560, sessions.length * 78);
  const height = 240;
  const padding = { top: 38, right: 24, bottom: 42, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const pointClass = options.type === "accuracy"
    ? "accuracy-line"
    : "reaction-line";
  const points = sessions.map(function (session, index) {
    const value = getValue(session);
    const x = sessions.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + (plotWidth * index) / (sessions.length - 1);
    const y = padding.top + ((maxValue - value) / safeRange) * plotHeight;

    return { x, y, value, index };
  });
  const pointString = points.map(function (point) {
    return `${point.x},${point.y}`;
  }).join(" ");
  const areaPointString = [
    `${points[0].x},${padding.top + plotHeight}`,
    pointString,
    `${points[points.length - 1].x},${padding.top + plotHeight}`
  ].join(" ");
  const gridLineCount = 4;
  const gridLines = Array.from({ length: gridLineCount + 1 }, function (_, index) {
    const ratio = index / gridLineCount;
    const y = padding.top + plotHeight * ratio;
    const value = Math.round(maxValue - safeRange * ratio);

    return `
      <line class="line-chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
      <text class="line-chart-y-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${formatValue(value)}</text>
    `;
  }).join("");
  const pointElements = points.map(function (point) {
    return `
      <g class="line-chart-point-group">
        <circle class="line-chart-point ${pointClass}" cx="${point.x}" cy="${point.y}" r="5"></circle>
        <text class="line-chart-value" x="${point.x}" y="${Math.max(point.y - 11, 16)}" text-anchor="middle">${formatValue(point.value)}</text>
        <text class="line-chart-x-label" x="${point.x}" y="${height - 14}" text-anchor="middle">${point.index + 1}회</text>
      </g>
    `;
  }).join("");

  container.innerHTML = `
    <div class="line-chart-scroll">
      <svg
        class="line-chart"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="${options.ariaLabel}"
      >
        ${gridLines}
        <polygon class="line-chart-area ${pointClass}" points="${areaPointString}"></polygon>
        <polyline class="line-chart-path ${pointClass}" points="${pointString}"></polyline>
        ${pointElements}
      </svg>
    </div>
  `;
}

function renderGameProgressCards(sessions) {
  const container = document.getElementById("gameProgressCards");

  if (!container) return;

  const gameKeys = progressGameFilter === "all"
    ? ["color", "direction", "dial"]
    : [progressGameFilter];

  container.innerHTML = gameKeys.map(function (game) {
    const gameSessions = sessions.filter(function (session) {
      return session.game === game;
    });
    const totalQuestions = gameSessions.reduce(function (sum, session) {
      return sum + session.answeredCount;
    }, 0);
    const totalCorrect = gameSessions.reduce(function (sum, session) {
      return sum + session.correctCount;
    }, 0);
    const accuracy = totalQuestions === 0
      ? 0
      : Math.round((totalCorrect / totalQuestions) * 100);
    const averageReactionTime = totalQuestions === 0
      ? 0
      : Math.round(gameSessions.reduce(function (sum, session) {
        return sum + (session.averageReactionTime * session.answeredCount);
      }, 0) / totalQuestions);

    return `
      <div class="game-progress-card">
        <strong>${gameInfo[game].title}</strong>
        <div><span>완료</span><b>${gameSessions.length}회</b></div>
        <div><span>정답률</span><b>${accuracy}%</b></div>
        <div><span>평균 반응</span><b>${averageReactionTime}ms</b></div>
      </div>
    `;
  }).join("");
}

function renderSessionHistory(sessions) {
  const body = document.getElementById("sessionHistoryBody");

  if (!body) return;

  body.innerHTML = sessions.slice(0, 15).map(function (session) {
    const settings = session.settings || {};
    const timeOption = playTimeOptions[settings.playTime];
    const difficultyOption = difficultyOptions[settings.difficulty];
    const statusText = session.completed ? "완료" : "진행 중";

    return `
      <tr>
        <td>${formatSessionDate(session.updatedAt)}</td>
        <td>${session.gameTitle}</td>
        <td>${timeOption ? timeOption.label : "-"} · ${difficultyOption ? difficultyOption.label : "-"}</td>
        <td>${session.correctCount} / ${session.totalQuestions || TOTAL_QUESTIONS}</td>
        <td>${session.accuracy}%</td>
        <td>${session.averageReactionTime}ms</td>
        <td><span class="session-status-badge ${session.completed ? "completed" : "in-progress"}">${statusText}</span></td>
      </tr>
    `;
  }).join("");
}

function formatSessionDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderRecords() {
  const recordBody = document.getElementById("recordBody");
  const displayRecords = getDisplayRecords();

  if (!recordBody) return;

  if (displayRecords.length === 0) {
    recordBody.innerHTML = `<tr><td colspan="7">아직 기록이 없습니다.</td></tr>`;
    return;
  }

  const recentRecords = displayRecords.slice(-15).reverse();

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
  const displayRecords = getDisplayRecords();

  if (!graph) return;

  if (displayRecords.length === 0) {
    graph.innerHTML = `<div class="empty-text">아직 기록이 없습니다.</div>`;
    return;
  }

  const recentRecords = displayRecords.slice(-15);
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
  initializeArduinoConnection();
  showMainPage();
  renderStats();
  renderProgressDashboard();
  renderRecords();
  renderGraph();
});

function initializeArduinoConnection() {
  if (typeof io !== "function") {
    updateArduinoStatus(false);
    return;
  }

  arduinoSocket = io();

  arduinoSocket.on("connect", function () {
    updateArduinoStatus(false, "아두이노 검색 중");
  });

  arduinoSocket.on("disconnect", function () {
    updateArduinoStatus(false, "서버 연결 끊김");
  });

  arduinoSocket.on("arduino:status", function (status) {
    updateArduinoStatus(
      Boolean(status && status.connected),
      status && status.path ? status.path : null
    );
  });

  arduinoSocket.on("arduino:input", function (message) {
    handleArduinoInput(message);
  });
}

function updateArduinoStatus(connected, detail) {
  const statusBox = document.getElementById("arduinoStatus");
  const statusText = document.getElementById("arduinoStatusText");

  arduinoConnected = connected;

  if (!statusBox || !statusText) return;

  statusBox.classList.toggle("connected", connected);
  statusBox.classList.toggle("disconnected", !connected);
  statusText.textContent = connected
    ? `아두이노 연결됨${detail ? ` · ${detail}` : ""}`
    : (detail || "아두이노 연결 안 됨");
}

function handleArduinoInput(message) {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "ready") {
    updateArduinoStatus(true);
    return;
  }

  if (message.type === "dial") {
    if (currentGame === "dial" && sessionActive && !waitingNextRound) {
      changeDialValue(message.value);
    }
    return;
  }

  if (!sessionActive || waitingNextRound) return;

  if (message.type === "button") {
    handleArduinoButton(message.value);
    return;
  }

  if (message.type === "ir") {
    handleArduinoRemote(message.value);
  }
}

function handleArduinoButton(button) {
  if (currentGame === "color" && colorLabel[button]) {
    submitColorAnswer(button);
    return;
  }

  if (currentGame === "direction") {
    if (button === "RED") submitDirectionAnswer("LEFT");
    if (button === "BLUE") submitDirectionAnswer("RIGHT");
    return;
  }

  if (currentGame === "dial" && button === "GREEN") {
    submitDialAnswer();
  }
}

function handleArduinoRemote(command) {
  if (currentGame === "direction") {
    if (command === "LEFT") submitDirectionAnswer("LEFT");
    if (command === "RIGHT") submitDirectionAnswer("RIGHT");
    return;
  }

  if (currentGame === "dial" && command === "OK") {
    submitDialAnswer();
  }
}

function sendArduinoCommand(command) {
  if (!arduinoConnected || !arduinoSocket) return;
  arduinoSocket.emit("arduino:feedback", command);
}

window.addEventListener("keydown", function (event) {
  const playPage = document.getElementById("playPage");
  const isDirectionGameVisible =
    currentGame === "direction" &&
    playPage &&
    !playPage.classList.contains("hidden");

  if (!isDirectionGameVisible || waitingNextRound) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    submitDirectionAnswer("LEFT");
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    submitDirectionAnswer("RIGHT");
  }
});
