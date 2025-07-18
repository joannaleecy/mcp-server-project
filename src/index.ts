import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Create an MCP server
const server = new McpServer({
  name: "My App",
  version: "1.0.0"
});

// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }: { a: number; b: number }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Simple tool with parameters
server.tool(
    "calculate-bmi",
    {
      weightKg: z.number(),
      heightM: z.number()
    },
    async ({ weightKg, heightM }: { weightKg: number; heightM: number }) => ({
      content: [{
        type: "text",
        text: String(weightKg / (heightM * heightM))
      }]
    })
  );
  
  // Async tool with external API call
  server.tool(
    "fetch-weather",
    { city: z.string() },
    async ({ city }: { city: string }) => {
      const response = await fetch(`https://api.weather.com/${city}`);
      const data = await response.text();
      return {
        content: [{ type: "text", text: data }]
      };
    }
  );

  server.prompt(
    "review-code",
    { code: z.string() },
    ({ code }: { code: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please review this code:\n\n${code}`
        }
      }]
    })
  ); 

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri: URL, variables: { [key: string]: string | string[] }) => {
    const name = Array.isArray(variables.name) ? variables.name[0] : variables.name || "Guest";
    return {
      contents: [{
        uri: uri.href,
        text: `Hello, ${name}!`
      }]
    };
  }
);

// Create an Express app
const app = express();

// To support multiple simultaneous connections, we have a lookup object from
// sessionId to transport
const transports: { [sessionId: string]: SSEServerTransport } = {};

// SSE endpoint
app.get("/sse", async (req: Request, res: Response) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;

    res.on("close", () => {
      delete transports[transport.sessionId];
    });

    await server.connect(transport);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).send("SSE connection error");
    }
    console.error("Error in /sse route:", error);
  }
});

// Message handling endpoint
app.post("/messages", (req, res) => {
  (async (req: express.Request, res: express.Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];

    if (!transport) {
      return res.status(400).send("No transport found for sessionId or SSE connection not established");
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();

