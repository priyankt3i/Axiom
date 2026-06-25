import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google Gen AI SDK
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "") {
  console.log("Initializing Gemini API with server-side key...");
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.log("No valid GEMINI_API_KEY found. Falling back to high-fidelity offline execution simulator.");
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", apiLive: !!ai });
});

// Dynamic Cost Estimator API
app.post("/api/estimate-cost", (req, res) => {
  const { taskDescription } = req.body;
  if (!taskDescription) {
    return res.status(400).json({ error: "Task description is required" });
  }

  // Calculate high-fidelity estimate based on description length and complexity
  const wordCount = taskDescription.split(/\s+/).length;
  const isComplex = wordCount > 15 || /stripe|payment|kubernetes|auth|docker/i.test(taskDescription);

  const estInputTokens = Math.round(18000 + wordCount * 12);
  const estOutputTokens = Math.round(4500 + (isComplex ? 3500 : 1500));
  const estComputeMs = isComplex ? 24500 : 12400;

  // Pricing assumptions: $0.075 / 1M input tokens, $0.30 / 1M output tokens, $0.000016 / ms compute
  const estTokenCost = (estInputTokens * 0.000000075) + (estOutputTokens * 0.0000003);
  const estComputeCost = estComputeMs * 0.000016;
  const totalCost = estTokenCost + estComputeCost;

  res.json({
    estimatedCost: parseFloat(totalCost.toFixed(5)),
    inputTokens: estInputTokens,
    outputTokens: estOutputTokens,
    computeMs: estComputeMs,
    isComplex
  });
});

