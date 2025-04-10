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
app.get("/sse", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    const transport = new sse_js_1.SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
    });
    yield server.connect(transport);
}));
// Message handling endpoint
app.post("/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];
    if (transport) {
        yield transport.handlePostMessage(req, res);
    }
    else {
        res.status(400).send('No transport found for sessionId');
    }
}));
// Start the Express server
app.listen(3001);
// Wrap the top-level await in an async IIFE
(() => __awaiter(void 0, void 0, void 0, function* () {
    const transport = new stdio_js_1.StdioServerTransport();
    yield server.connect(transport);
}))();
