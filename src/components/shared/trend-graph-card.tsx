import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TrendGraphCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trend Graph</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {/* Graph will be implemented here */}
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Chart implementation is pending.</p>
        </div>
      </CardContent>
    </Card>
  );
}
