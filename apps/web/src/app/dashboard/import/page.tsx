import { permanentRedirect } from "next/navigation";
import { accountImportHref } from "@/components/workspace/resource-navigation";

/**
 * Legacy Import URL. The Import UI moved under Account Settings (issue #576,
 * ASR-8); this path only remains as a permanent redirect source.
 */
export default function LegacyImportRedirect() {
  permanentRedirect(accountImportHref());
}
