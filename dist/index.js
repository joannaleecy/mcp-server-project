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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiKey = process.env.OPENAI_API_KEY; // Load the API key from the .env file
//const modeluse = "https://gaming-ai-openai.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-01-01-preview"
const modeluse = "https://gaming-ai-openai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview";
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
}, async ({ race1, culture1, language1, race2, culture2, language2, race3, culture3, language3 }) => {
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
        "Authorization": `Bearer ${apiKey}` // Replace with your actual API key
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
});
// Fixed the misplaced catch block and added proper syntax
server.tool("chat-with-user", { prompt: zod_1.z.string() }, async ({ prompt }) => {
    try {
        const response = await fetch("https://gaming-ai-openai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                prompt,
                max_tokens: 500
            })
        });
        const contentType = response.headers.get("Content-Type");
        const rawResponse = await response.text();
        console.log("Raw Response:", rawResponse);
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error(`Unsupported response format: ${contentType}. Response: ${rawResponse}`);
        }
        const data = JSON.parse(rawResponse);
        if (!data.choices || data.choices.length === 0) {
            return {
                content: [{ type: "text", text: "Sorry, I couldn't generate a response." }]
            };
        }
        const reply = data.choices[0].text.trim();
        return {
            content: [{ type: "text", text: reply }]
        };
    }
    catch (error) {
        console.error("Error in chat-with-user tool:", error);
        return {
            content: [{ type: "text", text: "An error occurred while processing your request." }]
        };
    }
});
// Add an evaluator agent to analyze the form for consistency and gaps
const agents_1 = require("./agents");
server.tool("evaluate-form", {
    formData: zod_1.z.object({
        settingAndEnvironment: zod_1.z.object({
            location: zod_1.z.string(),
            climate: zod_1.z.string(),
            landscape: zod_1.z.string()
        }),
        historyAndLore: zod_1.z.object({
            backstory: zod_1.z.string(),
            mythology: zod_1.z.string()
        }),
        societyAndCulture: zod_1.z.object({
            population: zod_1.z.string(),
            culture: zod_1.z.string(),
            economy: zod_1.z.string()
        }),
        technologyAndInfrastructure: zod_1.z.object({
            technologyLevel: zod_1.z.string(),
            transportation: zod_1.z.string(),
            energy: zod_1.z.string()
        })
    })
}, async ({ formData }) => {
    try {
        const settingAnalysis = await (0, agents_1.settingAndEnvironmentAgent)(formData.settingAndEnvironment);
        const historyAnalysis = await (0, agents_1.historyAndLoreAgent)(formData.historyAndLore);
        const societyAnalysis = await (0, agents_1.societyAndCultureAgent)(formData.societyAndCulture);
        const technologyAnalysis = await (0, agents_1.technologyAndInfrastructureAgent)(formData.technologyAndInfrastructure);
        return {
            content: [
                { type: "text", text: settingAnalysis },
                { type: "text", text: historyAnalysis },
                { type: "text", text: societyAnalysis },
                { type: "text", text: technologyAnalysis }
            ]
        };
    }
    catch (error) {
        console.error("Error in evaluate-form tool:", error);
        return {
            content: [{ type: "text", text: "An error occurred while analyzing the form data." }]
        };
    }
});
server.tool("evaluator-agent", {
    settingAndEnvironment: zod_1.z.object({
        location: zod_1.z.string(),
        climate: zod_1.z.string(),
        landscape: zod_1.z.string()
    }),
    historyAndLore: zod_1.z.object({
        backstory: zod_1.z.string(),
        mythology: zod_1.z.string()
    }),
    societyAndCulture: zod_1.z.object({
        population: zod_1.z.string(),
        culture: zod_1.z.string(),
        economy: zod_1.z.string()
    }),
    technologyAndInfrastructure: zod_1.z.object({
        technologyLevel: zod_1.z.string(),
        transportation: zod_1.z.string(),
        energy: zod_1.z.string()
    })
}, async ({ settingAndEnvironment, historyAndLore, societyAndCulture, technologyAndInfrastructure }) => {
    return {
        content: [
            {
                type: "text",
                text: `Evaluation received:\n\n` +
                    `1. Setting and Environment\n` +
                    `Location: ${settingAndEnvironment.location}\n` +
                    `Climate: ${settingAndEnvironment.climate}\n` +
                    `Landscape: ${settingAndEnvironment.landscape}\n\n` +
                    `2. History and Lore\n` +
                    `Backstory: ${historyAndLore.backstory}\n` +
                    `Mythology: ${historyAndLore.mythology}\n\n` +
                    `3. Society and Culture\n` +
                    `Population: ${societyAndCulture.population}\n` +
                    `Culture: ${societyAndCulture.culture}\n` +
                    `Economy: ${societyAndCulture.economy}\n\n` +
                    `4. Technology and Infrastructure\n` +
                    `Technology Level: ${technologyAndInfrastructure.technologyLevel}\n` +
                    `Transportation: ${technologyAndInfrastructure.transportation}\n` +
                    `Energy: ${technologyAndInfrastructure.energy}`
            }
        ]
    };
});
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
app.get("/sse", async (req, res) => {
    try {
        const transport = new sse_js_1.SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        res.on("close", () => {
            delete transports[transport.sessionId];
        });
        await server.connect(transport);
    }
    catch (error) {
        if (!res.headersSent) {
            res.status(500).send("SSE connection error");
        }
        console.error("Error in /sse route:", error);
    }
});
// Message handling endpoint
app.post("/messages", (req, res) => {
    (async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        if (!transport) {
            return res.status(400).send("No transport found for sessionId or SSE connection not established");
        }
        try {
            await transport.handlePostMessage(req, res);
        }
        catch (error) {
            if (!res.headersSent) {
                res.status(500).send("Internal Server Error");
            }
        }
    })(req, res);
});
// Add a route to handle GET / requests
app.get("/", (req, res) => {
    res.send("Welcome to the MCP server!");
});
// Start the Express server
app.listen(3002);
// Wrap the top-level await in an async IIFE
(async () => {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
})();
