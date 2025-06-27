#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import dotenv from "dotenv";
import minimist from "minimist";
import { z } from "zod";
import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Import tools
import { aggregateLogs } from "./tools/aggregateLogs.js";
import { getDashboard } from "./tools/getDashboard.js";
import { getDashboards } from "./tools/getDashboards.js";
import { getEvents } from "./tools/getEvents.js";
import { getIncidents } from "./tools/getIncidents.js";
import { getMetricMetadata } from "./tools/getMetricMetadata.js";
import { getMetrics } from "./tools/getMetrics.js";
import { getMonitor } from "./tools/getMonitor.js";
import { getMonitors } from "./tools/getMonitors.js";
import { listMetrics } from "./tools/listMetrics.js";
import { searchLogs } from "./tools/searchLogs.js";

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

// Load environment variables from .env file (if it exists)
dotenv.config();

// Define environment variables - from command line or .env file
const DD_API_KEY = argv.apiKey || process.env.DD_API_KEY;
const DD_APP_KEY = argv.appKey || process.env.DD_APP_KEY;

// Get site configuration - defines the base domain for Datadog APIs
const DD_SITE = argv.site || process.env.DD_SITE || "datadoghq.com";

// Define service-specific endpoints for different Datadog services
// This follows Datadog's recommended approach for configuring regional endpoints
const DD_LOGS_SITE = argv.logsSite || process.env.DD_LOGS_SITE || DD_SITE;
const DD_METRICS_SITE =
  argv.metricsSite || process.env.DD_METRICS_SITE || DD_SITE;

// Remove https:// prefix if it exists to prevent double prefix issues
const cleanupUrl = (url: string) =>
  url.startsWith("https://") ? url.substring(8) : url;

// Store clean values in process.env for backwards compatibility
process.env.DD_API_KEY = DD_API_KEY;
process.env.DD_APP_KEY = DD_APP_KEY;
process.env.DD_SITE = cleanupUrl(DD_SITE);
process.env.DD_LOGS_SITE = cleanupUrl(DD_LOGS_SITE);
process.env.DD_METRICS_SITE = cleanupUrl(DD_METRICS_SITE);

// Validate required environment variables
if (!DD_API_KEY) {
  console.error("Error: DD_API_KEY is required.");
  console.error("Please provide it via command line argument or .env file.");
  console.error(" Command line: --apiKey=your_api_key");
  process.exit(1);
}

if (!DD_APP_KEY) {
  console.error("Error: DD_APP_KEY is required.");
  console.error("Please provide it via command line argument or .env file.");
  console.error(" Command line: --appKey=your_app_key");
  process.exit(1);
}

// Initialize Datadog client tools
// We initialize each tool which will use the appropriate site configuration
getMonitors.initialize();
getMonitor.initialize();
getDashboards.initialize();
getDashboard.initialize();
getMetrics.initialize();
listMetrics.initialize();
getMetricMetadata.initialize();
getEvents.initialize();
getIncidents.initialize();
searchLogs.initialize();
aggregateLogs.initialize();

// Set up MCP server
const server = new McpServer({
  name: "datadog",
  version: "1.0.0",
  description:
    "MCP Server for Datadog API, enabling interaction with Datadog resources"
});

