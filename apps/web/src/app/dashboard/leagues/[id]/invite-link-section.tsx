"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Link2, Trash2 } from "lucide-react";

export default function InviteLinkSection({ orgId }: { orgId: string }) {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orgs/${orgId}/invite-link`);
        if (res.ok) {
          const data = await res.json();
          setLinkUrl(data.url);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invite-link`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setLinkUrl(data.url);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    const res = await fetch(`/api/orgs/${orgId}/invite-link`, {
      method: "DELETE",
    });
    if (res.ok) {
      setLinkUrl(null);
    }
  }

  async function handleCopy() {
    if (!linkUrl) return;
    const fullUrl = `${window.location.origin}${linkUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading invite link...</p>;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Invite Link</h3>
      {linkUrl ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-gray-100 px-3 py-2 text-sm text-gray-700">
            {linkUrl}
          </code>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRevoke}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
          <Link2 className="h-4 w-4 mr-1" />
          {generating ? "Generating..." : "Generate Invite Link"}
        </Button>
      )}
    </div>
  );
}
