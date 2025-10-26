import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAnalyticsStore } from "@/stores/analytics-store";
import { useMemoryStore } from "@/stores/memory-store";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/animations/page-transitions";

export function AnalyticsPage() {
  const { apiCalls, totalTokens, memoryGrowth } = useAnalyticsStore();
  const memories = useMemoryStore((state) => state.memories);

  const getSectorStats = () => {
    const stats: Record<string, number> = {};
    memories.forEach((mem) => {
      stats[mem.primary_sector] = (stats[mem.primary_sector] || 0) + 1;
    });
    return stats;
  };

  const getApiCallStats = () => {
    const stats: Record<string, number> = {};
    apiCalls.forEach((call) => {
      stats[call.endpoint] = (stats[call.endpoint] || 0) + 1;
    });
    return stats;
  };

  const sectorStats = getSectorStats();
  const apiCallStats = getApiCallStats();
  const avgSalience =
    memories.length > 0
      ? memories.reduce((sum, m) => sum + m.salience, 0) / memories.length
      : 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Analytics Dashboard
          </h2>
          <p className="text-muted-foreground">
            Token usage, API metrics, and memory analytics
          </p>
        </div>

        <StaggerContainer className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalTokens.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all API calls
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{apiCalls.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total requests made
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Salience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {avgSalience.toFixed(3)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Memory importance
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Memories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{memories.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  In all sectors
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sector Distribution</CardTitle>
              <CardDescription>Memory count by sector type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(sectorStats).map(([sector, count]) => {
                  const percentage = Math.round(
                    (count / memories.length) * 100,
                  );
                  return (
                    <div key={sector} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize font-medium">{sector}</span>
                        <span className="text-muted-foreground">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all progress-bar"
                          data-width={percentage}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Endpoint Usage</CardTitle>
              <CardDescription>Request count by endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(apiCallStats).map(([endpoint, count]) => (
                  <div
                    key={endpoint}
                    className="flex items-center justify-between"
                  >
                    <code className="text-xs bg-secondary px-2 py-1 rounded">
                      {endpoint}
                    </code>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
                {Object.keys(apiCallStats).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No API calls yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent API Calls</CardTitle>
            <CardDescription>
              Last 10 API requests with token usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {apiCalls
                .slice(-10)
                .reverse()
                .map((call, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-secondary px-2 py-1 rounded">
                          {call.endpoint}
                        </code>
                        <Badge
                          variant={call.success ? "default" : "destructive"}
                        >
                          {call.success ? "Success" : "Failed"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(call.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {call.tokens} tokens
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {call.duration}ms
                      </div>
                    </div>
                  </div>
                ))}
              {apiCalls.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No API calls recorded yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Memory Growth</CardTitle>
              <CardDescription>Memory additions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {memoryGrowth.slice(-7).map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{point.date}</span>
                    <span className="font-medium">{point.count} memories</span>
                  </div>
                ))}
                {memoryGrowth.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No growth data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token Usage Breakdown</CardTitle>
              <CardDescription>By operation type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["query", "add", "ingest", "reinforce"].map((operation) => {
                  const calls = apiCalls.filter((c) =>
                    c.endpoint.includes(operation),
                  );
                  const tokens = calls.reduce(
                    (sum, c) => sum + (c.tokens || 0),
                    0,
                  );
                  return (
                    <div
                      key={operation}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm capitalize">{operation}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {calls.length} calls
                        </span>
                        <Badge variant="secondary">{tokens} tokens</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
