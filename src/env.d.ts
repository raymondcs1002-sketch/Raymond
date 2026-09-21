/// <reference types="astro/client" />

import type { SiteContent } from "./lib/config";

declare global {
  namespace App {
    interface Locals {
      siteContent: SiteContent;
    }
  }
}
