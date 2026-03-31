const path = require("path");
const dotenv = require("dotenv");

/**
 * .env 를 여러 경로에서 순서대로 로드(나중 파일이 앞 설정을 덮어씀).
 * - API 폴더 기준: .env / .env.local
 * - 실행 cwd 기준: .env / .env.local (다른 디렉터리에서 node 를 실행한 경우)
 */
function loadEnvFiles() {
  const candidates = [
    path.join(__dirname, ".env"),
    path.join(__dirname, ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
  ];

  const seen = new Set();
  const loaded = [];

  for (const filePath of candidates) {
    const key = path.resolve(filePath);
    if (seen.has(key)) continue;
    seen.add(key);

    const result = dotenv.config({ path: filePath, override: true });
    if (!result.error) {
      loaded.push(filePath);
    }
  }

  if (loaded.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[env] .env 를 찾지 못했습니다. 아래 중 한 곳에 파일을 두세요."
    );
    // eslint-disable-next-line no-console
    console.warn("  -", path.join(__dirname, ".env"), "(권장: API 프로젝트 루트)");
    // eslint-disable-next-line no-console
    console.warn("  -", path.join(process.cwd(), ".env"), "(현재 작업 디렉터리)");
    // eslint-disable-next-line no-console
    console.warn(
      "[env] 예: cp .env.example .env 후 PGHOST / PGUSER / PGDATABASE 등을 채우세요."
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[env] .env 로드:", loaded.join(" → "));
  }
}

loadEnvFiles();

const { createServer } = require("./src/server");

const PORT = Number(process.env.PORT || 80);

const app = createServer();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[timeboxing-api] listening on :${PORT}`);
});
