import { permanentRedirect } from "next/navigation";
import { accountImportHref } from "@/components/workspace/resource-navigation";

/**
 * Legacy Import format-reference URL — moved with the Import UI under
 * Account Settings (issue #576). Permanent redirect source only.
 */
export default function LegacyImportFormatRedirect() {
  permanentRedirect(`${accountImportHref()}/format`);
}
