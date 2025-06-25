import { client, v1 } from "@datadog/datadog-api-client";

type GetMetricsParams = {
  q: string;
  from?: number;
  to?: number;
  resolution?: number;
};

let configuration: client.Configuration;

export const getMetrics = {
  initialize: () => {
    const configOpts = {
      authMethods: {
        apiKeyAuth: process.env.DD_API_KEY,
        appKeyAuth: process.env.DD_APP_KEY
      }
    };

    configuration = client.createConfiguration(configOpts);

    if (process.env.DD_METRICS_SITE) {
      configuration.setServerVariables({
        site: process.env.DD_METRICS_SITE
      });
    }
  },

  execute: async (params: GetMetricsParams) => {
    try {
      const { q, from, to, resolution } = params;
      const apiInstance = new v1.MetricsApi(configuration);
      
      if (!q) {
        throw new Error("Query parameter 'q' is required and must use Datadog syntax: 'aggregation:metric.name{scope}' (e.g., 'avg:system.cpu.user{*}')");
      }
      const queryStr = q;

      // Use provided time window or default to last 1 hour
      const currentTime = Math.floor(Date.now() / 1000);
      const fromTime = from || (currentTime - 3600); // Default: 1 hour ago
      const toTime = to || currentTime; // Default: now

      const apiParams: v1.MetricsApiQueryMetricsRequest = {
        from: fromTime,
        to: toTime,
        query: queryStr
      };

      if (resolution !== undefined) {
        (apiParams as any).resolution = resolution;
      }

      const response = await apiInstance.queryMetrics(apiParams);
      return response;
    } catch (error) {
      console.error("Error fetching metrics:", error);
      throw error;
    }
  }
};
