"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { mainNav, products, siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const secondaryNav = mainNav.filter((item) => item.title !== "Products");

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bg-navy flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
            U
          </span>
          <span className="text-lg">{siteConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Products</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[560px] grid-cols-2 gap-1 p-2">
                    {products.map((product) => (
                      <NavigationMenuLink
                        key={product.slug}
                        render={
                          <Link href={`/products/${product.slug}`}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-foreground font-medium">
                                {product.name}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {product.tagline}
                              </span>
                            </div>
                          </Link>
                        }
                      />
                    ))}
                    <NavigationMenuLink
                      className="border-border col-span-2 mt-1 justify-between border-t pt-3"
                      render={
                        <Link href="/products">
                          <span className="text-foreground font-medium">
                            View all products
                          </span>
                          <ArrowRight className="size-4" />
                        </Link>
                      }
                    />
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {secondaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors"
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" render={<Link href="/login">Sign in</Link>} />
          <Button
            className="bg-navy hover:bg-navy/90 text-white"
            render={<Link href="/signup">Get started</Link>}
          />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex items-center justify-between px-1 pt-2">
              <span className="font-semibold">{siteConfig.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </Button>
            </div>
            <nav className="mt-8 flex flex-col gap-1 px-1">
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm font-medium"
                >
                  {item.title}
                </Link>
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-2 px-1">
              <Button
                variant="outline"
                render={
                  <Link href="/login" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                }
              />
              <Button
                className="bg-navy hover:bg-navy/90 text-white"
                render={
                  <Link href="/signup" onClick={() => setOpen(false)}>
                    Get started
                  </Link>
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
