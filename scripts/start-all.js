const { spawn } = require("child_process");
require("../src/shared/db");
["transkrip", "nilai", "gateway"].forEach((n) =>
  spawn("node", [`src/${n}/index.js`], { stdio: "inherit" }),
);
