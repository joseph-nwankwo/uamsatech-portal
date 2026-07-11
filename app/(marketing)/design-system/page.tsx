import type { Metadata } from "next";
import {
  Rocket,
  Search,
  Inbox,
  Loader2,
  Bell,
  Building2,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  H1,
  H2,
  H3,
  H4,
  Lead,
  P,
  Large,
  Small,
  Muted,
} from "@/components/ui/typography";
import { ShowcaseSection } from "@/features/design-system/components/showcase-section";
import { ColorSwatches } from "@/features/design-system/components/color-swatches";
import { PortalSidebarDemo } from "@/features/design-system/components/portal-sidebar-demo";
import { SignupsBarChart } from "@/components/charts/signups-bar-chart";
import { AdoptionLineChart } from "@/components/charts/adoption-line-chart";
import { signupsData, adoptionData } from "@/components/charts/chart-data";

export const metadata: Metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Badge variant="outline">Internal — not linked from public nav</Badge>
        <H1 className="mt-4 sm:text-4xl">UAMSATech Design System</H1>
        <Lead className="mt-3">
          Reference implementation of every shared UI primitive: colors,
          typography, and components. Built on shadcn/ui (Base UI) + Tailwind
          v4, brand tokens defined in <code>app/globals.css</code>.
        </Lead>
      </div>

      <ShowcaseSection
        title="Colors"
        description="Brand tokens, semantic tokens (light/dark aware), the validated chart categorical palette, and the fixed status palette."
      >
        <ColorSwatches />
      </ShowcaseSection>

      <ShowcaseSection
        title="Typography"
        description="Inter, a single consistent scale used across the site."
      >
        <div className="space-y-3">
          <H1>Heading 1</H1>
          <H2>Heading 2</H2>
          <H3>Heading 3</H3>
          <H4>Heading 4</H4>
          <Lead>Lead paragraph — used under page titles.</Lead>
          <P>Body paragraph — default reading text.</P>
          <Large>Large text — emphasis without a heading.</Large>
          <Small>Small text — labels, metadata.</Small>
          <Muted>Muted text — secondary/help copy.</Muted>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Buttons"
        description="Variants, sizes, and the shared loading state."
      >
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button className="bg-navy hover:bg-navy/90 text-white">
            Brand navy
          </Button>
          <Button className="bg-gold text-navy hover:bg-gold/90">
            Brand gold
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Search">
            <Search />
          </Button>
          <Button loading>Loading</Button>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Cards">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>LecturerCraft</CardTitle>
              <CardDescription>AI-powered teaching platform</CardDescription>
            </CardHeader>
            <CardContent>
              <P className="text-muted-foreground text-sm">
                Lecture notes, assignments, and exams generated with AI.
              </P>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="outline">
                Learn more
              </Button>
            </CardFooter>
          </Card>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Inputs"
        description="Text, textarea, select, checkbox, switch, radio."
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ds-name">Full name</Label>
            <Input id="ds-name" placeholder="Ada Lovelace" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-plan">Plan</Label>
            <Select defaultValue="institution">
              <SelectTrigger id="ds-plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="institution">Institution</SelectItem>
                <SelectItem value="standalone">
                  Standalone / Third-party
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ds-message">Message</Label>
            <Textarea
              id="ds-message"
              placeholder="Tell us about your institution..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-updates" defaultChecked />
            <Label htmlFor="ds-updates">Send me product updates</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ds-notify" defaultChecked />
            <Label htmlFor="ds-notify">Email notifications</Label>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Deployment</Label>
            <RadioGroup defaultValue="institution" className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="individual" id="ds-r1" />
                <Label htmlFor="ds-r1">Individual</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="institution" id="ds-r2" />
                <Label htmlFor="ds-r2">Institution</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Tables">
        <div className="border-border overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Audience</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-foreground font-medium">
                  UAMSA
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Universities
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-foreground font-medium">
                  LecturerCraft
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Lecturers
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Dialogs">
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline">Open dialog</Button>}
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request institutional demo</DialogTitle>
              <DialogDescription>
                We&apos;ll reach out within one business day to schedule a
                walkthrough.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="ds-dialog-email">Work email</Label>
              <Input
                id="ds-dialog-email"
                type="email"
                placeholder="you@university.edu"
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button className="bg-navy hover:bg-navy/90 text-white">
                Send request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ShowcaseSection>

      <ShowcaseSection
        title="Sidebars"
        description="Representative shell for the future customer portal (portal.uamsatech.com) — see docs/00-brand-product-strategy.md for the full IA."
      >
        <PortalSidebarDemo />
      </ShowcaseSection>

      <ShowcaseSection
        title="Navigation"
        description="The mega-menu pattern used in the live site header for Products."
      >
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-72 gap-1 p-2">
                  <NavigationMenuLink
                    render={
                      <a href="/solutions">
                        <Building2 className="size-4" />
                        <span>Universities</span>
                      </a>
                    }
                  />
                  <NavigationMenuLink
                    render={
                      <a href="/solutions">
                        <GraduationCap className="size-4" />
                        <span>Lecturers</span>
                      </a>
                    }
                  />
                  <NavigationMenuLink
                    render={
                      <a href="/solutions">
                        <BookOpen className="size-4" />
                        <span>Students &amp; Researchers</span>
                      </a>
                    }
                  />
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </ShowcaseSection>

      <ShowcaseSection
        title="Charts"
        description="Built on Recharts via shadcn's chart wrapper. Colors and CVD-safety validated with the dataviz skill's palette validator (see docs/02-design-system.md). Data below is illustrative, not live."
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <H4 className="mb-4">New signups by month</H4>
            <SignupsBarChart />
            <table className="text-muted-foreground mt-4 w-full text-left text-xs">
              <caption className="sr-only">
                New signups by month, table view
              </caption>
              <thead>
                <tr className="border-border border-b">
                  <th className="py-1.5 font-medium">Month</th>
                  <th className="py-1.5 font-medium">Signups</th>
                </tr>
              </thead>
              <tbody>
                {signupsData.map((row) => (
                  <tr key={row.month} className="border-border/60 border-b">
                    <td className="py-1.5">{row.month}</td>
                    <td className="py-1.5">{row.signups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <H4 className="mb-4">Product adoption</H4>
            <AdoptionLineChart />
            <table className="text-muted-foreground mt-4 w-full text-left text-xs">
              <caption className="sr-only">
                Product adoption by month, table view
              </caption>
              <thead>
                <tr className="border-border border-b">
                  <th className="py-1.5 font-medium">Month</th>
                  <th className="py-1.5 font-medium">LecturerCraft</th>
                  <th className="py-1.5 font-medium">ScholarCraft</th>
                </tr>
              </thead>
              <tbody>
                {adoptionData.map((row) => (
                  <tr key={row.month} className="border-border/60 border-b">
                    <td className="py-1.5">{row.month}</td>
                    <td className="py-1.5">{row.lecturercraft}</td>
                    <td className="py-1.5">{row.scholarcraft}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Badges">
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge className="bg-gold text-navy">Most popular</Badge>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Empty States">
        <EmptyState
          icon={Inbox}
          title="No support tickets yet"
          description="When a customer opens a ticket, it will show up here."
          action={<Button size="sm">New ticket</Button>}
        />
      </ShowcaseSection>

      <ShowcaseSection
        title="Loading States"
        description="Spinner via the Button loading prop, and a standalone spinner."
      >
        <div className="flex items-center gap-6">
          <Button loading>Saving</Button>
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<Bell className="text-muted-foreground size-5" />}
              />
              <TooltipContent>Notifications load lazily</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Skeletons">
        <div className="max-w-sm space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Animations"
        description="Shared Framer Motion presets in lib/motion.ts (fadeInUp, fadeIn, staggerContainer) — used on the Home hero."
      >
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <Rocket className="size-4" />
          See the Home page hero for the staggered fade-in-up entrance built
          from these presets.
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Icons"
        description="Lucide React, stroke-based, sized via Tailwind size-* utilities."
      >
        <div className="text-muted-foreground flex flex-wrap items-center gap-6">
          <Search className="size-4" />
          <Search className="size-5" />
          <Search className="size-6" />
          <Bell className="size-5" />
          <Inbox className="size-5" />
          <Rocket className="size-5" />
        </div>
      </ShowcaseSection>
    </div>
  );
}
