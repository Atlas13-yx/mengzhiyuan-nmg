import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const port = 4173;
const appUrl = `http://${host}:${port}`;
const shouldOpenBrowser = process.argv.includes("--open");
const shouldSkipBuild = process.argv.includes("--skip-build");
const shouldReuseServer = process.argv.includes("--reuse");
const vinextCli = path.join(projectRoot, "node_modules", "vinext", "dist", "cli.js");

const contentTypePatterns = new Map([
  [".css", /^text\/css\b/i],
  [".js", /^(?:application|text)\/javascript\b/i],
  [".json", /^(?:application|text)\/json\b/i],
  [".svg", /^image\/svg\+xml\b/i],
]);

function runStep(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [vinextCli, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: false,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label}失败${signal ? `（信号 ${signal}）` : `（退出码 ${code ?? "未知"}）`}`,
        ),
      );
    });
  });
}

function isPortAvailable() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    probe.listen({ host, port, exclusive: true }, () => {
      probe.close(() => resolve(true));
    });
  });
}

function collectLocalResources(html) {
  const resources = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const rawValue = match[1];
    if (
      rawValue.startsWith("#") ||
      rawValue.startsWith("data:") ||
      rawValue.startsWith("javascript:") ||
      rawValue.startsWith("mailto:")
    ) {
      continue;
    }

    const resourceUrl = new URL(rawValue, appUrl);
    if (resourceUrl.origin === appUrl) {
      resources.add(`${resourceUrl.pathname}${resourceUrl.search}`);
    }
  }

  if (existsSync(path.join(projectRoot, "public", "favicon.svg"))) {
    resources.add("/favicon.svg");
  }
  if (existsSync(path.join(projectRoot, "public", "data", "announcements.json"))) {
    resources.add("/data/announcements.json");
  }

  return [...resources].sort();
}

async function fetchChecked(pathname, expectedContentType) {
  const response = await fetch(new URL(pathname, appUrl), {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${pathname} 返回 HTTP ${response.status}`);
  }
  if (expectedContentType) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!expectedContentType.test(contentType)) {
      await response.body?.cancel();
      throw new Error(`${pathname} 返回了错误的 Content-Type：${contentType || "空"}`);
    }
  }
  return response;
}

async function checkHealth() {
  const rootResponse = await fetchChecked("/", /^text\/html\b/i);
  const html = await rootResponse.text();
  const resources = collectLocalResources(html);
  const failures = [];

  await Promise.all(
    resources.map(async (resource) => {
      try {
        const pathname = new URL(resource, appUrl).pathname;
        const response = await fetchChecked(
          resource,
          contentTypePatterns.get(path.extname(pathname)),
        );
        await response.body?.cancel();
      } catch (error) {
        failures.push(error.message);
      }
    }),
  );

  if (failures.length > 0) {
    throw new Error(`静态资源健康检查失败：${failures.join("；")}`);
  }

  return resources;
}

function describeServerOutcome(outcome) {
  if (outcome.error) return `预览服务启动失败：${outcome.error.message}`;
  if (outcome.signal) return `预览服务过早退出（信号 ${outcome.signal}）`;
  return `预览服务过早退出（退出码 ${outcome.code ?? "未知"}）`;
}

async function waitUntilHealthy(getServerOutcome, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = new Error("服务尚未响应");

  while (Date.now() < deadline) {
    const outcome = getServerOutcome();
    if (outcome) throw new Error(describeServerOutcome(outcome));

    try {
      return await checkHealth();
    } catch (error) {
      lastError = error;
      const outcomeAfterCheck = getServerOutcome();
      if (outcomeAfterCheck) {
        throw new Error(describeServerOutcome(outcomeAfterCheck));
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  throw new Error(`预览服务在 120 秒内未通过健康检查：${lastError.message}`);
}

function openBrowser() {
  let command;
  let args;

  if (process.platform === "win32") {
    command = "cmd.exe";
    args = ["/d", "/c", "start", "", appUrl];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [appUrl];
  } else {
    command = "xdg-open";
    args = [appUrl];
  }

  const opener = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  opener.unref();
}

async function main() {
  if (!existsSync(vinextCli)) {
    throw new Error("依赖尚未安装，请先运行 npm install。 ");
  }

  if (!(await isPortAvailable())) {
    if (!shouldReuseServer) {
      throw new Error(
        `端口 ${port} 已被占用。为避免继续展示旧构建，启动器不会自动复用现有服务。` +
          "\n请先关闭旧预览窗口或占用该端口的程序后再试。",
      );
    }

    try {
      const resources = await checkHealth();
      console.log(`已有健康的预览服务正在运行：${appUrl}`);
      console.log(`已验证首页和 ${resources.length} 个本地资源。`);
      if (shouldOpenBrowser) openBrowser();
      return;
    } catch (error) {
      throw new Error(
        `端口 ${port} 已被其他或失效的程序占用。请关闭旧预览窗口后重试。\n${error.message}`,
      );
    }
  }

  if (!shouldSkipBuild) {
    console.log("[1/2] 正在构建生产预览...");
    await runStep(["build"], "构建");
  }

  console.log("[2/2] 正在启动并检查页面资源...");
  const serverChild = spawn(
    process.execPath,
    [vinextCli, "start", "--hostname", host, "--port", String(port)],
    {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: false,
    },
  );

  let serverOutcome = null;
  const serverExit = new Promise((resolve) => {
    serverChild.once("error", (error) => {
      serverOutcome = { error };
      resolve(serverOutcome);
    });
    serverChild.once("exit", (code, signal) => {
      serverOutcome = { code, signal };
      resolve(serverOutcome);
    });
  });

  let shuttingDown = false;
  const stopServer = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (serverChild.exitCode === null && serverChild.signalCode === null) {
      serverChild.kill();
    }
  };

  process.once("SIGINT", stopServer);
  process.once("SIGTERM", stopServer);
  process.once("exit", stopServer);

  try {
    const resources = await waitUntilHealthy(() => serverOutcome);
    console.log(`\n预览已就绪：${appUrl}`);
    console.log(`健康检查通过：首页和 ${resources.length} 个本地资源均可访问。`);
    console.log("按 Ctrl+C 可停止服务。\n");
    if (shouldOpenBrowser) openBrowser();
  } catch (error) {
    stopServer();
    throw error;
  }

  const outcome = await serverExit;
  if (shuttingDown || (!outcome.error && outcome.code === 0)) return;
  throw new Error(describeServerOutcome(outcome).replace("过早退出", "意外退出"));
}

main().catch((error) => {
  console.error(`\n启动失败：${error.message}`);
  process.exitCode = 1;
});
