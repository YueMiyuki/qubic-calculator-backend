const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { setInterval } = require("timers");

const app = express();
const PORT = process.env.PORT || 3000;

async function handleScore(infoData, entry) {
  // Read the last logged entry
  const filePath = path.join(__dirname, "li.txt");
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, "utf8").trim().split("\n");
    const lastEntry = fileData[fileData.length - 1];
    const lastAvgScore = lastEntry.split("|")[0];

    // Compare the new average score with the last logged average score
    if (
      parseFloat(infoData.averageScore).toFixed(5) ===
      parseFloat(lastAvgScore).toFixed(5)
    ) {
      console.log("Average score unchanged; no new data logged.");
      return;
    }
  }
  fs.appendFileSync(filePath, entry, "utf8");
  console.log(`Logged scores: ${entry}`);
}

async function handleData(infoData, entry) {
  const filePath = path.join(__dirname, "data.txt");
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, "utf8").trim().split("\n");
    const lastEntry = fileData[fileData.length - 1];
    const estimatedIts = lastEntry.split("|")[0];
    const solutionsPerHour = lastEntry.split("|")[1];

    // Compare the new average score with the last logged average score
    if (
      parseFloat(infoData.estimatedIts).toFixed(5) ===
      parseFloat(estimatedIts).toFixed(5)
    ) {
      console.log("Data unchanged; no new data logged.");
      return;
    }
    if (
      parseFloat(infoData.solutionsPerHour).toFixed(5) ===
      parseFloat(solutionsPerHour).toFixed(5)
    ) {
      console.log("Data unchanged; no new data logged.");
      return;
    }
  }
  fs.appendFileSync(filePath, entry, "utf8");
  console.log(`Logged data: ${entry}`);
}

async function logData() {
  const loginUrl = "https://api.qubic.li/Auth/Login";
  const loginPayload = {
    userName: "guest@qubic.li",
    password: "guest13@Qubic.li",
  };

  const loginHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    Origin: "https://app.qubic.li",
    Referer: "https://app.qubic.li/",
  };

  try {
    const loginResponse = await axios.post(loginUrl, loginPayload, {
      headers: loginHeaders,
    });
    const token = loginResponse.data.token;

    const url = "https://api.qubic.li/Score/Get";
    const headers = {
      "User-Agent": loginHeaders["User-Agent"],
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      Origin: loginHeaders["Origin"],
      Referer: loginHeaders["Referer"],
    };

    const response = await axios.get(url, { headers });
    const infoData = response.data;

    const totalScores = infoData.scores.reduce(
      (sum, scores) => sum + parseInt(scores.score),
      0
    );
    const now = new Date();
    const formattedTime = now.toISOString().replace("T", " ").split(".")[0]; // Format: YYYY-MM-DD HH:mm

    const newLogEntry =
      [infoData.averageScore, totalScores, formattedTime].join("|") + "\n";

    const newDataEntry =
      [infoData.estimatedIts, infoData.solutionsPerHour, formattedTime].join(
        "|"
      ) + "\n";

    await handleScore(infoData, newLogEntry);
    await handleData(infoData, newDataEntry);

    // Process data after logging
    processFile("li.txt", "score");
    processFile("data.txt", "data");
  } catch (error) {
    console.error("Error logging data:", error);
  }
}

// Function to process data and write to scores.json
function processFile(fileName, type) {
  if (type === "score") {
    const data = fs.readFileSync(fileName, "utf8").trim().split("\n");
    const processedData = [];

    // Process incoming data
    data.forEach((line) => {
      const parts = line.split("|");
      const timestamp = new Date(parts[2].trim()).getTime(); // Using the formatted timestamp

      processedData.push({
        time: Math.floor(timestamp / 1000), // Convert to UNIX timestamp
        TotalCurrent: parseFloat(parts[0].trim()),
        totalScores: parseFloat(parts[1].trim())
      });
    });

    // Keep only the latest 100 values, if available
    const latestProcessedData = processedData
      .sort((a, b) => b.time - a.time)
      .slice(0, 100);

    // Write the latest processed data to scores.json
    fs.writeFileSync(
      "scores.json",
      JSON.stringify(latestProcessedData, null, 2),
      "utf8"
    );
  } else if (type === "data") {
    const data = fs.readFileSync(fileName, "utf8").trim().split("\n");
    const processedData = [];

    // Process incoming data
    data.forEach((line) => {
      const parts = line.split("|");
      const EstimatedIts = parseFloat(parts[0].trim()); 
      const solutionsPerHour = parseFloat(parts[1].trim());
      const timestamp = new Date(parts[2].trim()).getTime(); // Using the formatted timestamp

      processedData.push({
        time: Math.floor(timestamp / 1000), // Convert to UNIX timestamp
        EstimatedIts: EstimatedIts,
        solutionsPerHour: solutionsPerHour
      });
    });

    // Keep only the latest 100 values, if available
    const latestProcessedData = processedData
      .sort((a, b) => b.time - a.time)
      .slice(0, 100);

    // Write the latest processed data to scores.json
    fs.writeFileSync(
      "data.json",
      JSON.stringify(latestProcessedData, null, 2),
      "utf8"
    );
  }
}

// API endpoint to retrieve the latest analyzed data from scores.json
app.get("/api/data", (req, res) => {
  fs.readFile("data.json", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading analyzed data file:", err);
      return res.status(500).send("Error reading data");
    }

    // Parse data and send back
    const jsonData = JSON.parse(data);
    res.json(jsonData);
  });
});

// API endpoint to retrieve the latest analyzed data from scores.json
app.get("/api/scores", (req, res) => {
  fs.readFile("scores.json", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading analyzed data file:", err);
      return res.status(500).send("Error reading data");
    }

    // Parse data and send back
    const jsonData = JSON.parse(data);
    res.json(jsonData);
  });
});

// Start logging data every 10 minutes
setInterval(logData, 60 * 5 * 1000); // 10 minutes

// Initial log on startup
logData();

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
