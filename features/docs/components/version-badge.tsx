import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function VersionBadge({ version }: { version: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge variant="outline" className="cursor-default">
              {version} (current)
            </Badge>
          }
        />
        <TooltipContent>
          Only {version} exists today — this badge is where a version switcher
          will appear once a later version ships.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
