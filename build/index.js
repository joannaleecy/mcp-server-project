"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const express_1 = __importDefault(require("express"));
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
// Create an MCP server
const server = new mcp_js_1.McpServer({
    name: "My App",
    version: "1.0.0"
});
// Add an addition tool
server.tool("add", { a: zod_1.z.number(), b: zod_1.z.number() }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ a, b }) {
    return ({
        content: [{ type: "text", text: String(a + b) }]
    });
}));
// Simple tool with parameters
server.tool("calculate-bmi", {
    weightKg: zod_1.z.number(),
    heightM: zod_1.z.number()
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ weightKg, heightM }) {
    return ({
        content: [{
                type: "text",
                text: String(weightKg / (heightM * heightM))
            }]
    });
}));
// Async tool with external API call
server.tool("fetch-weather", { city: zod_1.z.string() }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ city }) {
    const response = yield fetch(`https://api.weather.com/${city}`);
    const data = yield response.text();
    return {
        content: [{ type: "text", text: data }]
    };
}));
server.prompt("review-code", { code: zod_1.z.string() }, ({ code }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please review this code:\n\n${code}`
            }
        }]
}));
// Re-enabling the custom agent with placeholder string output for now
server.tool("create-unique-culture", {
    race1: zod_1.z.string(),
    culture1: zod_1.z.string(),
    language1: zod_1.z.string(),
    race2: zod_1.z.string(),
    culture2: zod_1.z.string(),
    language2: zod_1.z.string(),
    race3: zod_1.z.string(),
    culture3: zod_1.z.string(),
    language3: zod_1.z.string()
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ race1, culture1, language1, race2, culture2, language2, race3, culture3, language3 }) {
    // Placeholder response for testing
    const uniqueDescription = `Generated a unique culture combining: \n` +
        `1. Race: ${race1}, Culture: ${culture1}, Language: ${language1}\n` +
        `2. Race: ${race2}, Culture: ${culture2}, Language: ${language2}\n` +
        `3. Race: ${race3}, Culture: ${culture3}, Language: ${language3}`;
    /*
    const prompt = `Combine the following details into a single unique race, culture, and language:\n\n` +
      `1. Race: ${race1}, Culture: ${culture1}, Language: ${language1}\n` +
      `2. Race: ${race2}, Culture: ${culture2}, Language: ${language2}\n` +
      `3. Race: ${race3}, Culture: ${culture3}, Language: ${language3}\n\n` +
      `Describe the unique combination in detail.`;

    // Use an LLM to process the input and generate a unique result
    const response = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer YOUR_API_KEY` // Replace with your actual API key
      },
      body: JSON.stringify({
        model: "text-davinci-003",
        prompt,
        max_tokens: 500
      })
    });

    const data = await response.json();
    const uniqueDescription = data.choices[0]?.text?.trim() || "Unable to generate a unique description.";
    */
    return {
        content: [{ type: "text", text: uniqueDescription }]
    };
}));
// Add a dynamic greeting resource
server.resource("greeting", new mcp_js_1.ResourceTemplate("greeting://{name}", { list: undefined }), (uri, variables) => __awaiter(void 0, void 0, void 0, function* () {
    const name = Array.isArray(variables.name) ? variables.name[0] : variables.name || "Guest";
    return {
        contents: [{
                uri: uri.href,
                text: `Hello, ${name}!`
            }]
    };
}));
// Create an Express app
const app = (0, express_1.default)();
// To support multiple simultaneous connections, we have a lookup object from
// sessionId to transport
const transports = {};
// SSE endpoint
app.get("/sse", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transport = new sse_js_1.SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        res.on("close", () => {
            delete transports[transport.sessionId];
        });
        yield server.connect(transport);
    }
    catch (error) {
        if (!res.headersSent) {
            res.status(500).send("SSE connection error");
        }
        console.error("Error in /sse route:", error);
    }
}));
// Message handling endpoint
app.post("/messages", (req, res) => {
    ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        if (!transport) {
            return res.status(400).send("No transport found for sessionId or SSE connection not established");
        }
        try {
            yield transport.handlePostMessage(req, res);
        }
        catch (error) {
            if (!res.headersSent) {
                res.status(500).send("Internal Server Error");
            }
        }
    }))(req, res);
});
// Add a route to handle GET / requests
app.get("/", (req, res) => {
    res.send("Welcome to the MCP server!");
});
// Start the Express server
app.listen(3002);
// Wrap the top-level await in an async IIFE
(() => __awaiter(void 0, void 0, void 0, function* () {
    const transport = new stdio_js_1.StdioServerTransport();
    yield server.connect(transport);
}))();
// Removed vscode integration as it is not applicable to this MCP server project
// Updated error handling for unknown type
// Function to integrate with Microsoft Copilot Studio (commented out for now)
/*
async function integrateCopilotStudio() {
  try {
    // Select a Copilot model
    const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });

    if (!model) {
      console.error('No Copilot models available.');
      return;
    }

    // Example: Sending a request to the selected model
    const craftedPrompt = 'Hello, Copilot! Can you assist with MCP server tasks?';
    const response = await model.sendRequest(craftedPrompt);

    console.log('Copilot response:', response);
  } catch (err) {
    if (err instanceof Error) {
      console.error('Language Model Error:', err.message);
    } else {
      console.error('Unexpected error:', err);
    }
  }
}

// Call the integration function
// integrateCopilotStudio();
*/
