'use client';

import { useMedias } from '@/contexts/media-context';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PageFiltersProps {
  selectedMedia: string;
  setSelectedMedia: (value: string) => void;
  selectedYear: number;
  setSelectedYear: (value: number) => void;
  selectedMonth: number;
  setSelectedMonth: (value: number) => void;
  isDailyView: boolean;
  setIsDailyView: (value: boolean) => void;
}

export function PageFilters({
  selectedMedia,
  setSelectedMedia,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  isDailyView,
  setIsDailyView,
}: PageFiltersProps) {
  const { medias, isLoading } = useMedias();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="media">Media</Label>
            <Select value={selectedMedia} onValueChange={setSelectedMedia} disabled={isLoading}>
              <SelectTrigger id="media">
                <SelectValue placeholder="Select Media" />
              </SelectTrigger>
              <SelectContent>
                {medias.map((media) => (
                  <SelectItem key={media.id} value={media.id}>
                    {media.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="fiscal-year">Fiscal Year</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger id="fiscal-year">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="month">Month</Label>
            <Select
              value={String(selectedMonth)}
              onValueChange={(value) => setSelectedMonth(Number(value))}
              disabled={!isDailyView}
            >
              <SelectTrigger id="month">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {[...Array(12)].map((_, i) => (
                  <SelectItem key={i + 1} value={`${i + 1}`}>
                    {i + 1}月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Switch
              id="view-toggle"
              checked={isDailyView}
              onCheckedChange={setIsDailyView}
            />
            <Label htmlFor="view-toggle">Daily View</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}