"use strict";
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
server.tool("add", { a: zod_1.z.number(), b: zod_1.z.number() }, async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
}));
// Simple tool with parameters
server.tool("calculate-bmi", {
    weightKg: zod_1.z.number(),
    heightM: zod_1.z.number()
}, async ({ weightKg, heightM }) => ({
    content: [{
            type: "text",
            text: String(weightKg / (heightM * heightM))
        }]
}));
// Async tool with external API call
server.tool("fetch-weather", { city: zod_1.z.string() }, async ({ city }) => {
    const response = await fetch(`https://api.weather.com/${city}`);
    const data = await response.text();
    return {
        content: [{ type: "text", text: data }]
    };
});
server.prompt("review-code", { code: zod_1.z.string() }, ({ code }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please review this code:\n\n${code}`
            }
        }]
}));
// Add a dynamic greeting resource
server.resource("greeting", new mcp_js_1.ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, variables) => {
    const name = Array.isArray(variables.name) ? variables.name[0] : variables.name || "Guest";
    return {
        contents: [{
                uri: uri.href,
                text: `Hello, ${name}!`
            }]
    };
});
// Create an Express app
const app = (0, express_1.default)();
// To support multiple simultaneous connections, we have a lookup object from
// sessionId to transport
const transports = {};
// SSE endpoint
app.get("/sse", async (_, res) => {
    const transport = new sse_js_1.SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
    });
    await server.connect(transport);
});
// Message handling endpoint
app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res);
    }
    else {
        res.status(400).send('No transport found for sessionId');
    }
});
// Start the Express server
app.listen(3001);
// Wrap the top-level await in an async IIFE
(async () => {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
})();
