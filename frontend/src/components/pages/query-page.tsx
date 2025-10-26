import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { openMemoryClient } from "@/lib/api-client";
import type { QueryResult } from "@/lib/schemas";
import { toast } from "sonner";
import {
  PageTransition,
  FadeIn,
  StaggerContainer,
} from "@/components/animations/page-transitions";

export function QueryPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(8);
  const [minScore, setMinScore] = useState(0.3);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queryTime, setQueryTime] = useState(0);

  const handleQuery = async () => {
    if (!query.trim()) {
      toast.error("Please enter a query");
      return;
    }

    setIsLoading(true);
    const startTime = performance.now();

    try {
      const response = await openMemoryClient.queryMemories({
        query,
        k: topK,
        filters: { min_score: minScore },
      });

      const endTime = performance.now();
      setQueryTime(endTime - startTime);
      setResults(response.matches);
      toast.success(`Found ${response.matches.length} matching memories`);
    } catch (error) {
      toast.error("Query failed");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Query Memories</h2>
          <p className="text-muted-foreground">
            Search memories using semantic similarity
          </p>
        </div>

        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle>Query Parameters</CardTitle>
              <CardDescription>Configure your search query</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="query">Query</Label>
                <Input
                  id="query"
                  placeholder="Enter your search query..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                />
              </div>

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Top K Results: {topK}</Label>
                  <Slider
                    value={[topK]}
                    onValueChange={([value]) => setTopK(value)}
                    min={1}
                    max={50}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Min Score: {minScore.toFixed(2)}</Label>
                  <Slider
                    value={[minScore]}
                    onValueChange={([value]) => setMinScore(value)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
              </div>

              <Button
                onClick={handleQuery}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Searching..." : "Execute Query"}
              </Button>
            </CardContent>
          </Card>
        </FadeIn>

        {results.length > 0 && (
          <StaggerContainer>
            <Card>
              <CardHeader>
                <CardTitle>Results ({results.length})</CardTitle>
                <CardDescription>
                  Query completed in {queryTime.toFixed(2)}ms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {results.map((result, index) => (
                    <Card key={result.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">
                              Result #{index + 1}
                            </CardTitle>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="capitalize">
                                {result.primary_sector}
                              </Badge>
                              <Badge variant="secondary">
                                Score: {result.score.toFixed(3)}
                              </Badge>
                              <Badge variant="secondary">
                                Salience: {result.salience.toFixed(3)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{result.content}</p>
                        {result.path && result.path.length > 0 && (
                          <div className="mt-4">
                            <Label className="text-xs text-muted-foreground">
                              Path ({result.hops} hops):
                            </Label>
                            <p className="text-xs mt-1 font-mono">
                              {result.path.join(" → ")}
                            </p>
                          </div>
                        )}
                        <div className="mt-4 text-xs text-muted-foreground">
                          ID: {result.id} • Last seen:{" "}
                          {formatDate(result.last_seen_at)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </StaggerContainer>
        )}

        {!isLoading && results.length === 0 && (
          <FadeIn delay={0.2}>
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No results yet. Enter a query and click "Execute Query" to
                search.
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  );
}