// Add tools individually, using their schemas directly
server.tool(
  "get-monitors",
  "Fetch monitors from Datadog with optional filtering. Use groupStates to filter by monitor status (e.g., 'alert', 'warn', 'no data'), groups to filter by evaluation groups, monitorTags to filter by tag criteria, withDowntimes to include monitors with active downtimes and limit to control result size.",
  {
    groupStates: z.array(z.string()).optional(),
    groups: z.string().optional(),
    monitorTags: z.string().optional(),
    withDowntimes: z.boolean().optional(),
    limit: z.number().default(10000)
  },
  async (args) => {
    const result = await getMonitors.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-monitor",
  "Get detailed information about a specific Datadog monitor by its ID. Use this to retrieve the complete configuration, status, and other details of a single monitor.",
  {
    monitorId: z.number()
  },
  async (args) => {
    const result = await getMonitor.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-dashboards",
  "Retrieve a list of all dashboards from Datadog. Useful for discovering available dashboards and their IDs for further exploration.",
  {
    filterConfigured: z.boolean().optional(),
    limit: z.number().default(100)
  },
  async (args) => {
    const result = await getDashboards.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-dashboard",
  "Get the complete definition of a specific Datadog dashboard by its ID. Returns all widgets, layout, and configuration details.",
  {
    dashboardId: z.string()
  },
  async (args) => {
    const result = await getDashboard.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-metrics",
  "Query metrics data from Datadog. The q parameter is REQUIRED and must use Datadog query syntax: 'aggregation:metric.name{scope}' (e.g., 'avg:system.cpu.user{*}' or 'sum:kubernetes_state.deployment.replicas_ready{kube_namespace:production}'). Use from/to for custom time ranges (Unix timestamps), defaults to last hour. Essential for retrieving time-series data from Datadog.",
  {
    q: z.string(),
    from: z.number().optional(),
    to: z.number().optional(),
    resolution: z.number().optional()
  },
  async (args) => {
    const result = await getMetrics.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "list-metrics",
  "List available metrics from Datadog. Optionally use the q parameter to search for specific metrics matching a pattern. Helpful for discovering metrics to use in monitors or dashboards.",
  {
    q: z.string().optional()
  },
  async (args) => {
    const result = await listMetrics.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-metric-metadata",
  "Retrieve detailed metadata about a specific metric, including its type, description, unit, and other attributes. Use this to understand a metric's meaning and proper usage.",
  {
    metricName: z.string()
  },
  async (args) => {
    const result = await getMetricMetadata.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-events",
  "Search for events in Datadog within a specified time range. Events include deployments, alerts, comments, and other activities. Useful for correlating system behaviors with specific events.",
  {
    start: z.number(),
    end: z.number(),
    priority: z.enum(["normal", "low"]).optional(),
    sources: z.string().optional(),
    tags: z.string().optional(),
    unaggregated: z.boolean().optional(),
    excludeAggregation: z.boolean().optional(),
    limit: z.number().default(100)
  },
  async (args) => {
    const result = await getEvents.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-incidents",
  "List incidents from Datadog's incident management system. Can filter by active/archived status and use query strings to find specific incidents. Helpful for reviewing current or past incidents.",
  {
    includeArchived: z.boolean().optional(),
    pageSize: z.number().optional(),
    pageOffset: z.number().optional(),
    query: z.string().optional(),
    limit: z.number().default(100)
  },
  async (args) => {
    const result = await getIncidents.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "search-logs",
  "Search logs in Datadog with advanced filtering options. Use filter.query for search terms (e.g., 'service:web-app status:error'), from/to for time ranges (e.g., 'now-15m', 'now'), and sort to order results. Essential for investigating application issues.",
  {
    filter: z
      .object({
        query: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        indexes: z.array(z.string()).optional()
      })
      .optional(),
    sort: z.string().optional(),
    page: z
      .object({
        limit: z.number().optional(),
        cursor: z.string().optional()
      })
      .optional(),
    limit: z.number().default(100)
  },
  async (args) => {
    const result = await searchLogs.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "aggregate-logs",
  "Perform analytical queries and aggregations on log data. Essential for calculating metrics (count, avg, sum, etc.), grouping data by fields, and creating statistical summaries from logs. Use this when you need to analyze patterns or extract metrics from log data.",
  {
    filter: z
      .object({
        query: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        indexes: z.array(z.string()).optional()
      })
      .optional(),
    compute: z
      .array(
        z.object({
          aggregation: z.string(),
          metric: z.string().optional(),
          type: z.string().optional()
        })
      )
      .optional(),
    groupBy: z
      .array(
        z.object({
          facet: z.string(),
          limit: z.number().optional(),
          sort: z
            .object({
              aggregation: z.string(),
              order: z.string()
            })
            .optional()
        })
      )
      .optional(),
    options: z
      .object({
        timezone: z.string().optional()
      })
      .optional()
  },
  async (args) => {
    const result = await aggregateLogs.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

const app = express();
app.use(express.json());

// Store transports for each session type
const transports = {
  streamable: {} as Record<string, StreamableHTTPServerTransport>,
  sse: {} as Record<string, SSEServerTransport>
};

app.post('/streamable', async (req: Request, res: Response) => {
  // In stateless mode, create a new instance of transport and server for each request
  // to ensure complete isolation. A single instance would cause request ID collisions
  // when multiple clients connect concurrently.
  
  try {
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      console.log('Request closed');
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// SSE notifications not supported in stateless mode
app.get('/streamable', async (req: Request, res: Response) => {
  console.log('Received GET MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

// Session termination not needed in stateless mode
app.delete('/streamable', async (req: Request, res: Response) => {
  console.log('Received DELETE MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

// Legacy SSE endpoint for older clients
app.get('/sse', async (req, res) => {
  // Create SSE transport for legacy clients
  const transport = new SSEServerTransport('/messages', res);
  transports.sse[transport.sessionId] = transport;
  
  res.on("close", () => {
    delete transports.sse[transport.sessionId];
  });
  
  await server.connect(transport);
});

// Legacy message endpoint for older clients
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.sse[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

// Start the server
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});