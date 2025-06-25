import { client, v1 } from "@datadog/datadog-api-client";

type ListMetricsParams = {
  q?: string;
};

let configuration: client.Configuration;

export const listMetrics = {
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

  execute: async (params: ListMetricsParams) => {
    try {
        const { q } = params;

        const apiInstance = new v1.MetricsApi(configuration);
  
        const queryStr = q || "*";
  
        const apiParams: v1.MetricsApiListMetricsRequest = {
          q: queryStr
        };
  
        const response = await apiInstance.listMetrics(apiParams);
        return response;
      } catch (error) {
        console.error("Error fetching metrics:", error);
        throw error;
      }
  }
}; 