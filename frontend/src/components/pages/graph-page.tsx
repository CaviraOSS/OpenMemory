import { useEffect, useRef, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Edit, Trash2 } from "lucide-react";
import { useMemoryStore } from "@/stores/memory-store";
import type { Memory } from "@/lib/schemas";
import { PageTransition } from "@/components/animations/page-transitions";

interface GraphNode3D extends Memory {
  x: number;
  y: number;
  z: number;
  color: string;
  connections: string[]; // IDs of connected memories
}

interface Edge {
  from: string;
  to: string;
  strength: number;
}

const SECTOR_COLORS: Record<string, string> = {
  episodic: "#3b82f6",
  semantic: "#10b981",
  procedural: "#f59e0b",
  emotional: "#ef4444",
  reflective: "#8b5cf6",
};

const SECTOR_COLOR_CLASSES: Record<string, string> = {
  episodic: "bg-blue-500",
  semantic: "bg-emerald-500",
  procedural: "bg-amber-500",
  emotional: "bg-red-500",
  reflective: "bg-purple-500",
};

export function GraphPage() {
  const memories = useMemoryStore((state) => state.memories);
  const removeMemory = useMemoryStore((state) => state.removeMemory);
  const updateMemory = useMemoryStore((state) => state.updateMemory);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode3D[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode3D | null>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Filter and sort states
  const [filterSector, setFilterSector] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"salience" | "date" | "connections">(
    "salience",
  );

  const calculateSimilarity = useCallback(
    (mem1: Memory, mem2: Memory): number => {
      // Simple similarity based on sector and salience
      const sectorMatch = mem1.primary_sector === mem2.primary_sector ? 0.5 : 0;
      const salienceDiff = Math.abs(mem1.salience - mem2.salience);
      const salienceScore = Math.max(0, 1 - salienceDiff) * 0.5;
      return sectorMatch + salienceScore;
    },
    [],
  );

  // Filtered and sorted memories
  const filteredMemories = memories
    .filter((m) => {
      const sectorMatch =
        filterSector === "all" || m.primary_sector === filterSector;
      const searchMatch =
        searchQuery === "" ||
        m.content.toLowerCase().includes(searchQuery.toLowerCase());
      return sectorMatch && searchMatch;
    })
    .sort((a, b) => {
      if (sortBy === "salience") return b.salience - a.salience;
      if (sortBy === "date") return b.created_at - a.created_at;
      // For connections, we'll calculate after nodes are generated
      return 0;
    });

  const generateGraphData = useCallback(() => {
    // Use filtered memories instead of all memories
    const memoriesToGraph = filteredMemories;

    // Generate nodes with connections
    const graphNodes: GraphNode3D[] = memoriesToGraph.map((memory, index) => {
      const phi = Math.acos(-1 + (2 * index) / memoriesToGraph.length);
      const theta = Math.sqrt(memoriesToGraph.length * Math.PI) * phi;
      const radius = 300;

      // Find connected memories based on similarity
      const connections = memoriesToGraph
        .filter((m) => m.id !== memory.id)
        .map((m) => ({ id: m.id, similarity: calculateSimilarity(memory, m) }))
        .filter((c) => c.similarity > 0.6) // Only strong connections
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5) // Top 5 connections
        .map((c) => c.id);

      return {
        ...memory,
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi),
        color: SECTOR_COLORS[memory.primary_sector] || "#666",
        connections,
      };
    });

    // Sort by connections if needed
    if (sortBy === "connections") {
      graphNodes.sort((a, b) => b.connections.length - a.connections.length);
    }

    // Generate edges from connections
    const newEdges: Edge[] = [];
    graphNodes.forEach((node) => {
      node.connections.forEach((connId) => {
        const targetNode = graphNodes.find((n) => n.id === connId);
        if (targetNode) {
          const similarity = calculateSimilarity(node, targetNode);
          newEdges.push({
            from: node.id,
            to: connId,
            strength: similarity,
          });
        }
      });
    });

    setNodes(graphNodes);
    setEdges(newEdges);
  }, [filteredMemories, sortBy, calculateSimilarity]);

  const renderGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Draw mesh background
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;

    // Horizontal grid lines
    const gridSpacing = 50;
    for (let i = -300; i <= 300; i += gridSpacing) {
      const y1 = centerY + i;
      const y2 = centerY + i;
      ctx.beginPath();
      ctx.moveTo(centerX - 400, y1);
      ctx.lineTo(centerX + 400, y2);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = -400; i <= 400; i += gridSpacing) {
      const x1 = centerX + i;
      const x2 = centerX + i;
      ctx.beginPath();
      ctx.moveTo(x1, centerY - 300);
      ctx.lineTo(x2, centerY + 300);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Sort nodes by z-depth for proper rendering
    const sortedNodes = [...nodes].sort((a, b) => {
      const az = rotateZ(a, rotation.y);
      const bz = rotateZ(b, rotation.y);
      return az - bz;
    });

    // Draw edges between connected nodes
    ctx.globalAlpha = 0.2;
    edges.forEach((edge) => {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);

      if (!fromNode || !toNode) return;

      const fromRotatedX = rotateX(fromNode, rotation.y);
      const fromRotatedY = rotateY(fromNode, rotation.x);
      const fromRotatedZ = rotateZ(fromNode, rotation.y);

      const toRotatedX = rotateX(toNode, rotation.y);
      const toRotatedY = rotateY(toNode, rotation.x);
      const toRotatedZ = rotateZ(toNode, rotation.y);

      const fromScale = 800 / (800 + fromRotatedZ);
      const toScale = 800 / (800 + toRotatedZ);

      const fromX2d = centerX + fromRotatedX * fromScale;
      const fromY2d = centerY + fromRotatedY * fromScale;
      const toX2d = centerX + toRotatedX * toScale;
      const toY2d = centerY + toRotatedY * toScale;

      ctx.beginPath();
      ctx.moveTo(fromX2d, fromY2d);
      ctx.lineTo(toX2d, toY2d);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = edge.strength * 2;
      ctx.stroke();
    });

    ctx.globalAlpha = 1;

    // Draw nodes
    sortedNodes.forEach((node) => {
      const rotatedX = rotateX(node, rotation.y);
      const rotatedY = rotateY(node, rotation.x);
      const rotatedZ = rotateZ(node, rotation.y);

      const scale = 800 / (800 + rotatedZ);
      const x2d = centerX + rotatedX * scale;
      const y2d = centerY + rotatedY * scale;

      const radius = Math.max(3, 8 * node.salience * scale);

      // Draw node shadow for depth
      if (rotatedZ < 0) {
        ctx.beginPath();
        ctx.arc(x2d, y2d, radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();
      }

      // Draw node
      ctx.beginPath();
      ctx.arc(x2d, y2d, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = 0.7 + node.salience * 0.3;
      ctx.fill();

      // Node border
      if (rotatedZ > -100) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
      }

      // Highlight selected node
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1;
        ctx.stroke();

        // Draw connection indicators for selected node
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x2d, y2d, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = 1;
    });
  }, [nodes, edges, rotation, selectedNode]);

  useEffect(() => {
    if (filteredMemories.length > 0) {
      generateGraphData();
    }
  }, [filteredMemories, generateGraphData]);

  useEffect(() => {
    if (canvasRef.current && nodes.length > 0) {
      renderGraph();
    }
  }, [nodes, rotation, renderGraph]);

  const rotateX = (node: GraphNode3D, angleY: number) => {
    const rad = (angleY * Math.PI) / 180;
    return node.x * Math.cos(rad) - node.z * Math.sin(rad);
  };

  const rotateY = (node: GraphNode3D, angleX: number) => {
    const rad = (angleX * Math.PI) / 180;
    return node.y * Math.cos(rad) - node.z * Math.sin(rad);
  };

  const rotateZ = (node: GraphNode3D, angleY: number) => {
    const rad = (angleY * Math.PI) / 180;
    return node.x * Math.sin(rad) + node.z * Math.cos(rad);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;

    setRotation((prev) => ({
      x: (prev.x + deltaY * 0.5) % 360,
      y: (prev.y + deltaX * 0.5) % 360,
    }));

    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (const node of nodes) {
      const rotatedX = rotateX(node, rotation.y);
      const rotatedY = rotateY(node, rotation.x);
      const rotatedZ = rotateZ(node, rotation.y);

      const scale = 800 / (800 + rotatedZ);
      const x2d = centerX + rotatedX * scale;
      const y2d = centerY + rotatedY * scale;

      const distance = Math.sqrt((clickX - x2d) ** 2 + (clickY - y2d) ** 2);
      const radius = Math.max(3, 8 * node.salience * scale);

      if (distance < radius) {
        setSelectedNode(node);
        return;
      }
    }

    setSelectedNode(null);
  };

  const resetView = () => {
    setRotation({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  const handleEdit = () => {
    if (!selectedNode) return;
    setEditContent(selectedNode.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedNode) return;

    try {
      updateMemory(selectedNode.id, { content: editContent });
      setIsEditing(false);
      setEditContent("");
      // Refresh the selected node
      const updatedNode = nodes.find((n) => n.id === selectedNode.id);
      if (updatedNode) {
        setSelectedNode({ ...updatedNode, content: editContent });
      }
    } catch (error) {
      console.error("Failed to update memory:", error);
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedNode) return;

    try {
      removeMemory(selectedNode.id);
      setSelectedNode(null);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete memory:", error);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              3D Memory Graph
            </h2>
            <p className="text-muted-foreground">
              Interactive 3D visualization of memory latent space
            </p>
          </div>
          <Button onClick={resetView} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset View
          </Button>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Select value={filterSector} onValueChange={setFilterSector}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sectors</SelectItem>
              <SelectItem value="episodic">Episodic</SelectItem>
              <SelectItem value="semantic">Semantic</SelectItem>
              <SelectItem value="procedural">Procedural</SelectItem>
              <SelectItem value="emotional">Emotional</SelectItem>
              <SelectItem value="reflective">Reflective</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(v) =>
              setSortBy(v as "salience" | "date" | "connections")
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="salience">Salience</SelectItem>
              <SelectItem value="date">Date Created</SelectItem>
              <SelectItem value="connections">Connections</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary">
            {nodes.length} / {memories.length} memories
          </Badge>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nodes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rotation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                X: {rotation.x.toFixed(1)}° Y: {rotation.y.toFixed(1)}°
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {selectedNode ? "Node selected" : "None"}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>3D Visualization</CardTitle>
              <CardDescription>
                Drag to rotate • Click on nodes to select
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative bg-slate-950 rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full h-auto cursor-move"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={handleCanvasClick}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sector Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(SECTOR_COLORS).map(([sector]) => (
                  <div key={sector} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full ${SECTOR_COLOR_CLASSES[sector]}`}
                    />
                    <span className="text-sm capitalize">{sector}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {selectedNode && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Selected Memory</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleEdit}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <Badge variant="outline" className="capitalize">
                      {selectedNode.primary_sector}
                    </Badge>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            setEditContent("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">
                      {selectedNode.content.slice(0, 200)}...
                    </p>
                  )}

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>Salience: {selectedNode.salience.toFixed(3)}</div>
                    <div>Decay: {selectedNode.decay_lambda.toFixed(4)}</div>
                    <div>Connections: {selectedNode.connections.length}</div>
                    <div>ID: {selectedNode.id.slice(0, 8)}...</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Memory</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this memory? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageTransition>
  );
}