// Task simulation fallback for offline mode
function generateOfflineSimulation(taskDescription: string, devRole: string, qaRole: string) {
  const cleanTask = taskDescription.trim();
  const branchName = `feature/hermes-` + cleanTask.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30);
  
  // Custom templates for common engineering tasks to keep them extremely high-fidelity
  const isStripe = /stripe|payment|billing|checkout/i.test(cleanTask);
  const isAuth = /auth|login|jwt|session|signup/i.test(cleanTask);
  const isDb = /db|database|optimize|query|postgres|sql|prisma/i.test(cleanTask);

  let firstDiff = "";
  let secondDiff = "";
  let firstXml = "";
  let secondXml = "";
  let firstStdout = "";
  let secondStdout = "";
  let feedback = "";
  let devAction1 = "";
  let qaAction1 = "";
  let devAction2 = "";
  let qaAction2 = "";

  if (isStripe) {
    devAction1 = "Synthesizing Stripe checkout handler and webhook validation system.";
    firstDiff = `diff --git a/src/services/stripe.ts b/src/services/stripe.ts
new file mode 100644
--- /dev/null
+++ b/src/services/stripe.ts
@@ -0,0 +1,28 @@
+import Stripe from "stripe";
+
+export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
+  apiVersion: "2023-10-16",
+});
+
+export async function handleWebhookEvent(payload: string, signature: string) {
+  // CRITICAL: Need secure webhook signing verification
+  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
+  
+  // FAILING LINE: Missing webhook event construct check or passing undefined stripe key
+  const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
+  
+  if (event.type === "checkout.session.completed") {
+    const session = event.data.object as Stripe.Checkout.Session;
+    await fulfillOrder(session);
+  }
+  
+  return { received: true };
+}
+
+async function fulfillOrder(session: Stripe.Checkout.Session) {
+  console.log(\`Fulfilling order for client: \${session.client_reference_id}\`);
+  // Mock db entry
+}`;

    firstStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-stripe-wh'
[Docker Build] Building sandbox image with node:18-alpine... Success.
[Jest Exec] RUNNING test suite: tests/stripe.test.ts
✕ stripe webhook handler constructs event correctly (142ms)

  ● stripe webhook handler constructs event correctly
    StripeSignatureVerificationError: No webhook payload signature found matching expected signature for payload.
      at Webhook.constructEvent (node_modules/stripe/lib/Webhooks.js:15:12)
      at handleWebhookEvent (src/services/stripe.ts:11:25)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.85s
Ran all test suites.`;

    firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="1" failures="1" errors="0" time="1.85">
  <testsuite name="Stripe Webhook Integration" tests="1" failures="1" errors="0" time="1.85">
    <testcase name="stripe webhook handler constructs event correctly" classname="tests/stripe.test.ts" time="0.142">
      <failure message="StripeSignatureVerificationError: No webhook payload signature found matching expected signature" type="StripeSignatureVerificationError">
        at Webhook.constructEvent (node_modules/stripe/lib/Webhooks.js:15:12)
        at handleWebhookEvent (src/services/stripe.ts:11:25)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

    feedback = "QA AGENT REJECTION: Stripe signature verification is failing because raw body payload is not preserved in the Express parser. You must use a middleware that stores raw body buffer on req.rawBody, otherwise stripe.webhooks.constructEvent fails signature match.";

    devAction2 = "Adding express raw body parser configuration and updating Webhook signature validator.";
    secondDiff = `diff --git a/src/services/stripe.ts b/src/services/stripe.ts
--- a/src/services/stripe.ts
+++ b/src/services/stripe.ts
@@ -10,3 +10,13 @@
   const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
+  if (!endpointSecret) {
+    throw new Error("STRIPE_WEBHOOK_SECRET is not configured inside system environment.");
+  }
+  
+  // FIXED: Preserving raw string format and capturing validation constraints safely
   const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
+  
   if (event.type === "checkout.session.completed") {
@@ -18,2 +28,14 @@
+export function configureExpressRawBody(app: any) {
+  app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
+}`;

    secondStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-stripe-wh'
[Docker Build] Reusing cached layers... Success.
[Jest Exec] RUNNING test suite: tests/stripe.test.ts
✓ stripe webhook handler constructs event correctly (48ms)
✓ stripe webhook raw body parser extracts request buffers successfully (15ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.22s
Ran all test suites. All tests green!`;

    secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="2" failures="0" errors="0" time="1.22">
  <testsuite name="Stripe Webhook Integration" tests="2" failures="0" errors="0" time="1.22">
    <testcase name="stripe webhook handler constructs event correctly" classname="tests/stripe.test.ts" time="0.048"/>
    <testcase name="stripe webhook raw body parser extracts request buffers successfully" classname="tests/stripe.test.ts" time="0.015"/>
  </testsuite>
</testsuites>`;

  } else if (isAuth) {
    devAction1 = "Implementing JWT Authentication strategy and token expiration handlers.";
    firstDiff = `diff --git a/src/services/auth.ts b/src/services/auth.ts
new file mode 100644
--- /dev/null
+++ b/src/services/auth.ts
@@ -0,0 +1,22 @@
+import jwt from "jsonwebtoken";
+
+export function generateAccessToken(userId: string) {
+  // FAILING LINE: Missing fallback secret, throws directly under undefined process.env
+  return jwt.sign({ sub: userId }, process.env.JWT_SECRET);
+}
+
+export function authenticateToken(req: any, res: any, next: any) {
+  const authHeader = req.headers["authorization"];
+  const token = authHeader && authHeader.split(" ")[1];
+  
+  if (token == null) return res.sendStatus(401);
+  
+  jwt.verify(token, process.env.JWT_SECRET, (err: any, user: any) => {
+    if (err) return res.sendStatus(403);
+    req.user = user;
+    next();
+  });
+}`;

    firstStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-auth-jwt'
[Docker Build] Preparing isolated container workspace... Success.
[Jest Exec] RUNNING test suite: tests/auth.test.ts
✕ generates a token with signature (82ms)

  ● generates a token with signature
    ValidationError: "secretOrPrivateKey" must have a value
      at Object.sign (node_modules/jsonwebtoken/index.js:142:15)
      at generateAccessToken (src/services/auth.ts:5:14)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.64s`;

    firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="1" failures="1" errors="0" time="1.64">
  <testsuite name="Auth Verification" tests="1" failures="1" errors="0" time="1.64">
    <testcase name="generates a token with signature" classname="tests/auth.test.ts" time="0.082">
      <failure message="ValidationError: &quot;secretOrPrivateKey&quot; must have a value" type="ValidationError">
        at Object.sign (node_modules/jsonwebtoken/index.js:142:15)
        at generateAccessToken (src/services/auth.ts:5:14)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

    feedback = "QA AGENT REJECTION: The JWT token generation is throwing an error 'secretOrPrivateKey must have a value' because process.env.JWT_SECRET is undefined in the sandbox context. Please implement a robust fallback or raise an explicit startup validation error.";

    devAction2 = "Adding environment check fallback constraints and secure local sandbox seed for JWT signing.";
    secondDiff = `diff --git a/src/services/auth.ts b/src/services/auth.ts
--- a/src/services/auth.ts
+++ b/src/services/auth.ts
@@ -4,3 +4,8 @@
 export function generateAccessToken(userId: string) {
-  return jwt.sign({ sub: userId }, process.env.JWT_SECRET);
+  const secret = process.env.JWT_SECRET || "fallback_sandbox_secret_key_64bit";
+  return jwt.sign({ sub: userId }, secret, { expiresIn: "15m" });
 }
 
 export function authenticateToken(req: any, res: any, next: any) {
@@ -11,3 +16,4 @@
+  const secret = process.env.JWT_SECRET || "fallback_sandbox_secret_key_64bit";
-  jwt.verify(token, process.env.JWT_SECRET, (err: any, user: any) => {
+  jwt.verify(token, secret, (err: any, user: any) => {`;

    secondStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-auth-jwt'
[Docker Build] Reusing cached layer caches... Success.
[Jest Exec] RUNNING test suite: tests/auth.test.ts
✓ generates a token with signature (12ms)
✓ rejects authentication on expired or malformed headers (22ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.10s
All tests passed beautifully!`;

    secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="2" failures="0" errors="0" time="1.10">
  <testsuite name="Auth Verification" tests="2" failures="0" errors="0" time="1.10">
    <testcase name="generates a token with signature" classname="tests/auth.test.ts" time="0.012"/>
    <testcase name="rejects authentication on expired or malformed headers" classname="tests/auth.test.ts" time="0.022"/>
  </testsuite>
</testsuites>`;

  } else {
    // Generic high fidelity response
    devAction1 = "Assembling the core software modules, interfaces, and testing suite specifications.";
    firstDiff = `diff --git a/src/core/module.ts b/src/core/module.ts
new file mode 100644
--- /dev/null
+++ b/src/core/module.ts
@@ -0,0 +1,15 @@
+export class CoreTaskHandler {
+  private initialized: boolean = false;
+
+  constructor(private config: any) {}
+
+  public async executeTask() {
+    // FAILING LINE: Reading configuration options without safety locks
+    const maxRetries = this.config.policies.retryCount;
+    this.initialized = true;
+    return { status: "PROCESSED", retries: maxRetries };
+  }
+}`;

    firstStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-core-run'
[Docker Build] Assembling clean alpine Node container... Success.
[Jest Exec] RUNNING test suite: tests/module.test.ts
✕ task execution handles policy configurations correctly (54ms)

  ● task execution handles policy configurations correctly
    TypeError: Cannot read properties of undefined (reading 'retryCount')
      at CoreTaskHandler.executeTask (src/core/module.ts:8:44)
      at Object.<anonymous> (tests/module.test.ts:12:18)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.45s`;

    firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="1" failures="1" errors="0" time="1.45">
  <testsuite name="Core Logic Assertions" tests="1" failures="1" errors="0" time="1.45">
    <testcase name="task execution handles policy configurations correctly" classname="tests/module.test.ts" time="0.054">
      <failure message="TypeError: Cannot read properties of undefined (reading 'retryCount')" type="TypeError">
        at CoreTaskHandler.executeTask (src/core/module.ts:8:44)
        at Object.&lt;anonymous&gt; (tests/module.test.ts:12:18)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

    feedback = "QA AGENT REJECTION: CoreTaskHandler throws an error 'Cannot read properties of undefined (reading retryCount)' because configuration parameter nesting was not safeguarded against null config or empty policies mapping. Please wrap configuration with optional chaining and supply logical defaults.";

    devAction2 = "Securing nested configuration properties using TypeScript optional chaining.";
    secondDiff = `diff --git a/src/core/module.ts b/src/core/module.ts
--- a/src/core/module.ts
+++ b/src/core/module.ts
@@ -7,3 +7,5 @@
   public async executeTask() {
-    const maxRetries = this.config.policies.retryCount;
+    const maxRetries = this.config?.policies?.retryCount ?? 3;
+    const timeout = this.config?.policies?.timeoutMs ?? 5000;
     this.initialized = true;
-    return { status: "PROCESSED", retries: maxRetries };
+    return { status: "PROCESSED", retries: maxRetries, timeout };
   }`;

    secondStdout = `[Hermes Sandbox Init] spinning up ephemeral namespace 'hermes-sandbox-core-run'
[Docker Build] Reusing previous layer snapshot caches... Success.
[Jest Exec] RUNNING test suite: tests/module.test.ts
✓ task execution handles policy configurations correctly (8ms)
✓ initializes state machine with sensible fallback values (14ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.98s
Verification sandbox testing complete. Status: SUCCESS!`;

    secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hermes Verification Tests" tests="2" failures="0" errors="0" time="0.98">
  <testsuite name="Core Logic Assertions" tests="2" failures="0" errors="0" time="0.98">
    <testcase name="task execution handles policy configurations correctly" classname="tests/module.test.ts" time="0.008"/>
    <testcase name="initializes state machine with sensible fallback values" classname="tests/module.test.ts" time="0.014"/>
  </testsuite>
</testsuites>`;
  }

  // Calculate random tokens/ms
  const inputTokens = Math.floor(15000 + Math.random() * 2000);
  const outputTokens = Math.floor(3500 + Math.random() * 1000);
  const computeMs = Math.floor(11000 + Math.random() * 3000);
  const actualCost = parseFloat(((inputTokens * 0.000000075) + (outputTokens * 0.0000003) + (computeMs * 0.000016)).toFixed(5));

  return {
    taskName: cleanTask,
    gitBranch: branchName,
    estimatedCost: parseFloat((actualCost * 1.15).toFixed(5)),
    estimatedComputeMs: Math.round(computeMs * 1.2),
    developerAgentPrompt: `You are the lead engineering developer sub-agent within the Hermes Orchestrator. 
Your role is to write clean, maintainable, production-ready implementation and unit tests in typescript. 
Constraints: Maintain strict branch mapping, keep variable contexts distinct, and respond directly to unit testing failures.`,
    qaAgentPrompt: `You are the Lead SDET QA sub-agent within the Hermes Orchestrator.
Your role is to review developer code diffs, run test suites in a sandboxed Kubernetes container, and check JUnit logs.
If tests fail, provide objective trace logs and architectural critiques. If tests pass, compile reports and issue approval.`,
    iterations: [
      {
        iterationIndex: 1,
        developerAction: devAction1,
        codeDiff: firstDiff,
        qaAction: "[K8s Pod Init] " + (isStripe ? "hermes-sandbox-stripe-wh" : isAuth ? "hermes-sandbox-auth-jwt" : "hermes-sandbox-core-run"),
        testResultsXml: firstXml,
        stdout: firstStdout,
        status: "FAILED",
        feedbackToDeveloper: feedback
      },
      {
        iterationIndex: 2,
        developerAction: devAction2,
        codeDiff: secondDiff,
        qaAction: "[K8s Pod Reuse] " + (isStripe ? "hermes-sandbox-stripe-wh" : isAuth ? "hermes-sandbox-auth-jwt" : "hermes-sandbox-core-run") + " with active volume cache mounts.",
        testResultsXml: secondXml,
        stdout: secondStdout,
        status: "PASSED",
        feedbackToDeveloper: ""
      }
    ],
    finalPr: {
      prTitle: `feat: autonomous implementation of ${cleanTask}`,
      prDescription: `Autonomous engineering delivery orchestrated by Hermes.\n\n### Deliverables\n- Code implementation matching prompt specifications\n- Integrated unit assertions\n- Sandbox build verification verified inside ephemeral Kubernetes cluster\n\n- **Security Audit**: Signature bounds secured.\n- **Test Coverage**: 100% assertions green.\n- **Sub-agents**: Developer & SDET`,
      testCoverage: 95.8,
      actualCost: actualCost,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      computeMs: computeMs
    }
  };
}

// Full Dispatch API - optionally calling Google Gemini API if live, else using high fidelity offline fallback
app.post("/api/dispatch", async (req, res) => {
  const { taskDescription, developerRole, qaRole } = req.body;

  if (!taskDescription) {
    return res.status(400).json({ error: "Task description is required" });
  }

  // If no AI connection is live, trigger our offline generator
  if (!ai) {
    console.log("Using high-fidelity offline execution simulator.");
    const result = generateOfflineSimulation(taskDescription, developerRole || "Developer", qaRole || "SDET QA");
    return res.json(result);
  }

  try {
    console.log(`Querying Gemini API for dynamic agent orchestration of task: ${taskDescription}`);
    
    const userPrompt = `
Generate a highly realistic multi-agent software engineering task pipeline simulation for the engineering job: "${taskDescription}".
Sub-agent configuration:
- Developer Agent Role Description: "${developerRole || "Write clean TypeScript implementation and matching Jest unit tests."}"
- QA Agent Role Description: "${qaRole || "Review developer changes, spin up pod, run test suite, check for failure, write JUnit results."}"

Ensure that you simulate a real workflow with exactly 2 ITERATIONS:
- Iteration 1 MUST fail. Give a detailed realistic programming error (such as a missing import, syntax exception, unhandled promise, null pointer access, or mock assertion mismatch), show the failed code diff, and show the exact Jest console output showing test failures + JUnit XML string.
- Iteration 2 MUST pass. Show the corrected code diff fixing the issue from Iteration 1, showing Jest log output completely clean (All tests green!) and a successful JUnit XML.

Ensure all outputs are fully written out (zero pseudocode, write proper realistic typescript code inside the unified diff blocks).
Use the standard "diff --git" format for diff blocks.

Generate the exact JSON response containing all of this, following this exact schema:
{
  "taskName": "Name of the task",
  "gitBranch": "branch-name-slug",
  "estimatedCost": 0.05,
  "estimatedComputeMs": 15000,
  "developerAgentPrompt": "Prompt instructing the developer sub-agent",
  "qaAgentPrompt": "Prompt instructing the QA sub-agent",
  "iterations": [
    {
      "iterationIndex": 1,
      "developerAction": "Sentence describing what developer agent coded",
      "codeDiff": "Unified patch/diff showing the bug-prone code",
      "qaAction": "Sentence describing QA spinning up sandboxed container and launching Jest test runner",
      "testResultsXml": "JUnit XML output showing the failure",
      "stdout": "Bash terminal stdout logs showing the failing test with node tracebacks",
      "status": "FAILED",
      "feedbackToDeveloper": "Specific SDET critique explaining how to fix the error"
    },
    {
      "iterationIndex": 2,
      "developerAction": "Sentence describing developer rewriting and fixing the error",
      "codeDiff": "Unified patch/diff showing the fixed code or additional middleware",
      "qaAction": "Sentence describing QA container rerun",
      "testResultsXml": "JUnit XML output showing all testcases passing successfully",
      "stdout": "Bash terminal stdout logs showing passing test execution",
      "status": "PASSED",
      "feedbackToDeveloper": ""
    }
  ],
  "finalPr": {
    "prTitle": "feat: name of task",
    "prDescription": "Autonomous pull request summary",
    "testCoverage": 98.4,
    "actualCost": 0.045,
    "inputTokens": 14200,
    "outputTokens": 4500,
    "computeMs": 11500
  }
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            taskName: { type: Type.STRING },
            gitBranch: { type: Type.STRING },
            estimatedCost: { type: Type.NUMBER },
            estimatedComputeMs: { type: Type.INTEGER },
            developerAgentPrompt: { type: Type.STRING },
            qaAgentPrompt: { type: Type.STRING },
            iterations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  iterationIndex: { type: Type.INTEGER },
                  developerAction: { type: Type.STRING },
                  codeDiff: { type: Type.STRING },
                  qaAction: { type: Type.STRING },
                  testResultsXml: { type: Type.STRING },
                  stdout: { type: Type.STRING },
                  status: { type: Type.STRING },
                  feedbackToDeveloper: { type: Type.STRING }
                },
                required: ["iterationIndex", "developerAction", "codeDiff", "qaAction", "testResultsXml", "stdout", "status", "feedbackToDeveloper"]
              }
            },
            finalPr: {
              type: Type.OBJECT,
              properties: {
                prTitle: { type: Type.STRING },
                prDescription: { type: Type.STRING },
                testCoverage: { type: Type.NUMBER },
                actualCost: { type: Type.NUMBER },
                inputTokens: { type: Type.INTEGER },
                outputTokens: { type: Type.INTEGER },
                computeMs: { type: Type.INTEGER }
              },
              required: ["prTitle", "prDescription", "testCoverage", "actualCost", "inputTokens", "outputTokens", "computeMs"]
            }
          },
          required: ["taskName", "gitBranch", "estimatedCost", "estimatedComputeMs", "developerAgentPrompt", "qaAgentPrompt", "iterations", "finalPr"]
        }
      }
    });

    const parsedData = JSON.parse(response.text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini invocation failed, using offline fallback:", error);
    const fallbackData = generateOfflineSimulation(taskDescription, developerRole, qaRole);
    res.json(fallbackData);
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is booted and actively routing requests on http://localhost:${PORT}`);
  });
}

startServer();
